import App from '/@sys/app.mjs';
import { AudioSystem } from './bridges/audio_system.mjs';
import { Reactor } from './events.mjs';
import Util from './util.mjs';
import { IllegalStateFault } from './faults.mjs';
import * as MediaSessionBridge from './bridges/media_session_bridge.mjs';
import * as Dialogs from './ui/dialogs.mjs';
import Desktop from './ui/desktop.mjs';
import UIControls from './ui/controls/controls.mjs';
import ResourceManager from './resource_manager.mjs';
import AppRunner from './app_runner.mjs';
import { AppManager } from './app_manager.mjs';
import { ConfigManager } from './config_manager.mjs';
import Arrays from './utils/arrays.mjs';

var clientInstance: ClientClass;
var loadingText: HTMLElement;

export async function main() {
	loadingText = document.getElementById('loading-text');
	loadingText.innerHTML = "Initializing core...";

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
	clientInstance = new ClientClass();
	await clientInstance.init();

	Util.destroyElementById('loading-screen');

	clientInstance.start(Util.getURLParams());
}
	
export class ClientClass {
	static readonly CLIENT_VERSION = '1.0.220';
	static readonly BUILD_STRING = `${this.CLIENT_VERSION} Milestone 1`;
	static readonly BUILD_TEXT = `Clouds ${this.BUILD_STRING}`;
	static readonly API_VERSION: string;

	resources: ResourceManager;
	desktop: Desktop;
	audio: AudioSystem;
	appManager: AppManager;
	config: ConfigManager;
	mediaSessionBridge: any;
	logHistory: string;
	runningApps: App[];
	events: Reactor;

	constructor() {}

	async init() {
		let promises: Promise<any>[] = [];

		// Export global names
		window.Client = clientInstance;
		(window as any).App = App;

		// Start logging record
		this.logHistory = '[Begin]\n';
		this.initLogging();
	
		// Display API version
		fetch('/stat/version').then(async (fRes) => {
			if (fRes.status != 200) return;

			let version = await fRes.text();
			(ClientClass as any).API_VERSION = version;

			$('#api-ver').text('API ' + version);
		});

		// Create main structures
		this.runningApps = [];
		this.resources = new ResourceManager();
		this.events = new Reactor();
		this.events.register('log', 'apps-add', 'apps-rem');
		this.config = new ConfigManager();
		UIControls.init();

		// Fetch and load configuration
		promises.push(this.config.init());

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

		this.appManager = new AppManager();
		await this.appManager.init();
		
		// Let the desktop prepare app icons and behavior
		this.desktop.taskbar.setupAppsMenu();
		this.desktop.setupApps();

		// Media Session bridge
		this.mediaSessionBridge = MediaSessionBridge;
		this.mediaSessionBridge.init();

		// Initialize audio subsystem
		this.audio = new AudioSystem();

		await Promise.all(promises);
	}

	async start(args: any) {
		if (args && args.loc) {
			let app: any = await this.runApp('explorer');
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

	async runApp(name: string, buildArgs = []): Promise<App> {
		try {
			return await AppRunner.runUrl('/app/' + name + '/manifest.json', buildArgs);
		} catch(err) {
			this.logError(err);	
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
		Arrays.erase(this.runningApps, instance);
		this.events.dispatch('apps-rem');
	}

	registerMediaElement(elem) {
		return this.mediaSessionBridge.registerMediaElement(elem);
	}

	initLogging() {
		window.addEventListener('error', (ev) => {
			let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
			if (ev.error && ev.error.stack) {
				msg += ev.error.stack;
			} else {
				msg += 'unavailable';
			}
			this.log(msg);
		});

		window.addEventListener('unhandledrejection', (ev) => {
			this.log(`[Error] Unhandled rejection: ${ev.reason.stack}`);
		});
	}

	initGraphicalErrors() {
		window.addEventListener('error', (ev) => {
			let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
			if (ev.error && ev.error.stack) {
				msg += ev.error.stack;
			} else {
				msg += 'unavailable';
			}
			let stack = '';
			if (ev.error && ev.error.stack) {
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

	log(msg: string) {
		console.log(msg);

		try {
			this.logHistory += msg + '\n';
			this.events.dispatch('log', undefined, (fn) => {
				if (fn.disabled) return;

				try {
					fn(msg);
				} catch (err) {
					fn.disabled = true;
					this.showErrorDialog("Log failure", `A log event handler threw an exception and was disabled.\n\n${err}`);
					this.logError(err);
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
		this.log("[Error] " + msg);
	}

	stringifyError(err) {
		if (err.stack)
		return err.stack;
	}

	showErrorDialog(title, msg, error?: Error) {
		try {
			let [_, win] = Dialogs.showError(this.desktop.dwm, title, msg);
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

	static get(): ClientClass {
		return clientInstance;
	}
}
