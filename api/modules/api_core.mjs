const KAPI_VERSION = '0.6.08';

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
import * as FFmpegM from './ext/ffmpeg.mjs';
import * as ShellMgr from './ext/rshell.mjs';
//import * as MediaStr from './ext/mediastr.mjs';
//import * as FetchProxy from './fetchproxy.mjs';

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
	initExpress();
	//await FetchProxy.init();
	//FetchProxy.start();
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

	// API routes
	app.use('/res', Express.static('client/res')); // Static public resources
	app.use('/auth', Auth.getRouter());            // Auth system 
	app.use('/fsv', VFS.getRouter());			   // Extended file system with HTTP verbs
	
	apiSetupPages();     			    		   // Entry, Auth and Desktop
	apiSetupApps();								   // Apps service
	apiSetupRShell();     						   // Remote console

	//if (isExtEnabled('mediastr')) {
	//	MediaStr.init(config.extensions.mediastr);
	//	app.use('/mstr', MediaStr.getExpressRouter());
	//}

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
	
	ShellMgr.loadDefs(config.extensions.shell);
}

function apiSetupRShell() {
	app.get('/shell/0/init', (req, res) => {
		Auth.getUserGuard(req);

		let shell = ShellMgr.create();
		if (!shell) {
			res.status(500).end();
			return;
		}

		console.log('Created shell ' + shell.id);
		res.json(shell.id);
	});

	app.post('/shell/:id/send', (req, res) => {
		Auth.getUserGuard(req);

		let shell = ShellMgr.shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}
		let cmd = req.body.cmd;
		shell.send(cmd);
		res.end();
	});

	app.get('/shell/:id/stdout', (req, res) => {
		Auth.getUserGuard(req);
		let shell = ShellMgr.shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		res.send(shell.stdout);
	});

	app.get('/shell/:id/stdout_new', async (req, res) => {
		Auth.getUserGuard(req);
		res.set('Cache-Control', 'no-store');

		let shell = ShellMgr.shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		try {
			let result = await shell.newStdoutData();
			res.send(result);
		} catch(err) {
			console.log(err);
			res.status(500).end();
			return;
		}
		
	});

	app.get('/shell/:id/kill', (req, res) => {
		Auth.getUserGuard(req);
		
		let id = req.params.id;
		
		if(!ShellMgr.destroy(id)) {
			res.status(404).end();
			return;
		}

		console.log('Destroyed shell ' + id);
		res.end();
	});

	app.get('/shell/:id/ping', (req, res) => {
		Auth.getUserGuard(req);
		let shell = ShellMgr.shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		shell.ping();
		res.end();
	});


	setInterval(() => {
		ShellMgr.destroyOldShells(20);
	}, 20000)
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