import Resource from "./resource.mjs"
import Util from "./utils/browser.mjs";

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
		if (!id) id = this.#generateId();
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
	 * Release the handles of all resources owned by the user passed.
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

	/**
	 * Loads the module with the given url and registers a user.
	 * If the module is already loaded, just register another user for it. Otherwise, load it and
	 * register its first user.
	 * @returns The resource object that represents this module.
	 */
	async fetchModule(url: string, user: unknown): Promise<Resource> {
		return this.#fetchWebResource(url, user, async (id) => {
			await Util.addModule(url, id);
		});
	}
	/**
	 * Loads the script with the given url and registers a user.
	 * If the script is already loaded, just register another user for it. Otherwise, load it and register its first user.
	 * Returns the resource object that represents this script.
	 */
	async fetchScript(url: string, user: unknown): Promise<Resource> {
		return this.#fetchWebResource(url, user, async (id) => {
			await Util.addScript(url, id);
		});
	}

	/**
	 * Loads a style of the given url and registers a user.
	 * If the style was already loaded, just add another user to it.
	 * Otherwise, load the style, create its resource object and register its first user.
	 * Returns the resource object representing this style resource.
	 */
	async fetchStyle(url: string, user: unknown): Promise<Resource> {
		return this.#fetchWebResource(url, user, async (id) => {
			await Util.addStylesheet(url, id);
		});
	}

	/**
	 * General helper function for fetching and instantiating web resources like styles, modules
	 * and scripts. Sets the resource id to the url of the resource requested.
	 */
	async #fetchWebResource(url: string, user: unknown, creator: (id: string) => Promise<void>): Promise<Resource> {
		let resource: Resource | null = this.get(url);

		// If an unloaded resource with this URL exists, delete it to load it again.
		if (resource && resource.isUnloaded()) {
			this.remove(url);
			resource = null;
		}

		// Create resource item
		if (!resource) {
			let resId = btoa(url);
			resource = new Resource();
			resource.name = resId;
			resource.setUnloadCallback(() => {
				Util.destroyElementById(resId);
			});
			this.add(resource, url);
	
			await creator(resId);
		}

		resource.addUser(user);
		return resource;
	}

	#generateId(): string {
		let self: any = this.#generateId;
		if (!self.ID_COUNTER) self.ID_COUNTER = 0;

		self.ID_COUNTER++;
		return '__' + self.ID_COUNTER ;
	}
}

export default ResourceManager;