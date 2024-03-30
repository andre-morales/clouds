import Util from './util.mjs';

export class ReactorClass {
	constructor() {
		this.listeners = [];
		this.defaultHandler = null;
	}
}

export class Reactor {
	constructor() {
		this.classes = {};
	}

	register() {
		for (let name of arguments) {
			this.classes[name] = new ReactorClass();
		}
	}

	unregister(name) {
		delete this.classes[name];
	}

	getClass(name) {
		return this.classes[name];
	}

	on(name, callback) {
		let list = this.classes[name];
		if (!list) throw Error(`No class ${name} registered.`);

		list.listeners.push(callback);
		return callback;
	}

	off(name, callback) {
		let list = this.classes[name];
		if (!list) throw Error(`No class ${name} registered.`);

		Util.arrErase(list.listeners, callback);
	}

	default(name, callback) {
		let evclass = this.classes[name];
		if (!evclass) throw Error(`No class ${name} registered.`);

		evclass.defaultHandler = callback;
	}

	// Invoke event handlers immediatly
	fire(name, event, handler) {
		let evclass = this.classes[name];
		if (!evclass) throw Error(`No class ${name} registered.`);

		// If a handler was provided, call it with each listener and the same event
		// Otherwise, invoke all listeners directly
		if (handler) {
			for (let fn of evclass.listeners) {
				handler(fn, event);
			}
		} else {
			for (let fn of evclass.listeners) {
				fn(event);
			}
		}
		
		// If an event object was provided and it wasn't canceled, call default behavior
		if (event && event.canceled) return;
		if (evclass.defaultHandler) {
			evclass.defaultHandler(event);
		}
	}

	// Invoke event handlers in the next cycle of the engine
	dispatch(name, event, handler) {
		return new Promise((resolve) => {
			setTimeout(() => {
				this.fire(name, event, handler);
				resolve();
			}, 0);
		});
	}
}

export class Deferred {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.reject = reject
			this.resolve = resolve
		})
	}
}

export class ReactorEvent {
	constructor() {
		this.canceled = false;
	}

	cancel() {
		this.canceled = true;
	}
}