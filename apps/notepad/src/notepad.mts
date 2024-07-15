import Dialogs from '/@sys/ui/dialogs.mjs';
import { CtxCheckClass, CtxMenuClass } from '/@sys/ui/context_menu.mjs';
import { FileSystem, Paths } from '/@sys/bridges/filesystem.mjs';
import App from '/@sys/app.mjs';
import Window from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import { Editor } from './editor.mjs';

var Client: ClientClass;

interface Language {
	name: string;
	menuItem?: CtxCheckClass;
}

export default class NotepadApp extends App {
	window: Window = null;
	editor: Editor;
	unsavedChanges: boolean;
	path: string;
	syntaxViewMenu: CtxMenuClass;
	syntaxOptions: { [name: string]: Language };
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

			ev.cancel();
		});

		let $app = this.window.$window.find('.window-body').addClass('app-notepad');
		this.$app = $app;

		// If notepad was launched with a path (opening a file), load the text from the argument
		let fileTextProm: Promise<string>;
		if (this.buildArgs.length > 0) {
			this.setPath(Paths.removeFSPrefix(this.buildArgs[0] as string));
			fileTextProm = FileSystem.readText(this.path);
		}

		// Fetch application body
		await this.window.setContentToUrl('/app/notepad/main.html');
		
		// Instantiate editor
		this.editor = new Editor(this);

		// Query DOM elements
		this.$editor = $app.find('.editor');
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.unsavedChanges = true);
		
		// Create view menu options
		let viewMenu = CtxMenuClass.fromEntries([
			['*Line numbers', (v) => this.setLineNumbersVisible(v), { checked: true }],
			['*Wrap lines', (v) => this.editor.setLineWrapping(v)],
		]);
		this.syntaxViewMenu = new CtxMenuClass([], "Syntax");
		viewMenu.entries.push(this.syntaxViewMenu);

		$app.find('.view-menu').click((ev: MouseEvent) => {
			let bounds = (ev.target as HTMLElement).getBoundingClientRect();
			Client.desktop.openCtxMenuAt(viewMenu, bounds.left, bounds.bottom);
		});

		// Create file menu options
		$app.find('.file-menu').click((ev: MouseEvent) => {
			let fileMenu = CtxMenuClass.fromEntries([
				['-Open...', () => { this.open(); }],
				['-Save', () => { this.save(); }],
				['-Save as...', () => { this.saveAs(); }],
				['|'],
				['-Exit', () => { this.window.close(); }]
			]);

			let bounds = (ev.target as HTMLElement).getBoundingClientRect();
			Client.desktop.openCtxMenuAt(fileMenu, bounds.left, bounds.bottom);
		});
		
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
			'proto-asm': { name: 'Proto asm' }
		}
		this.#addSyntaxOptions();
		this.#setSyntax('plain');

		// Await for text content to arrive
		if (fileTextProm) {
			this.editor.setContent(await fileTextProm);
		}

		// Make the window visible
		this.window.setVisible(true);
	}

	setLineNumbersVisible(visible: boolean) {
		this.editor.$lineNumbers.toggleClass('d-none', !visible);
	}

	#addSyntaxOptions() {
		for (let [id, syn] of Object.entries(this.syntaxOptions)) {
			syn.menuItem = new CtxCheckClass(syn.name, () => this.#setSyntax(id), false);
			this.syntaxViewMenu.entries.push(syn.menuItem);
		}
	}

	#setSyntax(lang: string) {
		for (let entry of Object.values(this.syntaxOptions)) {
			entry.menuItem.checked = false;
		}

		this.syntaxOptions[lang].menuItem.checked = true;
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
		let text = await FileSystem.readText(this.path);

		this.editor.setContent(text);
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