window.SinesApp = class SinesApp extends App {
	constructor(webSys) {
		super(webSys);
		this.window = null;
	}

	async init() {
		// Require resources
		await this.requireStyle('/app/sinestesia/res/style.css');

		// Create window and fetch app body
		this.window = webSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/picture128.png';
		this.window.onCloseRequest = () => this.close();
		
		this.window.setTitle('Sinestesia');
		let $win = this.window.$window;
		$win.find('.body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/res/main.html');

		// Make the window visible
		this.window.setVisible(true);
	}

	playFile(path) {
		let url = encodeURI(path);
		let $win = this.window.$window;
		let $content = $win.find('.content');

		if (path.endsWith('.mp4') || path.endsWith('.mkv') || path.endsWith('.webm')) {
			let $video = $('<video controls></video>');
			$video.append($(`<source src="${url}">`));
			$content.empty();
			$content.append($video);
		} else if (path.endsWith('.png') || path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.webp')) {
			let $img = $(`<img src="${url}"></video>`);
			$content.empty();
			$content.append($img);
		} else {
			webSys.showErrorDialog('Unknown media type');
		}
	}

	onClose() {
		this.window.close();
	}
}