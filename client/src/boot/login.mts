import '../styles/login.scss';

function initLogin() {
	// Set title
	document.title = 'Auth - Clouds';

	// Enter on any of the inputs submits the login form
	let idField = document.getElementById('id-field');
	let passField = document.getElementById('pass-field');
	idField.addEventListener('keypress', (ev) => {
		if (ev.key == 'Enter') {
			passField.focus();
		}
	});
	passField.addEventListener('keypress', (ev) => {
		if (ev.key == 'Enter') authSubmit();
	});
	document.getElementById('login-btn').addEventListener('click', (ev) => {
		authSubmit();
	});
}

async function authSubmit() {
	let id = (document.getElementById('id-field') as any).value;
	let pass = (document.getElementById('pass-field') as any).value;

	let opt = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({id: id, pass: pass})
	};
	
	let fRes = await fetch('/auth/login', opt);
	let res = await fRes.json();

	if (res.ok) {
		authSuccess(res.key);
	} else {
		authFail();
	}
}

async function authSuccess(key) {
	let el = document.querySelector('#login-screen .status');
	el.innerHTML = 'Auth successful.';

	setCookie('auth_key', key);

	EntrySpace.initDesktop();
}

function authFail() {
	let el = document.querySelector('#login-screen .status');
	el.innerHTML = 'Auth failed.';
}

function setCookie(name, value, time?: number) {
	if (!time) time = 365;

	let d = new Date();
	d.setTime(d.getTime() + (time*24*60*60*1000));
	let expires = "expires="+ d.toUTCString();
	document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

EntrySpace.initLogin = initLogin;