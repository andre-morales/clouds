window.BrowserApp = class BrowserApp extends App {
	constructor() {
		super();
		this.window = null;
	}

	async init() {
		let self = this;

		// Require resources
		this.requireStyle('/app/browser/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.setIcon('/res/img/apps/browser128.png');
		this.window.on('closereq', () => this.close());
		this.window.setTitle('Browser');

		let $win = this.window.$window;
		let $app = $win.find('.body');
		$app.addClass('app-browser');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/browser/res/main.html');

		const proxyUrl = 'http://localhost:9201/';
		let $iframe = $app.find('iframe');
		let $input = $app.find('input');

		window.addEventListener('message', (ev) => {
			if (!ev.data.startsWith('Location:')) return;

			let fullUrl = ev.data.substring(ev.data.indexOf(':') + 1);
			let reflUrl = fullUrl.substring(proxyUrl.length);
			$input.val(reflUrl);
		});

		$input.on('change', () => {
			let url = $input.val();
			$iframe[0].src = proxyUrl + url;
		});

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}