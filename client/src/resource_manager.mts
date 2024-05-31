import Resource from "./resource.mjs"
import Util from "./util.mjs";

interface ResourceMap {
	[key: string]: Resource;
}

export class ResourceManager {
	resources: ResourceMap;

	constructor() {
		this.resources = {};
	}

	/**
	 * Adds a resource to be owned by this manager.
	 */
	add(id: string, res: Resource) {
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
	 * Removes all unloaded resources from the manager.
	 */
	clean() {
		for (let [key, value] of Object.entries(this.resources)) {
			if (value.isUnloaded()) delete this.resources[key];
		}
	}

	/**
	 * Loads the module with the given url and registers a user.
	 * If the module is already loaded, just register another user for it. Otherwise, load it and register its first user.
	 * Returns the resource object that represents this module.
	 */
	async fetchModule(url: string, user: string): Promise<Resource> {
		return this._fetchWebResource(url, user, async (id) => {
			await Util.addStylesheet(url, id);
		});
	}
	/**
	 * Loads the script with the given url and registers a user.
	 * If the script is already loaded, just register another user for it. Otherwise, load it and register its first user.
	 * Returns the resource object that represents this script.
	 */
	async fetchScript(url, user): Promise<Resource> {
		return this._fetchWebResource(url, user, async (id) => {
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
		return this._fetchWebResource(url, user, async (id) => {
			await Util.addStylesheet(url, id);
		});
	}

	/**
	 * General helper function for fetching and instantiating web resources like styles, modules
	 * and scripts. Sets the resource id to the url of the resource requested.
	 */
	async _fetchWebResource(url: string, user: unknown, creator: Function): Promise<Resource> {
		let resource = this.get(url);
	
		if (resource) {
			// The resource was already loaded, let's register
			// another user of it.
			resource.addUser(user);
		} else {
			let resId = btoa(url);
	
			// The resource hasn't been loaded yet.
			resource = new Resource();
			resource.name = resId;
			resource.addUser(user);
			resource.setUnloadCallback(() => {
				Util.destroyElementById(resId);
			});
			this.add(url, resource);
	
			await creator(resId);
		}
		return resource;
	}	
}

export default ResourceManager;