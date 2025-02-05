import Dialogs from '/@sys/ui/dialogs.mjs';
import { ContextMenu } from '/@sys/ui/controls/context_menu/ctx_menu.mjs';
import { FileSystem, Paths } from '/@sys/bridges/filesystem.mjs';
import App from '/@sys/app.mjs';
import Window from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import { Editor } from './editor.mjs';
import { FindHelper } from './find.mjs';
import Deferred from '/@comm/deferred.mjs';
import ContextCheckbox from '/@sys/ui/controls/context_menu/ctx_checkbox.mjs';

const EXTENSION_SYNTAX_TABLE: {[key: string]: string} = {
	'txt': 'plain',
	'json': 'json'
};

var Client: ClientClass;

interface Language {
	name: string;
	menuItem?: ContextCheckbox;
}

export default class NotepadApp extends App {
	window: Window = null;
	editor: Editor;
	unsavedChanges: boolean;
	path: string;
	syntaxViewMenu: ContextMenu;
	syntaxOptions: { [name: string]: Language };
	findHelper: FindHelper;
	$app: $Element;
	$editor: $Element;
	$textArea: $Element;

	constructor(...args : ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
	}

	async init() {
		// Create window
		this.window = ClientClass.get().desktop.createWindow(this);
		this.window.setTitle('Notepad');
		this.window.on('closing', (ev) => {
			if (!this.unsavedChanges) {
				this.exit();
				return;
			}

			let [promise] = Dialogs.showOptions(this, 'Notepad', 'Do you want to save before closing?', [
				"Save", "Don't save", "Cancel"]);
			
			promise.then(async (r) => {
				// Save clicked, if saved successfully, close.
				if (r == 0) {
					let saved = await this.save();
					if (saved) {
						this.exit();	
					}	
				}

				// Don't save
				if (r == 1) this.exit();
			})

			ev.preventDefault();
		});

		let $app = this.window.$window.find('.window-body').addClass('app-notepad');
		this.$app = $app;

		// If notepad was launched with a path (opening a file), load the text from the argument
		let defaultSyntax = 'plain';
		let fileTextProm: Promise<string>;
		if (this.buildArgs.length > 0) {
			const pathArg = this.buildArgs[0] as string;

			let ext = Paths.getExtension(pathArg).toLowerCase();
			let syntax = EXTENSION_SYNTAX_TABLE[ext];
			if (syntax) defaultSyntax = syntax;

			this.setPath(Paths.removeFSPrefix(pathArg));
			fileTextProm = this.loadContent();
		}

		// Fetch application body
		await this.window.setContentToUrl('/app/notepad/pages/main.html');
		
		// Instantiate editor
		this.editor = new Editor(this);

		// Query DOM elements
		this.$editor = $app.find('.editor');
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.unsavedChanges = true);
		
		this.#initMenuBar();
		
		// Zoom on Ctrl + Mouse wheel
		this.$textArea.on('wheel', (ev: WheelEvent) => {
			if (!ev.ctrlKey) return;
			
			let scale = ev.deltaY / 100.0;
			this.editor.setFontSize(this.editor.fontSize - scale);

			ev.preventDefault();
		});

		// Initialize possible syntaxes
		this.syntaxOptions = {
			'plain': { name: 'Plain text' },
			'json': { name: "JSON" }
		}
		this.#addSyntaxOptions();
		this.#setSyntax(defaultSyntax);

		// Await for text content to arrive
		if (fileTextProm) {
			this.editor.setContent(await fileTextProm);
		}

		// Make the window visible
		this.window.setVisible(true);
	}

	#initMenuBar() {
		let $app = this.$app;

		// Create file menu options
		$app.find('.file-menu').click((ev: MouseEvent) => {
			let fileMenu = ContextMenu.fromDefinition([
				['-Open...', () => { this.open(); }],
				['-Save', () => { this.save(); }],
				['-Save as...', () => { this.saveAs(); }],
				['|'],
				['-Exit', () => { this.window.close(); }]
			]);

			let bounds = (ev.target as HTMLElement).getBoundingClientRect();
			Client.desktop.openCtxMenuAt(fileMenu, bounds.left, bounds.bottom);
		});

		// Edit menu
		$app.find('.edit-menu').click((ev: MouseEvent) => {
			let menu = ContextMenu.fromDefinition([
				['-Find...', () => { this.openFindWindow(); }],
			]);

			let bounds = (ev.target as HTMLElement).getBoundingClientRect();
			Client.desktop.openCtxMenuAt(menu, bounds.left, bounds.bottom);
		});

		// Create view menu options
		let viewMenu = ContextMenu.fromDefinition([
			['*Line numbers', (v: boolean) => this.setLineNumbersVisible(v), { checked: true }],
			['*Wrap lines', (v: boolean) => this.editor.setLineWrapping(v)],
		]);
		this.syntaxViewMenu = new ContextMenu([], "Syntax");
		viewMenu.addItem(this.syntaxViewMenu);

		$app.find('.view-menu').click((ev: MouseEvent) => {
			let bounds = (ev.target as HTMLElement).getBoundingClientRect();
			Client.desktop.openCtxMenuAt(viewMenu, bounds.left, bounds.bottom);
		});
	}

	async openFindWindow() {
		if (!this.findHelper) {
			this.findHelper = new FindHelper(this);
			await this.findHelper.init();
		}

		this.findHelper.show();
	}

	setLineNumbersVisible(visible: boolean) {
		this.editor.$lineNumbers.toggleClass('d-none', !visible);
	}

	#addSyntaxOptions() {
		for (let [id, syn] of Object.entries(this.syntaxOptions)) {
			syn.menuItem = new ContextCheckbox(syn.name, () => this.#setSyntax(id), false);
			this.syntaxViewMenu.addItem(syn.menuItem);
		}
	}

	#setSyntax(lang: string) {
		for (let entry of Object.values(this.syntaxOptions)) {
			entry.menuItem.setChecked(false);
		}

		this.syntaxOptions[lang].menuItem.setChecked(true);
		this.editor.setLanguage(lang);
	}

	async open() {
		if (this.unsavedChanges) {
			let [promise] = Dialogs.showOptions(this, 'Notepad', 'Do you want to save your changes', [
				"Save", "Don't save", "Cancel"]);

			let btn = await promise;

			// If cancel or close was clicked, don't do anything
			if (btn == -1 || btn == 2) return;

			// Save clicked, if saved successfully, proceed with the open.
			if (btn == 0) {
				let saved = await this.save();
				if (!saved) return;
			}
		}

		// Choose file location
		let app = await Client.runApp('explorer') as any;
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		
		// No path chosen, cancel open
		if (!result || !result.length) return;
		
		// A path was chosen, set it and load the text
		this.setPath(result[0]);
		
		let text = await this.loadContent();
		this.editor.setContent(text);
	}

	async loadContent(): Promise<string> {
		const charset = 'utf-8';

		// Load file content
		let blob = await FileSystem.readBlob(this.path);

		// Read blob as text using the specified charset
		let deferred = new Deferred();
		let reader = new FileReader();
		reader.onload = () => {
			deferred.resolve(reader.result);
		};
		reader.onerror = () => {
			deferred.reject('Failed to read blob as text');
		};
		reader.readAsText(blob, charset);
		
		// Await text decoding
		let result = await deferred.promise;
		return result;
	}

	async save() {
		// If notepad hasn't set a path, invoke saveAs();
		if (!this.path) {
			return await this.saveAs();
		}
		
		// Otherwise, just upload the current content
		await this.upload();	
		return true;
	}
	
	async saveAs() {
		// Choose file location
		let app = await Client.runApp('explorer') as any;
		app.asFileSelector('save', 'one');
		
		let result = await app.waitFileSelection();
		
		// No path chosen, cancel save
		if (!result || !result.length) return false;
		
		// A path was chosen, set it and save the file
		this.setPath(result[0]);
		this.upload();
		return true;
	}
	
	setPath(path: string) {
		this.path = path;
		this.window.setTitle(Paths.file(path) + ': Notepad');
	}
	
	async upload() {
		try {
			await FileSystem.writeText(this.path, this.$textArea.val());
			this.unsavedChanges = false;
		} catch (err) {
			throw err;
		}
	}
}