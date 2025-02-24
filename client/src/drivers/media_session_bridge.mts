import { Paths } from './filesystem.mjs';
import Arrays from '../../../common/arrays.mjs';
import { Exception } from '../faults.mjs';

var activeMediaElements: ActiveMedia[];
var currentMedia: ActiveMedia | null;
var enabled = false;
var supported = false;

export function init() {
	supported = Boolean(navigator.mediaSession);
	if (!supported) {
		console.warn("This browser does not support media sessions.");
		return;
	}

	enabled = true;
	activeMediaElements = [];

	navigator.mediaSession.setActionHandler("play", async () => {
	    navigator.mediaSession.playbackState = 'playing';
	    //console.log('m-play');

	    let media = getMediaToPlay();
	    if (!media) return;

	    try {
			await media.element.play();
		} catch (err) {
			console.log(media);
			console.log(err);
		}
	});

	navigator.mediaSession.setActionHandler("pause", () => {
	    navigator.mediaSession.playbackState = 'paused';
	    //console.log('m-pause');

	    // Pause all media elements
	    for (let m of activeMediaElements) {
	    	m.element.pause();
	    }
	});

	navigator.mediaSession.setActionHandler("nexttrack", () => {
		if (!currentMedia) return;

    	if (currentMedia.nextTrackCallback) {
    		currentMedia.nextTrackCallback();
    	}
  	});

	navigator.mediaSession.setActionHandler("previoustrack", () => {
		if (!currentMedia) return;
		
    	if (currentMedia.previousTrackCallback) {
    		currentMedia.previousTrackCallback();
    	}
  	});

	navigator.mediaSession.setActionHandler('seekto', (ev) => {
		if (!currentMedia) return;

		if (ev.seekTime !== undefined) {
    		currentMedia.element.currentTime = ev.seekTime;
		}
    });
}

export function registerMediaElement(elem: HTMLMediaElement) {
	if (!supported) throw new Exception("Media session is not supported!");
	if (!enabled) return;

	let activeMedia = new ActiveMedia(elem);
	activeMediaElements.push(activeMedia);

	elem.addEventListener('play', () => {
		setCurrentMedia(activeMedia);
	});

	elem.addEventListener('timeupdate', () => {
		if (!currentMedia || currentMedia.element != elem) return;

		updatePosition();
	})

	return activeMedia;
}

function setCurrentMedia(media: ActiveMedia) {
	currentMedia = media;
	let elem = media.element;

	let srcUrlString = decodeURI(elem.currentSrc);
	let srcUrl = new URL(srcUrlString);

	let mData: any = {};

	let fileName = Paths.file(srcUrlString);
	// If filename has an extension, remove it
	let i = fileName.lastIndexOf('.');
	if (i != -1) {
		fileName = fileName.substring(0, i);
	}
	let thumb;

	// Check if the origin of the media and our app origin is the same
	if (srcUrl.origin === new URL(document.baseURI).origin) {
		// Get path and check if it is a filesystem path
		let filePath = srcUrl.pathname;
		if (Paths.isFSV(filePath)) {
			// It is a fs path, use our thumbnail system
			thumb = filePath + "?thumb";
		}
	}
		
	mData.title = fileName;
	mData.artist = "Clouds";
	if (thumb) {
		mData.artwork = [{
			src: thumb
		}];
	}

	navigator.mediaSession.metadata = new MediaMetadata(mData);
}

function updatePosition() {
	if (!enabled) return;
	if (!currentMedia) return;
	if (!navigator.mediaSession.setPositionState) return;
	
	let mElem = currentMedia.element;

	// If duration is not a number, the media probably got unloaded,
	// so we remove the position state.
	if (isNaN(mElem.duration)) {
		navigator.mediaSession.setPositionState();
		return;
	}

	navigator.mediaSession.setPositionState({
		duration: mElem.duration,
		playbackRate: mElem.playbackRate,
		position: mElem.currentTime
	});
}

function refreshActiveMedia() {
	// Prune active media elements that aren't valid anymore
	for (let i = 0; i < activeMediaElements.length; i++) {
		let me = activeMediaElements[i];
		if (me.valid()) continue;
		
		Arrays.erase(activeMediaElements, me);
		if (currentMedia === me) {
			currentMedia = null;
		}
		i--;
	}
}

function getMediaToPlay(): ActiveMedia | null {
	if (activeMediaElements.length == 0) return null;

	refreshActiveMedia();

	// Return the media contained in the focused window
	for (let i = 0; i < activeMediaElements.length; i++) {
    	let $media = $(activeMediaElements[i].element);
    	let $win = $media.closest('.focused');
    	if ($win.length >= 1) {
    		return activeMediaElements[i];
    	}
    }

    return activeMediaElements[0];
}

export class ActiveMedia {
	element: HTMLMediaElement;
	nextTrackCallback?: Function;
	previousTrackCallback?: Function;

	constructor(elem: HTMLMediaElement) {
		this.element = elem;
	}

	valid() {
		return document.body.contains(this.element);
	}
}