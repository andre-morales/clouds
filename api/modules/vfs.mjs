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
		if (err.code == 'ENOTDIR') throw 400;
		else {
			console.error(err);
			throw 500;
		}
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

// Erases completely the given file or folder
async function eraseVirtual(user, path) { 
	let fpath = translate(user, path);
	if (!fpath) return;

	console.log(`Erasing '${fpath}'`);

	await FS.promises.rm(fpath, {
		recursive: true
	});
}

// Moves a given file or folder into a new folder
async function renameVirtual(user, path, newPath) {
	let fPath = translate(user, path);
	let fNewPath = translate(user, newPath);
	if (!fPath || !fNewPath) return;

	console.log(`path-renamed "${fPath}" to ${fNewPath}`);

	await FS.promises.rename(fPath, fNewPath);
}

async function listVirtual(user, path) {
	// If the virtual path is root '/', list the virtual mounting points
	if (path == '/') {
		return listVMPoints(user);
	}

	// Translate the virtual path to the machine physical path
	let fPath = translate(user, path);
	if (!fPath) {
		throw 404;
	}

	// List the directory
	let results = await listPDir(fPath);
	return results;
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

	// Delete file completely (no trash)
	router.get('/erase/*', asyncRoute(async(req, res) => {
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		await eraseVirtual(userId, vpath);

		res.end();
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

// New router using HTTP verbs and unified resource path
export function getRouterV() {
	var router = Express.Router();

	let getOperations = {};
	let patchOperations = {};

	// GET: Query route
	router.get('/*', asyncRoute(async function (req, res) {
		let userId = Auth.getUserGuard(req);
		
		// Get query parameters and check for special GET operations	
		let queryParams = Object.keys(req.query);	
		if (queryParams.length > 0) {
			// Only one special query operation allowed
			if (queryParams.length != 1) {
				res.status(400).send("Only one query operation allowed.");
				return;
			}

			// Get operation name, and throw error if no such operation
			let operation = queryParams[0];
			let handler = getOperations[operation];
			if (!handler) {
				res.sendStatus(400);
				return;
			}

			await handler(...arguments);
			return;
		}

		let vPath = '/' + req.params[0];

		// If querying a path that ends in slash, perform a directory listing
		if (vPath.endsWith('/')) {
			try {
				let results = await listVirtual(userId, vPath);
				res.json(results);
			} catch (errCode) {
				res.status(errCode).end();
			}
			return;
		}

		// Translate the virtual path to a real one
		let fPath = translate(userId, vPath);
		if (!fPath) {
			res.status(404).end();
			return;
		}
		
		// Resolve the path and send the file. If an error occurs,
		// answer with a 500 error code and log the error.
		let absPath = Path.resolve(fPath);
		res.sendFile(absPath, (err) => {
			if (!err) return;
			
			// Fetch interrupted. Do nothing.
			if (err.code == 'ECONNABORTED') {
				res.status(200).end();
			// Tried to GET a directory.
			} else if (err.code == 'EISDIR') {
				res.sendStatus(400);
			// Unknown error, log it.
			} else {
				console.error("Send file failed with error: ", err);
				res.status(500).end();
			}
		});
	}));

	// POST: Upload files trough upload form
	router.post('/*', asyncRoute(async (req, res) => {	
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

	// PUT: Upload data to new or existing file
	router.put('/*', asyncRoute(async (req, res) => {
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

	// DELETE: Delete file completely (no trash)
	router.delete('/*', asyncRoute(async(req, res) => {
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		await eraseVirtual(userId, vpath);

		res.end();
	}));

	// PATCH: General file operations without response and non-cacheable
	router.patch('/*', asyncRoute(async function(req, res) {
		let userId = Auth.getUserGuard(req);
		
		// Get query parameters and check for special operations	
		let queryParams = Object.keys(req.query);	
		if (queryParams.length > 0) {
			// Only one special operation allowed
			if (queryParams.length != 1) {
				res.status(400).send("Only one operation allowed.");
				return;
			}

			// Get operation name, and throw error if no such operation
			let operation = queryParams[0];
			let handler = patchOperations[operation];
			if (!handler) {
				res.sendStatus(400);
				return;
			}

			await handler(...arguments);
			return;
		}

		// Patch request without operation is malformed
		res.sendStatus(400);
	}));

	// PATCH/RENAME: Renames (moves) a path from one place to another
	patchOperations['rename'] = async (req, res) => {
		let target = decodeURIComponent(req.query['rename']);

		res.send(target);
	}

	// GET/THUMB Thumbnail GET request
	getOperations['thumb'] = async (req, res) => {
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		let fpath = translate(userId, vpath);

		if (Files.isFileExtVideo(fpath) || Files.isFileExtPicture(fpath)) {
			await handleThumbRequest(fpath, res);
		} else {
			res.sendFile(fpath);
		}
	};

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