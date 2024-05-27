import * as CProcess from 'child_process';

function entry() {
	let args = process.argv.slice(2);

	runInSelf(args);
}

function runInSelf(args) {
	console.log('Entry: Launching in self.');

	import('./core.mjs').then((mod) => {
		mod.main(args);
	});
}

/*
TODO: Update these launching modes.
function runAttachedProc(){
	console.log('Entry: Launching in attached process.');

	var opt = {
		detached: false,
		stdio: 'pipe'
	}

	let child = CProcess.spawn("node", ["api/core.mjs"], opt);
	child.stdout.on('data', (data) => {
		console.log(`${data}`);
	});
	child.stderr.on('data', (data) => {
		console.log(`${data}`);
	});
}

function runDetachedProc() {
	console.log('Entry: Launching in detached process.');

	var opt = {
		detached: true,
		stdio: 'ignore'
	}

	let child = CProcess.spawn("node", ["api/api_core.js"], opt);
	child.unref();
}
*/
entry();