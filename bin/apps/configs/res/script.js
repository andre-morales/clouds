window.ConfigsApp = class ConfigsApp extends App {
	constructor() {
		super();
		this.window = null;
	}

	async init() {
		// Require resources
		await this.requireStyle('/app/configs/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/config128.png';
		this.window.setHeight(200);
		this.window.setTitle('Configs');
		this.window.on('closereq', () => this.close());
		
		let $win = this.window.$window;
		$win.addClass('app-configs');

		// Fetch body
		await this.window.setContentToUrl('/app/configs/res/main.html');

		let $input = $win.find('input');
		$input.val(getCookie('bg'));
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