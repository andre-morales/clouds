'use strict'

// Faults describe uncommon program situations, possibly due to programming errors.
// These may or not be recoverable and are generally not graceful. 
class Fault extends Error {
	constructor(message, cause) {
		super(message, (cause) ? {'cause' : cause} : undefined);
		this.name = "Fault";
	}
}

class InternalFault extends Fault {
	constructor(message) {
		super(message);
		this.name = "InternalFault";
	}
}

class IllegalStateFault extends Fault {
	constructor(message, cause) {
		super(message, cause);
		this.name = "IllegalStateFault";
	}
}

class BadParameterFault extends Fault {
	constructor(message) {
		super(message);
		this.name = "BadParameterFault";
	}
}

// Exceptions describe common program situations such as a failed request.
// These require immediate attention but should be handled gracefully. 
class Exception extends Error {
	constructor(message) {
		super(message);
		this.name = "Exception";
	}
}

class FetchException extends Error {
	constructor(message) {
		super(message);
		this.name = "FetchException";
	}
}