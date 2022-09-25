async function entry() {
	if (await testAuthkey()) {
		initDesktop();
	} else {
		initLogin();
	}
}

function authLogout() {
	setCookie('authkey', '');
}

async function testAuthkey() {
	let fres = await fetch('/auth/test');
	let res = await fres.json();
	return res.ok;
}

async function initLogin() {
	// Set title
	document.title = 'Auth - WebSys';

	// Fetch login page
	let res = await fetch('/page/login');
	document.getElementById('body').innerHTML = await res.text();

	// Add login script
	addScript('/res/js/login.js', 'login-script');
}

function initTransition() {
	let screen = document.createElement('div');
	screen.setAttribute('id', 'loading-screen');

	let icon = document.createElement('div');
	icon.setAttribute('id', 'loading-icon');
	screen.appendChild(icon);

	document.body.appendChild(screen);
}

function endTransition() {
	let screen = document.getElementById('loading-screen');
	if (screen) screen.remove();
}

async function initDesktop() {
	initTransition();

	// Set title
	document.title = 'Desktop - WebSys';

	// Destroy login script if any
	destroyElementById('login-script');

	// Fetch desktop page
	let fres = await fetch('/page/desktop');
	if (fres.status != 200) {
		console.log('Forbidden.');
	}
	document.getElementById('body').innerHTML = await fres.text();

	// Add system script
	addScript('/res/js/websys.js', 'websys-script');
}

function addScript(src, id) {
	var scr = document.createElement('script');
	if(id) scr.setAttribute('id', id);
	scr.setAttribute('src', src);
	document.head.appendChild(scr);

	return new Promise((resolve) => {
		scr.addEventListener('load', resolve);
	});
}

function addStylesheet(src, id) {
	var style = document.createElement('link');
	if(id) style.setAttribute('id', id);
	style.setAttribute('rel', 'stylesheet');
	style.setAttribute('href', src);

	document.head.appendChild(style);

	return new Promise((resolve) => {
		style.addEventListener('load', resolve);
	});
}

function destroyElementById(id) {
	let el = document.getElementById(id);
	if (el) el.remove();
	return el;
}

function setCookie(name, value, time) {
	if (!time) time = 365;

	let d = new Date();
	d.setTime(d.getTime() + (time*24*60*60*1000));
	let expires = "expires="+ d.toUTCString();
	document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

function getCookie(cname) {
	let name = cname + "=";
	let decodedCookie = decodeURIComponent(document.cookie);
	let ca = decodedCookie.split(';');
	for(let i = 0; i < ca.length; i++) {
		let c = ca[i];
		while (c.charAt(0) == ' ') {
			c = c.substring(1);
		}
		if (c.indexOf(name) == 0) {
			return c.substring(name.length, c.length);
		}
	}
	return "";
}

window.onload = entry;