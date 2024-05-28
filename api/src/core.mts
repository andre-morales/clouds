export const KAPI_VERSION = '0.8.00';

// Lib imports
import Path from 'path';
import FS from 'fs';
import HTTP from 'http';
import HTTPS from 'https';
import Compression from 'compression';
import CookieParser from 'cookie-parser';
import Cors from 'cors';
import Express from 'express';
import FileUpload from 'express-fileupload';
import Morgan from 'morgan';
import Chalk from 'chalk';

// Local imports
import { BadAuthException } from './errors.mjs';
import config, * as Config from './config.mjs';
import * as Auth from './auth.mjs';
import * as VFSRouter from './vfs_router.mjs';
import * as Stats from './stats.mjs';
import * as FFmpeg from './ext/ffmpeg.mjs';
import * as RShell from './ext/rshell.mjs';

var app: Express.Application;

/**
 * Main entry point of the server system.
 * @param args Command-line arguments
 */
export async function main(args: string[]) {
	console.log('--- KAPI Version: ' + KAPI_VERSION);

	Config.init(args);
	Auth.init();
	VFSRouter.init();
	Stats.init();
	FFmpeg.init();
	RShell.init();
	initExpress();
}

/**
 * Initialize Express App. Setups middlewares, routes, and starts up the HTTP(s) servers.
 */
function initExpress() {
	app = Express();

	// Core request handlers.
	setupLoggingRouter();

	app.use(Cors());
	app.use(Compression());

	// Body type parsers
	app.use(Express.json());
	app.use(Express.text());
	app.use(FileUpload({ createParentPath: true }));
	app.use(CookieParser());

	// Socket data stats tracker
	app.use(Stats.getTracker());
	
	// Public resources
	app.use('/res', Express.static('client/res')); 
	app.use('/@sys', [Auth.guard, Express.static('client/res/js')]);

	// API routes
	app.use('/auth', Auth.getRouter());            // Auth system 
	app.use('/fsv', VFSRouter.getRouter());		   // Extended file system with HTTP verbs
	app.use('/stat', [Auth.guard, Stats.getRouter()]);
	apiSetupPages();     			    		   // Entry, Auth and Desktop
	RShell.installRouter(app);
	apiSetupApps();								   // Apps service

	// General error handler
	app.use((err: any, req: any, res: any, next: any) => {
		if (err instanceof BadAuthException) {
			denyRequest(res);
			return;
		}

		next(err);
	});

	app.set('view engine', 'ejs');
	app.set('views', 'api/pages');
	app.disable('x-powered-by');

	// Enable HTTP listening server
	if (config.http_port) {
		let http = HTTP.createServer(app);
		http.listen(config.http_port, () => {
			console.log('Listening on port ' + config.http_port);
		});
	}
	
	// Enable HTTPS listening server
	if (config.https_port) {
		let httpsKey = FS.readFileSync('config/ssl/key.key');
		let httpsCert = FS.readFileSync('config/ssl/cert.crt');
		
		let https = HTTPS.createServer({
			key: httpsKey,
			cert: httpsCert
		}, app);

		https.listen(config.https_port, () => {
			console.log('Listening on port ' + config.https_port);
		});
	}
}
/**
 * Configure main pages on the app router.
 */
function apiSetupPages() {
	// - Entry point page
	app.get('/', (req, res) => {
		res.render('entry');
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
	app.get('/app/:app/*', Auth.guard, (req, res) => {
		let app = req.params.app;
		let path = req.params[0];	
		let fpath = './client/apps/' + app + '/' + path;
		res.sendFile(Path.resolve(fpath));
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

		// Show time in millis or seconds and color slow responses yellow or red
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

/**
 * Wraps a route handler in an async route capable of handling exceptions.
 * @param fn The route handler in natural Express format.
 * @returns An async function meant to be used as an Express route handler.
 */
export function asyncRoute(fn: Function) {
	return async (req: any, res: any, next: any) => {
		try {
			await fn(req, res, next);
		} catch (err) {
			next(err);
		}
	};
}