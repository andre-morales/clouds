import Resource from "./resource.mjs"
import Browser from "./utils/browser.mjs";

interface ResourceMap {
	[key: string]: Resource;
}

/**
 * Holds and manages resources by ids. A resource can be shared across multiple managers.
 */
export class ResourceManager {
	resources: ResourceMap;

	constructor() {
		this.resources = {};
	}

	/**
	 * Adds a resource to be owned by this manager.
	 */
	add(res: Resource, id?: string) {
		if (!id) id = generateUserId();
		if (this.resources[id]) {
			throw new Error(`A resource of ID "${id}" is already registered.`);
		}
		this.resources[id] = res;
	}

	/**
	 * Obtains a managed resource by id.
	 */
	get(id: string): Resource {
		return this.resources[id];
	}

	/**
	 * Removes a resource from this manager. This action does NOT unload the resource.
	 * @returns The resource passed.
	 */
	remove(id: string): Resource {
		let resource = this.resources[id];
		delete this.resources[id];
		return resource;
	}

	/**
	 * Adds a user to a resource on this manager.
	 */
	request(id: string, user: unknown) {
		this.resources[id].addUser(user);
	}

	/**
	 * Removes a user from a resource on this manager. If all users of a resource release it,
	 * it will gets unloaded automatically unless it is flagged as a permanent resource.
	 */
	release(id: string, user: unknown) {
		this.resources[id].removeUser(user);
	}

	/**
	 * Release the handles of all resources owned by the user specified.
	 */
	releaseAll(user: unknown) {
		Object.values(this.resources).forEach((res) => res.removeUser(user));
	}

	/**
	 * Removes all unloaded resources from the manager.
	 */
	clean() {
		for (let [key, value] of Object.entries(this.resources)) {
			if (value.isUnloaded()) delete this.resources[key];
		}
	}
}

function generateUserId(): string {
	let self: any = generateUserId;
	if (!self.ID_COUNTER) self.ID_COUNTER = 0;

	self.ID_COUNTER++;
	return '__' + self.ID_COUNTER ;
}

export default ResourceManager;