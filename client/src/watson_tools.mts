import { Reactor, ReactorEvent } from "./events.mjs";

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
		
		const proxyFetch = async (input: RequestInfo | URL, init: RequestInit): Promise<Response> => {
			let request = new Request(input, init);

			// Invoke original fetch call and save its promise
			let promise = FETCH(request);

			// Fire an event to save fetch() state
			let ev = new FetchEvent(request, promise);
			this.events.fire('fetch', ev);
			this.fetchHistory.push(ev);

			// Return the result as regular fetch would
			let res = await promise;
			return res;
		};

		window.fetch = proxyFetch;
	}

	private initLogging() {
		window.addEventListener('error', (ev) => {
			let msg = `[Error] Unhandled error "${ev.message}"\n    at: ${ev.filename}:${ev.lineno}\n  says: ${ev.error}\n stack: `;
			if (ev.error && ev.error.stack) {
				msg += ev.error.stack;
			} else {
				msg += 'unavailable';
			}
			Client.log(msg);
		});

		window.addEventListener('unhandledrejection', (ev) => {
			Client.log(`[Error] Unhandled rejection: ${ev.reason.stack}`);
		});
	}
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
		this.promise.then((res) => {
			this.responseSize = Number.parseInt(res.headers.get('Content-Length'));
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