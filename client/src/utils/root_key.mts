import { FileSystem } from '../bridges/filesystem.mjs';
import Objects from './objects.mjs';

type ObserverCallback = (value: unknown, chain: string[]) => void;

/**
 * Configuration key root objects manage JSON config files, exposing their properties in a
 * root object. Changes done to any of the keys can be observed externally and reacted upon.
 * 
 * Saving and loading properties are done through two steps.
 * 
 * Loading: Fetch() -> Load();
 * Saving: Save() -> Upload();
 * 
 * This separation allows modifying configuration objects without modifying the underlying JSON
 * file immediately and saving or discarding changes as wished.
 */
export class RootKey {
	#root: any;
	#stage: any;
	#filePath: string;
	#chainObservers: Set<ChainObserver>;

	constructor(path: string) {
		this.#root = asObservable({}, (chain, value) => {
			this.#notifyObservers(chain, value);
		});
		this.#stage = {};
		this.#filePath = path;
		this.#chainObservers = new Set<ChainObserver>();
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
		Object.assign(this.#root, this.#stage);
		return this;
	}

	/**
	 * Transfer all properties visible in this object to the staging object.
	 */
	save() {
		this.#stage = {};
		Object.assign(this.#stage, this.#root);
		return this;
	}

	/**
	 * Observe a property name. Sub-properties are specified using '.' as a separator by default.
	 */
	observeProperty(property: string, callback: ObserverCallback, separator = '.') {
		let chain = property.split(separator);
		return this.observeChain(chain, callback);
	}

	/**
	 * Observe a property object contained in the root configuration. The object must exist in the
	 * configuration.
	 */
	observeObject(key: unknown, callback: ObserverCallback) {
		let chain = Objects.findChain(this.#root, key);
		if (chain === null) {
			console.error('Object: ', key, "Root: ", this.#root);
			throw new Error("The key object passed is not contained in the root");
		}
		
		return this.observeChain(chain, callback);	
	}

	/**
	 * Observe a property through its property name chain array
	 */
	observeChain(chain: string[], callback: ObserverCallback) {
		let observer = new ChainObserver(this, chain, callback);
		this.#chainObservers.add(observer);
		return observer;
	}

	removeObserver(observer: ChainObserver) {
		this.#chainObservers.delete(observer);
	}

	getRoot() {
		return this.#root;
	}

	#notifyObservers(chain: string[], value: unknown) {
		for (let observer of this.#chainObservers.values()) {
			if (observer.matches(chain)) {
				observer.callback(value, chain);
			}
		}
	}

	/**
	 * Deletes all properties from the root object.
	 */
	#clean() {
		for (let property in this.#root) {
			delete this.#root[property];
		}
	}

}

class ChainObserver {
	rootKey: RootKey;
	chain: string[];
	callback: ObserverCallback;
	deep: boolean;

	constructor(key: RootKey, chain: string[], callback: ObserverCallback, deep = false) {
		this.rootKey = key;
		this.chain = chain;
		this.callback = callback;
		this.deep = deep;
	}

	matches(ch: string[]) {
		if (this.chain === ch) return true;
		if (this.chain.length !== ch.length) return false;

		for (let i = 0; i < ch.length; i++) {
			if (ch[i] !== this.chain[i]) return false;
		}

		return true;
	}

	/**
	 * Erases this observer and removes it from the root key it was observing.
	 */
	destroy() {
		this.rootKey.removeObserver(this);
	}
}

type ObjectChangeCallback = (base: string[], value: unknown) => void;

/**
 * Create an observable proxy of this object, the original object is left untouched.
 * All changes made to this object, including deep changes will notify the change callback.
 */
function asObservable(target: any, callback: ObjectChangeCallback, chain: string[] = []) {
	// Make all object values of this object proxies themselves, so deep changes notify our callback.
	for (const key in target) {
		if (typeof target[key] !== 'object') continue;
		
		// Replace original value with observable proxy
		target[key] = asObservable(target[key], callback, [...chain, key]);
	}

	let proxy = new Proxy(target, {
		set(target, key: string, value) {
			// If assigning an object to this property, make it observable first
			if (typeof value === 'object') {
				value = asObservable(value, callback, [...chain, key]);
			}
			
			target[key] = value;

			// Notify our callback of changes
			callback([...chain, key], value);
			return true;
		}
	});
	
	return proxy;
}
