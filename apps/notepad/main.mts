import Dialogs from '/@sys/ui/dialogs.mjs';
import { CtxMenuClass } from '/@sys/ui/context_menu.mjs';
import { FileSystem, Paths } from '/@sys/bridges/filesystem.mjs';
import App from '/@sys/app.mjs';
import Window from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';

var Client: ClientClass;

export default class NotepadApp extends App {
	window: Window = null;
	fontSize: number = 12;
	unsavedChanges: boolean;
	path: string;
	$app: $Element;
	$textArea: $Element;

	constructor(...args : ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
	}

	async init() {
		// Create window
		this.window = ClientClass.get().desktop.createWindow(this);
		this.window.on('closing', (ev) => {
			if (!this.unsavedChanges) {
				this.exit();
				return;
			}

			let [win, promise] = Dialogs.showOptions(this, 'Notepad', 'Do you want to save before closing?', [
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
				if (r == 1) this.exit() // Don't save
			})

			ev.cancel();
		});
		this.window.setTitle('Notepad');

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-notepad');

		// If notepad was launched with a path (opening a file)
		let fileTextProm;

		// Load the text from the argument path (if present)
		if (this.buildArgs.length > 0) {
			this.setPath(Paths.removeFSPrefix(this.buildArgs[0] as string));
			fileTextProm = FileSystem.readText(this.path);
		}

		// Fetch application body
		await this.window.setContentToUrl('/app/notepad/main.html');
		this.setDarkTheme(true);
		
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.unsavedChanges = true);
	
		let fileMenu = CtxMenuClass.fromEntries([
			['-Open...', () => { this.open(); }],
			['-Save', () => { this.save(); }],
			['-Save as...', () => { this.saveAs(); }],
		
			['*Dark theme', (v) => { 
				this.setDarkTheme(v);
			}, { checked: true } ],

			['|'],
			['-Exit', () => { this.window.close(); }]
		]);
	
		$app.find('.file-menu').click((ev: MouseEvent) => {
			Client.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});
		
		// Zoom on Ctrl + Mouse wheel
		this.$textArea.on('wheel', (ev: WheelEvent) => {
			if (!ev.ctrlKey) return;
			
			let scale = ev.deltaY / 100.0;
			this.setFontSize(this.fontSize - scale);

			ev.preventDefault();
		});

		/*let hammer = new Hammer.Manager(this.$textArea[0], {
			recognizers: [
				[Hammer.Pinch, {}]
			]
		});

		let beginZoom = this.fontSize;
		hammer.on('pinchstart', (ev) => {
			beginZoom = this.fontSize;
		});

		hammer.on('pinch', (ev) => {
			this.setFontSize(beginZoom * ev.scale);
		});*/

		// Await for text
		if (fileTextProm) {
			this.$textArea.val(await fileTextProm);
		}

		// Make the window visible
		this.window.setVisible(true);
	}

	async open() {
		if (this.unsavedChanges) {
			let [win, promise] = Dialogs.showOptions(this, 'Notepad', 'Do you want to save your changes', [
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
		this.$textArea.val(text);	
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
	
	setPath(path) {
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
	
	setFontSize(size) {
		if (size < 5) size = 5;
		if (size > 72) size = 72;

		this.fontSize = size;
		this.$textArea.css('font-size', size + 'pt');
	}

	setDarkTheme(v) {
		this.$app.toggleClass('dark', v);
	}
}