import Arrays from '../../common/arrays.mjs';
import { IllegalStateFault } from './faults.mjs';

type ReactorTypeMap = Record<string, ReactorEvent>;

type NamedEventClass<TM extends ReactorTypeMap, Name> = Name extends keyof TM ? TM[Name] : ReactorEvent;

/** String names accepted in the register() call. If Lax is true, only names in the type-map will
 *  be allowed */
type RegisterNames<TM, Lax extends boolean> = Lax extends true ? string[] : (keyof TM)[];

/** Resulting ReactorClass<>[] based on the array of names. If a name is not on the type-map, a
 *  generic ReactorClass<ReactorEvent> will be used. */
type RegisterClasses<TM extends ReactorTypeMap, Names> = {
	[I in keyof Names]: ReactorClass<NamedEventClass<TM, Names[I]>>
};

export type EventCallback<T extends ReactorEvent = ReactorEvent> = (ev: T) => void;

export enum ReactorDispatchMode {
	/** All listeners are invoked in the same macro task of the event loop. This behavior is the
	 * same one used by DOM events. */
	BATCH_MACRO_TASK,
	/** All listeners are invoked directly by the dispatch call. */
	IMMEDIATE
}

export class ReactorClass<T extends ReactorEvent = ReactorEvent> {
	public dispatchMode: ReactorDispatchMode;
	private listeners: EventCallback<T>[];
	private defaultHandler: EventCallback<T>;

	constructor() {
		this.dispatchMode = ReactorDispatchMode.BATCH_MACRO_TASK;
		this.listeners = [];
		this.defaultHandler = null;
	}

	public on(callback: EventCallback<T>) {
		this.listeners.push(callback);
		return callback;
	}

	public off(callback: EventCallback<T>): void {
		Arrays.erase(this.listeners, callback);
	}

	public default(callback: EventCallback<T>): void {
		this.defaultHandler = callback;
	}

	public dispatch(event?: T, proxy?: Function): void {
		// If no event object was specified during dispatch, create a default empty one.
		if (!event) event = new ReactorEvent() as T;

		switch(this.dispatchMode) {
			case ReactorDispatchMode.BATCH_MACRO_TASK:
				setTimeout(() => this.fire(event, proxy), 0);
				break;
			case ReactorDispatchMode.IMMEDIATE:
				this.fire(event, proxy);
				break;
		}
	}

	private fire(event?: T, proxy?: Function): void {
		// If a proxy was provided, call it with each listener and the same event.
		// Otherwise, just invoke all listeners directly.
		if (proxy) {
			for (let fn of this.listeners) {
				proxy(fn, event);
			}
		} else {
			for (let fn of this.listeners) {
				fn(event);
			}
		}
		
		// If an event object was provided and it wasn't canceled, call default behavior
		if (event?.isDefaultPrevented()) return;
		if (this.defaultHandler) {
			this.defaultHandler(event);
		}
	}
}

export class Reactor <TM extends ReactorTypeMap = {}, Lax extends boolean = true> {
	classes: {[key: string]: ReactorClass};

	constructor() {
		this.classes = {};
	}

	/**
	 * Register all the event classes specified.
	 * @returns Instances of the event classes registered.
	 */
	public register<T extends RegisterNames<TM, Lax>>(...names: T): RegisterClasses<TM, T> {
		return names.map((name) => {
			if (this.classes[name])
				throw new IllegalStateFault(`Cannot register the same class '${name}' twice.`);

			let evClass = this.classes[name] = new ReactorClass(); 
			return evClass as any;
		}) as any;
	}

	public unregister(name: string) {
		delete this.classes[name];
	}

	public on<E extends string>(
		className: E,
		callback: EventCallback<NamedEventClass<TM, E>>
	): EventCallback<NamedEventClass<TM, E>> {
		return this.getClass(className).on(callback);
	}

	public off<E extends string>(
		className: E,
		callback: EventCallback<NamedEventClass<TM, E>>
	): void {
		return this.getClass(className).off(callback);
	}

	public default<E extends string>(
		className: E,
		callback: EventCallback<NamedEventClass<TM, E>>
	): void {
		return this.getClass(className).default(callback);
	}

	/**
	 * Invoke all event listeners for the event class specified.
	 */
	public dispatch<E extends string>(
		className: E,
		event?: NamedEventClass<TM, E>,
		handler?: any
	): void {
		return this.getClass(className).dispatch(event, handler);
	}

	public getClass<E extends string>(
		className: E
	): ReactorClass<E extends keyof TM ? TM[E] : ReactorEvent> {
		let evClass = this.classes[className];
		if (!evClass) throw Error(`No class ${className} registered.`);

		return evClass as any;
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
