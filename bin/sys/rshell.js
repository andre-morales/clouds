import CProc from 'child_process';

var defs = null; 

export function loadDefs(defs_) {
	defs = defs_;
}

export function create(id) {
	return new RShell(id);
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
