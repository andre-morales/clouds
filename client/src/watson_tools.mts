import { Reactor, ReactorEvent } from "./events.mjs";
import ErrorStack from "./utils/error_stack.mjs";

export class WatsonTools {
	logHistory: string;
	fetchHistory: FetchEvent[];
	events: Reactor<{
		fetch: FetchEvent
	}>;

	constructor() {
		this.logHistory = '[Begin]\n';
		this.initLogging();	
		this.fetchHistory = [];
		this.trackFetch();
		this.events = new Reactor();
		this.events.register('fetch');
	}

	private trackFetch() {
		// Save original fetch function
		const FETCH = window.fetch;
		
		const proxyFetch = (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
			let request = new Request(input, init);

			// Invoke original fetch call and save its promise
			let promise = FETCH(request);

			// Fire an event to save fetch() state
			let ev = new FetchEvent(request, promise);
			this.events.fire('fetch', ev);
			this.fetchHistory.push(ev);

			// Return the result as regular fetch would
			return promise;
		};

		window.fetch = proxyFetch;
	}

	public initGraphicalErrorHandlers() {
		window.addEventListener('error', (ev) => {
			let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
			if (ev.error && ev.error.stack) {
				msg += ev.error.stack;
			} else {
				msg += 'unavailable';
			}
			let stack = '';
			if (ev.error && ev.error.stack) {
				stack = `\n${ev.error.stack}`;
			}

			Client.showErrorDialog("Error", `Unhandled error:\n${ev.message}${stack}`);
		});

		window.addEventListener('unhandledrejection', async (ev) => {
			let stack: string = ev.reason.stack;
			try {
				let es = new ErrorStack(ev.reason);
				await es.mapAll();
				stack = es.toHTML();
			} catch(err) {
				console.log(err);				
			}
			
			Client.showErrorDialog("Error", `Unhandled rejection: ${ev.reason}\n${stack}`, ev.reason);
		});
	}

	private initLogging() {}
}

export class FetchEvent extends ReactorEvent {
	public readonly request: Request;
	public readonly promise: Promise<Response>;
	public readonly timeStamp: number;
	private responseSize: number;
	private timeEnd: number;

	constructor(request: Request, promise: Promise<Response>) {
		super();
		this.timeStamp = Date.now();
		this.request = request;
		this.promise = promise;
		promise
		.then((res) => {
			this.responseSize = Number.parseInt(res.headers.get('Content-Length'));
		})
		.catch((err) => {
			// If the fetch() failed. Don't do anything.
		})
		.then(() => {
			this.timeEnd = Date.now();
		});
	}

	public getResponseSize() {
		return this.responseSize;
	}

	public getEndTime() {
		return this.timeEnd;
	}
}