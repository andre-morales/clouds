export default class ExplorerDefaultHandler {
	constructor(explorer) {
		this.explorer = explorer;
	}

	async open(path) {
		this.window = Client.desktop.createWindow(this.explorer);
		
		await this.window.setContentToUrl('/app/explorer/res/default-handler-helper.html');
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
			this.explorer.openFileWith(path);
			this.window.close();
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
}