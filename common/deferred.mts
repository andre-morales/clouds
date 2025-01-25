export default class Deferred {
	promise: Promise<any>;
	private _resolve?: (value?: any) => void;
	private _reject?: (value?: any) => void;

	get resolve() { return this._resolve as (value?: any) => void; }
	get reject() { return this._reject as (value?: any) => void; }

	constructor() {
		this.promise = new Promise((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		})
	}
}
//s
