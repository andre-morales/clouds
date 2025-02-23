import { IllegalStateFault } from "./faults.mjs";

export default class Resource {
	// The symbolic name of this resource.
	public name: string;

	// All the users of this resource.
	private users: Set<unknown>;

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
		this.users = new Set();
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
		if(this.unloaded) throw new IllegalStateFault("The resource is unloaded.");

		if (this.users.has(user)) {
			throw new IllegalStateFault("The resource is already owned by the user specified.");
		}

		if (this.unique && this.users.size >= 1)
			throw new IllegalStateFault("The resource is unique and can only be owned by a single object.")

		this.users.add(user);
	}

	public removeUser(user: unknown): void {
		if(this.unloaded) throw new IllegalStateFault("The resource was already unloaded.");

		if(!this.users.delete(user)) {
			throw new IllegalStateFault("The resource is not owned by the user specified.");
		}
		
		// If there are no users for this resource and it's not a permanent resource. Unload it.
		if (this.users.size == 0 && !this.permanent) {
			this.unload();
		}	
	}

	/**
	 * Removes a user from this resource and replaces it with another one. This function does not
	 * trigger the resource unloading.
	 * @param oldUser The user to be removed from the owner set. The resource MUST be owned by this
	 * user.
	 * @param newUser The user to be added to the owner set. The resource must NOT be owned already 
	 * by this user.
	 */
	public replaceUser(oldUser: unknown, newUser: unknown) {
		if(this.unloaded)
			throw new IllegalStateFault("The resource is unloaded.");

		if (!this.users.has(oldUser))
			throw new IllegalStateFault("The resource is not owned by the old user specified.");
		
		if (this.users.has(newUser))
			throw new IllegalStateFault("The resource is already owned by the new user specified.");

		this.users.delete(oldUser);
		this.users.add(newUser);
	}

	/**
	 * Invoke this resource unload function and flag it as unloaded.
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
