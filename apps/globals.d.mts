declare global {
	type $Element = ZeptoCollection;

	var Hammer: HammerStatic;
	var _systemPanic: Function;
	let __BUILD_MODE__: string;
}

export default global;