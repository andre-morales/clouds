const KAPI_VERSION = '0.7.00';

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

// Local imports
import { BadAuthException } from './errors.mjs';
import config, * as Config from './config.mjs';
import * as Auth from './auth.mjs';
import * as VFS from './vfs.mjs';
import * as Stats from './stats.mjs';
import * as FFmpegM from './ext/ffmpeg.mjs';

// Module instances
export var FFmpeg = null;
var progArgs = null;
var app = null;

export async function main(args) {
	console.log('--- KAPI Version: ' + KAPI_VERSION);
	progArgs = args;

	initConfig();
	Auth.init();
	VFS.init();
	Stats.init();
	initExpress();
}

function initExpress() {
	if (Config.isExtensionEnabled('ffmpeg')) {
		FFmpeg = new FFmpegM.FFmpeg();
		FFmpeg.init(config.extensions.ffmpeg);
	}

	app = Express();

	// Core request handlers
	app.use(Cors());
	app.use(Compression());

	// Body parsers
	app.use(Express.json());
	app.use(Express.text());
	app.use(FileUpload({ createParentPath: true }));
	app.use(CookieParser());

	app.use(Stats.getTracker());
	
	// API routes
	app.use('/res', Express.static('client/res')); // Static public resources
	app.use('/auth', Auth.getRouter());            // Auth system 
	app.use('/fsv', VFS.getRouter());			   // Extended file system with HTTP verbs
	app.use('/stat', Stats.getRouter());
	apiSetupPages();     			    		   // Entry, Auth and Desktop
	apiSetupApps();								   // Apps service

	// General error handler
	app.use((err, req, res, next) => {
		if (err instanceof BadAuthException) {
			denyRequest(res);
			return;
		}

		next(err);
	});

	app.set('view engine', 'ejs');
	app.set('views', 'api/pages');
	app.disable('x-powered-by');

	let httpsKey = FS.readFileSync('config/ssl/key.key');
	let httpsCert = FS.readFileSync('config/ssl/cert.crt');

	let http = HTTP.createServer(app);
	let https = HTTPS.createServer({
		key: httpsKey,
		cert: httpsCert
	}, app);

	if (config.http_port) {
		http.listen(config.http_port, () => {
			console.log('Listening on port ' + config.http_port);
		});
	}
	
	if (config.https_port) {
		https.listen(config.https_port, () => {
			console.log('Listening on port ' + config.https_port);
		});
	}
}

function initConfig() {
	Config.init(progArgs);
}

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
	app.get('/page/desktop', (req, res) => {
		Auth.getUserGuard(req);
		res.render('desktop');
	});

	app.get('/version', (req, res) => {
		res.send(KAPI_VERSION);
	});
}

function apiSetupApps() {
	app.get('/app/:app/*', (req, res) => {
		Auth.getUserGuard(req);
		
		let app = req.params.app;
		let path = req.params[0];	
		let fpath = './client/apps/' + app + '/' + path;
		res.sendFile(Path.resolve(fpath));
	});
}

function denyRequest(res) {
	res.status(403);
	res.send('BAD_AUTH: Authentication required.');
}

// Route wrapper for async routes
export function asyncRoute(fn) {
	return async (req, res, next) => {
		try {
			await fn(req, res, next);
		} catch (err) {
			next(err);
		}
	};
}