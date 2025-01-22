import Express from 'express';
import ExpressWs from 'express-ws';
import HTTP from 'node:http';
import HTTPS from 'node:https';

var http: HTTP.Server | undefined;
var https: HTTPS.Server | undefined;
var wsInstance: ExpressWs.Instance;
var swsInstance: ExpressWs.Instance;

function init(app: Express.Application, httpServer?: HTTP.Server, httpsServer?: HTTPS.Server) {
	http = httpServer;
	https = httpsServer;

	if (http) wsInstance = ExpressWs(app, httpServer, { leaveRouterUntouched: true });
	if (https) swsInstance = ExpressWs(app, httpsServer, { leaveRouterUntouched: true });
}

function on(router: Express.Router): ExpressWs.Router {
	wsInstance?.applyTo(router);
	swsInstance?.applyTo(router);
	return router as ExpressWs.Router;
}

/**
 * Creates an Express router capable of handling WebSocket routers with .ws().
 */
function createRouter() {
	return on(Express.Router());
}

export default { init, createRouter, on };