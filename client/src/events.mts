import Arrays from './utils/arrays.mjs';

export class ReactorClass {
	listeners: any[];
	defaultHandler: any;

	constructor() {
		this.listeners = [];
		this.defaultHandler = null;
	}
}

export class Reactor {
	classes: any;

	constructor() {
		this.classes = {};
	}

	register(...names: string[]) {
		for (let name of names) {
			this.classes[name] = new ReactorClass();
		}
	}

	unregister(name: string) {
		delete this.classes[name];
	}

	getClass(name: string) {
		return this.classes[name];
	}

	on(name: string, callback: Function) {
		let list = this.classes[name];
		if (!list) throw Error(`No class ${name} registered.`);

		list.listeners.push(callback);
		return callback;
	}

	off(name: string, callback: Function) {
		let list = this.classes[name];
		if (!list) throw Error(`No class ${name} registered.`);

		Arrays.erase(list.listeners, callback);
	}

	default(name, callback) {
		let evClass = this.classes[name];
		if (!evClass) throw Error(`No class ${name} registered.`);

		evClass.defaultHandler = callback;
	}

	// Invoke event handlers immediately
	fire(name, event, handler) {
		let evClass = this.classes[name];
		if (!evClass) throw Error(`No class ${name} registered.`);

		// If a handler was provided, call it with each listener and the same event
		// Otherwise, invoke all listeners directly
		if (handler) {
			for (let fn of evClass.listeners) {
				handler(fn, event);
			}
		} else {
			for (let fn of evClass.listeners) {
				fn(event);
			}
		}
		
		// If an event object was provided and it wasn't canceled, call default behavior
		if (event && event.canceled) return;
		if (evClass.defaultHandler) {
			evClass.defaultHandler(event);
		}
	}

	// Invoke event handlers in the next cycle of the engine
	dispatch(name: string, event?: any, handler?: any) {
		return new Promise((resolve) => {
			setTimeout(() => {
				this.fire(name, event, handler);
				resolve(undefined);
			}, 0);
		});
	}
}

export class Deferred {
	promise: Promise<any>;
	resolve: (value?: any) => void;
	reject: (value?: any) => void;

	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.resolve = resolve;
			this.reject = reject;
		})
	}
}

export class ReactorEvent {
	canceled: boolean;

	constructor() {
		this.canceled = false;
	}

	cancel() {
		this.canceled = true;
	}
}