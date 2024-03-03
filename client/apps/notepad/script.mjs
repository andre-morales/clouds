export default class NotepadApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Create window
		this.window = Client.desktop.createWindow(this);
		this.window.on('closing', (ev) => {
			if (!this.unsavedChanges) {
				this.exit();
				return;
			}

			let [win, promise] = Dialogs.showOptions(this, 'Notepad', 'Do you want to save before closing?', [
				"Save", "Don't save", "Cancel"]);
			
			promise.then(async (r) => {
				// Save clicked, if saved succesfully, close.
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
			this.setPath(Paths.removeFSPrefix(this.buildArgs[0]));
			fileTextProm = FileSystem.readText(this.path);
		}

		// Fetch application body
		await this.window.setContentToUrl('/app/notepad/main.html');
		this.setDarkTheme(true);
		
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.unsavedChanges = true);
	
		let fileMenu = CtxMenu([
			CtxItem('Open...', () => { this.open(); }),
			CtxItem('Save', () => { this.save(); }),
			CtxItem('Save as...', () => { this.saveAs(); }),
		
			CtxCheck('Dark theme', (v) => { 
				this.setDarkTheme(v);
			}, true),
			'-',
			CtxItem('Exit', () => { this.window.close(); })
		]);
	
		$app.find('.file-menu').click((ev) => {
			Client.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});
	
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

			// Save clicked, if saved succesfully, proceed with the open.
			if (btn == 0) {
				let saved = await this.save();
				if (!saved) return;
			}
		}

		// Choose file location
		let app = await Client.runApp('explorer');
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
		let app = await Client.runApp('explorer');
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
	
	setDarkTheme(v) {
		this.$app.toggleClass('dark', v);
	}
}