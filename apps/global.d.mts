declare global {
	interface ZeptoCollection {
		[0]: any;
	}
	type $Element = ZeptoCollection;

	var Hammer: HammerStatic;
	var _systemPanic: Function;
	let __BUILD_MODE__: string;
	let __BUILD_BASELINE_BROWSERS__: any;
}

export default global;	