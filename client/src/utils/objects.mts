type PropertyChain = any[];

export class Pointer<T = unknown> {
	private readonly root: any;
	private readonly chain: PropertyChain;

	private constructor(root: any, chain: PropertyChain) {
		this.root = root;
		this.chain = chain;
	}

	public static of<T>(root: any, chain: PropertyChain): Pointer<T> {
		return new Pointer(root, chain);
	}

	public get v(): T {
		let object = this.root;
		for (let key of this.chain) {
			object = object[key];
		}
		return object;
	}

	public set v(value: T) {
		let object = this.root;
		for (let i = 0; i < this.chain.length - 1; i++) {
			let key = this.chain[i];
			object = object[key];
		}

		object[this.chain[this.chain.length - 1]] = value;
	}
}

/**
 * Query object in dot name format from window object
 */
export function getObjectByName(scope: any, name: string, separator = '.'): any {
	let chain = name.split(separator);
	let ptr = Pointer.of(scope, chain);
	return ptr.v;
}

/**
 * Find the property name chain leading to a key object contained in a parent.
 */
export function findChain(parent: any, keyObject: unknown): PropertyChain {
	if (parent === keyObject) return [];

	for (let [property, value] of Object.entries(parent)) {
		// If this object has a property whose value is the key we're looking for.
		if (value === keyObject) {
			return [property];
		}

		// Do not look into strings or arrays
		if (typeof value == 'string') continue;
		if (Array.isArray(value)) continue;

		// Try to find the key in this sub property
		let result = findChain(value, keyObject);
		if (result !== null) {
			// Concatenate the chain found with our property name
			return [property].concat(result);
		}			
	}

	return null;
}

export default { getObjectByName, findChain, Pointer };