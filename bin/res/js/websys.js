var webSys = null;

async function main() {
	await addScript('/res/js/lib/zepto.min.js');
	await addScript('/res/js/desktop.js');
	await addScript('/res/js/window.js');

	addStylesheet('/res/css/desktop.css');

	// Fetch desktop page
	let fres = await fetch('/page/desktop');
	if (fres.status != 200) {
		console.log('Forbidden.');
	}
	document.getElementById('body').innerHTML = await fres.text();

	webSys = new WebSys();
	endTransition();

	webSys.init(getURLParams());
}

class WebSys {
	static get WEBSYS_VERSION() { return '0.5.0'; }
	static get WSCLIENT_VERSION() { return '0.5.0'; }

	constructor() {
		this.desktop = new Desktop(this);
		this.runningApps = [];
		this.loadedResources = {};
		this.logHistory = '[Begin]\n';
		this.logListeners = [];

		history.pushState(null, null, location.href); // Push new history entry to stack

		let btime = 0;
		window.addEventListener('popstate', () => {
			let time = new Date().getTime()
			let dt = time - btime;
			btime = time;
			if (dt > 10) this.desktop.backButton();

			history.go(1);
		});
	}

	async init(args) {
		let apiv = await (await fetch('/version')).text();

		let sysv = WebSys.WEBSYS_VERSION;
		let clientv = WebSys.WSCLIENT_VERSION;
		let vtext = `WebSys Modern v${sysv}<br>API v${apiv}<br>Client v${clientv}`; 
		$('.desktop .backplane .text').html(vtext);

		this.audioContext = new AudioContext();
		this.audioDestination = this.audioContext.createGain();

		var lowshelf = this.audioContext.createBiquadFilter(),
	    mid = this.audioContext.createBiquadFilter(),
	    highshelf = this.audioContext.createBiquadFilter();

	 //set the filter types (you could set all to 5, for a different result, feel free to experiment)
	 lowshelf.type = 'lowshelf';
	 lowshelf.frequency.value = 250;
	 lowshelf.gain.value = 0;

	 mid.type = 'peaking';
	 mid.frequency.value = 1000;
	 mid.gain.value = 0;

	 highshelf.type = 'highshelf';
	 highshelf.frequency.value = 2000;
	 highshelf.gain.value = 0;

	 this.lowshelf = lowshelf;
	 this.mids = mid;
	 this.highshelf = highshelf;

	 this.audioDestination.connect(lowshelf);
	 lowshelf.connect(mid);
	 mid.connect(highshelf);
	 highshelf.connect(this.audioContext.destination);

		if (args && args.loc) {
			let app = await runApp('explorer');
			app.go(args.loc);
		}
	}

	async runApp(name, buildArgs) {
		return await this.runAppFetch('/app/' + name + '/manifest', buildArgs);
	}

	async runAppFetch(manifestURL, buildArgs) {
		try {
			klog('Fetching [' + manifestURL + ']');

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

			let app = new AppClass(this, buildArgs);	
			app.classId = manifest.id;
			this.runningApps.push(app);

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
		for (let ll of this.logListeners) {
			try {
				ll();
			} catch (err) {
				this.showErrorDialog(err);
			}
		}
	}

	addLogListener(fn) {
		this.logListeners.push(fn);
		return fn;
	}

	removeLogListener(fn) {
		let arr = this.logListeners;
		var i = arr.indexOf(fn);
		if (i == -1) return;
		arr.splice(i, 1); 
	}
}

class App {
	constructor(sys, args) {
		this._sys = sys;
		if (!args) args = [];
		this.buildArgs = args;
		this.loadedResources = [];
	}

	requireScript(url) {
		this._sys.requestScript(url, this);
		this.loadedResources.push(url);
	}

	requireStyle(url) {
		this._sys.requestStyle(url, this);
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

		this._sys.endApp(this);
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
		console.log('Unloading resource id ' + atob(this.id));
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

	unregister(name) {
		delete this.evclasses[name];
	}

	on(name, callback) {
		let list = this.evclasses[name];
		if (!list) list = this.evclasses[name] = [];

		list.push(callback);
		return callback;
	}

	off(name, callback) {
		let list = this.evclasses[name];
		if (!list) return;
		arrErase(list, callbcak);
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

function klog(msg) {
	webSys.log(msg);
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

main();

