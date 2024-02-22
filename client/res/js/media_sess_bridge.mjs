'use strict';

var activeMediaElements = null;
var currentMedia = null;
var enabled = false;

export function init() {
	enabled = true;
	activeMediaElements = [];

	navigator.mediaSession.setActionHandler("play", () => {
	    navigator.mediaSession.playbackState = 'playing';
	    //console.log('m-play');

	    let media = getMediaToPlay();
	    if (!media) return;

	    media.element.play();
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
		
    	if (currentMedia.nextTrackCallback) {
    		currentMedia.previousTrackCallback();
    	}
  	});

	navigator.mediaSession.setActionHandler('seekto', (ev) => {
		if (!currentMedia) return;

    	currentMedia.element.currentTime = ev.seekTime;
    });
}

export function registerMediaElement(elem) {
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

function setCurrentMedia(media) {
	currentMedia = media;
	let elem = media.element;

	let srcUrlString = decodeURI(elem.currentSrc);
	let srcUrl = new URL(srcUrlString);

	let mdata = {};

	let fileName = Paths.file(srcUrlString);
	let thumb;

	// Check if the origin of the media and our app origin is the same
	if (srcUrl.origin === new URL(document.baseURI).origin) {
		// Get path and check if it is a filesystem path
		let filePath = srcUrl.pathname;
		if (Paths.isFS(filePath)) {
			// It is a fs path, use our thumbnail system
			thumb = Paths.toFS(filePath, 'thumb');
		}
	}
		
	mdata.title = fileName;
	mdata.artist = "Clouds";
	if (thumb) {
		mdata.artwork = [{
			src: thumb
		}];
	}

	navigator.mediaSession.metadata = new MediaMetadata(mdata);
}

function updatePosition() {
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

function getMediaToPlay() {
	if (activeMediaElements.length == 0) return;

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

class ActiveMedia {
	constructor(elem) {
		this.element = elem;
		this.nextTrackCallback = null;
		this.previousTrackCallback = null;
	}
}