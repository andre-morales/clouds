'use strict'

// Faults describe uncommon program situations, possibly due to programming errors.
// These may or not be recoverable and are generally not graceful. 
class Fault extends Error {
	constructor(message) {
		super(message);
		this.name = "Fault";
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

class InternalFault extends Fault {
	constructor(message) {
		super(message);
		this.name = "InternalFault";
	}
}

class BadParameterFault extends Fault {
	constructor(message) {
		super(message);
		this.name = "BadParameterFault";
	}
}

