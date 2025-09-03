export const KAPI_VERSION = '0.8.09';

// Local imports
import { BadAuthException } from './errors.mjs';
import config, * as Config from './config.mjs';
import * as Auth from './auth.mjs';
import * as VFSRouter from './vfs_router.mjs';
import * as VFSMXRouter from './vfsmx_router.mjs';
import * as Stats from './stats.mjs';
import * as FFmpeg from './ext/ffmpeg.mjs';
import * as RShell from './ext/rshell.mjs';
import * as VFS from './vfs.mjs';
import * as Files from './files.mjs';
import * as SystemManagement from './system_management.mjs';
import Express, { Request, Response, NextFunction } from 'express';
import FileUpload from 'express-fileupload';
import Compression from 'compression';
import CookieParser from 'cookie-parser';
import Cors from 'cors';
import Morgan from 'morgan';
import Chalk from 'chalk';
import Path from 'node:path';
import FS from 'node:fs';
import HTTP from 'node:http';
import HTTPS from 'node:https';
import WebSockets from './websockets.mjs';
import Deferred from '#common/deferred.mjs';

var app: Express.Application;
var httpServer: HTTP.Server;
var httpsServer: HTTPS.Server;

/**
 * Main entry point of the server system.
 * @param args Command-line arguments
 */
export async function main(args: string[]) {
	console.log('--- KAPI Version: ' + KAPI_VERSION);

	let options: Intl.DateTimeFormatOptions = {
		year: 'numeric', month: 'numeric', day: 'numeric',
		hour: '2-digit', minute: '2-digit', second: '2-digit'
	};
	console.log(`:: ${new Date().toLocaleDateString(undefined, options)}\n`)

	Config.init(args);
	Auth.init();
	VFS.init();
	Stats.init();
	FFmpeg.init();
	RShell.init();
	initServer();
	initMiddleware();
	initRouters();
	initErrorHandlers();
	runServers();
}

function initMiddleware() {
	// Add support for web socket routes
	WebSockets.init(app, httpServer, httpsServer);
	
	setupLoggingRouter();

	app.use(Cors());
	app.use(Compression());

	// Body type parsers
	app.use(Express.json());
	app.use(Express.text());
	app.use(FileUpload({ createParentPath: true }));
	app.use(CookieParser());

	app.set('view engine', 'ejs');
	app.set('views', 'api/pages');
	app.disable('x-powered-by');
}

/**
 * Initialize Express App. Setups middlewares, routes, and starts up the HTTP(s) servers.
 */
function initRouters() {
	// Socket data stats tracker
	app.use(Stats.getTracker());
	
	// Public resources
	app.use('/res', Express.static('client/public')); 
	app.use('/@sys', [Auth.guard, Express.static('client/public/js')]);

	// API routes
	app.use('/auth', Auth.getRouter());           	      		 // Auth system 
	app.use('/sys', [Auth.guard, SystemManagement.getRouter()]); // Management tasks
	app.use('/fsv', [Auth.guard, VFSRouter.getRouter()]); 		 // Extended file system service
	app.use('/fsmx', [Auth.guard, VFSMXRouter.getRouter()]); 	 // Media extensions for the VFS
	app.use('/stat', [Auth.guard, Stats.getRouter()]);   		 // Statistics and info router
	apiSetupPages();     			    		  	     		 // Entry, Auth and Desktop
	app.use('/shell', [Auth.guard, RShell.getRouter()]);		 // Remote shell service
	apiSetupApps();								   	     		 // Apps service

}

function initErrorHandlers() {
	// General error handler
	app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
		if (err instanceof BadAuthException) {
			denyRequest(res);
			return;
		}

		if ((req as any).ws) {
			console.error("Error on websocket handler!");
			console.error(err);
		}

		next(err);
	});
}

function initServer() {
	app = Express();

	// Enable HTTP listening server
	if (config.http_port) {
		httpServer = HTTP.createServer(app);
	}
	
	// Enable HTTPS listening server
	if (config.https_port) {
		let httpsKey = FS.readFileSync('config/ssl/key.key');
		let httpsCert = FS.readFileSync('config/ssl/cert.crt');
		
		httpsServer = HTTPS.createServer({
			key: httpsKey,
			cert: httpsCert
		}, app);
	}
}

function runServers() {
	httpServer?.listen(config.http_port, () => {
		console.log('HTTP on port ' + config.http_port);
	});
	httpsServer?.listen(config.https_port, () => {
		console.log('HTTPS on port ' + config.https_port);
	});
}

async function stopServers() {
	if (httpServer) {
		let def = new Deferred();
		httpServer.close(() => {
			def.resolve();
		});
		await def.promise;
	}
	
	if (httpsServer) {
		let def = new Deferred();
		httpsServer.close(() => {
			def.resolve();
		});
		await def.promise;
	}
}

/**
 * Configure main pages on the app router.
 */
function apiSetupPages() {
	// - Entry point page
	app.get('/', async (req, res) => {
		let user = Auth.getUser(req);
		let pwa = false;
		if (user) {
			try {
				let fPath = VFS.translate(user, '/usr/.system/preferences.json');
				let preferences = await Files.readJSON(fPath as string);
				pwa = Boolean(preferences.use_pwa_features);
			} catch(err) {}
		}

		res.render('entry', { use_pwa_features: pwa });
	});

	// - Login page
	app.get('/page/login', (req, res) => {
		res.render('login');
	});

	// - Desktop page
	app.get('/page/desktop', Auth.guard, (req, res) => {
		Auth.getUserGuard(req);
		res.render('desktop');
	});
}

/** Setup /app route */
function apiSetupApps() {
	app.get('/app/:app/*path', Auth.guard, (req, res) => {
		let app = req.params.app;
		let path = (req.params as any).path.join('/');
		let fPath = './apps/' + app + '/' + path;

		res.sendFile(Path.resolve(fPath));
	});
}

/**
 * Sets up request logging on the console.  
 */
function setupLoggingRouter() {
	if (!config.log_requests) return;

	app.use(Morgan((tokens, req, res) => {
		// Query all the information for the log message
		let ip = tokens['remote-addr'](req, res);
		let method = tokens.method(req, res);
		let status = tokens.status(req, res);
		if (!status) status = '???';
		let url = "" + tokens.url(req, res);
		let time = tokens['response-time'](req, res);

		// Color response status code according to their category
		switch (status[0]) {
		case '2':
			status = Chalk.green(status);
			break;
		case '4':
			status = Chalk.yellow(status);
			break;
		case '5':
			status = Chalk.red(status);
			break;
		}

		// Limit the URL length in the console, only showing the tail part
		const URL_LENGTH = 40;
		if (url.length > URL_LENGTH) {
			url = '…' + url.substring(url.length - URL_LENGTH + 1);
		} else {
			url = url.padStart(URL_LENGTH);
		}

		// Show time in milliseconds or seconds and color slow responses yellow or red
		let timeMs = Number(time);
		if (timeMs >= 1000) {
			time = Chalk.red((timeMs / 1000).toFixed(0) + 's');
		} else if (timeMs >= 500) {
			time = Chalk.yellow(timeMs.toFixed(0) + 'ms');
		} else {
			time = timeMs.toFixed(0) + 'ms';
		}
		time = time.padStart(5);

		let msg = [
			ip, '|',
			method,
			status,
			url,
			time
		].join(' ');
		return msg;
	}));
}

function denyRequest(res: Express.Response) {
	res.status(403);
	res.send('BAD_AUTH: Authentication required.');
}

export async function shutdown() {
	console.log("Received shutdown request...");
	RShell.shutdown();
	await stopServers();
	console.log("Servers stopped.");
}
