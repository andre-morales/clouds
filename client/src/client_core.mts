import App, { AppManifest } from './app.mjs';
import Resource from './resource.mjs';
import { FileSystem } from './filesystem.mjs';
import { AudioSystem } from './audio_system.mjs';
import { Reactor } from './events.mjs';
import Util, { getObjectByName } from './util.mjs';
import { IllegalStateFault } from './faults.mjs';
import * as MediaSessionBridge from './media_session_bridge.mjs';
import * as Dialogs from './ui/dialogs.mjs';
import Desktop from './ui/desktop.mjs';
import UIControls from './ui/controls/controls.mjs';

var Client;

export async function main() {
	// Fetch desktop page and display the system version on the page
	let desktopPageProm = fetch('/page/desktop').then(fRes => {
		if (fRes.status != 200) {
			throw new IllegalStateFault('Desktop page could not be accessed.');
		}

		return fRes.text();
	}).then(text => {
		document.body.innerHTML = text;

		// Display client version
		$('#client-ver').text(ClientClass.BUILD_TEXT);
	});

	// Load basic desktop page and style, this will bring the taskbar and system version
	// on display
	let desktopStyleProm = Util.addStylesheet('/res/css/desktop.css');
	await desktopPageProm;
	await desktopStyleProm;

	// Schedule loading of main system scripts
	let scriptsPromises = Promise.all([
		Util.addScript('/res/pack/public.bundle.js'),
		Util.addScript('/res/lib/hammer.min.js')
	]);

	// Schedule loading of main styles
	let stylesPromises = Promise.all([
		Util.addStylesheet('/res/css/ui.css'),
		Util.addStylesheet('/res/css/controls.css')
	]);

	// Wait for scripts and styles
	console.log("Scheduled all main resources.");
	
	await scriptsPromises;
	console.log("Scripts finished loading.");
	
	await stylesPromises;
	console.log("Styles finished loading.");

	// Instantiate system
	Client = new ClientClass();
	await Client.init();

	Util.destroyElementById('loading-screen');

	Client.start(Util.getURLParams());
}

export function get() {
	return Client;
}

export class ClientClass {
	CLIENT_VERSION: string;
	BUILD_STRING: string;
	BUILD_TEXT: string;
	API_VERSION: string;

	logHistory: string;
	runningApps: App[];
	loadedResources: any;
	_reactor: Reactor;
	desktop: Desktop;
	registeredApps: any;
	mediaSessionBridge: any;
	audio: AudioSystem;

	constructor() {
		this.CLIENT_VERSION = ClientClass.CLIENT_VERSION;
		this.BUILD_STRING = ClientClass.BUILD_STRING;
		this.BUILD_TEXT = ClientClass.BUILD_TEXT;
	}

	static get CLIENT_VERSION() { return '1.0.203'; }
	static get BUILD_STRING() { return `${this.CLIENT_VERSION} Early Test 2`; }
	static get BUILD_TEXT() { return `Clouds ${this.BUILD_STRING}`; }

	async init() {
		// Export global names
		window.Client = Client;
		(window as any).App = App;

		// Start logging record
		this.logHistory = '[Begin]\n';
		this.initLogging();

		// Create main structures
		this.runningApps = [];
		this.loadedResources = {};
		this._reactor = new Reactor();
		this._reactor.register('log', 'apps-add', 'apps-rem');
		
		// Display API version
		fetch('/stat/version').then(async (fRes) => {
			if (fRes.status != 200) return;

			let version = await fRes.text();
			this.API_VERSION = version;

			$('#api-ver').text('API ' + version);
		});

		UIControls.init();

		// Create desktop subsystem
		this.desktop = new Desktop();

		this.initGraphicalErrors();

		// Save current page on history and rack back button press
		let bTime = 0;
		history.pushState(null, null, location.href);
		window.addEventListener('popstate', () => {
			let time = new Date().getTime()
			let dt = time - bTime;
			bTime = time;
			if (dt > 10) this.desktop.backButton();

			history.go(1);
		});

		// Fetch app definitions from the user profile
		this.registeredApps = await FileSystem.readJson('/usr/.system/apps.json');
		
		// Remove disabled apps
		for (let app of Object.keys(this.registeredApps)) {
			if (app.startsWith('-')) delete this.registeredApps[app];
		}
		
		this.desktop.taskbar.setupAppsMenu();

		// Let the desktop prepare app icons and behavior
		this.desktop.setupApps();

		// Media Session bridge
		this.mediaSessionBridge = MediaSessionBridge;
		this.mediaSessionBridge.init();

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

	logout(refresh = true) {
		Util.setCookie('auth_key', '');
		fetch("/auth/logout", {
			method: "POST"
		});
		
		if (refresh) window.location.href = "/";
	}

	async runApp(name: string, buildArgs?: unknown[]) {
		return await this.runAppFetch('/app/' + name + '/manifest.json', buildArgs);
	}

	async runAppFetch(manifestURL: string, buildArgs?: unknown[]) {
		try {
			// Fetch manifest
			let fRes = await fetch(manifestURL);
			if (fRes.status == 404) {
				throw new Error('Failed to instantiate "' + manifestURL + '", manifest not found.');
			}
			if (fRes.status == 403) {
				throw new Error('Failed to instantiate "' + manifestURL + '", access denied.');
			}

			// Await for manifest
			let manifestObj = await fRes.json();
			let manifest = manifestObj as AppManifest;

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
				let namespace = await IMPORT(moduleName);

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
			this.showErrorDialog('App Initialization', err, err);
		}
		return null;
	}

	async endApp(instance: App, exitCode?: number) {
		// Check if app is on the list
		if (!this.runningApps.includes(instance)) return;

		// If it is on a valid state, dispose of it
		if (!instance.canEnd()) return;
		instance._dispose(exitCode);

		// Remove app from app list
		Util.arrErase(this.runningApps, instance);
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
				Util.destroyElementById(resId);
			};
			this.loadedResources[url] = resource;

			await Util.addModule(url, resId);
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
				Util.destroyElementById(resId);
			};
			this.loadedResources[url] = resource;

			await Util.addScript(url, resId);
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
				Util.destroyElementById(resId);
			};
			resource.permanent = false;
			this.loadedResources[url] = resource;

			await Util.addStylesheet(url, resId);
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

	initLogging() {
		window.addEventListener('error', (ev) => {
			let lmsg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
			if (ev.error.stack) {
				lmsg += ev.error.stack;
			} else {
				lmsg += 'unavailable';
			}
			this.log(lmsg);
		});

		window.addEventListener('unhandledrejection', (ev) => {
			this.log(`[Error] Unhandled rejection: ${ev.reason.stack}`);
		});
	}

	initGraphicalErrors() {
		window.addEventListener('error', (ev) => {
			let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
			if (ev.error.stack) {
				msg += ev.error.stack;
			} else {
				msg += 'unavailable';
			}
			let stack = '';
			if (ev.error.stack) {
				stack = `\n${ev.error.stack}`;
			}
			this.showErrorDialog("Error", `Unhandled error:\n${ev.message}${stack}`);
		});
		
		window.addEventListener('unhandledrejection', (ev) => {
			this.showErrorDialog("Error", `Unhandled rejection: ${ev.reason}\n${ev.reason.stack}`, ev.reason);
		});

		// Disable entry-level error handlers
		window.onerror = undefined;
		window.onunhandledrejection = undefined;
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

	stringifyError(err) {
		if (err.stack)
		return err.stack;
	}

	showErrorDialog(title, msg, error?: Error) {
		try {
			let [win, p] = Dialogs.showError(this.desktop.dwm, title, msg);
			win.$window.find('.options button').focus();
		} catch (err) {
			console.log("---- Couldn't display the error ----");
			console.error(error);
			console.log("------------- Due to ---------------")
			console.error(err);
			console.log("------------------------------------")

			// If the dialog has an optional error object, show it
			let causeString = (err.stack) ? err.stack : err;
			let errorDetail = '';
			if (error && error.stack) {
				errorDetail = `<b>Error: </b>${error.stack}\n`;
			}

			let originalErrStr = `[${title}]: "${msg}".\n${errorDetail}`;
			let panicMsg = `Couldn't show ${originalErrStr}\n<b>Display Failure Cause: </b>${causeString}`;
			_systemPanic("No Error Display", panicMsg);
		}
	}

	// -- Reactor aliases --
	on(evClass: string, callback: any) {
		this._reactor.on(evClass, callback);
		return callback;
	}

	off(evClass: string, callback: any) {
		this._reactor.off(evClass, callback);
	}

	dispatch(evClass: string, args?: unknown) {
		this._reactor.dispatch(evClass, args);
	}
}

export default { get };