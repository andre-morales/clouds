import { Reactor, ReactorEvent } from "../events.mjs";
import Dialogs from "../ui/dialogs.mjs";
import error_handler from "./error_handler.mjs";

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
			error_handler.showError("Error", "Unhandled rejection", ev.reason);
			/*let stack: string = ev.reason.stack;
			try {
				let es = new ErrorStack(ev.reason);
				await es.mapAll();
				stack = es.toHTML();
			} catch(err) {
				console.log(err);				
			}
			
			Client.showErrorDialog("Error", `Unhandled rejection: ${ev.reason}\n${stack}`, ev.reason);*/
		});
	}

	showErrorDialog(title, msg, error?: Error) {
		try {
			let dialog = Dialogs.showError(Client.desktop.dwm, title, msg);
			dialog.window.$window.find('.options button').focus();
		} catch (err) {
			console.log("---- Couldn't display the error ----");
			console.error(error);
			console.log("------------- Due to ---------------")
			console.error(err);
			console.log("------------------------------------")

			// If the dialog has an optional error object, show it
			let causeString = (err.stack) ? err.stack : err;
			let errorDetail = '';
			if (error && error.stack) {
				errorDetail = `<b>Error: </b>${error.stack}\n`;
			}

			let originalErrStr = `[${title}]: "${msg}".\n${errorDetail}`;
			let panicMsg = `Couldn't show ${originalErrStr}\n<b>Display Failure Cause: </b>${causeString}`;
			_systemPanic("No Error Display", panicMsg);
		}
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