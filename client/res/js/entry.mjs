async function entry() {
	if (await authIsKeyValid()) {
		initDesktop();
	} else {
		// Fetch login page
		let res = await fetch('/page/login');
		document.body.innerHTML = await res.text();

		// Add login script
		addModule('/res/js/login.mjs', 'login-script');
	}
}

function initTransition() {
	let screen = document.createElement('div');
	screen.setAttribute('id', 'loading-screen');

	let icon = document.createElement('div');
	icon.setAttribute('id', 'loading-icon');
	screen.appendChild(icon);

	document.body.appendChild(screen);
}

export async function initDesktop() {
	initTransition();

	// Set title
	document.title = 'Clouds';

	// Destroy login script if any
	destroyElementById('login-script');

	// Add system script and let it do the setup
	addScript('/res/js/client_core.js');
}

function authLogout() {
	setCookie('authkey', '');
}

async function authIsKeyValid() {
	let fres = await fetch('/auth/test');
	let res = await fres.json();
	return res.ok;
}

window.onload = entry;