import ErrorStack from "./stack.mjs";

export class StackAnalyzer {
	public static analyze(error: Error) {
		return new ErrorStackList(error);
	}	
}

export class ErrorStackList {
	public stacks: ErrorStack[];

	public constructor(root: Error) {
		this.stacks = [];
		
		let err = root;
		while (err) {
			this.stacks.push(new ErrorStack(err));

			if (!(err.cause instanceof Error)) break;
			err = err.cause;
		}
	}

	/**
	 * Invokes source map decoding in all entries and in all errors of the chain.
	 */
	public async resolveSourceMaps() {
		await Promise.all(this.stacks.map(async (stack) => {
			await stack.mapAll();
		}));
	}
}

export default { StackAnalyzer, ErrorStackList };