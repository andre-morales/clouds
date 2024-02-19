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
		
		let $win = this.window.$window;
		$win.addClass('app-configs');

		// Fetch body
		await this.window.setContentToUrl('/app/configs/main.html');

		// Background
		let $input = $win.find('input');
		$input.val(Client.desktop.configs.background);
		$input.on('change', () => {
			Client.desktop.setBackground($input.val(), true);
		});

		$win.find('.find').click(async () => {
			let app = await Client.runApp('explorer');
			app.asFileSelector('open', 'one');
			let result = await app.waitFileSelection();
			if (!result || !result.length) return;

			let file = '/fs/q' + result[0];
			$input.val(file);
			Client.desktop.setBackground(file, true);
		});

		// Logout
		$win.find('.logout').click(() => {
			authLogout();
			window.location.href = "/";
		})

		// Make the window visible
		this.window.setVisible(true);
	}
}