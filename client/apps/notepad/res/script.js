window.NotepadApp = class NotepadApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// If notepad was launched with a path (opening a file)
		if (this.buildArgs.length > 0) {
			this.path = this.buildArgs[0].substring('/fs/q'.length);
		}
	
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/log128.png');
		this.window.on('closing', (ev) => {
			if (!this.edited) {
				this.exit();
				return;
			}

			let [win, promise] = Dialogs.showOptions('Notepad', 'Do you want to save?', [
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
		await this.window.setContentToUrl('/app/notepad/res/main.html');
		this.setDarkTheme(true);
		
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.edited = true);
	
		let fileMenu = CtxMenu([
			CtxItem('Save...', () => { this.save(); }),
			CtxItem('Save as...', () => { this.save(); }),
		
			CtxCheck('Dark theme', (v) => { 
				this.setDarkTheme(v);
			}, true),
			'-',
			CtxItem('Exit', () => { this.window.fire('closereq'); })
		]);
	
		$app.find('.file-menu').click((ev) => {
			WebSys.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});
	
		// Load the text from the argument path (if present)
		if (this.path) {
			let freq = await fetch('/fs/q' + this.path);
			let text = await freq.text();
			this.$textArea.val(text);
		}

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
	}

	async save() {
		// If notepad was opening a file, save it
		if (this.path) {
			this.upload();
			return true;
		}
		
		// Otherwise, let the user choose where to save the file and give it a name
		let app = await WebSys.runApp('explorer');
		app.asFileSelector('save', 'one');
		
		let result = await app.waitFileSelection();
		
		// No path chosen, cancel save
		if (!result || !result.length) return false;
		
		// A path was chosen, set it and save the file
		this.setPath(result[0]);
		this.upload();
		return true;
	}
	
	async saveAs() {
		// Choose file location
		let app = await WebSys.runApp('explorer');
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
	
	upload() {
		fetch('/fs/ud' + this.path, {
			method: 'POST',
			body: this.$textArea.val(),
			headers: {
				'Content-Type': 'text/plain'
			}
		})
	}
	
	setDarkTheme(v) {
		this.$app.toggleClass('dark', v);
	}
	
	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}