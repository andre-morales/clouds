import * as Entry from './entry.mjs';

export function initLogin() {
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
	let id = document.getElementById('id-field').value;
	let pass = document.getElementById('pass-field').value;

	let opt = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
	    },
		body: JSON.stringify({id: id, pass: pass})
	};
	
	let fres = await fetch('/auth/login', opt);
	let res = await fres.json();

	if (res.ok) {
		authSuccess(res.key);
	} else {
		authFail();
	}
}

async function authSuccess(key) {
	let el = document.querySelector('#login-screen .status');
	el.innerHTML = 'Auth successful.';

	setCookie('authkey', key);

	Entry.initDesktop();
}

function authFail() {
	let el = document.querySelector('#login-screen .status');
	el.innerHTML = 'Auth failed.';
}