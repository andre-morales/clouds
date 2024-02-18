var Client;
var WebSys;

async function main() {
	// Load jquery compatible lib
	await addScript('/res/js/lib/zepto.min.js');

	// Early unhandled errors and rejections should bring immediate user attention
	window.onerror = (err) => {
		_systemPanic("Unhandled error", err, true);
	};

	window.onunhandledrejection = (err) => {
		_systemPanic("Unhandled promise error", err, true);
	};

	// Schedule loading of main system scripts
	let scriptsP = Promise.all([
		addScript('/res/js/faults.js'),
		addScript('/res/js/events.js'),
		addScript('/res/js/filesystem.js'),
		addScript('/res/js/app.js'),
		addScript('/res/js/lib/hammer.min.js'),
		addScript('/res/js/desktop.js'),
		addScript('/res/js/window.js'),
		addScript('/res/js/dialogs.js'),
		addScript('/res/js/audiosystem.js')
	]);

	// Load style
	addStylesheet('/res/css/desktop.css');

	// Fetch desktop page
	let fres = await fetch('/page/desktop');
	if (fres.status != 200) {
		console.error('Forbidden.');
		return;
	}
	document.body.innerHTML = await fres.text();

	// Wait for all scripts to load
	await scriptsP;

	// Instatiate system
	Client = new ClientClass();
	WebSys = Client;
	await Client.init();
	endTransition();

	Client.start(getURLParams());
}

class ClientClass {
	constructor() {
		this.CLIENT_VERSION = '1.0.045';
		this.BUILD_TEXT = `Clouds ${this.CLIENT_VERSION} Early Test 1`;
	}

	async init() {
		// Start logging record
		this.logHistory = '[Begin]\n';
		this.setupLogging();

		// Create main structures
		this.runningApps = [];
		this.loadedResources = {};
		this._reactor = new Reactor();
		this._reactor.register('log', 'apps-add', 'apps-rem');

		// Create desktop subsystem
		this.desktop = new Desktop();

		// Display version on ui
		fetch('/version').then(async (fres) => {
			let apiv = await fres.text();
			let sysv = Client.BUILD_TEXT;
			let vtext = `${sysv}<br>API v${apiv}`; 
			$('.desktop .backplane .text').html(vtext);
		})
		
		// Save current page on history
		history.pushState(null, null, location.href);

		// Track back button press
		let btime = 0;
		window.addEventListener('popstate', () => {
			let time = new Date().getTime()
			let dt = time - btime;
			btime = time;
			if (dt > 10) this.desktop.backButton();

			history.go(1);
		});

		// Initialize audio subsystem
		this.audio = new AudioSystem();
		
		// Fetch app definitions from the user profile
	 	let fres = await fetch('/fs/q/usr/apps.json');
		this.registeredApps = await fres.json();
		
		// Remove disabled apps
		for (let app of Object.keys(this.registeredApps)) {
			if (app.startsWith('-')) delete this.registeredApps[app];
		}
		
		// Let the desktop prepare app icons and behavior
		this.desktop.setupApps();
	}

	async start(args) {
		this.desktop.start();

		if (args && args.loc) {
			let app = await this.runApp('explorer');
			app.go(args.loc);
		}
	}

	async runApp(name, buildArgs) {
		return await this.runAppFetch('/app/' + name + '/manifest.json', buildArgs);
	}

	async runAppFetch(manifestURL, buildArgs) {
		try {
			// Fetch manifest
			let fres = await fetch(manifestURL);
			if (fres.status == 404) {
				throw Error('Failed to instantiate "' + manifestURL + '", manifest not found.');
			}
			if (fres.status == 403) {
				throw Error('Failed to instantiate "' + manifestURL + '", access denied.');
			}

			// Await for manifest
			let manifest = await fres.json();

			let tmpUserId = 'APP-CREATOR';

			// Load required scripts and styles declared in the manifest
			let scripts = (manifest.scripts) ? manifest.scripts : [];
			let styles = (manifest.styles) ? manifest.styles : [];

			let loadingScriptsPromises = scripts.map((url) => {
				return this.requestScript(url, tmpUserId);
			});

			let loadingStylesPromises = styles.map((url) => {
				return this.requestStyle(url, tmpUserId);
			});

			// Wait for all scripts to load and save the resource objects.
			// We don't wait for the styles to load since most of the time, its not necessary
			let loadedScriptResources = await Promise.all(loadingScriptsPromises);

			// Obtain the app class from manifest.
			let AppClass = getObjectByName(manifest.builder);
			if (!AppClass) {
				throw Error('Failed to instantiate "' + manifestURL + '", builder unavailable.');
			}

			// Instantiate the app object with any passed arguments
			if (!buildArgs) buildArgs = [];

			let app = new AppClass(manifest.id, buildArgs);

			// Replace the temporary user and set the app as a user of its own script resources
			for (let res of loadedScriptResources) {
				res.users[res.users.indexOf(tmpUserId)] = app;
			}

			// Once a style its loaded, we should replace the temporary user with the app object.
			for (let promise of loadingStylesPromises) {
				promise.then((resource) => {
					resource.users[resource.users.indexOf(tmpUserId)] = app;
				});
			}

			// Save the app in the running array and fire any events
			this.runningApps.push(app);
			this.dispatch('apps-add');
			app.state = 'alive';

			// Fire the app initialization and return its instance
			await app.init();
			return app;
		} catch (err) {
			console.error(err);	
			this.showErrorDialog('App Initialization', err);
		}
		return null;
	}

	async endApp(instance) {
		// Check if app is on the list
		if (!this.runningApps.includes(instance)) return;

		// If it is on a valid state, dispose of it
		if (!instance.canEnd()) return;
		instance._dispose();

		// Remove app from app list
		arrErase(this.runningApps, instance);
		this.dispatch('apps-rem');
	}

	// Loads the script with the given url and registers a user.
	// If the script is already loaded, just register another user for it. Otherwise, load it and register its first user.
	// Returns the resource object that represents this script.
	async requestScript(url, user) {
		let resource = this.loadedResources[url];
		if (resource) {
			// The resource was already loaded, let's register
			// another user of it.
			resource.addUser(user);
		} else {
			// The resource hasn't been loaded yet, let's create it and load the script
			let resId = btoa(url);
			resource = new Resource();
			resource.permanent = false;
			resource.id = resId;
			resource.users = [user];
			resource.fnUnload = () => {
				destroyElementById(resId);
			};
			this.loadedResources[url] = resource;

			await addScript(url, resId);
		}
		return resource;
	}

	// Loads a style of the given url and registers a user.
	// If the style was already loaded, just add another user to it.
	// Otherwise, load the style, create its resource object and register its first user.
	// Returns the resource object representing this style resource.
	async requestStyle(url, user) {
		let resource = this.loadedResources[url];

		if (resource) {
			// The resource was already loaded, let's register
			// another user of it.
			if (!resource["users"].includes(user)) {
				resource["users"].push(user);
			}
		} else {
			let resId = btoa(url);

			// The resource hasn't been loaded yet.
			resource = new Resource();
			resource.id = resId;
			resource.users = [user];
			resource.fnUnload = () => {
				destroyElementById(resId);
			};
			resource.permanent = false;
			this.loadedResources[url] = resource;

			await addStylesheet(url, resId);
		}
		return resource;
	}

	releaseResource(url, user) {
		// Find resource
		let res = this.loadedResources[url];
		if (!res) return;

		// Remove its user, and if it gets unloaded, remove it from the list
		res.removeUser(user);
		if (res.unloaded) {
			delete this.loadedResources[url];
		}
	}

	showErrorDialog(title, msg) {
		try {
			Dialogs.showError(this.desktop.dwm, title, msg);
		} catch (err) {
			console.log("---- Couldn't display error message ----");
			console.error(err);
			console.log("----------------------------------------")
			_systemPanic("No Error Display", `Couldn't show [${title}]: "${msg}", due to "${err}"`);
		}
	}

	downloadUrl(path) {
		let link = document.createElement('a');
		link.style.display = 'none';
		link.href = path;
		link.download = '';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	log(msg) {
		this.logHistory += msg + '\n';
		try {
			this._reactor.dispatch('log')
		} catch (err) {
			console.error(err);
			this.showErrorDialog("Log failure", err);
		}
	}

	setupLogging() {
		let self = this;

		window.onerror = (ev) => {
			this.log(`[Error] '${ev.message}' at ${ev.filename}:${ev.lineno}`);
			this.showErrorDialog("Fault", `Unhandled error: ${ev}`);
		};

		window.onunhandledrejection = (ev) => {
			this.log(`[PromErr] '${ev.reason}'`);
			this.showErrorDialog( "Fault", `Unhandled internal rejection: ${event.reason}`);
		};
	}

	on(evclass, callback) {
		this._reactor.on(evclass, callback);
		return callback;
	}

	off(evclass, callback) {
		this._reactor.off(evclass, callback);
	}

	dispatch(evclass, args) {
		this._reactor.dispatch(evclass, args);
	}
}

function _systemPanic(title, msg, mode) {
	// Initialize a counter to keep incrementing the z-index
	let self = _systemPanic;
	self.counter = self.counter || 1024;
	let index = self.counter++;

	let $box = $(`<div class='panic-screen' style="z-index: ${index}; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background: black; color: white;">`);

	let $title;
	if (mode) {
		$title = $("<h1>-- Startup Failed --</h1>");
	} else {
		$title = $("<h1>-- System Panic --</h1>");
	}

	let $text = $(`<p>Reason: ${title}</p><p>Detail: ${msg}</p>`);

	let $dismiss = $("<button>Dismiss</button>");
	$dismiss.click(() => {
		$box.remove();
	});
	
	if (mode) {
		$box.css('background', '#503');
	} else {
		$box.css('background', '#58A');
	}

	$box.append($title);
	$box.append($text);
	$box.append($dismiss);
	$('body').append($box);
}

function klog(msg) {
	Client.log(msg);
}

function getObjectByName(name) {
    var nameParts = name.split('.');
    var nameLength = nameParts.length;
    var scope = window;

    for (var i = 0; i < nameLength; ++i) {
        scope = scope[nameParts[i]];
    }

    return scope;
}

function cloneTemplate(id) {
	let el = document.getElementById('t_' + id);
	return el.content.cloneNode(true);
}

function arrErase(arr, val) {
	let i = arr.indexOf(val);
	if (i >= 0) {
		arr.splice(i, 1);
	}
	return i;
}

function endsWithArr(str, arr) {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

function sleep(ms) {
	return new Promise(res => setTimeout(res, ms));
}

function getURLParams() {
	return new Proxy(new URLSearchParams(window.location.search), {
 		get: (searchParams, prop) => searchParams.get(prop),
	});
}

class Clipboard {
	static async copyText(text) {
		this.object = text;
		this.type = 'text';
		await navigator.clipboard.writeText(text);
	}

	static async copyObject(object, type) {
		this.object = object;
		this.type = type;
	}
}

class Mathx {
	static clamp(value, min, max) {
		if (value > max) return max;
		if (value < min) return min;
		return value;
	}	
}

main();

function createSlider(slider){
	if (slider.attr('data-ready')) return;
	slider.attr('data-ready', true);

	// Creating handles
	let $lower = slider.find('.lower');
	if (!$lower.length) {
		$lower = $('<span class="lower"></span>');
		slider.append($lower);
	}

	let $thumb = slider.find('.thumb');
	if (!$thumb.length) {
		$thumb = $('<span class="thumb"></span>');
		slider.append($thumb);
	}

	let attrOr = (elem, attr, def) => {
		let v = elem.attr(attr);
		if (v === 0) return 0;
		if (!v) return def;
		return v; 
	};

	let min = attrOr(slider, "data-min", 0);
	let max = attrOr(slider, "data-max", 100);
	
	let valueChange = (coff, fireEv) => {
		coff = Mathx.clamp(coff, 0, 1);
		let value = min + (max - min) * coff;

		if(slider[0].value == value) return;
		slider[0].value = value;

		$lower.css("width", `${coff * 100}%`);
		$thumb.css("left", `${coff * slider.width() - $thumb.width()/2}px`);
		
		if(fireEv) slider.trigger('change');
	};

	let dragX = (ev) => {
		let mx = ev.pageX;

		let touches = ev.changedTouches;
		if (touches && touches[0]) {
			mx = touches[0].pageX;
		}
		return (mx - slider.offset().left) / slider.width();
	};

	// Event handling
	let held = false;
	$(document).on('mousemove touchmove', (ev) => {
		if(!held) return

		valueChange(dragX(ev), true);	
	});
	
	slider.on('mousedown touchstart', (ev) => {
		held = true;
		valueChange(dragX(ev), true);
	});
	$thumb.on('mousedown touchstart', () => {
		held = true;
	});

	$(document).on('mouseup', (ev) => {
		if(!held) return;

		valueChange(dragX(ev), true);
		held = false;
	});

	// Properties
	slider[0].setValue = (value, fireEv) => {
		valueChange((value-min)/(max-min), fireEv);
	};
	
	// Initial value
	var initval = attrOr(slider, "data-value", 0);
	setTimeout(() => {
		valueChange(Mathx.clamp(initval, min, max));
	}, 0)	
}

function prepareSliders(){
	var sliders = $(".Slider");

	for(let i = 0; i < sliders.length; i++){
		let $slider = $(sliders[i]);
		
		createSlider($slider);
	}
}