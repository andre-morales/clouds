var WebSys;

async function main() {
	let scriptsP = Promise.all([
		addScript('/res/js/lib/zepto.min.js'),
		addScript('/res/js/lib/hammer.min.js'),
		addScript('/res/js/app.js'),
		addScript('/res/js/desktop.js'),
		addScript('/res/js/window.js'),
		addScript('/res/js/dialogs.js'),
		addScript('/res/js/audiosystem.js')
	]);

	addStylesheet('/res/css/desktop.css');

	// Fetch desktop page
	let fres = await fetch('/page/desktop');
	if (fres.status != 200) {
		console.error('Forbidden.');
		return;
	}
	document.getElementById('body').innerHTML = await fres.text();

	// Wait for all scripts to load
	await scriptsP;

	// Instatiate system
	WebSys = new WebSysClass();
	await WebSys.init();
	endTransition();

	WebSys.start(getURLParams());
}

class WebSysClass {
	async init() {
		this.WEBSYS_VERSION = '0.6.5';
		this.WSCLIENT_VERSION = '0.6.1';
		this.logHistory = '[Begin]\n';
		this.setupLogging();

		this.runningApps = [];
		this.loadedResources = {};
		this.reactor = new Reactor();
		this.reactor.register('log', 'apps-add', 'apps-rem');
		this.desktop = new Desktop();

		fetch('/version').then(async (fres) => {
			let apiv = await fres.text();
			let sysv = WebSys.WEBSYS_VERSION;
			let clientv = WebSys.WSCLIENT_VERSION;
			let vtext = `WebSys Modern v${sysv}<br>API v${apiv}<br>Client v${clientv}`; 
			$('.desktop .backplane .text').html(vtext);
		})
		
		history.pushState(null, null, location.href);

		let btime = 0;
		window.addEventListener('popstate', () => {
			let time = new Date().getTime()
			let dt = time - btime;
			btime = time;
			if (dt > 10) this.desktop.backButton();

			history.go(1);
		});

		this.audio = new AudioSystem();
		
		// Fetch app definitions and prepare them
	 	let fres = await fetch('/fs/q/usr/apps.json');
		this.registeredApps = await fres.json();
		
		// Remove disabled apps
		for (let app of Object.keys(this.registeredApps)) {
			if (app.startsWith('-')) delete this.registeredApps[app];
		}
		
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
		return await this.runAppFetch('/app/' + name + '/manifest', buildArgs);
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
			let manifest = await fres.json();

			// Load required scripts beforehand
			for (let url of manifest.scripts) {
				// If the script is not loaded yet, do so.

				if (!this.loadedResources[url]) {
					let resId = btoa(url);
					await addScript(url, resId);
				}
			}

			// After loading required scripts, create the app object.
			let AppClass = getObjectByName(manifest.builder);
			if (!AppClass) {
				throw Error('Failed to instantiate "' + manifestURL + '", builder unavailable.');
			}

			if (!buildArgs) buildArgs = [];
			let app = new AppClass(...buildArgs);	
			app.classId = manifest.id;
			this.runningApps.push(app);
			this.reactor.fire('apps-add');

			// Register the app as an user of the loaded scripts.
			for (let url of manifest.scripts) {
				// Register resource in the app
				app.loadedResources.push(url);

				let res = this.loadedResources[url];
				if (res) {
					// The resource is already registered,
					// just add another user.
					res.addUser(app);
				} else {
					// Resource not registered yet, create its
					// object.
					let resId = btoa(url);

					// The resource hasn't been loaded yet.
					let resObj = new Resource();
					resObj.id = resId;
					resObj.users = [app];
					resObj.fnUnload = () => {
						destroyElementById(resId);
					};
					resObj.permanent = true;
					this.loadedResources[url] = resObj;
				}
			}		
		
			await app.init();
			return app;
		} catch (err) {
			console.error(err);	
			this.showErrorDialog(err, 'App Initialization');
		}
		return null;
	}

	async endApp(instance) {
		// Check if app is on the list
		let arr = this.runningApps;
		var i = arr.indexOf(instance);
		if (i == -1) return;

		// Release app resources
		for (let res of instance.loadedResources) {
			this.releaseResource(res, instance);
		}

		// Remove app from app list
		arr.splice(i, 1); 
		this.reactor.fire('apps-rem');
	}

	async requestScript(url, user) {
		let res = this.loadedResources[url];

		if (res) {
			// The resource was already loaded, let's register
			// another user of it.
			res.addUser(user);
		} else {
			let resId = btoa(url);

			// The resource hasn't been loaded yet.
			let resObj = new Resource();
			resObj.permanent = true;
			resObj.id = resId;
			resObj.users = [user];
			resObj.fnUnload = () => {
				destroyElementById(resId);
			};
			this.loadedResources[url] = resObj;

			await addScript(url, resId);
		}
	}

	async requestStyle(url, user) {
		let res = this.loadedResources[url];

		if (res) {
			// The resource was already loaded, let's register
			// another user of it.
			if (!res["users"].includes(user)) {
				res["users"].push(user);
			}
		} else {
			let resId = btoa(url);

			// The resource hasn't been loaded yet.
			let resObj = new Resource();
			resObj.id = resId;
			resObj.users = [user];
			resObj.fnUnload = () => {
				destroyElementById(resId);
			};
			resObj.permanent = true;
			this.loadedResources[url] = resObj;

			await addStylesheet(url, resId);
		}
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

	showErrorDialog(msg, title) {
		if (!title) title = 'System Error';

		let win = this.desktop.createWindow();
		win.$window.addClass('error-dialog');
		win.setTitle(title);
		let $body = win.$window.find('.window-body');
		$body.append($('<img src="/res/img/icons/error.png">'))

		let html = msg.toString().replaceAll('\n', '<br>');

		$body.append($('<span>' + html + '</span>'))
		win.on('closereq', () => win.close());
		win.setSize(380, 200);
		win.bringToCenter();
		win.bringToFront();
		win.setVisible(true);
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
			this.reactor.fire('log')
		} catch (err) {
			this.showErrorDialog(err);
		}
	}

	setupLogging() {
		let self = this;

		// Hijack console
		/*let conLog = window.console.log;
		window.console.log = function() {
			self.logHistory += [...arguments].join(' ') + '\n';
			self.reactor.fire('log');
			conLog(...arguments);
		}

		let conError = window.console.error;
		window.console.error = function() {
			conError(...arguments);
		}*/

		window.addEventListener('error', (ev) => {
			this.log(`[Error] '${ev.message}' at ${ev.filename}:${ev.lineno}`);
		});

		window.addEventListener('unhandledrejection', (ev) => {
			this.log(`[PromErr] '${ev.reason}'`);
		});
	}

	on(evclass, callback) {
		this.reactor.on(evclass, callback);
		return callback;
	}

	off(evclass, callback) {
		this.reactor.off(evclass, callback);
	}
}

class FileTypes {
	static isDir(path) {
		return path.endsWith('/');
	}

	static isVideo(path) {
		return endsWithArr(path, ['.mp4', '.mkv', '.webm', '.m4v']);
	}

	static isPicture(path) {
		return endsWithArr(path, ['.png', '.jpg', '.jpeg', '.webp']);
	}

	static isAudio(path) {
		return endsWithArr(path, ['.mp3', '.ogg', 'm4a', '.opus', '.weba']);
	}
	
	static isText(path) {
		return endsWithArr(path, ['.txt']);
	}
	
	static isMedia(path) {
		return FileTypes.isVideo(path) || FileTypes.isPicture(path) || FileTypes.isAudio(path);
	}
}

class Reactor {
	constructor() {
		this.evclasses = {};
	}

	register() {
		for (let name of arguments) {
			this.evclasses[name] = [];
		}
	}

	unregister(name) {
		delete this.evclasses[name];
	}

	on(name, callback) {
		let list = this.evclasses[name];
		if (!list) throw Error(`No class ${name} registered.`);

		list.push(callback);
		return callback;
	}

	off(name, callback) {
		let list = this.evclasses[name];
		if (!list) return;
		arrErase(list, callback);
	}

	fire(name, args) {
		let list = this.evclasses[name];
		if (!list) return;

		for (let fn of list) {
			if (args) fn(...args);
			else fn();
		}
	}
}

class Deferred {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.reject = reject
			this.resolve = resolve
		})
	}
}

function klog(msg) {
	WebSys.log(msg);
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

function pathJoin(base, child) {
	let path = "";

	if (child.startsWith("/")) {
		path = child;
	} else if (base.endsWith("/")) {
		path = base + child;
	} else {
		path = base + "/" + child;
	}

	return pathResolve(path);
}

function pathResolve(path) {
	path = path.replaceAll('/./', '/');
	if (path.endsWith('/.')) path = path.slice(0, -1);

	while (true) {
		let ellipsis = path.indexOf("/..", 1);
		if (ellipsis == -1) break;

		let slash = path.lastIndexOf("/", ellipsis - 1);
		if (slash < 0) {
			path = "./" + path.slice(ellipsis + 4);
			break;
		}

		let base_ = path.slice(0, slash + 1);
		let child_ = path.slice(ellipsis + 4);
		if (base_ == "/") {
			path = base_ + child_;
			break;
		} else if (base_ == "") {
			path = "./" + child_;
			break;
		}
		path = base_ + child_;
	}
	return path;
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

function getURLParams() {
	return new Proxy(new URLSearchParams(window.location.search), {
 		get: (searchParams, prop) => searchParams.get(prop),
	});
}

function clampf(value, min, max) {
	if (value > max) return max;
	if (value < min) return min;
	return value;
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