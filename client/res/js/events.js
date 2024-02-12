
class Reactor {
	constructor() {
		this.evclasses = {};
	}

	register() {
		for (let name of arguments) {
			this.evclasses[name] = [];
		}
	}

	unregister(name) {
		delete this.evclasses[name];
	}

	on(name, callback) {
		let list = this.evclasses[name];
		if (!list) throw Error(`No class ${name} registered.`);

		list.push(callback);
		return callback;
	}

	off(name, callback) {
		let list = this.evclasses[name];
		if (!list) throw Error(`No class ${name} registered.`);

		arrErase(list, callback);
	}

	dispatch(name, event) {
		let list = this.evclasses[name];
		if (!list) throw Error(`No class ${name} registered.`);

		for (let fn of list) {
			fn(event);
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