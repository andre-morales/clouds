import CProc from 'child_process';
import Express from 'express';
import * as Auth from '../auth.mjs';
import * as Config from '../config.mjs';

var enabled = false;
var defs = null; 
export var shells = {};
var counter = 1;

export function init() {
	if (!Config.isExtensionEnabled('rshell')) return;
	enabled = true;

	defs = Config.config.extensions.rshell;
}

export function create() {
	let id = counter;
	let shell = new RShell(id);

	try {
		if (!shell.spawn()) return null;
	} catch(err) {
		console.log("Shell creation exception.");
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

	shells[id].kill();
	delete shells[id];
	return true;
}

export function destroyOldShells(limit) {
	let now = (new Date()).getTime();
	let destroyedShells = [];

	for (const [id, proc] of Object.entries(shells)) {
		if (now - proc.lastPing > limit*1000) {
			destroyedShells.push(id);
			console.log('Timeout shell ' + id);
		}
	}

	destroyedShells.forEach((id) => destroy(id));
}

export function installRouter(router) {
	router.get('/shell/0/init', (req, res) => {
		Auth.getUserGuard(req);

		let shell = create();
		if (!shell) {
			res.status(500).end();
			return;
		}

		res.json(shell.id);
	});

	router.get('/shell/0/list', (req, res) => {
		Auth.getUserGuard(req);

		let obj = Object.values(shells).map((shell) => {
			return {
				'id': shell.id,
				'ping': new Date(shell.lastPing).toString()
			};
		});

		res.json(obj);
	});

	router.post('/shell/:id/send', (req, res) => {
		Auth.getUserGuard(req);

		let shell = shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}
		let cmd = req.body.cmd;
		shell.send(cmd);
		res.end();
	});

	router.get('/shell/:id/stdout', (req, res) => {
		Auth.getUserGuard(req);
		let shell = shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		res.send(shell.stdout);
	});

	router.get('/shell/:id/stdout_new', async (req, res) => {
		Auth.getUserGuard(req);
		res.set('Cache-Control', 'no-store');

		let shell = shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		try {
			let result = await shell.newStdoutData();
			res.send(result);
		} catch(err) {
			console.log(err);
			res.status(500).end();
			return;
		}
		
	});

	router.get('/shell/:id/kill', (req, res) => {
		Auth.getUserGuard(req);
		
		let id = req.params.id;
		
		if(!destroy(id)) {
			res.status(404).end();
			return;
		}

		console.log('Destroyed shell ' + id);
		res.end();
	});

	router.get('/shell/:id/ping', (req, res) => {
		Auth.getUserGuard(req);
		let shell = shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		shell.ping();
		res.end();
	});


	setInterval(() => {
		destroyOldShells(20);
	}, 20000)

	return router;
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
		let proc = CProc.spawn(defs.exec);
		proc.on('error', (err) => {
			console.log(err);
		});

		if (!proc.pid) return false;
		this.proc = proc;

		console.log('+ shell ' + this.id);
		return true;
	}

	kill() {
		this.proc.kill();
		console.log('- shell ' + this.id);
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
	}
}