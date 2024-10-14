import SinestesiaApp from "./app.mjs";
import { Container } from "./container.mjs";
import { ImageContainer } from "./image_container.mjs";
import { VideoContainer } from "./video_container.mjs";
import { Reactor } from "/@sys/events.mjs";

export enum ContentType {
	NONE, IMAGE, VIDEO
}

export default class MediaPlayer {
	public readonly app: SinestesiaApp;
	private contentType: ContentType;
	private activeContainer: Container;
	private containers: Map<ContentType, Container>;
	private reactor: Reactor;

	constructor(app: SinestesiaApp) {
		this.app = app;
		this.contentType = ContentType.NONE;
		this.reactor = new Reactor();
		this.reactor.register('media-change');
	}

	init() {
		let $win = this.app.window.$window;
		this.containers = new Map();
		
		let videoContainer = new VideoContainer(this, $win.find('.content-w.video'));
		let imageContainer = new ImageContainer(this, $win.find('.content-w.img'));

		this.containers.set(ContentType.IMAGE, imageContainer);
		this.containers.set(ContentType.VIDEO, videoContainer);
	}

	setContent(type: ContentType, url: string) {
		let cont = this.containers.get(type);
		if (!cont) return;
		
		this.contentType = type;
		this.activeContainer = cont;
		cont.setContentUrl(url);
		cont.setEnabled(true);
		
		this.reactor.dispatch('media-change', {
			contentType: type
		});
	}

	async play() {
		if (this.contentType != ContentType.VIDEO) return;

		let videoContainer = this.containers.get(ContentType.VIDEO) as VideoContainer;
		await videoContainer.play();
	}

	/**
	 * Stops all playback and unloads the current file.
	 **/ 
	unload() {
		this.contentType = ContentType.NONE;
		this.activeContainer = null;

		// Disable and unload all containers
		for (let cont of this.containers.values()) {
			cont.setEnabled(false);
			cont.unload();
		}

		// Guarantee hiding of the empty container
		this.app.window.$window.find('.content-w').removeClass('enabled');
	}

	goNextFile() {
		this.app.playlist.goNext();
	}

	goPreviousFile() {
		this.app.playlist.goPrevious();
	}

	getMediaElement(): $Element {
		if (!this.activeContainer) return null;

		return this.activeContainer.getMediaElement();
	}

	getCurrentUrl() {
		if (!this.activeContainer) return null;

		return this.activeContainer.getContentUrl();
	}

	public getContainer(type: ContentType) {
		return this.containers.get(type);
	}

	public on(evClass: string, callback: Function) {
		this.reactor.on(evClass, callback);
	}
}

function padNumber (n: number) {
	return n.toLocaleString(undefined, {
		minimumIntegerDigits: 2,
		useGrouping: false
	})
}

export function timeToString (time: number) {
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