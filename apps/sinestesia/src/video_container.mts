import { Container } from "./container.mjs";
import MediaPlayer from "./media_player.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import Fullscreen from "/@sys/ui/fullscreen.mjs";

interface $VideoElement extends $Element {
	[0]?: HTMLVideoElement;
}

export class VideoContainer extends Container {
	private $video: $VideoElement;
	private video: HTMLVideoElement;
	private $bufferedRanges: $Element;
	private bufferedRanges: TimeRanges;

	constructor(player: MediaPlayer, $root: $Element) {
		super(player, $root);
		this.$video = $root.find('video');
		this.video = this.$video[0];
		this.initControls();
	}

	initControls() {
		let progressBarHeld = false;

		const $ui = this.$root.find('.video-container');
		const $video = this.$video;
		const $controls = $ui.find('.controls');
		const $time = $ui.find('.time');
		const $duration = $ui.find('.duration');
		const $progressBar = $ui.find('.progressbar');

		// Main controls
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
		
		// Show controls when tapping video
		$video.click(() => {
			$controls.toggleClass('visible');
		});
		
		// Track buffered parts of the video
		this.$bufferedRanges = $("<div>")
		this.$bufferedRanges.css("width", "100%")
		.css('height', '100%')
		.css('top', '0')
		.css('left', '0');
		this.$bufferedRanges.prependTo($progressBar[0].trackContainer);

		let interval = setInterval(() => {
			if (!this.isEnabled()) return;

			this.updateBufferedRanges();
		}, 200);

		this.player.app.on('exit', () => {
			clearInterval(interval);
		});

		// Progress bar behavior
		let $barThumb = $progressBar.find('.thumb');
		$progressBar.on('mousedown touchstart', () => {
			progressBarHeld = true;
		});

		$(document).on('mousemove', () => {
			if (!progressBarHeld) return;

			let t = $progressBar[0].value * $video[0].duration / 100.0;
			$barThumb.css('--time', `'${timeToString(t)}'`);
		});

		$(document).on('mouseup touchend', () => {
			if (!progressBarHeld) return;
			progressBarHeld = false;
			
			let time = $progressBar[0].value * $video[0].duration / 100.0;
			$video[0].currentTime = time;
			$barThumb.css('--time', null);
		});

		// Video reactive events
		$video.on('loadedmetadata', function() {
			$duration.text(timeToString(this.duration));
		});

		$video.on("timeupdate", function() {
			if (progressBarHeld) return;
			
			let prog = this.currentTime / this.duration * 100;
			$progressBar[0].value = prog;

			$time.text(timeToString(this.currentTime));
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

			if (this.player.app.lockedPlayback)
				this.player.app.cancelPauseEvents = true;
		});

		$video.on('ended', (ev) => {
			if (!this.player.app.isAutoPlayEnabled()) return;
			setTimeout(() => this.player.goNextFile(), 500);
		});

		// Enable transform gestures on this element
		this.player.app.gestures.on($video[0]);

		// Create audio track and integrate it with the audio subsystem
		if (ClientClass.get().audio.begin()) {
			let track = ClientClass.get().audio.context.createMediaElementSource($video[0]);
			track.connect(ClientClass.get().audio.destination);
		}

		// Register active media element for integration with browser controls
		let media = ClientClass.get().registerMediaElement($video[0]);
		media.nextTrackCallback = () => { this.player.goNextFile() };
		media.previousTrackCallback = () => { this.player.goPreviousFile() };
	}

	updateBufferedRanges() {
		let ranges = this.video.buffered;
		if (timeRangesEqual(ranges, this.bufferedRanges)) return;

		this.bufferedRanges = ranges;
		this.$bufferedRanges.empty();
		
		let fullLength = this.video.duration;
		for (let i = 0; i < ranges.length; i++) {
			let start = ranges.start(i);
			let end = ranges.end(i);
			let duration = end - start;

			let $segment = $('<div>');
			$segment.css("height", "100%")
			.css("position", "absolute")
			.css('top', '0')
			.css("left", `${start / fullLength * 100}%`)
			.css("width", `${duration / fullLength * 100}%`)
			.css("background", "#BBB");
			this.$bufferedRanges.append($segment);
		}
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

function timeRangesEqual(a: TimeRanges, b: TimeRanges) {
	if (a === b) return true;
	if (!a) return false;
	if (!b) return false;

	let length = a.length;
	if (length != b.length) return false;

	for (let i = 0; i < length; i++) {
		if (a.end(i) != b.end(i)) return false;
		if (a.start(i) != b.start(i)) return false;
	}

	return true;
}

function padNumber (n: number) {
	return n.toLocaleString(undefined, {
		minimumIntegerDigits: 2,
		useGrouping: false
	})
}

function timeToString (time: number) {
	let hours = Math.floor(time / 60 / 60);
	let minutes = Math.floor(time / 60 - hours * 60);
	let seconds = Math.floor(time) % 60;

	let strSec = padNumber(seconds);
	if (hours) {
		let strMin = padNumber(minutes);
		return `${hours}:${strMin}:${strSec}`;
	} else {
		return `${minutes}:${strSec}`;
	}
};