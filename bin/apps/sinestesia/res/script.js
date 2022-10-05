window.SinesApp = class SinesApp extends App {
	constructor(webSys) {
		super(webSys);
		this.window = null;
	}

	async init() {
		// Require resources
		this.requireStyle('/app/sinestesia/res/style.css');

		// Create window and fetch app body
		this.window = webSys.desktop.createWindow();
		this.window.icon = '/res/img/apps/picture128.png';
		this.window.on('closereq', () => this.close());
		
		this.window.setTitle('Sinestesia');
		let $win = this.window.$window;
		$win.find('.body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/res/main.html');

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
	}

	playFile(path) {
		let url = encodeURI(path);
		let $win = this.window.$window;
		let $content = $win.find('.content');

		let fname = path;
		if (path.endsWith('/')) fname = path.slice(0, -1)

		fname = fname.slice(fname.lastIndexOf('/') + 1);
		this.window.setTitle(fname);
		
		if (FileTypes.isVideo(path)) {
			let $video = $('<video controls></video>');
			$video.append($(`<source src="${url}">`));
			$content.empty();
			$content.append($video);

			let track = webSys.audioContext.createMediaElementSource($video[0]);
			track.connect(webSys.audioDestination);
			webSys.audioContext.resume();

		} else if (FileTypes.isPicture(path)) {
			let $img = $(`<img src="${url}"></img>`);
			$content.empty();
			$content.append($img);
		} else if (FileTypes.isAudio(path)) {
			let $audio = $('<audio controls></audio>');
			$audio.append($(`<source src="${url}">`));
			$content.empty();
			$content.append($audio);

			let track = webSys.audioContext.createMediaElementSource($audio[0]);
			track.connect(webSys.audioDestination);
			webSys.audioContext.resume();
		} else {
			webSys.showErrorDialog('Unknown media type');
		}
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}