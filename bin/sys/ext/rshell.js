import CProc from 'child_process';

var defs = null; 
export var shells = {};
var counter = 1;

export function loadDefs(defs_) {
	defs = defs_;
}

export function create() {
	let id = counter;
	let shell = new RShell(id);

	try {
		if (!shell.spawn()) return null;
	} catch(err) {
		return null;
	}

	counter++;
	shells[id] = shell;
	shell.setupOutput();
	shell.ping();
	return shell;
}

export function destroy(id) {
	if (!shells[id]) return false;

	shells[id].proc.kill();
	delete shells[id];
	return true;
}

export function destroyOldShells(limit) {
	let now = (new Date()).getTime();
	let destroyedShells = [];

	for (const [id, proc] of Object.entries(shells)) {
		if (now - proc.lastPing > limit*1000) {
			destroyedShells.push(id);
		}
	}

	destroyedShells.forEach(destroy);
}

export class RShell {
	constructor(id) {
		this.id = id;
		this.stdout = '';
		this.newOut = '';
		this.proc = null;
		this.waiterObj = null;
		this._config = null;
	}

	spawn() {
		if (!defs || !defs.enabled) return null;

		let proc = CProc.spawn(defs.exec);
		proc.on('error', (err) => {
			console.log(err);
		});

		if (proc.pid) return this.proc = proc;
		return null;
	}

	newStdoutData() {
		if (this.newOut) {
			let promise = Promise.resolve(this.newOut);
			this.newOut = '';
			return promise;
		}

		if (this.waiterObj) return Promise.reject();

		return new Promise((res) => {
			this.waiterObj = res;
		});
	}

	setupOutput() {
		let outFn = (ch) => {
			let content = ch.toString();
			this.stdout += content;

			if (this.waiterObj) {
				let prom = this.waiterObj;
				this.waiterObj = null;
				prom(content);
			} else {
				this.newOut += content;
			}
		}

		this.proc.stdout.on('data', outFn);
		this.proc.stderr.on('data', outFn);
	}

	ping() {
		this.lastPing = (new Date()).getTime();
	}

	send(msg) {
		this.proc.stdin.write(msg + '\n');
	};
}
