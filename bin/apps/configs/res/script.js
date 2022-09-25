window.ConfigsApp = class ConfigsApp extends App {
	constructor(webSys) {
		super(webSys);
		this.window = null;
	}

	async init() {
		// Require resources
		await this.requireStyle('/app/configs/res/style.css');

		// Create window and fetch app body
		this.window = webSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/config128.png';
		this.window.setHeight(200);
		this.window.setTitle('Configs');
		this.window.onCloseRequest = () => this.close();
		
		let $win = this.window.$window;
		$win.addClass('app-configs');

		// Fetch body
		await this.window.setContentToUrl('/app/configs/res/main.html');

		let $input = $win.find('input');
		$input.val(getCookie('bg'));
		$input.on('change', () => {
			setCookie('bg', $input.val());
			this._sys.desktop.setBackground($input.val());
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