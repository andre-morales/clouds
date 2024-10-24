import App from "./app.mts";
import { ClientClass } from "./client_core.mts";

declare global {
	type $Element = ZeptoCollection;
	interface ZeptoCollection {
		[0]: HTMLElement
	}

	var Hammer: HammerStatic;
	var App: App;
	var Client: ClientClass;
	var _systemPanic: Function;
	var IMPORT: Function;
	let __BUILD_MODE__: string;
}

export default global;