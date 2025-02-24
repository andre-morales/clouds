import SinestesiaApp from "../app.mjs";
import { ContentType, timeToString } from "../media_player.mjs";
import { TrackSegment } from "./track_segment.mjs";
import { VideoContainer } from "./video_container.mjs";
import { FileSystem } from "/@sys/drivers/filesystem.mjs";
import Dialogs from "/@sys/ui/dialogs.mjs";
import Arrays from "/@comm/arrays.mjs";

export class TrackMarker {
	private container: VideoContainer;
	private app: SinestesiaApp;
	private enabled: boolean;
	private video: HTMLVideoElement;
	private segments: TrackSegment[];
	public selectedSegment: TrackSegment;
	private playingSegment: TrackSegment;

	private $container: $Element;
	private $track: $Element;
	private $selection: $Element;
	private $segmentsList: $Element;

	private selectionF: number;
	private selectionW: number;

	constructor(container: VideoContainer) {
		this.container = container;
		this.app = container.getPlayer().app;
		this.video = this.container.getMediaElement()[0];
		this.segments = [];

		const $cont = this.app.window.$window.find('.segment-marker');
		const $tooltip = $cont.find('.tooltip');
		const $track = $cont.find('.track');
		this.$container = $cont;
		this.$track = $track;
		this.$selection = $cont.find('.selection');
		this.$segmentsList = $cont.find('.segment-list ul');

		this.app.player.events.on('media-change', (ev) => {
			this.mediaChanged(ev.contentType);
		});

		$track.on('mouseenter', () => {
			$tooltip.css('display', 'block');
		});
		$track.on('mouseleave', () => {
			$tooltip.css('display', '');
		});

		$track.on('mousemove', (ev: MouseEvent) => {
			if (!this.video) return;

			let winCoords = this.app.window.getLocalCoordinates(ev);
			let trackX = ev.clientX - $track.offset().left;
			let factorX = trackX / $track.width();

			let time = factorX * this.video.duration;
			let timeStr = timeToString(time);

			$tooltip.text(timeStr);
			$tooltip.css('left', `${winCoords[0]}px`);
			$tooltip.css('top', `${winCoords[1] - $tooltip.height()}px`);
		});

		$cont.find('.export-st-btn').click(() => this.exportSegments());
		$cont.find('.mark-btn').click(() => this.markSelection());
		$cont.find('.play-st-btn').click(() => this.playPauseSegment());
		$cont.find('.expand-sts-list-btn').click(() => {
			this.$segmentsList.parent().toggleClass('d-none');
		})

		$track.on('dblclick', (ev: MouseEvent) => {
			this.video.currentTime = this.getTrackPos(ev) * this.video.duration;
		});

		$cont.on('keydown', (ev: KeyboardEvent) => {
			switch (ev.key) {
			case ' ':
				this.playPauseSegment();
				break;
			case 'm':
				this.markSelection();
				break;
			}
		});

		this.initTrackSegments();
		this.initSelection();

		this.mediaChanged(ContentType.VIDEO);

		this.autoImportSegments();

		this.initTimeSync();
	}

	private async autoImportSegments() {
		try {
			let path = decodeURIComponent(this.app.player.getCurrentUrl()) + '.segments.json';
			await this.importSegments(path);
			Dialogs.showMessage(this.app, 'Segments', 'Imported segments.');
		} catch(err) {}
	}

	private initTrackSegments() {
		let mvSegment: TrackSegment;
		let mvDirection: number;
		let stFactor: number;
		let stLength: number;
		
		this.$track.on('mousedown', (ev: MouseEvent) => {
			if (!ev.ctrlKey) return;
			
			let width = this.$track.width();
			let mx = ev.clientX	- this.$track.offset().left;

			for (let st of this.segments) {
				let leftDrag = Math.abs(mx - st.factor * width) < 8;
				let rightDrag = Math.abs(mx - (st.factor + st.length) * width) < 8;
				if (!leftDrag && !rightDrag) continue;

				mvDirection = (leftDrag) ? -1 : 1;
				mvSegment = st;
				stFactor = st.factor;
				stLength = st.length;
				break;		
			}

			if (!mvSegment) return;
			ev.stopImmediatePropagation();
		});

		this.$track.on('mousemove', (ev: MouseEvent) => {
			if (!mvSegment) return;
			if (mvDirection == 0) return;

			let mx = ev.clientX	- this.$track.offset().left;
			let mxf = mx / this.$track.width();

			let factor = stFactor;
			let length: number;

			if (mvDirection == 1) {
				length = mxf - stFactor;
			} else if (mvDirection == -1) {
				factor = mxf;
				length = stFactor + stLength - mxf;
			}

			if (length <= 0) return;
			mvSegment.setFactor(factor);
			mvSegment.setLength(length);
		});

		this.$track.on('mouseup', () => {
			mvSegment = null;
		});
	}

	private initSelection() {
		let performingSelection = false;

		const moveSelection = (ev: MouseEvent) => {
			let trackF = this.getTrackPos(ev);
			this.selectionW = trackF - this.selectionF;

			let factor = this.selectionF;
			if (this.selectionW < 0) {
				factor = trackF;
			}

			this.setSelection(factor, Math.abs(this.selectionW));
		}

		this.$track.on('mousedown', (ev: MouseEvent) => {
			if (ev.button != 0) return;

			performingSelection = true;
			this.selectionF = this.getTrackPos(ev);
			moveSelection(ev);
		})

		document.addEventListener('mousemove', (ev) => {
			if (!performingSelection) return;
			
			moveSelection(ev);
		});

		document.addEventListener('mouseup', (ev) => {
			if (ev.button != 0) return;

			performingSelection = false;
		});
	}

	private initTimeSync() {
		let lastF = this.getVideo().currentTime;
		let fn = () => {
			if (!this.app.window.$window) return;

			let time = this.getVideo().currentTime;
			if (time != lastF) {
				this.timeUpdate();
				lastF = time;
			}
			window.requestAnimationFrame(fn);
		}

		window.requestAnimationFrame(fn);
	}

	private timeUpdate() {
		const $track = this.$container.find('.track');
		const $playLine = this.$container.find('.play-line');

		let factor = this.video.currentTime / this.video.duration;
		let x = factor * $track.width();
		$playLine.css('left', `${x}px`);

		// Pause playback if the current segment has finished
		if (this.playingSegment) {
			if (this.playingSegment.getEndTime() < this.video.currentTime)
				this.video.pause();
		} 
	}

	private mediaChanged(type: ContentType) {
		if (type != ContentType.VIDEO) {
			this.video = null;
			return;
		}

		this.video = this.app.player.getMediaElement()[0];
		this.video.addEventListener('pause', (ev) => {
			this.playingSegment = null;
		});
	}

	private playPauseSegment() {
		if (!this.selectedSegment || !this.selectedSegment.valid) return;

		if (this.video.paused) {
			this.playingSegment = this.selectedSegment;
			this.video.currentTime = this.selectedSegment.getTime();
			this.video.play();
		} else {
			this.playingSegment = null;
			this.video.pause();
		}
	}

	private markSelection() {
		if (this.selectionW == 0) return;

		let selectF = this.selectionF;

		if (this.selectionW < 0) 
			selectF += this.selectionW;

		let segment = this.createSegment(selectF, Math.abs(this.selectionW));
		segment.mark();
		this.$segmentsList.append(segment.$segmentItem);
		this.setSelectedSegment(segment);
		this.clearSelection();
	}

	private clearSelection() {
		this.selectionF = 0;
		this.selectionW = 0;
		this.$selection.css('display', 'none');
		this.$selection.css('left', '0');
		this.$selection.css('width', '0');
	}

	private setSelection(factor: number, length: number) {
		this.$selection.css('display', '');
		this.$selection.css('left', factor * 100 + '%');
		this.$selection.css('width', length * 100 + '%');
	}

	public setSelectedSegment(segment: TrackSegment) {
		if (this.selectedSegment) {
			if (!this.selectedSegment.valid) {
				this.selectedSegment = null;
				return;
			}
		}

		segment.$segment.focus();
	}

	public setEnabled(enabled: boolean) {
		this.enabled = enabled;

		if (enabled) {
			this.$container.css('display', '');
		} else {
			this.$container.css('display', 'none')
		}
	}

	public getVideo() {
		return this.video;
	}

	public getContainer() {
		return this.$container;
	}

	public createSegment(factor: number, length: number): TrackSegment {
		let ts = new TrackSegment(this, factor, length);
		this.segments.push(ts);
		return ts;
	}

	public destroySegment(segment: TrackSegment): void {
		segment.destroy();
		Arrays.erase(this.segments, segment);
		if (this.selectedSegment == segment)
			this.selectedSegment = null;
	}

	private async importSegments(path: string) {
		let segments = await FileSystem.readJson(path);
		let videoDuration = this.getVideo().duration;
		console.log('imported')
		for (let st of segments) {
			let f = st[0] / videoDuration;
			let l = (st[1] - st[0]) / videoDuration;
			let segment = this.createSegment(f, l);
			segment.mark();
			this.$segmentsList.append(segment.$segmentItem);
			console.log(this.$segmentsList);
			console.log(segment.$segmentItem);

		}
	}

	private async exportSegments() {
		const videoDuration = this.getVideo().duration;

		let obj = this.segments.map((st) => {
			let start = st.factor * videoDuration;
			let end = (st.factor + st.length) * videoDuration
			return [start, end];
		});

		let path = decodeURIComponent(this.app.player.getCurrentUrl()) + '.segments.json';
		await FileSystem.writeJson(path, obj);
		Dialogs.showMessage(this.app, "Segments", "Exported segments successfully.");
	}

	private getTrackPos(ev: MouseEvent) {
		return (ev.clientX - this.$track.offset().left) / this.$track.width();
	}
}
