export class Except {
	constructor(type) {
		this.type = type;
	}
};

export class BadAuthExecpt extends Except {
	constructor() {
		super('BadAuthExecpt');
	}
}