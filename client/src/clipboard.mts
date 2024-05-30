var itemValue: any;
var itemType: string;

async function saveObject(type: string, object: any) {
	itemValue = object;
	itemType = type;
}

async function getObject() {
	return itemValue;
}	

async function getType() {
	return itemType;
}

function clear() {
	itemValue = null;
	itemType = null;
}

export default { saveObject, getObject, getType, clear };