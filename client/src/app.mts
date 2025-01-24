import { Reactor, ReactorEvent } from './events.mjs';
import { InternalFault } from './faults.mjs';
import Window from './ui/window.mjs'
import ResourceManager from './resource_manager.mjs';

export enum AppState {
	INIT, ALIVE, DYING, DEAD
}

export enum ExitMode {
	EXPLICIT, MAIN_WINDOW_CLOSED, LAST_WINDOW_CLOSED
}

type EventsTypeMap = {
	exit: AppExitEvent
}

export interface AppManifest {
	id: string;
	base?: string;
	icon?: string;
	displayName?: string;
	builder?: string;
	modules?: string[];
	scripts?: string[];
	styles?: string[];
	noWindowGrouping?: boolean;
}

export default class App {	
	public readonly events: Reactor<EventsTypeMap>;
	public readonly classId: string;
	readonly resources: ResourceManager;
	readonly buildArgs: unknown[];
	readonly windows: Window[];
	state: AppState;
	icon: string;
	displayName: string;
	noWindowGrouping: boolean;
	mainWindow: Window;
	exitMode: ExitMode;

	constructor(manifest: AppManifest, args?: unknown[]) {
		if (!manifest) throw new InternalFault("Apps need a manifest");
		this.state = AppState.INIT;
		this.resources = new ResourceManager();
		this.classId = manifest.id;
		this.icon = manifest.icon ?? "";
		this.displayName = manifest.displayName;
		this.noWindowGrouping = manifest.noWindowGrouping;

		this.buildArgs = args ?? [];
		this.windows = [];
		this.mainWindow = undefined;
		this.exitMode = ExitMode.MAIN_WINDOW_CLOSED;
		this.events = new Reactor();
		this.events.register("exit");
	}

	_dispose(code: number) {
		this.state = AppState.DYING;

		try {
			this.dispatch("exit", new AppExitEvent(code));
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
		this.state = AppState.DEAD;
	}

	exit(code?: number) {
		Client.endApp(this, code);
	}

	public setExitMode(mode: ExitMode) {
		this.exitMode = mode;
	}

	protected async requireScript(url: string) {
		let resource = await Client.resources.fetchScript(url, this);
		this.resources.add(resource);
	}

	protected async requireStyle(url: string) {
		let resource = await Client.resources.fetchStyle(url, this);
		this.resources.add(resource);
	}

	isAlive() {
		return this.state == AppState.ALIVE;
	}

	on(evClass: string, callback: Function) {
		this.events.on(evClass, callback as any);
	}

	off(evClass: string, callback) {
		this.events.off(evClass, callback);
	}

	dispatch(evClass: string, event: ReactorEvent) {
		this.events.dispatch(evClass, event);
	}
}

class AppExitEvent extends ReactorEvent {
	public readonly exitCode: number;

	public constructor(code: number) {
		super();
		this.exitCode = code;
	}
}

export { App };