function addScript(src, id) {
	var elem = document.createElement('script');
	if (id) elem.setAttribute('id', id);
	elem.setAttribute('src', src);

	document.head.appendChild(elem);

	return new Promise((resolve) => {
		elem.addEventListener('load', resolve);
	});
}

function addModule(src, id) {
	var elem = document.createElement('script');
	if (id) elem.setAttribute('id', id);
	elem.setAttribute('type', 'module');
	elem.setAttribute('src', src);
	
	document.head.appendChild(elem);

	return new Promise((resolve) => {
		elem.addEventListener('load', resolve);
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
