// Query object in dot name format from window object
export function getObjectByName(name: string): any {
    let nameParts = name.split('.');
    let nameLength = nameParts.length;
    let scope: any = window;

    for (let i = 0; i < nameLength; ++i) {
        scope = scope[nameParts[i]];
    }

    return scope;
}

export function cloneTemplate(id: string): Node {
	let el = document.getElementById('t_' + id) as HTMLTemplateElement;
	return el.content.cloneNode(true);
}

export function arrErase(arr: unknown[], val: unknown): number {
	let i = arr.indexOf(val);
	if (i >= 0) {
		arr.splice(i, 1);
	}
	return i;
}

export function endsWithAny(str: string, arr: string[]): boolean {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

export function sleep(ms: number): Promise<void> {
	return new Promise(res => setTimeout(res, ms));
}

export function getURLParams(): ProxyConstructor {
	return new Proxy(new URLSearchParams(window.location.search), {
 		get: (searchParams: any, prop) => searchParams.get(prop),
	});
}

function strReplaceAll(text, token, newToken) {
	let escapedToken = token.replace(/([\/\,\!\\\^\$\{\}\[\]\(\)\.\*\+\?\|\<\>\-\&])/g, "\\$&");
	let regexp = new RegExp(escapedToken, 'g');

	if (typeof(newToken) == "string") {
		newToken = newToken.replace(/\$/g, "$$$$");
	}

	return text.replace(regexp, newToken);
}

export function setCookie(name: string, value: string, time = 365) {
	let d = new Date();
	d.setTime(d.getTime() + (time*24*60*60*1000));
	let expires = "expires="+ d.toUTCString();
	document.cookie = name + "=" + value + ";" + expires + ";path=/";
}

export function getCookie(cname: string): string {
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

export function destroyElementById(id) {
	let el = document.getElementById(id);
	if (el) el.remove();
	return el;
}

export function addModule(src: string, id?: string) {
	var elem = document.createElement('script');
	if (id) elem.setAttribute('id', id);
	elem.setAttribute('type', 'module');
	elem.setAttribute('src', src);
	
	document.head.appendChild(elem);

	return new Promise((resolve, reject) => {
		elem.addEventListener('load', resolve);
		elem.addEventListener('error', () => reject(`Resource '${src}' failed to load.`));
	});
}

export function addStylesheet(src: string, id?: string) {
	var style = document.createElement('link');
	if(id) style.setAttribute('id', id);
	style.setAttribute('rel', 'stylesheet');
	style.setAttribute('href', src);

	document.head.appendChild(style);

	return new Promise((resolve, reject) => {
		style.addEventListener('load', resolve);
		style.addEventListener('error', () => reject(`Resource '${src}' failed to load.`));
	});
}

export function addScript(src: string, id?: string) {
	var elem = document.createElement('script');
	if (id) elem.setAttribute('id', id);
	elem.setAttribute('defer', '');
	elem.setAttribute('src', src);

	document.head.appendChild(elem);

	return new Promise((resolve, reject) => {
		elem.addEventListener('load', resolve);
		elem.addEventListener('error', () => reject(`Resource '${src}' failed to load.`));
	});
}

export function downloadUrl(path) {
	let link = document.createElement('a');
	link.style.display = 'none';
	link.href = path;
	link.download = '';
	document.body.appendChild(link);
	link.click();
	link.remove();
}

export default {
	getObjectByName, cloneTemplate, arrErase, endsWithAny, sleep, getURLParams, strReplaceAll,
	getCookie, setCookie, destroyElementById, addModule, addStylesheet, addScript
};