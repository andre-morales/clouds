import * as CProcess from 'child_process';

function entry() {
	//runFullyDetached();
	runFullyAttached();
}

function runFullyAttached() {
	let m = import('./core.js');
}

function runAttached(){
	console.log('Launching attached.');

	var opt = {
		detached: false,
		stdio: 'pipe'
	}

	let child = CProcess.spawn("node.exe", ["bin\\sys\\core.js"], opt);
	child.stdout.on('data', (data) => {
		console.log(`${data}`);
	});
	child.stderr.on('data', (data) => {
		console.log(`${data}`);
	});
}

function runFullyDetached() {
	console.log('Launching fully detached.');

	var opt = {
		detached: true,
		stdio: 'ignore'
	}

	let child = CProcess.spawn("node.exe", ["bin\\sys\\core.js"], opt);
	child.unref();
}

entry();