async function entry() {
	if (await authIsKeyValid()) {
		initDesktop();
	} else {
		// Fetch login page
		let res = await fetch('/page/login');
		document.body.innerHTML += await res.text();

		await addScript('/res/pack/boot_login.chk.js');
		EntrySpace.initLogin();
	}
}

var loadingText;

function initTransition() {
	let screen = document.createElement('div');
	screen.setAttribute('id', 'loading-screen');

	let icon = document.createElement('div');
	icon.setAttribute('id', 'loading-icon');
	screen.appendChild(icon);

	loadingText = document.createElement('p');
	loadingText.setAttribute('id', 'loading-text');
	screen.appendChild(loadingText);

	document.body.appendChild(screen);
}

function enablePanics() {
	window._systemPanic = _systemPanic;

	// Early unhandled errors and rejections should bring immediate user attention in the form
	// of a system panic
	let hPanicError = (err) => {
		_systemPanic("Unhandled Error", err.error, true);
	};
	
	let hPanicUnhandledRejection = (ev) => {
		let detail;
		if (ev.reason) {
			let trace = (ev.reason.stack) ? ev.reason.stack : 'unavailable';
			detail = `${ev.reason}\n trace: ${trace}`;
		}
		_systemPanic("Unhandled Promise Error", detail, true);
	};

	window.addEventListener('error', hPanicError);
	window.addEventListener('unhandledrejection', hPanicUnhandledRejection);

	EntrySpace.disablePanicHandlers = () => {
		window.removeEventListener('error', hPanicError);
		window.removeEventListener('unhandledrejection', hPanicUnhandledRejection);
	}
}

async function initDesktop() {
	EntrySpace.log('Initializing desktop...')
	initTransition();

	// Set title
	document.title = 'Clouds';

	// Destroy login screen if any
	destroyElementById('login-screen');

	// Load jquery compatible lib
	loadingText.innerHTML = "Loading base...";
	await addScript('/res/lib/zepto.min.js');

	// Enable system panics after zepto is ready
	enablePanics();

	// Add system script and let it do the setup
	loadingText.innerHTML = "Loading core...";
	await addScript('/res/pack/shared.chk.js');
	
	EntrySpace.log('Invoking core module entry point...');
	(window as any).CoreModule.main();
}
EntrySpace.initDesktop = initDesktop;

async function authIsKeyValid() {
	let fRes = await fetch('/auth/test');
	let res = await fRes.json();
	return res.ok;
}

function setCookie(name, value, time) {
	if (!time) time = 365;

	let d = new Date();
	d.setTime(d.getTime() + (time*24*60*60*1000));
	let expires = "expires="+ d.toUTCString();
	document.cookie = name + "=" + value + ";" + expires + ";path=/";
}
EntrySpace.setCookie = setCookie;

function addScript(src) {
	var elem = document.createElement('script');
	elem.setAttribute('defer', '');
	elem.setAttribute('src', src);

	document.head.appendChild(elem);

	return new Promise((resolve, reject) => {
		elem.addEventListener('load', () => {
			EntrySpace.log('Library <b>' + src + '</b> ready.');
			resolve(undefined);
		});
		elem.addEventListener('error', () => reject(`Resource '${src}' failed to load.`));
	});
}

function destroyElementById(id) {
	let el = document.getElementById(id);
	if (el) el.remove();
	return el;
}

function _systemPanic(reason, detail, mode) {
	console.error('--- SYSTEM PANIC ---');
	// Initialize a counter to keep incrementing the z-index
	let self = _systemPanic as any;
	self.counter = self.counter || 1024;
	let index = self.counter++;

	let $box = $(`<div class='panic-screen' style="z-index: ${index}; position: absolute; top: 0; bottom: 0; left: 0; right: 0; background: black; color: white;">`);

	let $title;
	if (mode) {
		$title = $("<h1>-- Startup Failed --</h1>");
	} else {
		$title = $("<h1>-- System Panic --</h1>");
	}

	let $text = $(`<div></div>`);
	if (reason) {
		$text.append(`<p><b><u>${reason}</u></b></p>`);
	}
	if (detail) {
		$text.append(`<p><b>Detail: </b>${detail}</p>`);
	}
	$text.append(`<p><b>System: </b>${navigator.userAgent}</p>`);

	let stack = Error().stack;
	if (stack) {
		$text.append(`<p><b>Trigger Stack: </b>${stack}</p>`);
	}

	let $dismiss = $("<button>Dismiss</button>");
	$dismiss.click(() => {
		$box.remove();
	});
	
	if (mode) {
		$box.css('background', '#503');
	} else {
		$box.css('background', '#58A');
	}

	$box.append($title);
	$box.append($text);
	$box.append($dismiss);
	$('body').append($box);
}

entry();