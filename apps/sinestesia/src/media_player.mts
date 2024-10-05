import SinestesiaApp from "./app.mjs";
import { Container } from "./container.mjs";
import { ImageContainer } from "./image_container.mjs";
import { VideoContainer } from "./video_container.mjs";
import { ClientClass } from "/@sys/client_core.mjs";

export enum ContentType {
	NONE, IMAGE, VIDEO
}

export class MediaPlayer {
	public readonly app: SinestesiaApp;
	private contentType: ContentType;
	private activeContainer: Container;
	private containers: Map<ContentType, Container>;

	constructor(app: SinestesiaApp) {
		this.app = app;
		this.contentType = ContentType.NONE;
	}

	init() {
		let $win = this.app.window.$window;
		this.containers = new Map();
		
		let videoContainer = new VideoContainer(this, $win.find('.contentw.video'));
		let imageContainer = new ImageContainer(this, $win.find('.contentw.img'));

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
		this.app.window.$window.find('.contentw').removeClass('enabled');
	}

	goNextFile() {
		this.app.playlist.goNext();
	}

	goPreviousFile() {
		this.app.playlist.goPrevious();
	}

	getMediaElement() {
		return this.activeContainer.getMediaElement();
	}

	getCurrentUrl() {
		return this.activeContainer.getContentUrl();
	}
}

export default MediaPlayer;