import Util from 'util';
import FS from 'fs';
import Path from 'path';
import Express from 'express';

import { asyncRoute, FFmpeg } from './api_core.mjs';
import config from './config.mjs';
import * as Auth from './auth.mjs'
import * as Files from './files.mjs';

var defs = null;

export function init() {
	defs = config.fs;
}

export function translate(userid, vpath) {
	for (let mountp in defs) {
		if (vpath.startsWith(mountp)) {
			let phyPoint = defs[mountp].path;
			phyPoint = phyPoint.replace('$user', userid);
			return phyPoint + vpath.replace(mountp, "");
		}
	}

	return null;
}

export function listVMPoints(userid) {
	return Object.keys(defs)
	.filter((vmp) => {
		return !defs[vmp].hidden;
	})
	.map((vmp) => {
		return [vmp];
	});
}

export async function listPDir(path) {
	if (!path.endsWith('/')) path += '/';

	let files;
	try {
		files = await FS.promises.readdir(path, {
			"withFileTypes": true
		});
	} catch (err) {
		if (err.code == 'EPERM') throw 403;
		if (err.code == 'ENOENT') throw 404;
		throw 500;
	}

	let promises = files.map(async (entry) => {
		let file = entry.name;
		let stype = '';
		let creationTime = 0;

		// If this try-catch fails, we probably have no rights to gather
		// information about the file
		try {
			let stat = await FS.promises.stat(path + file);

			//creationTime = stat.birthtimeMs;
			creationTime = stat.mtimeMs;

			if (stat.isDirectory()) {
				file += '/';
			}

			if (entry.isSymbolicLink()) {
				stype += 's';
			}
		} catch(e) {
			// Add inacessible tag to it
			stype += 'i';
		}

		return [file, stype, creationTime];
	});

	let results = await Promise.all(promises);
	return results; 
}

export function getRouter() {
	var router = Express.Router();

	router.get('/q/*', asyncRoute(async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		// Translate the virtual path to a real one
		let vpath = '/' + req.params[0];
		let fpath = translate(userId, vpath);
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

	router.post('/u/*', asyncRoute(async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		let fpath = translate(userId, vpath);

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

	router.post('/ud/*', asyncRoute(async (req, res) => {
		let user = Auth.getUserGuard(req);

		let path = translate(user, '/' + req.params[0]);

		try {
			await FS.promises.writeFile(path, req.body);
		} catch (err) {
			res.status(500);
		}
		res.end();
	}));

	router.get('/ls/*', asyncRoute(async(req, res) => {
		let userId = Auth.getUserGuard(req);

		// If the virtual path is root '/', list the virtual mounting points
		let vpath = '/' + req.params[0];
		if (vpath == '/') {
			res.json(listVMPoints(userId));
			return;
		}

		// Translate the virtual path to the machine physical path
		let fpath = translate(userId, vpath);
		if (!fpath) {
			res.status(400).end();
			return;
		}

		// List the directory, and return the json results
		try {
			let results = await listPDir(fpath);
			res.json(results);
		} catch(err) {
			res.status(err).end();
		}
	}));

	router.get('/thumb/*', async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];

		let fpath = translate(userId, vpath);

		if (Files.isFileExtVideo(fpath) || Files.isFileExtPicture(fpath)) {
			await handleThumbRequest(fpath, res);
		} else {
			res.sendFile(fpath);
		}
	});	

	return router;
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