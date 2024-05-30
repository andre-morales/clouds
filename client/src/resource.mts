export default class Resource {
	id: string;
	users: unknown[];
	fnUnload: () => void;
	unloaded: boolean;
	permanent: boolean;

	constructor() {
		this.id = null;
		this.users = [];
		this.fnUnload = null;
		this.unloaded = false;

		// A permanent resource does not get unloaded if it has no more users.
		this.permanent = false;
	}

	addUser(user: unknown) {
		if (!this.users.includes(user)) {
			this.users.push(user);
			return true;
		}
		return false;
	}

	removeUser(user: unknown) {
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
