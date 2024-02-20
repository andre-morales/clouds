function initLogin() {
	// Set title
	document.title = 'Auth - Clouds';

	// Enter on any of the inputs submits the login form
	document.getElementById('id-field').addEventListener('keypress', (ev) => {
		if (ev.key == 'Enter') authSubmit();
	});
	document.getElementById('pass-field').addEventListener('keypress', (ev) => {
		if (ev.key == 'Enter') authSubmit();
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
	
	let fres = await fetch('/auth', opt);
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

	initDesktop();
}

function authFail() {
	let el = document.querySelector('#login-screen .status');
	el.innerHTML = 'Auth failed.';
}

initLogin();