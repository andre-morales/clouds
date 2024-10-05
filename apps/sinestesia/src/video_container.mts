import { Container } from "./container.mjs";
import MediaPlayer from "./media_player.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import Fullscreen from "/@sys/ui/fullscreen.mjs";

interface $VideoElement extends $Element {
	[0]?: HTMLVideoElement;
}

export class VideoContainer extends Container {
	private $video: $VideoElement;

	constructor(player: MediaPlayer, $root: $Element) {
		super(player, $root);
		this.$video = $root.find('video');
		this.initControls();
	}

	initControls() {
		let fnTimeAsString;
		let progressBarHeld = false;

		let $ui = this.$root.find('.video-container');
		let $video = this.$video;
		
		let $controls = $ui.find('.controls');
		let $time = $ui.find('.time');
		let $duration = $ui.find('.duration');

		$controls.find('.play-btn').click(() => {
			if (this.isPaused()) {
				this.play();
			} else {
				this.player.app.cancelPauseEvents = false;
				this.pause();
			}
		});

		$controls.find('.prev-btn').click(() => {
			this.player.goPreviousFile();
		});

		$controls.find('.next-btn').click(() => {
			this.player.goNextFile();
		});

		$ui.dblclick((ev: MouseEvent) => {
			let cPos = $ui.offset();
			let x = 1.0 * (ev.pageX - cPos.left) / cPos.width;
			
			// Double tap on the left edge rewinds the video, on the right edge it forwards the video.
			// If tapped on the center, toggle fullscreen.
			if (x < 0.3) {
				this.rewind();
			} else if (x > 0.7) {
				this.forward();
			} else {
				// Toggle fullscreen
				if (Fullscreen.element == $ui[0]) {
					this.player.app.setFullscreen(null);
				} else {
					this.player.app.setFullscreen($ui[0]);
				}
			}
		});

		
		$video.click(() => {
			$controls.toggleClass('visible');
		});
		
		let $progressBar = this.$root.find('.progressbar');
		let $barThumb = $progressBar.find('.thumb');
		$progressBar.on('mousedown touchstart', () => {
			progressBarHeld = true;
		});

		$(document).on('mousemove', () => {
			if (!progressBarHeld) return;

			let t = $progressBar[0].value * $video[0].duration / 100.0;
			$barThumb.css('--time', `'${fnTimeAsString(t)}'`);
		});

		$(document).on('mouseup touchend', () => {
			if (!progressBarHeld) return;
			progressBarHeld = false;
			
			let time = $progressBar[0].value * $video[0].duration / 100.0;
			$video[0].currentTime = time;
			$barThumb.css('--time', null);
		});

		$video.on('loadedmetadata', function() {
			$duration.text(fnTimeAsString(this.duration));
			//this.playbackRate = 1.3;
			//this.preservesPitch = false;
		});

		$video.on("timeupdate", function() {
			if (progressBarHeld) return;
			let prog = this.currentTime / this.duration * 100;
			$progressBar[0].value = prog;

			$time.text(fnTimeAsString(this.currentTime));
		});

		$video.on('play', (ev) => {
			$ui.addClass('playing');
		});

		$video.on('pause', (ev) => {
			if (this.player.app.cancelPauseEvents) {
				$video[0].play();
			} else {
				$ui.removeClass('playing');
			}
			if (this.player.app.lockedPlayback) this.player.app.cancelPauseEvents = true;
		});

		$video.on('ended', (ev) => {
			if (!this.player.app.isAutoPlayEnabled()) return;
			setTimeout(() => this.player.goNextFile(), 500);
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

		this.player.app.gestures.on($video[0]);

		if (ClientClass.get().audio.begin()) {
			let track = ClientClass.get().audio.context.createMediaElementSource($video[0]);
			track.connect(ClientClass.get().audio.destination);
		}

		let media = ClientClass.get().registerMediaElement($video[0]);
		media.nextTrackCallback = () => { this.player.goNextFile() };
		media.previousTrackCallback = () => { this.player.goPreviousFile() };
	}

	setContentUrl(url: string) {
		super.setContentUrl(url);
		this.$video.append($(`<source src="${url}">`));
		this.$video[0].load();
	}

	async play() {
		ClientClass.get().audio.resume();

		// Play might throw if another video gets loaded before this one starts playing.
		// This is not a problem, hence the silent error.
		try {
			await this.$video[0].play();
		} catch (err) {}
	}

	pause() {
		this.$video[0].pause();
	}

	isPaused() {
		return this.$video[0].paused;
	}

	forward() {
		this.$video[0].currentTime += 10;
	}

	rewind() {
		this.$video[0].currentTime -= 10;
	}

	unload(): void {
		this.$video.empty();
		this.$video[0].load();
	}

	getMediaElement(): $Element {
		return this.$video;
	}
}