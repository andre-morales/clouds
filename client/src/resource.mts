export default class Resource {
	name: string;
	users: unknown[];
	#unloaded: boolean;
	/** A permanent resource does not get unloaded if it has no more users. */
	#permanent: boolean;
	#unloadFn?: () => void;

	constructor() {
		this.name = null;
		this.users = [];
		this.#unloadFn = null;
		this.#unloaded = false;
		this.#permanent = false;
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
		if (this.users.length == 0 && !this.#permanent) {
			this.unload();
		}	
	}

	/**
	 * Find the user 'oldUser' of this resource and replace it with 'newUser'.
	 */
	replaceUser(oldUser: unknown, newUser: unknown) {
		this.users[this.users.indexOf(oldUser)] = newUser;
	}

	/**
	 * Invokes this resource unload function and flags it as unloaded.
	 */
	unload() {
		this.#unloaded = true;
		if (this.#unloadFn) {
			this.#unloadFn();
		}
	}

	setPermanent(permanent: boolean) {
		this.#permanent = permanent;
	}

	setUnloadCallback(callback: () => void) {
		this.#unloadFn = callback;
	}

	isUnloaded() {
		return this.#unloaded;
	}
}
