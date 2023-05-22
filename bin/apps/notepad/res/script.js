window.NotepadApp = class NotepadApp extends App {
	constructor() {
		super(arguments);
		this.window = null;
	}

	async init() {
		if (this.buildArgs.length > 0) {

			this.path = this.buildArgs[0].substring('/fs/q'.length);
		}

		// Require resources
		await this.requireStyle('/app/notepad/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.setIcon('/res/img/apps/log128.png');
		this.window.on('closereq', () => {
			if (!this.edited) {
				this.close();
				return;
			}

			let [win, promise] = Dialogs.showOptions('Notepad', 'Do you want to save?', [
				"Save", "Don't save", "Cancel"]);
			
			promise.then((r) => {
				// Save
				if (r == 0) {
					this.save();
					this.close();
				}

				// Don't save
				if (r == 1) this.close() // Don't save
			})
		});
		this.window.setTitle('Notepad');

		let $app = this.window.$window.find('.body');
		this.$app = $app;
		$app.addClass('app-notepad');

		// Fetch application body
		await this.window.setContentToUrl('/app/notepad/res/main.html');
		this.setDarkTheme(true);
		
		this.$textArea = $app.find('textarea');
		this.$textArea.on('change', () => this.edited = true);
	
		let fileMenu = CtxMenu([
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

	save() {
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