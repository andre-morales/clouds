const KAPI_VERSION = '0.5.4';

// Lib imports
import Util from 'util';
import FS from 'fs';
import HTTP from 'http';
import HTTPS from 'https';
import Compression from 'compression';
import CookieParser from 'cookie-parser';
import Cors from 'cors';
import Express from 'express';

// Local imports
const VFSM = await import('./vfs.js')
const Files = await import('./files.js');
const FFmpegM = await import('./ext/ffmpeg.js');
const ShellMgr = await import ('./ext/rshell.js');
const MediaStr = await import ('./ext/mediastr.js');
const FetchProxy = await import ('./fetchproxy.js');

// Lib requires
import { createRequire } from "module";
const require = createRequire(import.meta.url);

const WebSocket = require('ws');
const Path = require('path');
let FFmpeg = null;

const CProc = require('child_process');
const FileUpload = require('express-fileupload');

var progArgs = null;
var profile = 'default';
var config = null;
var app = null;
var logins = null;
var userDefs = null;
var vfs = null;

export async function main(args) {
	console.log('KAPI Version: ' + KAPI_VERSION);
	progArgs = args;

	initConfig();
	initFS();
	initUsers();
	initExpress();
	startExpress();
	await FetchProxy.init();
	FetchProxy.start();
}

function initExpress() {
	if (isExtEnabled('ffmpeg')) {
		FFmpeg = new FFmpegM.FFmpeg();
		FFmpeg.init(config.extensions.ffmpeg);
	}

	app = Express();
	app.use(Cors());
	app.use(Compression());
	
	app.use(Express.json());
	app.use(Express.text());
	app.use(FileUpload({ createParentPath: true }));
	app.use(CookieParser());

	app.use('/res', Express.static('bin/res')); // Static public resources

	apiSetupAuth();       // Auth system
	apiSetupPages();      // Entry, Auth and Desktop
	apiSetupFS();         // File system
	apiSetupApps();       // Apps service
	apiSetupRShell();     // Remote console

	if (isExtEnabled('mediastr')) {
		MediaStr.init(config.extensions.mediastr);
		app.use('/mstr', MediaStr.getExpressRouter());
	}
}

function initConfig() {
	let i = progArgs.indexOf('--profile');
	if (i >= 0) profile = progArgs[i + 1];
	console.log('Profile: ' + profile);
	
	let allConfig = JSON.parse(FS.readFileSync(`config/profiles/all.json`));
	let profConfig = JSON.parse(FS.readFileSync(`config/profiles/${profile}.json`));
	config = Object.assign({}, allConfig, profConfig);
	
	console.log(config);
	
	ShellMgr.loadDefs(config.extensions.shell);
}

function initFS() {
	vfs = new VFSM.VFS();
	vfs.loadDefs(config.fs);
}

function initUsers() {
	userDefs = JSON.parse(FS.readFileSync('config/users.json'));
	logins = {};
}

function isExtEnabled(ext) {
	return config.extensions
		&& config.extensions[ext]
		&& config.extensions[ext].enabled;
}

function apiSetupRShell() {
	app.get('/shell/0/init', (req, res) => {
		getGuardedReqUser(req);

		let shell = ShellMgr.create();
		if (!shell) {
			res.status(500).end();
			return;
		}

		console.log('Created shell ' + shell.id);
		res.json(shell.id);
	});

	app.post('/shell/:id/send', (req, res) => {
		getGuardedReqUser(req);

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
		getGuardedReqUser(req);
		let shell = ShellMgr.shells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		res.send(shell.stdout);
	});

	app.get('/shell/:id/stdout_new', async (req, res) => {
		getGuardedReqUser(req);
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
		getGuardedReqUser(req);
		
		let id = req.params.id;
		
		if(!ShellMgr.destroy(id)) {
			res.status(404).end();
			return;
		}

		console.log('Destroyed shell ' + id);
		res.end();
	});

	app.get('/shell/:id/ping', (req, res) => {
		getGuardedReqUser(req);
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
		getGuardedReqUser(req);
		res.render('desktop');
	});

	app.get('/version', (req, res) => {
		res.send(KAPI_VERSION);
	});
}

function apiSetupApps() {
	app.get('/app/:app/manifest/', (req, res) => {
		getGuardedReqUser(req);

		res.sendFile(Path.resolve('./bin/apps/' + req.params.app + '/manifest.json'));
	});

	app.get('/app/:app/res/*', (req, res) => {
		getGuardedReqUser(req);
		
		let app = req.params.app;
		let path = req.params[0];	
		let fpath = './bin/apps/' + app + '/res/' + path;
		res.sendFile(Path.resolve(fpath));
	});
}

function apiSetupFS() {
	app.get('/fs/q/*', async (req, res) => {	
		let userId = getGuardedReqUser(req);

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
	});	

	app.post('/fs/u/*', async (req, res) => {	
		let userId = getGuardedReqUser(req);

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
	});	

	app.post('/fs/ud/*', async (req, res) => {
		let user = getGuardedReqUser(req);

		let path = vfs.translate(user, '/' + req.params[0]);

		try {
			await FS.promises.writeFile(path, req.body);
		} catch (err) {
			res.status(500);
		}
		res.end();
	});

	app.get('/fs/ls/*', async(req, res) => {
		let userId = getReqUser(req, true, res);
		if (!userId) return;

		let vpath = '/' + req.params[0];
		if (vpath == '/') {
			res.json(vfs.listVMPoints(userId));
			return;
		}

		let fpath = vfs.translate(userId, vpath);
		if (!fpath) {
			res.status(400).end();
			return;
		}

		try {
			let results = await vfs.listPDir(fpath);
			res.json(results);
		} catch(err) {
			res.status(err).end();
		}
	});

	app.get('/fs/thumb/*', async (req, res) => {	
		let userId = getGuardedReqUser(req);

		let vpath = '/' + req.params[0];

		let fpath = vfs.translate(userId, vpath);

		if (Files.isFileExtVideo(fpath) || Files.isFileExtPicture(fpath)) {
			await handleThumbRequest(fpath, res);
		} else {
			res.sendFile(fpath);
		}
	});	
}

function apiSetupAuth() {
	app.post('/auth', (req, res) => {
		let id = req.body.id;
		let pass = req.body.pass;
		if ((id in userDefs) && (userDefs[id].pass === pass)) {
			let newKey = getRandomInt(1, 32768);
			logins[id] = newKey;
			res.json({ ok: true, key: newKey });
			return;
		}

		res.json({ ok: false, key: 0 });
	});

	app.get('/auth/test', (req, res) => {
		let result = getReqUser(req) != null;
		res.json({ 'ok': result });
	});
}

function getGuardedReqUser(req) {
	let user = getReqUser(req);
	if (!user) throw new BadAuthExecpt();
	return user;
}

function getReqUser(req, autoDeny, res) {
	let key = req.cookies.authkey;
	
	// Iterate over logged in users and compare authentication key
	for (let user in logins) {
		if (logins[user] == key) return user;
	}

	// If the key isn't registered, check if we have a no-auth user configured
	if (config.noauth) {
		return config.noauth
	}
	
	// Otherwise, just deny the request
	if (autoDeny) denyRequest(res);
	return null;
}

function denyRequest(res) {
	res.status(403);
	res.send('BAD_AUTH: Authentication required.');
}

function startExpress() {
	app.use((err, req, res, next) => {
		if (err instanceof BadAuthExecpt) {
			denyRequest(res);
			return;
		}

		next(err);
	});

	app.set('view engine', 'ejs');
	app.set('views', 'bin/views');
	app.disable('x-powered-by');

	let httpsKey = FS.readFileSync('ssl/key.key');
	let httpsCert = FS.readFileSync('ssl/cert.crt');

	let http = HTTP.createServer(app);
	let https = HTTPS.createServer({
		key: httpsKey,
		cert: httpsCert
	}, app);

	http.listen(9200, () => {
		console.log('Listening on port 9200.');
	});
	https.listen(9100, () => {
		console.log('Listening on port 9100.');
	});
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* -- Thumbnail handling -- */
function hashPathStr(str) {
	return str
	.replaceAll('/', '_')
	.replaceAll('\\', '_')
	.replaceAll(':', '_');
}

async function handleThumbRequest(_abs, res){
	let absFilePath = Files.toFullSystemPath(_abs);
	var thumbfolder = Files.toFullSystemPath(`./.thumbnails/`);

	let fthname = hashPathStr(_abs);
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

function execute(file, args, options){
	return new Promise((resolve, reject) => {
		let proc;
		let callback = (err, sout, serr) => {
			if(err){
				reject(err);
			} else {
				resolve({'app': app, 'stdout': sout, 'stderr': serr});
			}
		};
		
		proc = CProc.execFile(file, args, options, callback);
		
	});
}

class Except {
	constructor(type) {
		this.type = type;
	}
};

class BadAuthExecpt extends Except {
	constructor() {
		super('BadAuthExecpt');
	}
}