import FS from 'fs';
import Path from 'path';
import Express from 'express';

import { asyncRoute } from './api_core.mjs';
import config from './config.mjs';
import * as Auth from './auth.mjs'
import * as Files from './files.mjs';
import * as FFmpeg from './ext/ffmpeg.mjs'

var defs = null;

export function init() {
	defs = config.fs;
}

// Translate a virtual path into a physical one.
// Loops over all mounting points checking if the virtual path belongs to one of them.
// If so, does the mapping. If no mapping was found, returns null.
// This function performs no checks if the path provided is valid,
// it only performs a substitution.
function translate(userid, vPath) {
	for (let mPoint in defs) {
		if (vPath.startsWith(mPoint)) {
			// Normalize virtual path
			let nPath = Path.posix.normalize(vPath);

			// Trying to escape the mounting point?
			if (nPath.indexOf(mPoint) == -1) {
				return null;
			}

			// Remove mounting point from virtual path
			nPath = nPath.replace(mPoint, "");

			// Retrieve physical location of mounting point
			let phyPoint = defs[mPoint].path;
			phyPoint = phyPoint.replace('$user', userid);

			// Physical path
			let jPath = Path.posix.join(phyPoint, nPath);
			return jPath;
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

	if (config.logFSOperations) {
		console.log(`Erasing "${fpath}"`);
	}

	await FS.promises.rm(fpath, { recursive: true });
}

// Moves a path to another, this can move files or folders and give them new names
async function renameVirtual(user, path, newPath) {
	let fPath = translate(user, path);
	let fNewPath = translate(user, newPath);
	if (!fPath || !fNewPath) return;

	if (config.logFSOperations) {
		console.log(`Renaming "${fPath}" to "${fNewPath}"`);
	}

	await FS.promises.rename(fPath, fNewPath);
}

// Copies a file to another path, if the target already exists, fails.
async function copyVirtual(user, srcPath, dstPath) {
	let fSource = translate(user, srcPath);
	let fDestination = translate(user, dstPath);
	if (!fSource || !fDestination) return;

	if (config.logFSOperations) {
		console.log(`Copying "${fSource}" to "${fDestination}"`);
	}

	await FS.promises.copyFile(fSource, fDestination, FS.constants.COPYFILE_EXCL);
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

async function mkdirVirtual(user, path) {
	let fPath = translate(user, path);
	if (!fPath) return;

	if (config.logFSOperations) {
		console.log(`New Directory in "${fPath}"`);
	}

	await FS.promises.mkdir(fPath);
}

// New router using HTTP verbs and unified resource path
export function getRouter() {
	var router = Express.Router();

	let getOperations = {};
	let patchOperations = {};
	let putOperations = {};

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
		
		// Resolve the path and send the file.
		let absPath = Path.resolve(fPath);
		res.sendFile(absPath, (err) => {
			if (!err) return;
			
			switch (err.code) {
			// Fetch interrupted. Do nothing.
			case 'ECONNABORTED':
				res.status(200).end();
				break;
			// File doesn't exit
			case 'ENOENT':
				res.status(404).end();
				break;
			// Tried to GET a directory.
			case 'EISDIR':
				res.status(400).end();
				break;
			// Unknown error, log it.
			default:
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
	router.put('/*', asyncRoute(async function (req, res) {
		let user = Auth.getUserGuard(req);

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
			let handler = putOperations[operation];
			if (!handler) {
				res.sendStatus(400);
				return;
			}

			await handler(...arguments);
			return;
		}

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
		let user = Auth.getUserGuard(req);

		let from = '/' + req.params[0];
		let target = decodeURIComponent(req.query['rename']);

		await renameVirtual(user, from, target);

		res.end();
	}

	// PATCH/COPY: Copies a path from one place to another
	patchOperations['copy'] = async (req, res) => {
		let user = Auth.getUserGuard(req);

		let from = '/' + req.params[0];
		let target = decodeURIComponent(req.query['copy']);

		await copyVirtual(user, from, target);

		res.end();
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

	// PUT/MAKE
	putOperations['make'] = async (req, res) => {
		let userId = Auth.getUserGuard(req);

		let target = '/' + req.params[0];

		if (target.endsWith('/')) {
			await mkdirVirtual(userId, target);
		}

		res.end();
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
