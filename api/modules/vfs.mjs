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

// Translate a virtual path into a physical one.
// Loops over all mounting points checking if the virtual path belongs to one of them.
// If so, does the mapping. If no mapping was found, returns null.
// This function performs no checks if the path provided is valid,
// it only performs a substitution.
function translate(userid, vpath) {
	for (let mountp in defs) {
		if (vpath.startsWith(mountp)) {
			let phyPoint = defs[mountp].path;
			phyPoint = phyPoint.replace('$user', userid);
			return phyPoint + vpath.replace(mountp, "");
		}
	}

	return null;
}

// Lists all virtual mounting points accessible to the user as configured in the
// config/profiles/[user].json
function listVMPoints(userid) {
	return Object.keys(defs)
	.filter((vmp) => {
		return !defs[vmp].hidden;
	})
	.map((vmp) => {
		return [vmp];
	});
}

// List all files present in a PHYSICAL path
async function listPDir(path) {
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

// Moves the file in the PHYSICAL path to the trash folder configured.
async function trash(path) {
	
}

export function getRouter() {
	var router = Express.Router();

	// Query route
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

	// Upload files trough upload form
	router.post('/u/*', asyncRoute(async (req, res) => {	
		let userId = Auth.getUserGuard(req);

		// Sanity check
		if (!req.files) {
			console.log('no files');
			res.status(500).end();
			return;
		}

		// Sanity check 2
		if (!req.files.upload) {
			console.log('no uploaded files');
			res.status(500).end();
			return;
		}
		
		// Translate target directory to physical
		let vdir = '/' + req.params[0];
		let fdir = translate(userId, vdir);

		// Make sure uploaded files are in an array
		var files = req.files.upload;
		if(!Array.isArray(files)){
			files = [files];
		}

		// Move the uploaded files into their target path
		for(let file of files){
			file.mv(Path.join(fdir, file.name));
		}	

		res.end();
	}));	

	// Upload data to new or existing file
	router.post('/ud/*', asyncRoute(async (req, res) => {
		let user = Auth.getUserGuard(req);

		// Phyisical target path
		let path = translate(user, '/' + req.params[0]);

		try {
			await FS.promises.writeFile(path, req.body);
		} catch (err) {
			res.status(500);
		}
		res.end();
	}));

	// List files in directory
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

	// Delete file (move to trash)
	router.get('/del/*', asyncRoute(async(req, res) => {
		// Not implemented yet.
	}));

	// Query thumbnail for media file
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