import Dialogs from '/@sys/ui/dialogs.mjs';
import { Paths } from '/@sys/bridges/filesystem.mjs';
import Window from '/@sys/ui/window.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import App from '/@sys/app.mjs';

var Client: ClientClass;

export default class ConfigsApp extends App {
	window: Window;
	unsavedChanges: boolean;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
		this.window = null;
	}

	async init() {
		let self = this;

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setCloseBehavior('exit');
		this.window.setTitle('Configs');
		this.window.on('closing', (ev) => {
			if (this.unsavedChanges) {
				ev.cancel();

				let [win, choice] = Dialogs.showOptions(this, "Configuration", "Do you want to save your changes?", ['Yes', 'No', 'Cancel']);

				choice.then(async (v: number) => {
					switch(v) {
					// Yes
					case 0:
						this.unsavedChanges = false;
						Client.config.preferences.save();
						await Client.config.preferences.upload();
						this.window.close();
						break;
					// No
					case 1:
						Client.config.preferences.load();
						Client.desktop.reload();
						this.unsavedChanges = false;
						this.window.close();
						break;
					}
				});
			}
		});

		let $win = this.window.$window;
		let $app = $win.find('.window-body');
		$app.addClass('app-configs');

		// Fetch body
		await this.window.setContentToUrl('/app/configs/main.html');

		// Background
		let $input = $win.find('.background-input');
		$input.val(Client.config.preferences.background);
		$input.on('change', () => {
			Client.desktop.setBackground($input.val());
		});

		$win.find('.find').click(async () => {
			let app = await Client.runApp('explorer') as any;
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
		$fullscrFilter.prop("checked", Client.config.preferences.fullscreen_filter === false);
		$fullscrFilter.change(async function (){
			if (this.checked) {
				Client.config.preferences.fullscreen_filter = false;
			} else {
				Client.config.preferences.fullscreen_filter = true;
			}
			self.unsavedChanges = true;
		});

		// Fullscreen filter
		let $winContents = $win.find('.drag-contents-toggle');
		$winContents.prop("checked", Client.config.preferences.show_dragged_window_contents);
		$winContents.change(async function (){
			if (this.checked) {
				Client.config.preferences.show_dragged_window_contents = true;
			} else {
				Client.config.preferences.show_dragged_window_contents = false;
			}
			self.unsavedChanges = true;
		});

		// Fullscreen filter
		let $pdfViewer = $win.find('.use-pdf-viewer');
		$pdfViewer.prop("checked", Client.config.preferences.use_pdf_viewer);
		$pdfViewer.change(async function (){
			if (this.checked) {
				Client.config.preferences.use_pdf_viewer = true;
			} else {
				Client.config.preferences.use_pdf_viewer = false;
			}
			self.unsavedChanges = true;
		});

		let $usePWAFeatures = $win.find('.use-pwa-features');
		$usePWAFeatures.prop("checked", Client.config.preferences.use_pwa_features);
		$usePWAFeatures.change(async function (){
			if (this.checked) {
				Client.config.preferences.use_pwa_features = true;
			} else {
				Client.config.preferences.use_pwa_features = false;
			}
			self.unsavedChanges = true;
		});

		$win.find('.logout').click(() => {
			Client.logout();
		})

		$win.find('.reload').click(() => {
			Client.config.preferences.load();
			Client.desktop.reload();
			this.unsavedChanges = false;
		});

		$win.find('.save').click(async () => {
			Client.config.preferences.save();
			await Client.config.preferences.upload();
			this.unsavedChanges = false;
		});

		this.window.setVisible(true);
	}
}