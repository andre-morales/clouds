import { FileSystem } from './bridges/filesystem.mjs';

export class ConfigManager {
	preferences: ConfigRootAccessor;

	constructor() {
		this.preferences = new ConfigRoot("/usr/.system/preferences.json");
	}

	async init() {
		await this.preferences.fetch().then((c) => c.load());
	}
}

/**
 * An interface with all the properties of the configuration root plus disabled type-checking
 * for string properties.
 */
interface ConfigRootAccessor extends ConfigRoot {
	[key: string]: any;
}

/**
 * Configuration root objects manage JSON config files, exposing their properties in the root object 
 * itself. Saving and loading properties are both done through two steps.
 * 
 * Loading: Fetch() -> Load();
 * Saving: Save() -> Upload();
 * 
 * This separation allows modifying configuration objects without saving their contents,
 * restoring their original state if necessary.
 */
class ConfigRoot {
	#filePath: string;
	#stage: any;

	constructor(path: string) {
		this.#filePath = path;
		this.#stage = {};
	}

	/**
	 * Load the JSON file managed by this configuration into the stage object.
	 */
	async fetch() {
		this.#stage = await FileSystem.readJson(this.#filePath);
		return this;
	}

	/**
	 * Save all contents from the stage object to the JSON file managed by this configuration.
	 */
	async upload() {
		await FileSystem.writeJson(this.#filePath, this.#stage);
		return this;
	}

	/**
	 * Make all properties from the stage object visible in this root object.
	 */
	load() {
		this.#clean();
		Object.assign(this, this.#stage);
		return this;
	}

	/**
	 * Transfer all properties visible in this object to the staging object.
	 */
	save() {
		this.#stage = {};
		Object.assign(this.#stage, this);
		return this;
	}

	/**
	 * Deletes all properties from this root config object.
	 */
	#clean() {
		for (let property in this) {
			delete this[property];
		}
	}
}