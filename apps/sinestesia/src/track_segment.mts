import { timeToString } from "./media_player.mjs";
import { TrackMarker } from "./track_marker.mjs";
import { ClientClass } from "/@sys/client_core.mjs";
import { ContextMenu } from "/@sys/ui/context_menu.mjs";

export class TrackSegment {
	public valid: boolean;
	public factor: number;
	public length: number;
	public $segment: $Element;
	public $segmentItem: $Element;
	private marker: TrackMarker;

	constructor(marker: TrackMarker, factor: number, length: number) {
		this.marker = marker;
		this.factor = factor;
		this.length = length;
		this.valid = true;
	}

	public destroy() {
		this.valid = false;
		this.$segment.remove();
		this.$segmentItem.remove();
	}

	public mark() {
		let $track = this.marker.getContainer().find('.track');		
		let $segment = this.$segment = $('<div class="segment" tabindex="0">');
		$segment.css('left', this.factor * 100 + '%');
		$segment.css('width', this.length * 100 + '%');
		$track.prepend($segment);

		$segment.on('dblclick', () => {
			this.marker.getVideo().currentTime = this.getTime();
		});

		$segment.on('mousedown', () => {
			this.marker.setSelectedSegment(this);
		});

		$segment.on('focus', () => {
			this.marker.selectedSegment = this;
		});

		ClientClass.get().desktop.addCtxMenuOn($segment, () => 
			ContextMenu.fromDefinition([
				['-Erase', () => this.marker.destroySegment(this)]
			])
		);

		let name = timeToString(this.getTime()) + " - " + timeToString(this.getEndTime());
		this.$segmentItem = $(`<li>${name}</li>`);
		this.$segmentItem.click(() => {
			$segment.focus();
		});
	}

	public setFactor(factor: number) {
		this.factor = factor;
		this.$segment?.css('left', this.factor * 100 + '%');
	}

	public setLength(length: number) {
		this.length = length;
		this.$segment?.css('width', this.length * 100 + '%');
	}

	public getTime() {
		return this.factor * this.marker.getVideo().duration;
	}

	public getEndTime() {
		return (this.factor + this.length) * this.marker.getVideo().duration;
	}

	public getDuration() {
		return this.length * this.marker.getVideo().duration;
	}
}