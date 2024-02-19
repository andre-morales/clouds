window.ConsoleApp = class ConsoleApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow(this);
		this.window.setTitle('Console');
		this.window.setCloseBehavior('exit');

		// Fetch explorer body
		await this.window.setContentToUrl('/app/console/main.html');
		let $app = this.window.$window.find('.window-body');
		$app.addClass('app-console');

		this.logListener = Client.on('log', () => {
			this.updateLog();
		});
		this.on('exit', () => {	
			Client.off('log', this.logListener);
		});

		this.updateLog();

		$app.find('.send-btn').click(() => {
			let cmd = $app.find('.cmd-field').val();
			Client.log("> " + cmd);
			let result = eval(cmd);
			Client.log("< " + JSON.stringify(result));
		});

		// Make the window visible
		this.window.setVisible(true);
	}

	updateLog() {
		if (this.disabled) return;

		try {
			let html = WebSys.logHistory.replaceAll('\n', '<br>');
			this.window.$window.find('.content').html(html);
		} catch (err) {
			this.disabled = true;
			throw new IllegalStateFault("Log updater failed. Logger disabled.", err);
		}
	}
}