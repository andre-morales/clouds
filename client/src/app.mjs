import { Reactor } from './events.mjs';

export default class App {
	constructor(manifest, args) {
		if (!manifest) throw new InternalFault("Apps need a manifest");
		this.state = 'starting';

		this.classId = manifest.id;
		this.icon = (manifest.icon) ? manifest.icon : "";
		this.displayName = manifest.displayName;
		this.noWindowGrouping = manifest.noWindowGrouping;

		this.buildArgs = (args) ? args : [];
		this.loadedResources = [];
		this.windows = [];
		this.mainWindow = undefined;
		this.exitMode = 'main-win-close';
		this.events = new Reactor();
		this.events.register("exit");
	}

	_dispose(code) {
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
		for (let res of this.loadedResources) {
			Client.releaseResource(res, this);
		}
	}

	exit(code) {
		Client.endApp(this, code);
	}

	// explicit: Only exit the app upon calling App.Exit,
	// main-win-close: Exits the app when the main window closes.
	// last-win-close: Exits the app once all windows are closed.
	setExitMode(mode) {
		this.exitMode = mode;
	}

	requireScript(url) {
		Client.requestScript(url, this);
		this.loadedResources.push(url);
	}

	requireStyle(url) {
		Client.requestStyle(url, this);
		this.loadedResources.push(url);
	}

	canEnd() {
		return this.state != 'dying' && this.state != 'dead';
	}

	on(evclass, callback) {
		this.events.on(evclass, callback);
	}

	off(evclass, callback) {
		this.events.off(evclass, callback);
	}

	dispatch(evclass, args) {
		this.events.dispatch(evclass, args);
	}

}

export { App };