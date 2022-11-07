import * as CProcess from 'child_process';

function entry() {
	let args = process.argv.slice(2);

	runInSelf(args);
}

function runInSelf(args) {
	console.log('Launching in self.');

	import('./core.js').then((mod) => {
		mod.main(args);
	});
}

function runAttachedProc(){
	console.log('Launching in attached process.');

	var opt = {
		detached: false,
		stdio: 'pipe'
	}

	let child = CProcess.spawn("node", ["bin/sys/core.js"], opt);
	child.stdout.on('data', (data) => {
		console.log(`${data}`);
	});
	child.stderr.on('data', (data) => {
		console.log(`${data}`);
	});
}

function runDetachedProc() {
	console.log('Launching in detached process.');

	var opt = {
		detached: true,
		stdio: 'ignore'
	}

	let child = CProcess.spawn("node", ["bin/sys/core.js"], opt);
	child.unref();
}

entry();