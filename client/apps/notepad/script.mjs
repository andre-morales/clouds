export default class NotepadApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// If notepad was launched with a path (opening a file)
		if (this.buildArgs.length > 0) {
			this.path = Paths.removeFSPrefix(this.buildArgs[0]);
		}
	
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/log128.png');
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

		// Fetch application body
		await this.window.setContentToUrl('/app/notepad/main.html');
		this.setDarkTheme(true);
		
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.unsavedChanges = true);
	
		let fileMenu = CtxMenu([
			CtxItem('Save', () => { this.save(); }),
			CtxItem('Save as...', () => { this.save(); }),
		
			CtxCheck('Dark theme', (v) => { 
				this.setDarkTheme(v);
			}, true),
			'-',
			CtxItem('Exit', () => { this.window.close(); })
		]);
	
		$app.find('.file-menu').click((ev) => {
			Client.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});
	
		// Load the text from the argument path (if present)
		if (this.path) {
			let text = await FileSystem.readText(this.path);
			this.$textArea.val(text);
		}

		// Make the window visible
		this.window.setVisible(true);
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
		
		this.window.setTitle(path);
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