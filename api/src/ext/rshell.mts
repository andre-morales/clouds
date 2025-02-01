import CProc from 'child_process';
import * as Config from '../config.mjs';
import WebSockets from '../websockets.mjs';
import Arrays from '#common/arrays.mjs';

var enabled = false;
var defs: any = null; 
export var shells : { [id: string]: RShell } = {};
var counter = 1;
var cleanupTask: NodeJS.Timeout;

// Add some properties to the Express request object
declare global {
	namespace Express {
		interface Request {
			shell: RShell;
		}
	}
}

export function init() {
	if (!Config.isExtensionEnabled('rshell')) return;
	enabled = true;

	defs = Config.config.extensions.rshell;
}

export function shutdown() {
	for (let key of Object.keys(shells)) {
		destroy(Number(key));
	}

	clearInterval(cleanupTask);
}

export function create() {
	let id = counter;
	let shell;

	try {
		shell = new RShell(id);
	} catch(err) {
		console.error("Shell creation exception.");
		console.error(err);
		return null;
	}

	counter++;
	shells[id] = shell;
	shell.setupOutput();
	return shell;
}

export function destroy(id: number) {
	if (!shells[id]) return false;

	shells[id].kill();
	delete shells[id];
	return true;
}

export function destroyOldShells(limit: number) {
	let now = (new Date()).getTime();
	let destroyedShells: number[] = [];

	for (const [id, proc_] of Object.entries(shells)) {
		let proc : any = proc_;
		if (now - proc.lastPing > limit*1000) {
			destroyedShells.push(Number(id));
			console.log('Timeout shell ' + id);
		}
	}

	destroyedShells.forEach((id) => destroy(id));
}

export function getRouter() {
	let router = WebSockets.createRouter();
	
	// General handler decorator
	router.use('/:id/*cmd', (req, res, next) => {
		if (req.params.id == '0') {
			next();
			return;
		}

		let shell = shells[req.params.id]
		if (!shell) {
			res.status(404).end();	
			return;
		}

		req.shell = shell;
		next();
	});

	router.ws('/:id/socket', (ws, req) => {
		let wsx = ws as unknown as WebSocket;
		req.shell.addSocket(wsx);
	});

	router.get('/0/init', (req, res) => {
		let shell = create();
		if (!shell) {
			res.status(500).end();
			return;
		}

		res.json(shell.id);
	});

	router.get('/0/list', (req, res) => {
		let obj = Object.values(shells).map((shell: any) => {
			return {
				'id': shell.id,
				'ping': new Date(shell.lastPing).toString()
			};
		});

		res.json(obj);
	});

	router.post('/:id/send', (req, res) => {
		let cmd = req.body.cmd;
		req.shell.send(cmd);
		res.end();
	});

	router.get('/:id/kill', (req, res) => {
		let id = Number(req.params.id);
		if(!destroy(id)) {
			res.status(404).end();
			return;
		}

		console.log('Destroyed shell ' + id);
		res.end();
	});

	router.get('/:id/ping', (req, res) => {
		req.shell.ping();
		res.end();
	});

	cleanupTask = setInterval(() => {
		destroyOldShells(20);
	}, 20000)

	return router;
}

export class RShell {
	id: number;
	stdout: string;
	proc: CProc.ChildProcessWithoutNullStreams;
	lastPing: number;
	sockets: WebSocket[];

	constructor(id: number) {
		this.id = id;
		this.stdout = '';
		this.sockets = [];
		this.lastPing = new Date().getTime();

		let proc = CProc.spawn(defs.exec);
		proc.on('error', (err) => {
			console.log(err);
		});

		if (!proc.pid) throw new Error("Shell creation failed.");

		this.proc = proc;
		console.log('+ shell ' + this.id);
	}

	kill() {
		this.proc.kill();
		console.log('- shell ' + this.id);
	}

	addSocket(ws: WebSocket) {
		this.sockets.push(ws);
		ws.send(this.stdout);
		ws.onclose = (ev) => {
			Arrays.erase(this.sockets, ws);
		};
	}

	setupOutput() {
		let outFn = (ch: any) => {
			let content = ch.toString();

			// Save content on stdout whole log
			this.stdout += content;

			// Send new data to sockets
			for (let sock of this.sockets) {
				sock.send(content);
			}
		}

		this.proc.stdout.on('data', outFn);
		this.proc.stderr.on('data', outFn);
	}

	ping() {
		this.lastPing = (new Date()).getTime();
	}

	send(msg: string) {
		this.proc.stdin.write(msg + '\n');
	}
}