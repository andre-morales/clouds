import { Paths } from '/res/js/filesystem.mjs';

export default class ExplorerDefaultHandler {
	constructor(explorer) {
		this.explorer = explorer;
		this.window = null;
	}

	async open(path) {
		this.window = Client.desktop.createWindow(this.explorer);
		
		await this.window.setContentToUrl('/app/explorer/res/open-handler-win.html');
		this.window.setTitle('Open file');
		
		this.window.bringToFront();

		let $win = this.window.$window;
		let $body = $win.find('.window-body');
		$body.addClass('default-handler-helper');
		
		// If the file has an extension, put in the message.
		// Otherwise, hide the first part of the message.
		let fileExtI = path.lastIndexOf('.');
		if (fileExtI != -1) {
			$body.find('.ext').text(path.substring(fileExtI + 1));
		} else {
			$body.find('.ext-text').css('display', 'none');
		}
		
		let fileName = path.substring(path.lastIndexOf('/') + 1);
		$body.find('.filename').text(fileName);

		// Action handlers
		$body.find('.open-with-option').click(() => {
			this.window.close();
			this.openFileWith(path);
		});

		$body.find('.open-ext-option').click(() => {
			this.explorer.openFileExt(path);
			this.window.close();
		});

		$body.find('.download-option').click(() => {
			Client.downloadUrl(Paths.toFSV(path));
			this.window.close();
		});

		this.window.setInitialPosition('center');
		this.window.setVisible(true);
	}

	async openFileWith(path) {
		const win = Client.desktop.createWindow(this.explorer);
		const $win = win.$window;

		await win.setContentToUrl('/app/explorer/res/open-with-win.html');
		win.setTitle('Open: ' + path.substring(path.lastIndexOf('/') + 1));
		win.setSize(280, 280);
		win.bringToCenter();
		win.bringToFront();

		$win.find('.window-body').addClass('openwith-helper');
		let $list = $win.find('ul');
		for (let [id, defs] of Object.entries(Client.registeredApps)) {
			if (!defs.flags.includes('tool')) continue;

			let $item = $(`<li>${defs.name}</li>`);
			$item.click(async () => {
				let app = await Client.runApp(id, [Paths.toFSV(path)]);
				if (app.window) {
					app.window.bringToFront();
					app.window.focus();
				}
				win.close();
			});
			$list.append($item);
		}

		win.setVisible(true);	
	}
}