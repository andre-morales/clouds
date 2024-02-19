window.ConfigsApp = class ConfigsApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		let self = this;

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/config128.png');
		this.window.setHeight(240);
		this.window.setTitle('Configs');
		this.window.on('closing', (ev) => {
			if (this.unsavedChanges) {
				ev.cancel();

				let [win, choice] = Dialogs.showOptions(this, "Configuration", "Do you want to save your changes?", ['Yes', 'No', 'Cancel']);

				choice.then(async (v) => {
					switch(v) {
					case 0:
						this.unsavedChanges = false;
						await Client.desktop.saveConfigs();
						Client.desktop.loadConfigs();
						this.window.close();
						break;
					case 1:
						Client.desktop.loadConfigs();
						this.unsavedChanges = false;
						this.window.close();
						break;
					}
				});
			}
		});

		let $win = this.window.$window;
		$win.addClass('app-configs');

		// Fetch body
		await this.window.setContentToUrl('/app/configs/main.html');

		// Background
		let $input = $win.find('.background-input');
		$input.val(Client.desktop.configs.background);
		$input.on('change', () => {
			Client.desktop.setBackground($input.val());
		});

		$win.find('.find').click(async () => {
			let app = await Client.runApp('explorer');
			app.asFileSelector('open', 'one');
			let result = await app.waitFileSelection();
			if (!result || !result.length) return;

			let file = '/fs/q' + result[0];
			$input.val(file);
			Client.desktop.setBackground(file);
			this.unsavedChanges = true;
		});

		// Fullscreen filter
		let $fullscrFilter = $win.find('.fullscr-filter-toggle');
		$fullscrFilter.prop("checked", Client.desktop.configs['fullscreen-filter'] === false);
		$fullscrFilter.change(async function (){
			if (this.checked) {
				Client.desktop.configs['fullscreen-filter'] = false;
			} else {
				Client.desktop.configs['fullscreen-filter'] = true;
			}
			self.unsavedChanges = true;
		})

		// Logout
		$win.find('.logout').click(() => {
			authLogout();
			window.location.href = "/";
		})

		$win.find('.reload').click(() => {
			Client.desktop.loadConfigs();
			this.unsavedChanges = false;
		});

		$win.find('.save').click(async () => {
			await Client.desktop.saveConfigs();
			Client.desktop.loadConfigs();
			this.unsavedChanges = false;
		});

		// Make the window visible
		this.window.setVisible(true);
	}
}