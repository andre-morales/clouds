import { StackFrame } from "./stack_frame.mjs";
import firefoxParser from './parsers/firefox.mjs';
import chromeParser from './parsers/chrome.mjs';

enum StackStyle {
	UNKNOWN, FIREFOX, CHROME
}

export default class ErrorStack {
	public readonly error: Error;
	public readonly frames: StackFrame[];
	private static parser: (stack: string) => StackFrame[];

	static {
		let parsers = {
			[StackStyle.UNKNOWN]: chromeParser,
			[StackStyle.FIREFOX]: firefoxParser,
			[StackStyle.CHROME]: chromeParser,
		}

		this.parser = parsers[this.getStackStyle()];
	}

	constructor(err: Error) {
		this.error = err;
		this.frames = [];
		
		// Nothing we can do if there's no stack at all
		if (!err.stack) return;

		this.frames = ErrorStack.parser(err.stack);
	}

	/**
	 * Transform all entries in the stack trace trough their sourcemaps.
	 */
	async mapAll() {
		await Promise.all(this.frames.map(async (entry) => {
			await entry.map();
		}));
	}

	toString() {
		let result = '';
		for (let entry of this.frames) {
			result += entry.toString() + '\n';
		}
		return result;
	}

	private static getStackStyle() {
		let agent = navigator.userAgent;
		if (agent.includes("Chrome")) return StackStyle.CHROME;
		if (agent.includes("Firefox")) return StackStyle.FIREFOX;
		return StackStyle.UNKNOWN;
	}
}


