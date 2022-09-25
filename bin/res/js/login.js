async function auth() {
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
