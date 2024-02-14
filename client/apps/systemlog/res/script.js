window.SystemLogApp = class SystemLogApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Require resources
		await this.requireStyle('/app/systemlog/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/log128.png');
		this.window.on('closereq', () => this.close());
		
		this.window.setTitle('System Log');
		let $win = this.window.$window;

		// Fetch explorer body
		await this.window.setContentToUrl('/app/systemlog/res/main.html');

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
		WebSys.off('log', this.logListener);
		this.window.close();
	}
}