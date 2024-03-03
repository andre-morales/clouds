export default class AboutApp extends App {
	constructor(...args) {
		super(...args);

		this.window = null;
	}

	async init() {
		this.window = Client.desktop.createWindow(this);
		this.window.setTitle('About');
		this.window.setSize(380, 360);
		let $app = this.window.$window.find('.window-body');
		$app.addClass('app-about');
		await this.window.setContentToUrl('/app/about/body.html');

		let clientStr = `Version ${Client.BUILD_STRING}`;
		$app.find('.version').text(clientStr);

		let serverStr = `KAPI ${Client.API_VERSION}`;
		$app.find('.api-version').text(serverStr);

		let userAgentStr = navigator.userAgent;
		$app.find('.user-agent').text("User Agent: " + userAgentStr);

		this.window.setVisible(true);
	}
}