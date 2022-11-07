window.SinesApp = class SinesApp extends App {
	constructor() {
		super();
		this.window = null;
	}

	async init() {
		let fnTimeAsString;

		// Require resources
		this.requireStyle('/app/sinestesia/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.setIcon('/res/img/apps/picture128.png');
		this.window.on('closereq', () => this.close());
		this.window.on('backnav', () => {
			if (this.fullscreen && Fullscreen.element == this.fullscreen) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.close();
			}
		});
		this.window.setTitle('Sinestesia');

		let $win = this.window.$window;
		$win.find('.body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/res/main.html');

		// Behaviour
		$win.find('.open-btn').click(async () => {
			let app = await WebSys.runApp('explorer');
			app.asFileSelector('open', 'one');
			let result = await app.waitFileSelection();
			if (!result.length) return;

			let file = result[0];
			this.playFile('/fs/q' + file);
		});

		// Video container behaviour
		let $videoc = $win.find('.video-container');
		let $video = $videoc.find('video');
		let $time = $videoc.find('.time');
		let $duration = $videoc.find('.duration');

		$win.find('.play-btn').click(() => {
			let el = this.mediaElement[0];
			if (el.paused) {
				el.play();
				$videoc.addClass('playing');
			} else {
				el.pause();
				$videoc.removeClass('playing');
			}
		});

		$videoc.dblclick(() => {
			if (Fullscreen.element == $videoc[0]) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.fullscreen = $videoc[0];
				Fullscreen.on($videoc[0]);
			}
		});

		let $controls = $win.find('.controls');
		$win.find('.controls .center').click(() => {
			$controls.toggleClass('visible');
		});
		
		let progressbarHeld = false;
		let $progressbar = $win.find('.progressbar');
		$progressbar.on('mousedown touchstart', () => {
			progressbarHeld = true;
		});
		$(document).on('mouseup touchend', () => {
			if (!progressbarHeld) return;
			progressbarHeld = false;
			
			let time = $progressbar[0].value * $video[0].duration / 100.0;
			$video[0].currentTime = time;
		});
		$video.on('loadedmetadata', function() {
			$duration.text(fnTimeAsString(this.duration));
		});
		$video.on("timeupdate", function() {
			if (progressbarHeld) return;
			let prog = this.currentTime / this.duration * 100;
			$progressbar[0].setValue(prog);

			$time.text(fnTimeAsString(this.currentTime));
		});
		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);

		prepareSliders();


		let fnTwo = (n) => {
			return n.toLocaleString(undefined, {
				minimumIntegerDigits: 2,
				useGrouping: false
			})
		}
		fnTimeAsString = (time) => {
			let hours = Math.floor(time / 60 / 60);
			let minutes = Math.floor(time / 60 - hours * 60);
			let seconds = Math.floor(time) % 60;

			let strSec = fnTwo(seconds);
			if (hours) {
				let strMin = fnTwo(minutes);
				return `${hours}:${strMin}:${strSec}`;
			} else {
				return `${minutes}:${strSec}`;
			}
		};
	}

	playFile(path) {
		let url = encodeURI(path);
		let $win = this.window.$window;

		let fname = path.replace(/\/+$/, ''); // Remove trailing slash
		fname = fname.slice(fname.lastIndexOf('/') + 1);
		this.window.setTitle(fname);
		
		$win.find('.contentw').removeClass('enabled');
		$win.find('.contentw.picture').empty();
		$win.find('.contentw.audio').empty();
		$win.find('.contentw.video video').empty();

		if (FileTypes.isPicture(path)) {
			this.openPicture(url);
		} else if (FileTypes.isVideo(path)) {
			this.openVideo(url);
		} else if (FileTypes.isAudio(path)) {
			let $audio = $('<audio controls></audio>');
			$audio.append($(`<source src="${url}">`));
	
			let $container = $win.find('.contentw.audio')
			$container.append($audio);
			$container.addClass('enabled');

			let track = WebSys.audio.context.createMediaElementSource($audio[0]);
			track.connect(WebSys.audio.destination);
		} else {
			WebSys.showErrorDialog('Unknown media type');
		}
	}

	openPicture(url) {
		let $img = $(`<img src="${url}" draggable="false"></img>`);
		$img.dblclick(() => {
			if (Fullscreen.element == $img[0]) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.fullscreen = $img[0];
				Fullscreen.on($img[0]);
			}
		});
		
		let $container = this.window.$window.find('.contentw.img')
		$container.append($img).addClass('enabled');
	}

	openVideo(url) {
		let $win = this.window.$window;

		let $video = $win.find('video');
		this.mediaElement = $video;
		$video.append($(`<source src="${url}">`));

		let $container = $win.find('.contentw.video')
		$container.addClass('enabled');

		let track = WebSys.audio.context.createMediaElementSource($video[0]);
		track.connect(WebSys.audio.destination);
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}