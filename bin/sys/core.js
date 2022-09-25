const KAPI_VERSION = '0.5.0';

const VFSM = await import('./vfs.js')
const Pathex = await import('./pathex.js');
const FFmpegM = await import('./ffmpeg.js');

import { createRequire } from "module";
const require = createRequire(import.meta.url);

const Compression = require('compression');
const WebSocket = require('ws');
const Path = require('path');
const FFmpeg = new FFmpegM.FFmpeg();
const FS = require('fs');
const Express = require('express');
const CookieParser = require('cookie-parser');
const CProc = require('child_process');
const FileUpload = require('express-fileupload');

var config = null;
var app = null;
var appSv = null;
var logins = null;
var userDefs = null;
var vfs = null;
var rshells = null;
var rshellCounter = 1;

function main() {
	console.log('KAPI Version: ' + KAPI_VERSION);

	initConfig();
	initFS();
	initUsers();
	initExpress();
	startExpress();
}

function initConfig() {
	config = JSON.parse(FS.readFileSync('config/main.json'));
}

function initFS() {
	vfs = new VFSM.VFS();
	vfs.loadDefs('config/fs.json');
}

function initUsers() {
	userDefs = JSON.parse(FS.readFileSync('config/users.json'));
	logins = {};
}

function initExpress() {
	FFmpeg.init(config.extensions.ffmpeg);

	app = Express();
	app.use(Compression());
	app.use(FileUpload({
		createParentPath: true
	}));
	app.use(Express.json());                    // JSON parser
	app.use(CookieParser());					// Cookie parser
	app.use('/res', Express.static('bin/res')); // Static public resources

	apiSetupAuth();  // Auth system
	apiSetupPages(); // Entry, Auth and Desktop
	apiSetupFS();    // File system
	apiSetupApps();  // Apps service
	apiSetupRShell();  // Remote console
}

function apiSetupRShell() {
	rshells = {};

	app.get('/shell/0/init', (req, res) => {
		let id = createRemoteShell();
		res.json(id);
	});

	app.post('/shell/:id/send', (req, res) => {
		let shell = rshells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}
		let cmd = req.body.cmd;
		shell.send(cmd);
	});

	app.get('/shell/:id/stdout', (req, res) => {
		let shell = rshells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		res.send(shell.stdout);
	});

	app.get('/shell/:id/stdout_new', async (req, res) => {
		res.set('Cache-Control', 'no-store');

		let shell = rshells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		try {
			let result = await shell.newStdoutData();
			res.send(result);
		} catch(err) {
			res.status(500).end();
			return;
		}
		
	});

	app.get('/shell/:id/kill', (req, res) => {
		let id = req.params.id;
		if (!rshells[id]) {
			res.status(404).end();
			return;
		}

		destroyRemoteShell(id);

		res.end();
	});

	app.get('/shell/:id/ping', (req, res) => {
		let shell = rshells[req.params.id]
		if (!shell) {
			res.status(404).end();
			return;
		}

		shell.ping();
		res.end();
	});

	setInterval(() => {
		let now = (new Date()).getTime();
		let destroyedShells = [];

		for (const [id, proc] of Object.entries(rshells)) {
			if (now - proc.lastPing > 20000) {
				destroyedShells.push(id);
			}
		}

		destroyedShells.forEach(destroyRemoteShell);
	}, 20000)
}

class RShell {
	constructor(id) {
		this.id = id;
		this.stdout = '';
		this.newOut = '';
		this.proc = null;
		this.waiterObj = null;
	}

	spawn() {
		return this.proc = CProc.spawn('cmd.exe');
	}

	newStdoutData() {
		return new Promise((resolve, reject) => {
			if (this.newOut) {
				let copy = this.newOut;
				this.newOut = '';
				resolve(copy);
			} else {
				if (this.waiterObj) {
					reject();
					return;
				}

				this.waiterObj = resolve;
			}
		});
	}

	setupOutput() {
		let outFn = (ch) => {
			let content = ch.toString();
			this.stdout += content;

			if (this.waiterObj) {
				this.waiterObj(content);
				this.waiterObj = null;
			} else {
				this.newOut += content;
			}
		}

		this.proc.stdout.on('data', outFn);
		this.proc.stderr.on('data', outFn);
	}

	ping() {
		this.lastPing = (new Date()).getTime();
	}

	send(msg) {
		this.proc.stdin.write(msg + '\n');
	};
}

function createRemoteShell() {
	let id = rshellCounter++;
	console.log('Creating shell ' + id);

	let shellObj = new RShell(id);
	rshells[id] = shellObj;
	
	shellObj.spawn();
	shellObj.setupOutput();
	shellObj.ping();

	return id;
}

function destroyRemoteShell(id) {
	console.log('Destroying shell ' + id);
	rshells[id].proc.kill();
	delete rshells[id];
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
		guardRequest(req);

		res.render('desktop');
	});

	app.get('/version', (req, res) => {
		res.send(KAPI_VERSION);
	});
}

function apiSetupApps() {
	app.get('/app/:app/manifest/', (req, res) => {
		if(!checkRequest(req)) {
			denyRequest(res);
			return;
		}

		res.sendFile(Path.resolve('./bin/apps/' + req.params.app + '/manifest.json'));
	});

	app.get('/app/:app/res/*', (req, res) => {
		if(!checkRequest(req)) {
			denyRequest(res);
			return;
		}

		let app = req.params.app;
		let path = req.params[0];	
		let fpath = './bin/apps/' + app + '/res/' + path;
		res.sendFile(Path.resolve(fpath));
	});
}

function apiSetupFS() {

	app.get('/fs/q/*', async (req, res) => {	
		if(!checkRequest(req)) {
			denyRequest(res);
			return;
		}

		let vpath = '/' + req.params[0];
		let userId = getRequestUser(req);
		
		let fpath = vfs.translate(userId, vpath);
		if (!fpath) {
			res.status(404).end();
			return;
		}
		
		res.sendFile(fpath);
	});	

	app.post('/fs/u/*', async (req, res) => {	
		if(!checkRequest(req)) {
			denyRequest(res);
			return;
		}

		let vpath = '/' + req.params[0];
		let userId = getRequestUser(req);
		
		let fpath = vfs.translate(userId, vpath);


		if(req.files && req.files.upload){
			let upload = req.files.upload;
			var files = upload;
			if(!Array.isArray(upload)){
				files = [files];
			}

			for(let file of files){
				file.mv(Path.join(fpath, file.name));
			}	

			res.end();
			return;		
		}

		res.status(500).end();
	});	

	app.get('/fs/ls/*', async(req, res) => {
		let userId = getRequestUser(req);
		if(userId == null) {
			denyRequest(res);
			return;
		}

		let vpath = '/' + req.params[0];
		if (vpath == '/') {
			res.json(vfs.listVMPoints(userId));
			return;
		}

		let fpath = vfs.translate(userId, vpath);
		if (!fpath) {
			res.status(404).end();
			return;
		}

		let results = await vfs.listPDir(fpath);
		if (results === 404) {
			res.status(404).end();
			return;
		}

		res.json(results);
	});

	app.get('/fs/thumb/*', async (req, res) => {	
		let userId = getRequestUser(req);
		if(userId == null) {
			denyRequest(res);
			return;
		}

		let vpath = '/' + req.params[0];

		let fpath = vfs.translate(userId, vpath);

		if (isFileExtVideo(fpath)) {
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
		let result = checkRequest(req);
		res.json({ 'ok': result });
	});
}

function isFileExtVideo(path) {
	let extensions = ['.mp4', '.webm', '.mkv'];
	for (let ext of extensions) {
		if (path.endsWith(ext)) return true;
	}

	return false;
}

function guardRequest(req) {
	if (!checkRequest(req)) throw new BadAuthExecpt();
}

function getRequestUser(req) {
	//return 'andre';

	let key = req.cookies.authkey;

	for (let user in logins) {
		if (logins[user] == key) return user;
	}

	return null;
}

function checkRequest(req) {
	return getRequestUser(req) != null;
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

	appSv = app.listen(9200, () => {
		console.log('Listening on port 9200.');
	});
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/* -- Thumbnail handling -- */
async function handleThumbRequest(_abs, res){
	let absFilePath = Pathex.toFullSystemPath(_abs);

	var thumbfolder = Pathex.toFullSystemPath(`./.thumbnails/`);
	var thumbpath = `${thumbfolder}/${btoa(_abs)}.jpg`;

	if(FS.existsSync(thumbpath)){
		res.sendFile(thumbpath);
		return;
	}

	if(config.extensions.ffmpeg && config.extensions.ffmpeg.enabled) {
		if(!FS.existsSync(thumbfolder)) FS.mkdirSync(thumbfolder);

		if(!FS.existsSync(thumbpath)){
			let result = await FFmpeg.createThumbOf(absFilePath, thumbpath);

			if(!result){
				res.status(404).end();
				return;
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

main();