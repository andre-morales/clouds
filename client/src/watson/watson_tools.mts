import { Reactor, ReactorEvent } from "../events.mjs";
import Dialogs from "../ui/dialogs.mjs";
import Browser from "../utils/browser.mjs";
import ErrorHandler from "./error_handler.mjs";

export class WatsonTools {
	logHistory: string;
	fetchHistory: FetchEvent[];
	events: Reactor<{
		fetch: FetchEvent
	}>;
	private static instance: WatsonTools;

	constructor() {
		this.logHistory = '[Begin]\n';
		this.fetchHistory = [];
		this.events = new Reactor();
		this.events.register('fetch');
	}

	async init() {
		EntrySpace.log("Initializing Watson...");
		this.initLogging();	
		this.trackFetch();
		EntrySpace.log("Watson tools online.");
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
			this.events.dispatch('fetch', ev);
			this.fetchHistory.push(ev);

			// Return the result as regular fetch would
			return promise;
		};

		window.fetch = proxyFetch;
	}

	public initGraphicalErrorHandlers() {
		ErrorHandler.initGraphicErrorHandlers();
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

	public static async init() {
		this.instance = new WatsonTools();
		await this.instance.init();
	}

	public static get() {
		return this.instance;
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