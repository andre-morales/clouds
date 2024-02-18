class App {
	constructor(manifest, args) {
		if (!manifest) throw new InternalFault("Apps need a manifest");
		this.state = 'starting';
		this.classId = manifest.id;
		this.icon = (manifest.icon) ? manifest.icon : "";
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
		for (let win of this.windows) {
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

class Resource {
	constructor() {
		this.id = null;
		this.users = [];
		this.fnUnload = null;
		this.unloaded = false;

		// A permanent resource does not get unloaded if it has no more users.
		this.permanent = false;
	}

	addUser(user) {
		if (!this.users.includes(user)) {
			this.users.push(user);
			return true;
		}
		return false;
	}

	removeUser(user) {
		// Get user index
		var i = this.users.indexOf(user);
		if (i == -1) return;
		
		// Remove it from array
		this.users.splice(i, 1);

		// If there are no users for this resource and it's not a permanent resource. Unload it.
		if (this.users.length == 0 && !this.permanent) {
			this.unload();
		}	
	}

	unload() {
		this.unloaded = true;
		this.fnUnload();
	}
}