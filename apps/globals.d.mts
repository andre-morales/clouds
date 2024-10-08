declare global {
	type $Element = ZeptoCollection;

	var Hammer: HammerStatic;
	var _systemPanic: Function;
}

export default global;