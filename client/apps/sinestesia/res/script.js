window.SinesApp = class SinesApp extends App {
	constructor(...args) {
		super(...args);
		
		this.window = null;
		this.$mediaElement = null;
		this.$video = null;
		this.contentType = '';
		this.transform = {
			scale: 1, x: 0, y: 0, rotation: 0
		};
	}

	async init() {
		this.on('exit', () => {
			this.playlist = null;
			this.playlistI = 0;
			this.cancelPauseEvents = false;
			this.stop();
			this.saveAppWindowState(this.window);
		});

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow(this);
		this.window.setIcon('/res/img/apps/picture128.png');
		this.window.setDefaultCloseAction('exit');
		this.window.on('backnav', () => {
			if (this.fullscreen && Fullscreen.element == this.fullscreen) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.exit();
			}
		});
		this.window.setTitle('Sinestesia');

		let $win = this.window.$window;
		$win.find('.window-body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/res/main.html');

		// Behaviour
		this.createContextMenu();
		this.setupVideoContainer();

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);

		prepareSliders();

		if (this.buildArgs.length > 0) {
			this.openFile(this.buildArgs[0]);
		}
	}

	setupVideoContainer() {
		let fnTimeAsString;
		let progressbarHeld = false;

		let $win = this.window.$window;
		let $videoc = $win.find('.video-container');
		let $video = $videoc.find('video');
		this.$video = $video;
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

		$video.on('ended', (ev)=>{
			if (this.playlist) {
				this.playlistI++;
				this.openFile('/fs/q' + this.url + this.playlist[this.playlistI][0]);

				setTimeout(()=>{
					this.play();
				}, 100);
			}
		});

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

		let track = WebSys.audio.context.createMediaElementSource($video[0]);
		track.connect(WebSys.audio.destination);
	}

	createContextMenu() {
		let $win = this.window.$window;
		let ctxMenu = CtxMenu([
			CtxItem('Open...', () => this.showOpenDialog()),
			CtxItem('Open folder...', () => this.showOpenFolderDialog()),
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
			}, false),
			CtxItem('Reset transform', () => this.resetZoomPan()),
		]);
		WebSys.desktop.addCtxMenuOn($win.find('.window-body'), () => ctxMenu);
	}

	async showOpenDialog() {
		let app = await WebSys.runApp('explorer');
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let file = result[0];
		this.openFile('/fs/q' + file);
	}

	async showOpenFolderDialog() {
		let app = await WebSys.runApp('explorer');
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let folder = result[0];
		this.openFolder(folder);
	}

	openFile(path) {	
		// Set window title
		let fname = path.replace(/\/+$/, ''); // Remove trailing slash
		fname = fname.slice(fname.lastIndexOf('/') + 1);
		this.window.setTitle(fname);

		this.stop();

		// Judge filetype and play accordingly
		let url = encodeURI(path);
		if (FileTypes.isPicture(path)) {
			this.openPicture(url);
		} else if (FileTypes.isVideo(path)) {
			this.openVideo(url);
		} else {
			this.openVideo(url);
		}
	}

	async openFolder(url) {
		let fres = await fetch('/fs/ls' + url);
		if (fres.status != 200)  return;

		let files = await fres.json();

		this.playlist = files;
		this.playlistI = 0;
		this.url = url;
		this.openFile('/fs/q' + url + this.playlist[0][0]);
	}

	openPicture(url) {
		this.contentType = 'image';

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
		this.contentType = 'video';

		let $win = this.window.$window;
		let $video = $win.find('video');

		// Create source tag
		this.$mediaElement = $video;
		$video.append($(`<source src="${url}">`));
		$video[0].load();

		// Enable the content container
		let $container = $win.find('.contentw.video')
		$container.addClass('enabled');

		// Setup touch gestures
		this.setupZoomPanGestures();
	}

	play() {
		if (this.contentType != 'video') return;

		WebSys.audio.context.resume();
		this.$mediaElement[0].play();
	}

	// Stops all playback and unloads the current file.
	stop() {
		let $win = this.window.$window;

		// Clear all content containers
		this.contentType = '';
		$win.find('.contentw').removeClass('enabled');
		$win.find('.contentw.picture').empty();
		$win.find('.contentw.video video').empty();
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
}