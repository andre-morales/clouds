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

export function cloneTemplate(id: string) {
	let el: any = document.getElementById('t_' + id);
	return el.content.cloneNode(true);
}

export function arrErase(arr: unknown[], val: unknown) {
	let i = arr.indexOf(val);
	if (i >= 0) {
		arr.splice(i, 1);
	}
	return i;
}

export function endsWithAny(str, arr) {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

export function sleep(ms) {
	return new Promise(res => setTimeout(res, ms));
}

export function getURLParams() {
	return new Proxy(new URLSearchParams(window.location.search), {
 		get: (searchParams: any, prop) => searchParams.get(prop),
	});
}

export default { getObjectByName, cloneTemplate, arrErase, endsWithAny, sleep, getURLParams };