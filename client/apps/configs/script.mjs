export default class ConfigsApp extends App {
	constructor(...args) {
		super(...args);
		this.window = null;
	}

	async init() {
		let self = this;

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		
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

			let file = Paths.toFSV(result[0]);
			$input.val(file);
			Client.desktop.setBackground(file);
			this.unsavedChanges = true;
		});

		// Fullscreen filter
		let $fullscrFilter = $win.find('.fullscr-filter-toggle');
		$fullscrFilter.prop("checked", Client.desktop.configs.fullscreen_filter === false);
		$fullscrFilter.change(async function (){
			if (this.checked) {
				Client.desktop.configs.fullscreen_filter = false;
			} else {
				Client.desktop.configs.fullscreen_filter = true;
			}
			self.unsavedChanges = true;
		});

		// Fullscreen filter
		let $winContents = $win.find('.drag-contents-toggle');
		$winContents.prop("checked", Client.desktop.configs.show_dragged_window_contents);
		$winContents.change(async function (){
			if (this.checked) {
				Client.desktop.configs.show_dragged_window_contents = true;
			} else {
				Client.desktop.configs.show_dragged_window_contents = false;
			}
			self.unsavedChanges = true;
		});

		// Logout
		$win.find('.logout').click(() => {
			Client.logout();
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

		this.window.setVisible(true);
	}
}