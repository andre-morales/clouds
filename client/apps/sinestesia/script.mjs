import { CtxMenu, CtxItem, CtxCheck } from '/res/js/ui/context_menu.mjs';
import { FileSystem, Paths, FileTypes } from '/res/js/filesystem.mjs';
import Fullscreen from '/res/js/ui/fullscreen.mjs';

export default class SinestesiaApp extends App {
	constructor(...args) {
		super(...args);
		
		this.window = null;
		this.contentType = '';
		this.allowZoomPan = false;
		this.transform = {
			scale: 1, x: 0, y: 0, rotation: 0,
			flipX: 1, flipY: 1
		};
		this.$mediaElement = null;
		this.$video = null;
		this.$image = null;
		this.currentUrl = null;
		this.autoPlay = false;
		this.playlist = {
			dir: null,
			index: 0,
			list: null
		};
	}

	async init() {
		this.on('exit', () => {
			this.playlist = null;
			this.cancelPauseEvents = false;
		});

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.setCloseBehavior('exit');
		this.window.on('backnav', () => {
			if (this.fullscreen && Fullscreen.element == this.fullscreen) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.exit();
			}
		});
		this.window.on('closing', () => {
			this.unload();
		});
		this.window.setTitle('Sinestesia');

		let $win = this.window.$window;
		$win.find('.window-body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/main.html');

		// Behaviour
		this.createContextMenu();
		this.setupVideoContainer();
		this.setupImageContainer();

		// Make the window visible
		this.window.setVisible(true);

		//prepareSliders();

		if (this.buildArgs.length > 0) {
			this.openFile(this.buildArgs[0]);
		}
	}

	setupVideoContainer() {
		let fnTimeAsString;
		let progressbarHeld = false;

		let $win = this.window.$window;
		let $container = $win.find('.video-container');
		let $video = $container.find('video');
		this.$video = $video;
		let video = $video[0];
		
		let $controls = $container.find('.controls');
		let $time = $container.find('.time');
		let $duration = $container.find('.duration');

		$controls.find('.play-btn').click(() => {
			let el = this.$mediaElement[0];
			if (el.paused) {
				Client.audio.resume();
				this.play();
			} else {
				this.cancelPauseEvents = false;
				el.pause();
			}
		});

		$controls.find('.prev-btn').click(() => {
			this.goPrevious();
		});

		$controls.find('.next-btn').click(() => {
			this.goNext();
		});

		$container.dblclick((ev) => {
			let cPos = $container.offset();
			let x = 1.0 * (ev.pageX - cPos.left) / cPos.width;
			
			// Double tap on the left edge rewinds the video, on the right edge it forwards the video.
			// If tapped on the center, toggle fullscreen.
			if (x < 0.3) {
				this.rewind();
			} else if (x > 0.7) {
				this.forward();
			} else {
				// Toggle fullscreen
				if (Fullscreen.element == $container[0]) {
					Fullscreen.rewind();
					this.fullscreen = null;
				} else {
					this.fullscreen = $container[0];
					Fullscreen.on($container[0]);
				}
			}
		});

		
		$video.click(() => {
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
			$progressbar[0].value = prog;

			$time.text(fnTimeAsString(this.currentTime));
		});

		$video.on('play', (ev) => {
			$container.addClass('playing');
		});

		$video.on('pause', (ev) => {
			if (this.cancelPauseEvents) {
				video.play();
			} else {
				$container.removeClass('playing');
			}
			if (this.lockedPlayback) this.cancelPauseEvents = true;
		});

		$video.on('ended', (ev) => {
			if (!this.autoPlay) return;
			setTimeout(() => this.goNext(), 500);
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

		if (Client.audio.begin()) {
			let track = Client.audio.context.createMediaElementSource($video[0]);
			track.connect(Client.audio.destination);
		}

		let media = Client.registerMediaElement($video[0]);
		media.nextTrackCallback = () => { this.goNext() };
		media.previousTrackCallback = () => { this.goPrevious() };
	}

	setupImageContainer() {
		let $container = this.window.$window.find('.image-container');

		this.$image = $container.find("img");
		$container.dblclick(() => {
			if (Fullscreen.element == $container[0]) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.fullscreen = $container[0];
				Fullscreen.on($container[0]);
			}
		});

		let $controls = $container.find('.controls');
		this.$image.click(() => {
			$controls.toggleClass('visible');
		});

		$controls.find('.prev-btn').click(() => {
			this.goPrevious();
		});

		$controls.find('.next-btn').click(() => {
			this.goNext();
		});
	}

	createContextMenu() {
		let $win = this.window.$window;
		let ctxMenu = CtxMenu([
			CtxItem('Open...', () => this.showOpenDialog()),
			CtxItem('Open folder...', () => this.showOpenFolderDialog()),
			'-',
			CtxCheck('Autoplay', (v) => {
				this.autoPlay = v;
			}),
			CtxCheck('Lock playback', (v) => {
				this.lockedPlayback = v;
				this.cancelPauseEvents = v;
			}),
			'-',
			CtxItem('Flip horizontally', () => {
				this.transform.flipX *= -1;
				this.updateTransform();
			}),
			CtxItem('Flip vertically', () => {
				this.transform.flipY *= -1;
				this.updateTransform();
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
				this.allowZoomPan = v;
			}, false),
			CtxItem('Reset transform', () => this.resetZoomPan()),
		]);
		Client.desktop.addCtxMenuOn($win.find('.window-body'), () => ctxMenu);
	}

	async showOpenDialog() {
		let app = await Client.runApp('explorer');
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let file = result[0];
		this.openFile('/fsv' + file);
	}

	async showOpenFolderDialog() {
		let app = await Client.runApp('explorer');
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let folder = result[0];
		this.openFolder(folder);
	}

	async openFolder(dir) {
		let files = await FileSystem.list(dir);

		this.playlist.list = files;
		this.playlist.index = 0;
		this.playlist.dir = dir;
		this.autoPlay = true;
		this.openFile('/fsv' + dir + this.playlist.list[0][0]);
	}

	openFile(path) {	
		// Set window title
		let fname = path.replace(/\/+$/, ''); // Remove trailing slash
		fname = fname.slice(fname.lastIndexOf('/') + 1);
		this.window.setTitle(fname);

		this.unload();

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

	openPicture(url) {
		this.contentType = 'image';
		this.currentUrl = url;
		this.$image.attr("src", url);
		this.$mediaElement = this.$image;

		let $container = this.window.$window.find('.contentw.img')
		$container.addClass('enabled');

		this.setupZoomPanGestures(this.$image[0]);
	}

	openVideo(url) {
		this.contentType = 'video';
		this.currentUrl = url;

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
		this.setupZoomPanGestures($video[0]);
	}

	// -- Media Controls --
	async play() {
		if (this.contentType != 'video') return;

		Client.audio.resume();

		// Play might throw if another video gets loaded before this one starts playing.
		// This is not a problem, hence the silent error.
		try {
			await this.$mediaElement[0].play();
		} catch (err) {}
	}

	// Stops all playback and unloads the current file.
	unload() {
		let $win = this.window.$window;

		// Clear all content containers
		this.contentType = '';
		$win.find('.contentw').removeClass('enabled');
		$win.find('.contentw.picture img').attr("src", "");
		let $video = $win.find('.contentw.video video');
		$video.empty();
		$video[0].load();
	}

	forward() {
		if (this.contentType != 'video') return;

		this.$mediaElement[0].currentTime += 10;
	}

	rewind() {
		if (this.contentType != 'video') return;

		this.$mediaElement[0].currentTime -= 10;
	}

	async goNext() {
		if (!this.playlist.list) {
			await this.convertToPlaylist();
		}

		if (this.playlist.list && this.playlist.index < this.playlist.list.length - 1) {
			this.playlist.index++;
			let nextFile = this.playlist.list[this.playlist.index][0];
			let nextUrl = '/fsv' + this.playlist.dir + nextFile;
			this.openFile(nextUrl);

			await Util.sleep(100);
			this.play();
		}
	}

	async goPrevious() {
		if (!this.playlist.list) {
			await this.convertToPlaylist();
		}

		if (this.playlist.list && this.playlist.index > 0) {
			this.playlist.index--;

			let prevFile = this.playlist.list[this.playlist.index][0];
			let prevUrl = '/fsv' + this.playlist.dir + prevFile;

			this.openFile(prevUrl);

			await Util.sleep(100);
			this.play();
		}
	}

	// Convert the current playthrough into a playlist
	async convertToPlaylist() {
		if (this.playlist.list) return;

		// Files outside the filesystem can't be converted to playlists
		if (!Paths.isFS(this.currentUrl) && !Paths.isFSV(this.currentUrl)) return;

		// Convert the URL back to path form and remove FS prefix
		let currentPath = Paths.removeFSPrefix(decodeURI(this.currentUrl));

		// List all files in the same folder, and set them as the playlist
		let folder = Paths.parent(currentPath);
		let files = await FileSystem.list(folder);
		this.playlist.dir = folder;
		this.playlist.list = files;

		// Find current file in the listing, if for some reason it can't be found,
		// use the first file as index
		let currentFile = Paths.file(currentPath);
		let index = files.findIndex((f) => f[0] == currentFile);

		// Enable auto play when doing playlist conversions
		this.autoPlay = true;

		if (index != -1) {
			this.playlist.index = index;
		} else {
			this.playlist.index = 0;
			console.warn("Could't find the file itself in the playlist?");
			console.warn("Files:", files);
			console.warn("Path:", currentPath); 	
		}
	}

	// -- Gestures and transformation --
	updateTransform() {
		let t = this.transform;
		let css = `scale(${t.scale}, ${t.scale}) translate(${t.x}px, ${t.y}px) scale(${t.flipX}, ${t.flipY}) rotate(${t.rotation}deg)`;
		this.$mediaElement.css('transform', css);
	}

	setupZoomPanGestures(element) {
		// Prevent adding gestures more than once
		if (element.getAttribute('data-has-gestures')) return;
		element.setAttribute('data-has-gestures', true);

		let trans = this.transform;
		
		let _lx = 0, _ly = 0;
		let _lscale = 1;
		
		let hammer = new Hammer.Manager(element, {
			recognizers: [
				[Hammer.Pinch, {}],
				[Hammer.Pan, {}]
			]
		});
		
		hammer.on('pinchstart', () => {
			_lscale = trans.scale;
		});
		hammer.on('pinch', (ev) => {
			if (!this.allowZoomPan) return;

			trans.scale = _lscale * ev.scale; 
			this.updateTransform();
		});

		hammer.on('panstart', () => {
			_lx = trans.x;
			_ly = trans.y;
		});
		hammer.on('pan', (ev) => {
			if (!this.allowZoomPan) return;

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