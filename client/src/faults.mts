// Faults describe uncommon program situations, possibly due to programming errors.
// These may or not be recoverable and are generally not graceful. 
export class Fault extends Error {
	constructor(message: string, cause?: Error) {
		super(message, (cause) ? {'cause' : cause} : undefined);
		this.name = "Fault";
	}
}

export class InternalFault extends Fault {
	constructor(message: string) {
		super(message);
		this.name = "InternalFault";
	}
}

export class IllegalStateFault extends Fault {
	constructor(message: string, cause?: Error) {
		super(message, cause);
		this.name = "IllegalStateFault";
	}
}

export class BadParameterFault extends Fault {
	constructor(message: string) {
		super(message);
		this.name = "BadParameterFault";
	}
}

// Exceptions describe common program situations such as a failed request.
// These require immediate attention but should be handled gracefully. 
export class Exception extends Error {
	constructor(message: string) {
		super(message);
		this.name = "Exception";
	}
}

export class FetchException extends Error {
	constructor(message: string) {
		super(message);
		this.name = "FetchException";
	}
}