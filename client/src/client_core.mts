import App from '/@sys/app.mjs';
import { AudioSystem } from './bridges/audio_system.mjs';
import { Reactor } from './events.mjs';
import Browser from './utils/browser.mjs';
import { IllegalStateFault } from './faults.mjs';
import * as MediaSessionBridge from './bridges/media_session_bridge.mjs';
import Desktop from './ui/desktop.mjs';
import UIControls from './ui/controls/controls.mjs';
import ResourceManager from './resource_manager.mjs';
import AppRunner from './app_runner.mjs';
import { AppManager } from './app_manager.mjs';
import { ConfigManager } from './config_manager.mjs';
import Arrays from '../../common/arrays.mjs';
import { WatsonTools } from './watson/watson_tools.mjs';

var clientInstance: ClientClass;
var loadingText: HTMLElement;

declare global {
	var EntrySpace: any;
	var sourceMap: any;
}

export async function main() {
	EntrySpace.log('Reached core module entry point.');

	await WatsonTools.init();

	loadingText = document.getElementById('loading-text');
	loadingText.innerHTML = "Initializing core...";

	// Fetch desktop page and display the system version on the page
	let desktopPageProm = fetch('/page/desktop').then(fRes => {
		if (fRes.status != 200) {
			throw new IllegalStateFault('Desktop page could not be accessed.');
		}

		return fRes.text();
	}).then(text => {
		document.body.innerHTML += text;

		// Display client version
		$('#client-ver').text(ClientClass.BUILD_TEXT);
	});

	// Load basic desktop page and style, this will bring the taskbar and system version
	// on display
	let desktopStyleProm = Browser.addStylesheet('/res/css/desktop.css');
	await desktopPageProm;
	await desktopStyleProm;

	// Schedule loading of main system scripts
	let scriptsPromises = Promise.all([
		Browser.addScript('/res/pack/public.chk.js'),
		Browser.addScript('/res/pack/platform.chk.js'),
		Browser.addScript('/res/lib/hammer.min.js')
	]);

	// Schedule loading of main styles
	let stylesPromises = Promise.all([
		Browser.addStylesheet('/res/css/ui.css'),
		Browser.addStylesheet('/res/css/controls.css')
	]);

	// Wait for scripts and styles
	EntrySpace.log("Scheduled all main resources.");
	
	await scriptsPromises;
	EntrySpace.log("Scripts finished loading.");
	
	await stylesPromises;
	EntrySpace.log("Styles finished loading.");

	// Instantiate system
	clientInstance = new ClientClass();
	await clientInstance.init();

	// Once the system has finished starting up, remove the load screen and the boot error handlers.
	Browser.destroyElementById('loading-screen');
	EntrySpace.disableHandlers();
	EntrySpace.disablePanicHandlers();

	clientInstance.start(Browser.getURLParams());
}
	
export class ClientClass {
	static readonly CLIENT_VERSION = '1.0.243';
	static readonly BUILD_STRING = `${this.CLIENT_VERSION} Milestone 1`;
	static readonly BUILD_MODE = __BUILD_MODE__;
	static readonly BUILD_TEXT = `Clouds ${this.BUILD_STRING} (${this.BUILD_MODE})`;
	static readonly API_VERSION: string;

	watson: WatsonTools;
	resources: ResourceManager;
	desktop: Desktop;
	audio: AudioSystem;
	appManager: AppManager;
	config: ConfigManager;
	mediaSessionBridge: typeof MediaSessionBridge;
	runningApps: App[];
	events: Reactor;

	constructor() {}

	async init() {
		let promises: Promise<any>[] = [];

		// Export global names
		window.Client = clientInstance;
		(window as any).App = App;

		// Init watson logging and error handling
		this.watson = WatsonTools.get();

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
		Browser.setCookie('auth_key', '');
		fetch("/auth/logout", {
			method: "POST"
		});
		
		if (refresh) window.location.href = "/";
	}

	async runApp(name: string, buildArgs = []): Promise<App> {
		return await AppRunner.runUrl('/app/' + name + '/manifest.json', buildArgs);
	}

	async endApp(instance: App, exitCode?: number) {
		// Check if app is on the list
		if (!this.runningApps.includes(instance)) return;

		// If it is on a valid state, dispose of it
		if (!instance.isAlive()) return;
		instance._dispose(exitCode);

		// Remove app from app list
		Arrays.erase(this.runningApps, instance);
		this.events.dispatch('apps-rem');
	}

	initGraphicalErrors() {
		this.watson.initGraphicalErrorHandlers();

		// Disable entry-level error handlers
		window.onerror = undefined;
		window.onunhandledrejection = undefined;
	}

	log(msg: string) {
		console.log(msg);

		try {
			this.watson.logHistory += msg + '\n';
			this.events.dispatch('log', undefined, (fn) => {
				if (fn.disabled) return;

				try {
					fn({message: msg});
				} catch (err) {
					fn.disabled = true;
					this.watson.showErrorDialog("Log failure", `A log event handler threw an exception and was disabled.\n\n${err}`);
					console.error('Error thrown in log listener:', err);
				}
			});
		} catch (err) {
			this.watson.showErrorDialog("Log failure", `Log system failure.`);
		}
	}

	showErrorDialog(title, msg, error?: Error) {
		this.watson.showErrorDialog(title, msg, error);
	}

	static get(): ClientClass {
		return clientInstance;
	}
}
