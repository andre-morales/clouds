"use strict"

import App from '/@sys/app.mjs';
import { AudioSystem } from './drivers/audio_system.mjs';
import { Reactor, ReactorEvent } from './events.mjs';
import Browser from './utils/browser.mjs';
import { IllegalStateFault } from './faults.mjs';
import * as MediaSessionDriver from './drivers/media_session.mjs';
import Desktop from './ui/desktop.mjs';
import UIControls from './ui/controls/controls.mjs';
import AppRunner from './app_runner.mjs';
import { AppManager } from './app_manager.mjs';
import { ConfigManager } from './config_manager.mjs';
import Arrays from '../../common/arrays.mjs';
import { WatsonTools } from './watson/watson_tools.mjs';
import WebResourceManager from './web_resource_manager.mjs';
import Polyfills from './polyfills/polyfills.mjs';
import * as Public from './public.mjs';
import ThemeManager from './ui/theme_manager.mjs';
import './styles/main.scss';

var clientInstance: ClientClass;
var loadingText: HTMLElement;

declare global {
	var EntrySpace: any;
	var sourceMap: any;
}

export async function main() {
	EntrySpace.log('<> Welcome to Clouds ' + ClientClass.BUILD_STRING);
	EntrySpace.log('Reached core module entry point.');

	Polyfills.install();
	await WatsonTools.init();

	loadingText = document.getElementById('loading-text');
	loadingText.innerHTML = "Initializing core...";
	
	let uiPromise = initUI();
	let platformPromise = initPlatform();	
	EntrySpace.log("Scheduled all main resources.");
	
	// Wait for scripts and styles
	await platformPromise;
	await uiPromise;

	// Instantiate system
	clientInstance = new ClientClass();
	await clientInstance.init();

	// Once the system has finished starting up, remove the load screen and the boot error handlers.
	Browser.destroyElementById('loading-screen');
	EntrySpace.disableHandlers();
	EntrySpace.disablePanicHandlers();

	// If a program startup has been passed in the url, run it
	clientInstance.start(Browser.getURLParams());

	let bootTime = Date.now() - EntrySpace.startTime;
	EntrySpace.log(`Finished core initialization in ${bootTime}ms.`);
}

async function initUI() {
	// Fetch desktop page and display the system version on the page
	let desktopPageProm = fetch('/page/desktop').then(fRes => {
		if (fRes.status != 200) {
			throw new IllegalStateFault('Desktop page could not be accessed.');
		}

		return fRes.text();
	}).then(text => {
		document.body.innerHTML += text;
	});

	// Schedule loading of main styles
	let stylesPromise = Promise.all([
		Browser.addStylesheet('/res/pack/core.chk.css').promise,
	]);

	await desktopPageProm;
	await stylesPromise;
	EntrySpace.log("Styles finished loading.");

	// Display client version
	$('#client-ver').text(ClientClass.BUILD_TEXT);
	$('#desktop').css('display', '');
}

async function initPlatform() {
	// Schedule loading of main system scripts
	let scriptsPromises = Promise.all([
		Browser.addScript('/res/lib/hammer.min.js')
	]);

	await scriptsPromises;
	EntrySpace.log("Scripts finished loading.");
}

export class ClientClass {
	static readonly CLIENT_VERSION = '1.0.270';
	static readonly BUILD_STRING = `${this.CLIENT_VERSION} Milestone 1`;
	static readonly BUILD_MODE = __BUILD_MODE__;
	static readonly BUILD_TEXT = `Clouds ${this.BUILD_STRING} (${this.BUILD_MODE})`;
	static readonly API_VERSION: string;

	watson: WatsonTools;
	resources: WebResourceManager;
	desktop: Desktop;
	audio: AudioSystem;
	appManager: AppManager;
	config: ConfigManager;
	themeManager: ThemeManager;
	mediaSessionBridge: typeof MediaSessionDriver;
	runningApps: App[];
	events: Reactor<{ log: ReactorEvent }>;

	constructor() {}

	async init() {
		let promises: Promise<any>[] = [];

		// Export global names
		let world = window as any;
		world.PublicModules = Public;
		world.Client = clientInstance;
		world.App = App;

		// Init watson logging and error handling
		this.watson = WatsonTools.get();

		// Display API version
		promises.push(fetch('/stat/version').then(async (fRes) => {
			if (fRes.status != 200) return;

			let version = await fRes.text();
			(ClientClass as any).API_VERSION = version;

			$('#api-ver').text('API ' + version);
		}));

		// Create main structures
		this.runningApps = [];
		this.resources = new WebResourceManager();
		this.events = new Reactor();
		this.events.register('log', 'apps-add', 'apps-rem');

		// Fetch and load configuration
		this.config = new ConfigManager();
		promises.push(this.config.init());

		// Start theming system
		this.themeManager = new ThemeManager();
		promises.push(this.themeManager.init());

		// Initialize custom UI controls
		UIControls.init();		

		// Create desktop subsystem
		this.desktop = new Desktop();

		this.initGraphicalErrors();

		this.appManager = new AppManager();
		await this.appManager.init();
		
		// Let the desktop prepare app icons and behavior
		this.desktop.taskbar.setupAppsMenu();
		this.desktop.setupApps();

		// Media Session bridge
		this.mediaSessionBridge = MediaSessionDriver;
		this.mediaSessionBridge.init();

		// Initialize audio subsystem
		this.audio = new AudioSystem();

		// Await all initialization tasks to finish before closing the constructor.
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
		
		if (refresh) Client.restart();
	}

	restart() {
		window.location.href = "/";
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
