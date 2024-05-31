import { Reactor } from './events.mjs';
import { InternalFault } from './faults.mjs';
import Window from './ui/window.mjs'
import ResourceManager from './resource_manager.mjs';

export interface AppManifest {
	id: string;
	icon?: string;
	displayName?: string;
	builder?: string;
	modules?: string[];
	scripts?: string[];
	styles?: string[];
	noWindowGrouping?: boolean;
}

export default class App {
	resources: ResourceManager;
	state: string;
	classId: string;
	icon: string;
	displayName: string;
	noWindowGrouping: boolean;
	buildArgs: unknown[];
	windows: Window[];
	mainWindow: Window;
	exitMode: string;
	events: Reactor;

	constructor(manifest: AppManifest, args?: unknown[]) {
		if (!manifest) throw new InternalFault("Apps need a manifest");
		this.state = 'starting';
		this.resources = new ResourceManager();
		this.classId = manifest.id;
		this.icon = manifest.icon ?? "";
		this.displayName = manifest.displayName;
		this.noWindowGrouping = manifest.noWindowGrouping;

		this.buildArgs = args ?? [];
		this.windows = [];
		this.mainWindow = undefined;
		this.exitMode = 'main-win-close';
		this.events = new Reactor();
		this.events.register("exit");
	}

	_dispose(code: number) {
		this.state = 'dying';

		try {
			this.dispatch("exit", code);
		} catch (err) {
			console.error(err);
			Client.showErrorDialog("Bad App", "An app exit() handler threw an exception.");
		}

		// Destroy all windows owned by this app
		while (this.windows.length > 0) {
			let win = this.windows[0];
			Client.desktop.destroyWindow(win);
		}

		// Release all app resources
		this.resources.releaseAll(this);
	}

	exit(code?: number) {
		Client.endApp(this, code);
	}

	// explicit: Only exit the app upon calling App.Exit,
	// main-win-close: Exits the app when the main window closes.
	// last-win-close: Exits the app once all windows are closed.
	setExitMode(mode: string) {
		this.exitMode = mode;
	}

	async requireScript(url: string) {
		let resource = await Client.resourceMan.fetchScript(url, this);
		this.resources.add(resource);
	}

	async requireStyle(url: string) {
		let resource = await Client.resourceMan.fetchStyle(url, this);
		this.resources.add(resource);
	}

	canEnd() {
		return this.state != 'dying' && this.state != 'dead';
	}

	on(evClass: string, callback) {
		this.events.on(evClass, callback);
	}

	off(evClass: string, callback) {
		this.events.off(evClass, callback);
	}

	dispatch(evClass: string, args: unknown) {
		this.events.dispatch(evClass, args);
	}

}

export { App };