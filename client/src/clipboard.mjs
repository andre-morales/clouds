async function saveObject(type, object) {
	this.object = object;
	this.type = type;
}

async function getObject() {
	return this.object;
}	

async function getType() {
	return this.type;
}

function clear() {
	this.object = null;
	this.type = null;
}

export default { saveObject, getObject, getType, clear };