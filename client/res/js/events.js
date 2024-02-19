class ReactorClass {
	constructor() {
		this.listeners = [];
		this.defaultHandler = null;
	}
}

class Reactor {
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

		arrErase(list.listeners, callback);
	}

	default(name, callback) {
		let evclass = this.classes[name];
		if (!evclass) throw Error(`No class ${name} registered.`);

		evclass.defaultHandler = callback;
	}

	dispatch(name, event, handler) {
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
}

class Deferred {
	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this.reject = reject
			this.resolve = resolve
		})
	}
}

class ReactorEvent {
	constructor() {
		this.canceled = false;
	}

	cancel() {
		this.canceled = true;
	}
}