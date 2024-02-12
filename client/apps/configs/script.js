window.ConfigsApp = class ConfigsApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/config128.png');
		this.window.setHeight(200);
		this.window.setTitle('Configs');
		this.window.on('closereq', () => this.exit());
		
		let $win = this.window.$window;
		$win.addClass('app-configs');

		// Fetch body
		await this.window.setContentToUrl('/app/configs/main.html');

		let $input = $win.find('input');
		$input.val(WebSys.desktop.configs.background);
		$input.on('change', () => {
			WebSys.desktop.setBackground($input.val(), true);
		});

		$win.find('.find').click(async () => {
			let app = await WebSys.runApp('explorer');
			app.asFileSelector('open', 'one');
			let result = await app.waitFileSelection();
			if (!result || !result.length) return;

			let file = '/fs/q' + result[0];
			$input.val(file);
			WebSys.desktop.setBackground(file, true);
		});

		$win.find('.logout').click(() => {
			authLogout();
			window.location.href = "/";
		})

		// Make the window visible
		this.window.setVisible(true);
	}

	onClose() {
		this.window.close();
	}
}