window.WebViewApp = class WebViewApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setTitle('WebView');

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-webview');

		// Fetch application body
		await this.window.setContentToUrl('/app/webview/main.html');
		
		let fileMenu = CtxMenu([
			CtxItem('Open...', () => { this.showOpenDialog(); }),
			'-',
			CtxItem('Exit', () => { this.window.close(); })
		]);
	
		$app.find('.file-menu').click((ev) => {
			Client.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});

		this.$iframe = $app.find("iframe");

		this.window.setVisible(true);

		// If launched with a path (opening a file)
		if (this.buildArgs.length > 0) {
			this.setPath(this.buildArgs[0]);
		}
	}

	async showOpenDialog() {
		let app = await Client.runApp('explorer');
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let file = result[0];
		this.setPath(Paths.toFSV(file));
	}
	
	setPath(path) {
		this.path = path;
		if (!path) {
			this.window.setTitle('WebView');
			return;
		}

		this.window.setTitle(Paths.file(path));
		this.$iframe[0].src = path;
	}
		
	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}