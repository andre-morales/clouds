declare module 'express-ws' {
	import * as express from "express";
	import * as core from "express-serve-static-core";
	import * as http from "http";
	import * as https from "https";
	import * as ws from "ws";

	export namespace expressWs {
		type Application = express.Application & WithWebsocketMethod;
		type Router = express.Router & WithWebsocketMethod;
	
		interface Options {
			leaveRouterUntouched?: boolean | undefined;
			wsOptions?: ws.ServerOptions | undefined;
		}
	
		interface RouterLike {
			get: express.IRouterMatcher<this>;
			[key: string]: any;
			[key: number]: any;
		}
	
		interface Instance {
			app: Application;
			applyTo(target: RouterLike): void;
			getWss(): https.Server;
		}
	
		type WebsocketRequestHandler = (ws: ws.WebSocket, req: express.Request, next: express.NextFunction) => void;
		type WebsocketMethod<T> = (route: core.PathParams, ...middlewares: WebsocketRequestHandler[]) => T;
	
		interface WithWebsocketMethod {
			ws: WebsocketMethod<this>;
		}
	}

	export function expressWs(
		app: express.Application,
		server?: http.Server | https.Server,
		options?: expressWs.Options,
	): expressWs.Instance;

	export default expressWs;
}
