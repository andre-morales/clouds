window.WebViewApp = class WebViewApp extends App {
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
		this.window = WebSys.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/log128.png');
		this.window.on('closereq', () => this.close());
		this.window.setTitle('WebView');

		let $app = this.window.$window.find('.window-body');
		this.$app = $app;
		$app.addClass('app-webview');

		// Fetch application body
		await this.window.setContentToUrl('/app/webview/main.html');
		
		this.$iframe = $app.find("iframe");

		// Load the text from the argument path (if present)
		if (this.path) {
			//let freq = await fetch('/fs/q' + this.path);
			//let text = await freq.text();
			//this.$iframe.contents().find("html").html(text);
			this.$iframe[0].src = '/fs/q' + this.path;
		}

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
	}

	
	setPath(path) {
		this.path = path;
		
		this.window.setTitle(path);
	}
		
	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}