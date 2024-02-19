window.SystemLogApp = class SystemLogApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow(this);
		this.window.setTitle('System Log');
		let $win = this.window.$window;

		// Fetch explorer body
		await this.window.setContentToUrl('/app/systemlog/main.html');

		this.logListener = WebSys.on('log', () => {
			this.updateLog();
		});

		this.updateLog();

		// Make the window visible
		this.window.setVisible(true);
	}

	updateLog() {
		let html = WebSys.logHistory.replaceAll('\n', '<br>');
		this.window.$window.find('.content').html(html);
	}

	onClose() {
		Client.off('log', this.logListener);
		this.window.close();
	}
}