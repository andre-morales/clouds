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
		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setCloseBehavior('exit');
		this.window.setTitle('Configs');
		this.window.on('closing', (ev) => {
			if (this.unsavedChanges) {
				ev.cancel();

				let [choice] = Dialogs.showOptions(this, "Configuration", "Do you want to save your changes?", ['Yes', 'No', 'Cancel']);

				choice.then(async (v: number) => {
					switch(v) {
					// Yes
					case 0:
						this.unsavedChanges = false;
						Client.config.preferencesMgr.save();
						await Client.config.preferencesMgr.upload();
						this.window.close();
						break;
					// No
					case 1:
						Client.config.preferencesMgr.load();
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
		this.bindFieldToProp($input, 'background');

		$win.find('.find').click(async () => {
			let app = await Client.runApp('explorer') as any;
			app.asFileSelector('open', 'one');
			let result = await app.waitFileSelection();
			if (!result || !result.length) return;

			let file = Paths.toFSV(result[0]);
			$input.val(file).change();
		});

		let $fullscrFilter = $win.find('.fullscr-filter-toggle');
		this.bindCheckboxToProp($fullscrFilter, 'fullscreen_filter');	

		let $winContents = $win.find('.drag-contents-toggle');
		this.bindCheckboxToProp($winContents, 'show_dragged_window_contents');		

		let $usePWAFeatures = $win.find('.use-pwa-features');
		this.bindCheckboxToProp($usePWAFeatures, 'use_pwa_features');

		let $pdfViewer = $win.find('.pdf-viewer');
		this.bindFieldToProp($pdfViewer, 'pdf_viewer');

		$win.find('.logout').click(() => {
			Client.logout();
		})

		$win.find('.reload').click(() => {
			Client.config.preferencesMgr.load();
			this.unsavedChanges = false;
		});

		$win.find('.save').click(async () => {
			Client.config.preferencesMgr.save();
			await Client.config.preferencesMgr.upload();
			this.unsavedChanges = false;
		});

		this.window.setVisible(true);
	}

	/**
	 * Associates a field element with a string property in preferences configuration, making sure
	 * their states are synchronized with each other.
	 */
	bindFieldToProp($field: $Element, propertyName: string) {
		const config = ClientClass.get().config;

		$field.val(config.preferences[propertyName]);

		// Mirror field changes to the property
		$field.change(() => {
			config.preferences[propertyName] = $field.val();
			this.unsavedChanges = true;
		});

		// Watch the property for changes and modify our field accordingly
		let observer = config.preferencesMgr.observeChain([propertyName], (value) => {
			$field.val(value);
		});

		// Remove this observer when quitting the app
		this.on('exit', () => observer.destroy());
	}

	/**
	 * Associates a checkbox element with a boolean property in preferences configuration,
	 * making sure their states are synchronized with each other.
	 */
	bindCheckboxToProp($checkbox: $Element, propertyName: string) {
		const config = ClientClass.get().config;
		
		$checkbox.prop("checked", config.preferences[propertyName]);

		// Mirror checkbox changes to the property
		$checkbox.change(() => {
			config.preferences[propertyName] = $checkbox[0].checked;
			this.unsavedChanges = true;
		});

		// Watch the property for changes and modify our checkbox accordingly
		let observer = config.preferencesMgr.observeChain([propertyName], (value) => {
			$checkbox[0].checked = value;
		});

		// Remove this observer when quitting the app
		this.on('exit', () => observer.destroy());
	}
}