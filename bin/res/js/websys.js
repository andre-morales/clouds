var WebSys;

async function main() {
	let scriptsP = Promise.all([
		addScript('/res/js/lib/zepto.min.js'),
		addScript('/res/js/lib/hammer.min.js'),
		addScript('/res/js/desktop.js'),
		addScript('/res/js/window.js')
	]);

	addStylesheet('/res/css/desktop.css');

	// Fetch desktop page
	let fres = await fetch('/page/desktop');
	if (fres.status != 200) {
		console.error('Forbidden.');
		return;
	}
	document.getElementById('body').innerHTML = await fres.text();

	// Instatiate system
	await scriptsP;

	WebSys = new WebSysClass();
	await WebSys.init();
	endTransition();

	WebSys.start(getURLParams());
}

class WebSysClass {
	async init() {
		this.WEBSYS_VERSION = '0.6.0';
		this.WSCLIENT_VERSION = '0.6.0';
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

		this.createAudioSystem();

	 	let fres = await fetch('/res/user/desktop.json');
		let deskApps = await fres.json();
		this.desktop.setApps(deskApps);
	}

	async start(args) {
		this.desktop.start();

		if (args && args.loc) {
			let app = await runApp('explorer');
			app.go(args.loc);
		}
	}

	createAudioSystem() {
		this.audioContext = new AudioContext();
		this.audioDestination = this.audioContext.createGain();
		this.audioEqPoints = [];
		this.audioClipEnabled = false;
		this.audioClipBound = 1;

		let pointsc = 6;
		let prevNode = this.audioDestination;

		for (let i = 0; i < pointsc; i++) {
			let filter = this.audioContext.createBiquadFilter();
			filter.frequency.value = 2 ** (10/(pointsc + 1) * (i + 1)) * 20;

			if (i == 0) {
				filter.type = 'lowshelf';
			} else if (i == pointsc - 1) {
				filter.type = 'highshelf';
			} else {
				filter.type = 'peaking';
			}

			prevNode.connect(filter);
			prevNode = filter;
			this.audioEqPoints.push(filter);
		}

		this.audioFinal = this.audioContext.createGain();
		let nodex = this.audioContext.createScriptProcessor(0, 1, 1);
		nodex.onaudioprocess = (ev) => {
			let input = ev.inputBuffer.getChannelData(0);
	        let output = ev.outputBuffer.getChannelData(0);

	        if (!this.audioClipEnabled) { 
	        	output.set(input);
	        	return;
	        }

	        let b = this.audioClipBound;
	        for (let i = 0; i < input.length; i++) {
	        	let v = input[i];
	        	if (v > b) v = b;
	        	if (v < -b) v = -b;
	        	output[i] = v;
	        }
		};

		prevNode.connect(this.audioFinal);
		this.audioFinal.connect(nodex);
		nodex.connect(this.audioContext.destination);
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

			let app = new AppClass(buildArgs);	
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
			this.loadedResources[url] = resObj;

			await addStylesheet(url, resId);
		}
	}

	releaseResource(url, user) {
		let res = this.loadedResources[url];
		if (!res) return;

		let users = res["users"];

		var i = users.indexOf(user);
		if (i == -1) return;
			
		users.splice(i, 1);

		if (users.length == 0) {
			res.unload();
			delete this.loadedResources[url];
		}	
	}

	showErrorDialog(msg, title) {
		if (!title) title = 'System Error';

		let win = this.desktop.createWindow();
		win.$window.addClass('error-dialog');
		win.setTitle(title);
		let $body = win.$window.find('.body');
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
		let conLog = window.console.log;
		window.console.log = function() {
			self.logHistory += [...arguments].join(' ') + '\n';
			conLog(...arguments);
		}

		let conError = window.console.error;
		window.console.error = function() {
			conError(...arguments);
		}

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

class App {
	constructor(args) {
		if (!args) args = [];
		this.buildArgs = args;
		this.loadedResources = [];
	}

	requireScript(url) {
		WebSys.requestScript(url, this);
		this.loadedResources.push(url);
	}

	requireStyle(url) {
		WebSys.requestStyle(url, this);
		this.loadedResources.push(url);
	}

	saveAppWindowState(win) {
		let state;
		if (win.maximized) {
			state = [win.maximized, win.restoredBounds];
		} else {
			state = [win.maximized, win.getBoundsA()];
		}

		let regname = 'app.' + this.classId + '.winstate';
		localStorage.setItem(regname, JSON.stringify(state));
	}

	restoreAppWindowState(win) {
		let regname = 'app.' + this.classId + '.winstate';
		try {
			let state = JSON.parse(localStorage.getItem(regname));
			if (state) {
				win.setBoundsA(state[1]);
				win.setMaximized(state[0]);
				return true;
			}
		} catch (e) {}
		return false;
	}

	onClose() {}
	
	close() {
		this.onClose();
		WebSys.endApp(this);
	}
}

class Resource {
	constructor() {
		this.id = null;
		this.users = [];
		this.fnUnload = null;
	}

	addUser(user) {
		if (!this.users.includes(user)) {
			this.users.push(user);
			return true;
		}
		return false;
	}

	unload() {
		this.fnUnload();
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
		return endsWithArr(path, ['.mp3', '.ogg', 'm4a', '.opus']);
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

async function copyTextToClipboard(text) {
	await navigator.clipboard.writeText(text);
}

function clampf(value, min, max) {
	if (value > max) return max;
	if (value < min) return min;
	return value;
}

main();

