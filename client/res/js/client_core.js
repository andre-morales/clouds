var Client;

async function main() {
	// Load jquery compatible lib
	await addScript('/res/js/lib/zepto.min.js');

	// Early unhandled errors and rejections should bring immediate user attention
	window.onerror = (err) => {
		_systemPanic("Unhandled error", err, true);
	};

	window.onunhandledrejection = (ev) => {
		_systemPanic("Unhandled promise error", ev.reason, true);
	};

	// Schedule loading of main system scripts
	let scriptsP = Promise.all([
		addScript('/res/js/faults.js'),
		addScript('/res/js/events.js'),
		addScript('/res/js/util.js'),
		addScript('/res/js/filesystem.js'),
		addScript('/res/js/app.js'),
		addScript('/res/js/desktop.js'),
		addScript('/res/js/lib/hammer.min.js'),
		addScript('/res/js/context_menu.js'),
		addScript('/res/js/window.js'),
		addScript('/res/js/dialogs.js'),
		addScript('/res/js/audiosystem.js'),
		addScript('/res/js/controls.js'),
		addModule('/res/js/media_sess_bridge.mjs')
	]);

	// Load style
	addStylesheet('/res/css/desktop.css');

	// Fetch desktop page
	let fres = await fetch('/page/desktop');
	if (fres.status != 200) {
		throw new IllegalStateFault('Desktop paged could not be accessed.');
	}
	document.body.innerHTML = await fres.text();

	// Wait for all scripts to load
	await scriptsP;

	// Instatiate system
	Client = new ClientClass();
	await Client.init();

	destroyElementById('loading-screen');

	Client.start(getURLParams());
}

class ClientClass {
	constructor() {
		this.CLIENT_VERSION = '1.0.155';
		this.BUILD_STRING = `${this.CLIENT_VERSION} Early Test 1`
		this.BUILD_TEXT = `Clouds ${this.BUILD_STRING}`;
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

		// Display version on ui
		fetch('/version').then(async (fres) => {
			let apiv = await fres.text();
			this.API_VERSION = apiv;

			let sysv = Client.BUILD_TEXT;
			let vtext = `${sysv}<br>API v${apiv}`; 
			$('.desktop .backplane .text').html(vtext);
		})
		
		// Create desktop subsystem
		this.desktop = new Desktop();

		// Media Session bridge
		this.mediaSessionBridge = await import('@client/media_sess_bridge.mjs');
		this.mediaSessionBridge.init();

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

		// Fetch app definitions from the user profile
		this.registeredApps = await FileSystem.readJson('/usr/apps.json');
		
		// Remove disabled apps
		for (let app of Object.keys(this.registeredApps)) {
			if (app.startsWith('-')) delete this.registeredApps[app];
		}
		
		// Let the desktop prepare app icons and behavior
		this.desktop.setupApps();

		// Initialize audio subsystem
		this.audio = new AudioSystem();
	}

	async start(args) {
		this.desktop.start();

		if (args && args.loc) {
			let app = await this.runApp('explorer');
			app.go(args.loc);
		}
	}

	logout() {
		setCookie('authkey', '');
	}

	async runApp(name, buildArgs) {
		return await this.runAppFetch('/app/' + name + '/manifest.json', buildArgs);
	}

	async runAppFetch(manifestURL, buildArgs) {
		try {
			// Fetch manifest
			let fres = await fetch(manifestURL);
			if (fres.status == 404) {
				throw new Error('Failed to instantiate "' + manifestURL + '", manifest not found.');
			}
			if (fres.status == 403) {
				throw new Error('Failed to instantiate "' + manifestURL + '", access denied.');
			}

			// Await for manifest
			let manifest = await fres.json();

			let tmpUserId = 'APP-CREATOR';

			// Load required scripts and styles declared in the manifest
			let modules = (manifest.modules) ? manifest.modules : [];
			let scripts = (manifest.scripts) ? manifest.scripts : [];
			let styles = (manifest.styles) ? manifest.styles : [];

			let loadingModulesPromises = modules.map((url) => {
				return this.requestModule(url, tmpUserId);
			});

			let loadingScriptsPromises = scripts.map((url) => {
				return this.requestScript(url, tmpUserId);
			});

			let loadingStylesPromises = styles.map((url) => {
				return this.requestStyle(url, tmpUserId);
			});

			// Wait for all scripts to load and save the resource objects.
			// We don't wait for the styles to load since most of the time, its not necessary
			let loadedModuleResources = await Promise.all(loadingModulesPromises);
			let loadedScriptResources = await Promise.all(loadingScriptsPromises);

			let AppClass;

			// Obtain the app class declared in the manifest from the global namespace
			if (manifest.builder) {
				AppClass = getObjectByName(manifest.builder)
			// Obtain the app class as the default export of the first module
			} else {
				if (modules.length < 1) {
					throw Error('Failed to instantiate "' + manifestURL + '", undisclosed builder and no modules declared.');
				}

				// Import first module
				let moduleName = modules[0];
				let namespace = await import(moduleName);

				AppClass = namespace.default;
			}
			
			if (!AppClass) {
				throw Error('Failed to instantiate "' + manifestURL + '", builder unavailable.');
			}

			// Instantiate the app object with any passed arguments
			if (!buildArgs) buildArgs = [];
			let app = new AppClass(manifest, buildArgs);

			// Replace the temporary user and set the app as a user of its own script resources
			for (let res of loadedModuleResources) {
				res.users[res.users.indexOf(tmpUserId)] = app;
			}

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
			Client.logError(err);	
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

	// Loads the module with the given url and registers a user.
	// If the module is already loaded, just register another user for it. Otherwise, load it and register its first user.
	// Returns the resource object that represents this module.
	async requestModule(url, user) {
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

			await addModule(url, resId);
		}
		return resource;
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


	downloadUrl(path) {
		let link = document.createElement('a');
		link.style.display = 'none';
		link.href = path;
		link.download = '';
		document.body.appendChild(link);
		link.click();
		link.remove();
	}

	registerMediaElement(elem) {
		return this.mediaSessionBridge.registerMediaElement(elem);
	}

	// -- Logging --
	setupLogging() {
		window.onerror = (msg, file, line, col, err) => {
			let lmsg = `[Error] Unhandled error "${msg}"\n    at: ${file}:${line}\n  says: ${err}\n stack: `;
			if (err.stack) {
				lmsg += err.stack;
			} else {
				lmsg += 'unavailable';
			}
			this.log(lmsg);
			this.showErrorDialog("Error", `Unhandled error\n\n${msg}`);
		};

		window.onunhandledrejection = (ev) => {
			this.log(`[Error] Unhandled rejection: ${ev.reason}`);
			this.showErrorDialog("Error", `Unhandled rejection: ${ev.reason}`);
		};
	}

	log(msg) {
		console.log(msg);

		try {
			this.logHistory += msg + '\n';
			this._reactor.dispatch('log', undefined, (fn) => {
				if (fn.disabled) return;

				try {
					fn(msg);
				} catch (err) {
					fn.disabled = true;
					this.showErrorDialog("Log failure", `A log event handler threw an exception and was disabled.\n\n${err}`);
					Client.logError(err);
					console.error('Error thrown in log listener:', err);
				}
			});
		} catch (err) {
			this.showErrorDialog("Log failure", `Log system failure.`);
		}
	}

	logError(err) {
		let msg = `${err}\n stack: `;
		if (err.stack) {
			msg += err.stack;
		} else {
			msg += 'unavailable';
		};
		Client.log("[Error] " + msg);
	}

	showErrorDialog(title, msg) {
		try {
			let [win, p] = Dialogs.showError(this.desktop.dwm, title, msg);
			win.$window.find('.options button').focus();
		} catch (err) {
			console.log("---- Couldn't display error message ----");
			console.error(err);
			console.log("----------------------------------------")
			_systemPanic("No Error Display", `Couldn't show [${title}]: "${msg}", due to "${err}"`);
		}
	}

	// -- Reactor aliases --
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

class LocalClipboard {
	static async saveObject(type, object) {
		this.object = object;
		this.type = type;
	}

	static async getObject() {
		return this.object;
	}	

	static async getType() {
		return this.type;
	}

	static clear() {
		this.object = null;
		this.type = null;
	}
}

function _systemPanic(title, msg, mode) {
	console.error('--- SYSTEM PANIC ---');
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

main();
