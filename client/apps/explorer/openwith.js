'use strict'

window.ExplorerOpenWith = class ExplorerOpenWith {
	constructor(explorer) {
		this.explorer = explorer;
	}

	async open(path) {
		this.window = WebSys.desktop.createWindow();
		this.window.on('closereq', () => this.window.close());
		
		await this.window.setContentToUrl('/app/explorer/res/openwith-helper.html');
		this.window.setTitle('Open: ' + path.substring(path.lastIndexOf('/') + 1));
		this.window.setSize(280, 280);
		this.window.bringToCenter();
		this.window.bringToFront();

		let $win = this.window.$window;
		$win.find('.window-body').addClass('openwith-helper');
		let $list = $win.find('ul');
		for (let [id, defs] of Object.entries(WebSys.registeredApps)) {
			if (!defs.flags.includes('tool')) continue;

			let $item = $(`<li>${defs.name}</li>`);
			$item.click(async () => {
				let app = await WebSys.runApp(id, ['/fs/q' + path]);
				if (app.window) {
					app.window.bringToFront();
					app.window.focus();
				}
				this.window.close();
			});
			$list.append($item);
		}

		this.window.setVisible(true);	
	}
}