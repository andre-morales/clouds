import Resource from "./resource.mjs";
import ResourceManager from "./resource_manager.mjs";
import Browser from "./utils/browser.mjs";

export default class WebResourceManager {
	public manager = new ResourceManager();

	/**
	 * Loads the script with the given url and registers a user.
	 * If the script is already loaded, just register another user for it. Otherwise, load it and register its first user.
	 * Returns the resource object that represents this script.
	 */
	async fetchScript(url: string, user: unknown): Promise<Resource> {
		return this.fetchWebResource(url, user, async (id) => {
			await Browser.addScript(url, id);
		}, true);
	}

	/**
	 * Loads a style of the given url and registers a user.
	 * If the style was already loaded, just add another user to it.
	 * Otherwise, load the style, create its resource object and register its first user.
	 * Returns the resource object representing this style resource.
	 */
	async fetchStyle(url: string, user: unknown): Promise<Resource> {
		return this.fetchWebResource(url, user, async (id) => {
			await Browser.addStylesheet(url, id);
		});
	}

	/**
	 * General helper function for fetching and instantiating web resources like styles, modules
	 * and scripts. Sets the resource id to the url of the resource requested.
	 */
	private async fetchWebResource(url: string, user: unknown, creator: (id: string) => Promise<void>, permanent?: boolean): Promise<Resource> {
		let resource: Resource | null = this.manager.get(url);

		// If an unloaded resource with this URL exists, delete it to load it again.
		if (resource && resource.isUnloaded()) {
			this.manager.remove(url);
			resource = null;
		}

		if (resource) {
			// If the resource already exists, await its creation if necessary
			await (resource as any).creationPromise;
		} else {
			// Create resource item
			let resId = btoa(url);
			resource = new Resource();
			resource.name = resId;
			resource.setPermanent(permanent);
			resource.setUnloadCallback(() => {
				Browser.destroyElementById(resId);
			});
			this.manager.add(resource, url);
	
			// Creation temporary fix
			let promise = creator(resId);
			(resource as any).creationPromise = promise;
			await promise;
		}

		resource.addUser(user);
		return resource;
	}
}