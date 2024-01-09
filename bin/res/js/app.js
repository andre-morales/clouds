class App {
	constructor(args) {
		if (!args) args = [];
		this.buildArgs = args;
		this.loadedResources = [];
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

	onClose() {}
	
	close() {
		this.onClose();
		WebSys.endApp(this);
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