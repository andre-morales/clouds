window.SystemLogApp = class SystemLogApp extends App {
	constructor(webSys) {
		super(webSys);
		this.window = null;
	}

	async init() {
		// Require resources
		await this.requireStyle('/app/systemlog/res/style.css');

		// Create window and fetch app body
		this.window = webSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/log128.png';
		this.window.onCloseRequest = () => this.close();
		
		this.window.setTitle('System Log');
		let $win = this.window.$window;

		// Fetch explorer body
		await this.window.setContentToUrl('/app/systemlog/res/main.html');

		this.logListener = this._sys.addLogListener(() => {
			this.updateLog();
		});

		this.updateLog();

		// Make the window visible
		this.window.setVisible(true);
	}

	updateLog() {
		let html = this._sys.logHistory.replaceAll('\n', '<br>');
		this.window.$window.find('.content').html(html);
	}

	onClose() {
		this._sys.removeLogListener(this.logListener);
		this.window.close();
	}
}