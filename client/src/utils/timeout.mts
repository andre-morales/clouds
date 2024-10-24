export class Timeout {
	private time: number;
	private timeoutId: number;
	private callback: Function;

	constructor(time: number, callback: Function) {
		this.time = time;
		this.callback = callback;
	}

	/**
	 * Sets the timeout to fire after the configured time. If the timeout has already been set
	 * before, this resets its timer.
	 */
	public set() {
		clearTimeout(this.timeoutId);
		this.timeoutId = window.setTimeout(() => {
			this.callback();
		}, this.time);
	}

	/**
	 * Cancels the timeout entirely.
	 */
	public stop() {
		clearTimeout(this.timeoutId);
	}
}