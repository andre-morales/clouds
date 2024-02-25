
// Query object in dot name format from window object
function getObjectByName(name) {
    var nameParts = name.split('.');
    var nameLength = nameParts.length;
    var scope = window;

    for (var i = 0; i < nameLength; ++i) {
        scope = scope[nameParts[i]];
    }

    return scope;
}

function cloneTemplate(id) {
	let el = document.getElementById('t_' + id);
	return el.content.cloneNode(true);
}

function arrErase(arr, val) {
	let i = arr.indexOf(val);
	if (i >= 0) {
		arr.splice(i, 1);
	}
	return i;
}

function endsWithArr(str, arr) {
	for (let end of arr) {
		if (str.endsWith(end)) return true;
	}
	return false;
}

function sleep(ms) {
	return new Promise(res => setTimeout(res, ms));
}

function getURLParams() {
	return new Proxy(new URLSearchParams(window.location.search), {
 		get: (searchParams, prop) => searchParams.get(prop),
	});
}