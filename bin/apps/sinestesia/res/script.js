window.SinesApp = class SinesApp extends App {
	constructor() {
		super(arguments);
		
		this.window = null;
		this.$mediaElement = null;
		this.transform = {
			scale: 1, x: 0, y: 0, rotation: 0
		};
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
		$win.find('.window-body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/res/main.html');

		// Behaviour
		let ctxMenu = CtxMenu([
			CtxItem('Open...', () => this.showOpenDialog()),
			'-',
			CtxCheck('Lock playback', (v) => {
				this.lockedPlayback = v;
				this.cancelPauseEvents = v;
			}),
			CtxItem('Rotate right', () => {
				this.transform.rotation += 90;
				this.updateTransform();
			}),
			CtxItem('Rotate left', () => {
				this.transform.rotation -= 90;
				this.updateTransform();
			}),
			CtxCheck('Allow zoom/pan', (v) => {
				this.lockedZoomPan = !v;
			}, true),
			CtxItem('Reset transform', () => this.resetZoomPan()),
		]);
		WebSys.desktop.addCtxMenuOn($win.find('.window-body'), () => ctxMenu);

		// Video container behaviour
		let $videoc = $win.find('.video-container');
		let $video = $videoc.find('video');
		let video = $video[0];
		let $time = $videoc.find('.time');
		let $duration = $videoc.find('.duration');

		$win.find('.play-btn').click(() => {
			let el = this.$mediaElement[0];
			if (el.paused) {
				WebSys.audio.context.resume();
				el.play();
				
			} else {
				this.cancelPauseEvents = false;
				el.pause();
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
		$win.find('video').click(() => {
			$controls.toggleClass('visible');
		});
		
		let progressbarHeld = false;
		let $progressbar = $win.find('.progressbar');
		let $barThumb = $progressbar.find('.thumb');
		$progressbar.on('mousedown touchstart', () => {
			progressbarHeld = true;
		});
		$(document).on('mousemove', () => {
			if (!progressbarHeld) return;

			let t = $progressbar[0].value * $video[0].duration / 100.0;
			$barThumb.css('--time', `'${fnTimeAsString(t)}'`);
		});
		$(document).on('mouseup touchend', () => {
			if (!progressbarHeld) return;
			progressbarHeld = false;
			
			let time = $progressbar[0].value * $video[0].duration / 100.0;
			$video[0].currentTime = time;
			$barThumb.css('--time', null);
		});
		$video.on('loadedmetadata', function() {
			$duration.text(fnTimeAsString(this.duration));
			//this.playbackRate = 1.3;
			//this.preservesPitch = false;
		});
		$video.on("timeupdate", function() {
			if (progressbarHeld) return;
			let prog = this.currentTime / this.duration * 100;
			$progressbar[0].setValue(prog);

			$time.text(fnTimeAsString(this.currentTime));
		});
		$video.on('play', (ev) => {
			$videoc.addClass('playing');
		});
		$video.on('pause', (ev) => {
			if (this.cancelPauseEvents) {
				video.play();
			} else {
				$videoc.removeClass('playing');
			}
			if (this.lockedPlayback) this.cancelPauseEvents = true;
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

		if (this.buildArgs.length > 0) {
			this.playFile(this.buildArgs[0]);
		}
	}

	async showOpenDialog() {
		let app = await WebSys.runApp('explorer');
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result.length) return;

		let file = result[0];
		this.playFile('/fs/q' + file);
	}

	playFile(path) {
		let url = encodeURI(path);
		let $win = this.window.$window;

		let fname = path.replace(/\/+$/, ''); // Remove trailing slash
		fname = fname.slice(fname.lastIndexOf('/') + 1);
		this.window.setTitle(fname);
		
		$win.find('.contentw').removeClass('enabled');
		$win.find('.contentw.picture').empty();
		$win.find('.contentw.video video').empty();

		if (FileTypes.isPicture(path)) {
			this.openPicture(url);
		} else if (FileTypes.isVideo(path)) {
			this.openVideo(url);
		} else {
			this.openVideo(url);
		}
	}

	openPicture(url) {
		let $img = $(`<img src="${url}" draggable="false"></img>`);
		this.$mediaElement = $img;
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

		this.setupZoomPanGestures();
	}

	openVideo(url) {
		let $win = this.window.$window;

		let $video = $win.find('video');
		this.$mediaElement = $video;
		$video.append($(`<source src="${url}">`));

		let $container = $win.find('.contentw.video')
		$container.addClass('enabled');

		let track = WebSys.audio.context.createMediaElementSource($video[0]);
		track.connect(WebSys.audio.destination);

		this.setupZoomPanGestures();
	}

	updateTransform() {
		let t = this.transform;
		let css = `scale(${t.scale}) translate(${t.x}px, ${t.y}px) rotate(${t.rotation}deg)`;
		this.$mediaElement.css('transform', css);
	}

	setupZoomPanGestures() {
		let $el = this.$mediaElement;
		let trans = this.transform;
		
		let _lx = 0, _ly = 0;
		let _lscale = 1;
		
		let hammer = new Hammer.Manager($el[0], {
			recognizers: [
				[Hammer.Pinch, {}],
				[Hammer.Pan, {}]
			]
		});
		
		hammer.on('pinchstart', () => {
			_lscale = trans.scale;
		});
		hammer.on('pinch', (ev) => {
			if (this.lockedZoomPan) return;

			trans.scale = _lscale * ev.scale; 
			this.updateTransform();
		});

		hammer.on('panstart', () => {
			_lx = trans.x;
			_ly = trans.y;
		});
		hammer.on('pan', (ev) => {
			if (this.lockedZoomPan) return;

			trans.x = _lx + ev.deltaX / trans.scale;
			trans.y = _ly + ev.deltaY / trans.scale;
			this.updateTransform();
		});
	}

	resetZoomPan() {
		this.transform.x = 0;
		this.transform.y = 0;
		this.transform.scale = 1;	
		this.updateTransform();
	}

	onClose() {
		this.cancelPauseEvents = false;
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}