const KAPI_VERSION = '0.5.7';

// Lib imports
import Util from 'util';
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
import * as VFSM from './vfs.mjs';
import * as Files from './files.mjs';
import * as FFmpegM from './ext/ffmpeg.mjs';
import * as ShellMgr from './ext/rshell.mjs';
//import * as MediaStr from './ext/mediastr.mjs';
//import * as FetchProxy from './fetchproxy.mjs';

// Module instances
let FFmpeg = null;
var vfs = null;
var progArgs = null;
var app = null;

export async function main(args) {
	console.log('--- KAPI Version: ' + KAPI_VERSION);
	progArgs = args;

	initConfig();
	Auth.init();
	initFS();
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
	apiSetupPages();     			    		   // Entry, Auth and Desktop
	apiSetupFS();         						   // File system
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

	let httpsKey = FS.readFileSync('ssl/key.key');
	let httpsCert = FS.readFileSync('ssl/cert.crt');

	let http = HTTP.createServer(app);
	let https = HTTPS.createServer({
		key: httpsKey,
		cert: httpsCert
	}, app);

	http.listen(config.http_port, () => {
		console.log('Listening on port ' + config.http_port);
	});
	https.listen(config.https_port, () => {
		console.log('Listening on port ' + config.https_port);
	});
}

function initConfig() {
	Config.init(progArgs);
	
	ShellMgr.loadDefs(config.extensions.shell);
}

function initFS() {
	vfs = new VFSM.VFS();
	vfs.loadDefs(config.fs);
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

function apiSetupFS() {
	app.get('/fs/q/*', asyncRoute(async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		// Translate the virtual path to a real one
		let vpath = '/' + req.params[0];
		let fpath = vfs.translate(userId, vpath);
		if (!fpath) {
			res.status(404).end();
			return;
		}
		
		// Resolve the path and send the file. If an error occurs,
		// answer with a 404 error code.
		let absPath = Path.resolve(fpath);
		res.sendFile(absPath, (err) => {
			if (err) {
				res.status(404).end();
			}
		});
	}));	

	app.post('/fs/u/*', asyncRoute(async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		let fpath = vfs.translate(userId, vpath);

		if (!req.files) {
			console.log('no files');
			res.status(500).end();
			return;
		}

		if (!req.files.upload) {
			console.log('no uploaded files');
			res.status(500).end();
			return;
		}
		
		let upload = req.files.upload;
		var files = upload;
		if(!Array.isArray(upload)){
			files = [files];
		}

		for(let file of files){
			file.mv(Path.join(fpath, file.name));
		}	

		res.end();
	}));	

	app.post('/fs/ud/*', asyncRoute(async (req, res) => {
		let user = Auth.getUserGuard(req);

		let path = vfs.translate(user, '/' + req.params[0]);

		try {
			await FS.promises.writeFile(path, req.body);
		} catch (err) {
			res.status(500);
		}
		res.end();
	}));

	app.get('/fs/ls/*', asyncRoute(async(req, res) => {
		let userId = Auth.getUserGuard(req);

		// If the virtual path is root '/', list the virtual mounting points
		let vpath = '/' + req.params[0];
		if (vpath == '/') {
			res.json(vfs.listVMPoints(userId));
			return;
		}

		// Translate the virtual path to the machine physical path
		let fpath = vfs.translate(userId, vpath);
		if (!fpath) {
			res.status(400).end();
			return;
		}

		// List the directory, and return the json results
		try {
			let results = await vfs.listPDir(fpath);
			res.json(results);
		} catch(err) {
			res.status(err).end();
		}
	}));

	app.get('/fs/thumb/*', async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];

		let fpath = vfs.translate(userId, vpath);

		if (Files.isFileExtVideo(fpath) || Files.isFileExtPicture(fpath)) {
			await handleThumbRequest(fpath, res);
		} else {
			res.sendFile(fpath);
		}
	});	
}

function denyRequest(res) {
	res.status(403);
	res.send('BAD_AUTH: Authentication required.');
}

async function handleThumbRequest(_abs, res){
	let absFilePath = Files.toFullSystemPath(_abs);
	var thumbfolder = Files.toFullSystemPath(`./.thumbnails/`);

	let fthname = Files.hashPath(_abs);
	var thumbpath = `${thumbfolder}/${fthname}.thb`;

	if(FS.existsSync(thumbpath)){
		res.sendFile(thumbpath);
		return;
	}

	if(FFmpeg) {
		if(!FS.existsSync(thumbfolder)) FS.mkdirSync(thumbfolder);

		if(!FS.existsSync(thumbpath)){
			let result = await FFmpeg.createThumbOf(absFilePath, thumbpath);

			if(!result){
				let f = await FS.promises.open(thumbpath, 'w');
				f.close();
				//res.status(404).end();
				//return;
			}	
		} 

		res.sendFile(thumbpath);
	} else {
		res.status(404).end();
	}
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