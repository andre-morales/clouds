import { IllegalStateFault } from "./faults.mjs";

export default class Resource {
	// The symbolic name of this resource.
	public name: string;

	// All the users of this resource.
	private users: unknown[];

	// If this resource is unloaded. Once a resource is unloaded, it will never be active anymore.
	private unloaded: boolean;

	// A permanent resource does not get unloaded if it has no more users.
	private permanent: boolean;

	// A unique resource can only be owned by a single user.
	private unique: boolean;

	// The function to call when this resource gets unloaded.
	private unloadFn?: () => void;

	constructor() {
		this.name = null;
		this.users = [];
		this.unloadFn = null;
		this.unloaded = false;
		this.permanent = false;
		this.unique = false;
	}

	/**
	 * Make the user object specified own this resource.
	 * At a given time, a user can only own a resource once.
	 */
	public addUser(user: unknown): void {
		if(this.unloaded) throw new IllegalStateFault("The resource was already unloaded.");

		if (this.users.includes(user)) {
			throw new IllegalStateFault("The resource is already owned by the user specified.");
		}

		if (this.unique && this.users.length >= 1)
			throw new IllegalStateFault("The resource is unique and can only be owned by a single object.")

		this.users.push(user);
	}

	public removeUser(user: unknown): void {
		if(this.unloaded) throw new IllegalStateFault("The resource was already unloaded.");

		// Get user index
		var i = this.users.indexOf(user);
		if (i == -1) throw new IllegalStateFault("The resource is not owned by the user specified.");
		
		// Remove it from array
		this.users.splice(i, 1);

		// If there are no users for this resource and it's not a permanent resource. Unload it.
		if (this.users.length == 0 && !this.permanent) {
			this.unload();
		}	
	}

	/**
	 * Find the user 'oldUser' of this resource and replace it with 'newUser'.
	 */
	public replaceUser(oldUser: unknown, newUser: unknown) {
		this.users[this.users.indexOf(oldUser)] = newUser;
	}

	/**
	 * Invokes this resource unload function and flags it as unloaded.
	 */
	public unload() {
		this.unloaded = true;
		if (this.unloadFn) {
			this.unloadFn();
		}
	}

	public setPermanent(permanent: boolean) {
		this.permanent = permanent;
	}

	public setUnique(unique: boolean) {
		this.unique = unique;
	}

	public setUnloadCallback(callback: () => void) {
		this.unloadFn = callback;
	}

	public isUnloaded() {
		return this.unloaded;
	}
}
