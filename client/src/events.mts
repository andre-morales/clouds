import Arrays from '../../common/arrays.mjs';

type ReactorTypeMap = {
	[key: string]: ReactorEvent
}

export type EventCallback = (ev: ReactorEvent) => void;

export class ReactorClass {
	listeners: EventCallback[];
	defaultHandler: EventCallback;

	constructor() {
		this.listeners = [];
		this.defaultHandler = null;
	}
}

export class Reactor <TM extends ReactorTypeMap = {}> {
	classes: {[key: string]: ReactorClass};

	constructor() {
		this.classes = {};
	}

	public register(...names: string[]) {
		for (let name of names) {
			this.classes[name] = new ReactorClass();
		}
	}

	public unregister(name: string) {
		delete this.classes[name];
	}

	public on<E extends string>(
		evClass: E,
		callback: (evType: E extends keyof TM ? TM[E] : ReactorEvent) => void
	) {
		let list = this.classes[evClass];
		if (!list) throw Error(`No class ${evClass} registered.`);

		list.listeners.push(callback);
		return callback;
	}

	public off(name: string, callback: Function) {
		let list = this.classes[name];
		if (!list) throw Error(`No class ${name} registered.`);

		Arrays.erase(list.listeners, callback);
	}

	public default(name: string, callback: EventCallback) {
		let evClass = this.classes[name];
		if (!evClass) throw Error(`No class ${name} registered.`);

		evClass.defaultHandler = callback;
	}

	// Invoke event handlers immediately
	public fire(name: string, event?: ReactorEvent, handler?: Function) {
		let evClass = this.classes[name];
		if (!evClass) throw Error(`No class ${name} registered.`);

		// If no event object was specified during dispatch, create a default empty one.
		if (!event) event = new ReactorEvent();

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
		if (event?.isDefaultPrevented()) return;
		if (evClass.defaultHandler) {
			evClass.defaultHandler(event);
		}
	}

	// Invoke event handlers in the next cycle of the engine
	public dispatch(name: string, event?: ReactorEvent, handler?: any) {
		return new Promise((resolve) => {
			setTimeout(() => {
				this.fire(name, event, handler);
				resolve(undefined);
			}, 0);
		});
	}
}

export class ReactorEvent {
	private defaultPrevented: boolean;
	
	public preventDefault() {
		this.defaultPrevented = true;
	}

	public isDefaultPrevented() {
		return this.defaultPrevented;
	}
}
