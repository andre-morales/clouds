import { Container } from "./container.mjs";
import MediaPlayer, { timeToString } from "./media_player.mjs";
import { TrackMarker } from "./track_marker.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import { type SliderTrack } from "/@sys/ui/controls/slider.mjs";
import Fullscreen from "/@sys/ui/fullscreen.mjs";

const AUTOPLAY_DELAY = 500;
const BUFFERED_RANGES_INTERVAL = 200;

interface $VideoElement extends $Element {
	[0]: HTMLVideoElement;
}

export class VideoContainer extends Container {
	private $video: $VideoElement;
	private video: HTMLVideoElement;
	private allowPauseEventLatch: boolean;
	private bufferedRanges: TimeRanges;
	private bufferedRangesTrack: SliderTrack;
	private trackMarker: TrackMarker;

	constructor(player: MediaPlayer, $root: $Element) {
		super(player, $root);
		this.$video = $root.find('video');
		this.video = this.$video[0];
		this.initControls();
	}

	initControls() {
		let progressBarHeld = false;

		const client = ClientClass.get();
		const $ui = this.$root.find('.video-container');
		const $video = this.$video;
		const video = this.video;
		const $controls = $ui.find('.controls');
		const $time = $ui.find('.time');
		const $duration = $ui.find('.duration');
		const $progressBar = $ui.find('.progressbar');

		// Main controls
		$controls.find('.play-btn').click(() => {
			if (this.isPaused()) {
				this.play();
			} else {
				this.allowPauseEventLatch = true;
				this.pause();
			}
		});

		$controls.find('.prev-btn').click(() => {
			this.player.goPreviousFile();
		});

		$controls.find('.next-btn').click(() => {
			this.player.goNextFile();
		});

		$video.dblclick((ev: MouseEvent) => {
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
		this.bufferedRangesTrack = $progressBar[0].addUnderTrack() as SliderTrack;
		this.bufferedRangesTrack.setColor("#BBB");
		
		let interval = setInterval(() => {
			if (!this.isEnabled()) return;

			this.updateBufferedRanges();
		}, BUFFERED_RANGES_INTERVAL);

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
		$video.on('loadedmetadata', () => {
			$duration.text(timeToString(video.duration));
		});

		$video.on("timeupdate", () => {
			if (progressBarHeld) return;
			
			let prog = video.currentTime / video.duration * 100;
			$progressBar[0].value = prog;

			$time.text(timeToString(video.currentTime));
		});

		$video.on('play', () => {
			$ui.addClass('playing');
		});

		$video.on('pause', () => {
			if (this.player.app.isPlaybackLocked() && !this.allowPauseEventLatch) {
				// If the playback is locked and the single event latch hasn't been enabled,
				// prevent the pause event.
				this.video.play();
			} else {
				// Remove the playing class and disable the latch.
				$ui.removeClass('playing');
				this.allowPauseEventLatch = false;
			}
		});

		$video.on('ended', (ev) => {
			// Advance to the next file in the folder if autoplay is enabled
			if (this.player.app.isAutoPlayEnabled()) {
				setTimeout(() => this.player.goNextFile(), AUTOPLAY_DELAY);
			}
		});

		// Enable transform gestures on this element
		this.player.app.gestures.on(video);

		// Create audio track and integrate it with the audio subsystem
		if (client.audio.begin()) {
			let track = client.audio.context.createMediaElementSource(video);
			track.connect(client.audio.destination);
		}

		// Register active media element for integration with browser controls
		let media = client.registerMediaElement(video);
		media.nextTrackCallback = () => { this.player.goNextFile() };
		media.previousTrackCallback = () => { this.player.goPreviousFile() };
	}

	updateBufferedRanges() {
		// Do not update ranges if they haven't changed
		const ranges = this.video.buffered;
		if (timeRangesEqual(ranges, this.bufferedRanges)) return;
		
		this.bufferedRanges = ranges;
		this.bufferedRangesTrack.clearRanges();
		
		let fullLength = this.video.duration;
		for (let i = 0; i < ranges.length; i++) {
			let start = ranges.start(i);
			let end = ranges.end(i);
			let duration = end - start;

			this.bufferedRangesTrack.addRange(start / fullLength, duration / fullLength);
		}
	}

	setContentUrl(url: string) {
		super.setContentUrl(url);
		this.$video.append($(`<source src="${url}">`));
		this.$video[0].load();
	}

	setTrackMarkerEnabled(enabled: boolean) {
		if (!enabled && !this.trackMarker) return;

		if (!this.trackMarker)
			this.trackMarker = new TrackMarker(this);

		this.trackMarker.setEnabled(enabled);
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

	public getPlayer(): MediaPlayer {
		return this.player;
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
