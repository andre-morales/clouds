var itemValue: any;
var itemType: string;

function saveObject(type: string, object: any) {
	itemValue = object;
	itemType = type;
}

function getObject() {
	return itemValue;
}	

function getType() {
	return itemType;
}

function clear() {
	itemValue = null;
	itemType = '';
}

export default { saveObject, getObject, getType, clear };