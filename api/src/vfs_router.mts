import Express from 'express';
import Path from 'node:path';
import FS from 'node:fs';

import { asyncRoute } from './core.mjs';
import * as VFS from './vfs.mjs';
import * as Auth from './auth.mjs'
import * as Pathx from './pathx.mjs';
import * as FFmpeg from './ext/ffmpeg.mjs'

interface FunctionMap {
	[method: string]: Function;
}

/**
 * Initializes virtual file system router.
 */
export function init() {
	VFS.init();
}

/**
 * Send a file as the response to a user.
 * Used in the GET <file> route
 * @param res Express response object.
 * @param user Id of the request user.
 * @param path Virtual path to the desired resource.
 */
function resSendFile(res: Express.Response, user: string, path: string): void {
	// Translate the virtual path to a real one
	let fPath = VFS.translate(user, path);
	if (!fPath) {
		res.status(404).end();
		return;
	}
	
	// Resolve the path and send the file.
	let absPath = Path.resolve(fPath);
	res.sendFile(absPath, (err: any) => {
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
}

/**
 * Validates and moves uploaded files into their target directory. Sends response to the user.
 * Used in the POST <directory> route
 * @param res Express response object.
 * @param user Id of the request user.
 * @param path Virtual directory path, target of the uploaded files.
 * @param files Files upload structure obtained from the request.
 */
function resFetchFiles(res: Express.Response, user: string, path: string, files: any): void {
	// Sanity check
	if (!files) {
		res.status(400).send('No file structure sent.');
		return;
	}

	// Sanity check 2
	if (!files.upload) {
		res.status(400).send('No files sent.');
		return;
	}

	// Translate target directory to physical and make sure the mapping exists
	let fdir = VFS.translate(user, path);
	if (!fdir) {
		res.status(500).end();
		return;
	}

	// Make sure uploaded files are in an array
	let uploadedFiles = [files.upload].flat();

	// Move the uploaded files into their target path
	for(let file of uploadedFiles){
		file.mv(Path.join(fdir, file.name));
	}	

	res.status(200).end();
}

/**
 * Obtains the client-side virtual file system router. Already performs authentication.
 * @returns The express router, mountable anywhere.
 */
export function getRouter(): Express.Router {
	var router = Express.Router();

	let getOperations: FunctionMap = {};
	let patchOperations: FunctionMap = {};
	let putOperations: FunctionMap = {};

	// GET: Query route
	router.get('/*', asyncRoute(async function (req: Express.Request, res: Express.Response) {
		let userId = Auth.getUserGuard(req);
		
		let handled = await dispatchQueryOperation(req, res, getOperations);
		if (handled) return;

		let vPath = '/' + req.params[0];

		// If querying a path that ends in slash, perform a directory listing
		if (vPath.endsWith('/')) {
			try {
				let results = await VFS.list(userId, vPath);
				res.json(results);
			} catch (errCode: any) {
				res.status(errCode).end();
			}
			return;
		}

		// Otherwise, send the file to the user.
		resSendFile(res, userId, vPath);
	}));

	// POST: Upload files trough upload form
	router.post('/*', asyncRoute(async (req: Express.Request & { files: any }, res: Express.Response) => {	
		let user = Auth.getUserGuard(req);
		let virtualPath = '/' + req.params[0];
		let files = req.files;
		resFetchFiles(res, user, virtualPath, files);
	}));	

	// PUT: Upload data to new or existing file
	router.put('/*', asyncRoute(async (req: Express.Request, res: Express.Response) => {
		let user = Auth.getUserGuard(req);

		// Handle special operations specified though query parameters
		let handled = await dispatchQueryOperation(req, res, putOperations);
		if (handled) return;

		// Obtain phyisical target path and make sure it is valid.
		let path = VFS.translate(user, '/' + req.params[0]);
		if (!path) {
			res.status(500).end();
			return;
		}

		// Write request body straight to file content.
		try {
			await FS.promises.writeFile(path, req.body);
		} catch (err) {
			res.status(500);
		}
		res.end();
	}));

	// DELETE: Delete file completely (no trash)
	router.delete('/*', asyncRoute(async (req: Express.Request, res: Express.Response) => {
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		await VFS.erase(userId, vpath);

		res.end();
	}));

	// PATCH: General file operations without response and non-cacheable
	router.patch('/*', asyncRoute(async (req: Express.Request, res: Express.Response) => {
		let userId = Auth.getUserGuard(req);
		
		// Handle special operations specified though query parameters
		let handled = await dispatchQueryOperation(req, res, patchOperations);
		if (handled) return;

		// Patch requests without any operation are malformed
		res.sendStatus(400);
	}));

	// PATCH?=RENAME: Renames (moves) a path from one place to another
	patchOperations['rename'] = async (req: Express.Request, res: Express.Response) => {
		let user = Auth.getUserGuard(req);

		let from = '/' + req.params[0];
		let target: any = req.query['rename'];
		if (!target) {
			res.status(400).end();
			return;
		}
		let targetURI = decodeURIComponent(target);

		await VFS.rename(user, from, targetURI);

		res.end();
	}

	// PATCH?=COPY: Copies a path from one place to another
	patchOperations['copy'] = async (req: Express.Request, res: Express.Response) => {
		let user = Auth.getUserGuard(req);

		let from = '/' + req.params[0];
		let target = decodeURIComponent((req.query['copy'] as string));

		await VFS.copy(user, from, target);

		res.end();
	}

	// GET?=STATS
	getOperations['stats'] = async (req: Express.Request, res: Express.Response) => {
		let user = Auth.getUserGuard(req);
		let vpath = '/' + req.params[0];

		res.json(await VFS.stats(user, vpath));
	}

	// GET?=THUMB Thumbnail GET request
	getOperations['thumb'] = async (req: Express.Request, res: Express.Response) => {
		let userId = Auth.getUserGuard(req);

		let vpath = '/' + req.params[0];
		let fpath = VFS.translate(userId, vpath);
		if (!fpath) {
			res.status(400).end();
			return;
		}

		if (Pathx.isFileExtVideo(fpath) || Pathx.isFileExtPicture(fpath)) {
			await handleThumbRequest(fpath, res);
		} else {
			res.sendFile(fpath);
		}
	};

	// PUT?=MAKE
	putOperations['make'] = async (req: Express.Request, res: Express.Response) => {
		let userId = Auth.getUserGuard(req);

		let target = '/' + req.params[0];

		if (target.endsWith('/')) {
			await VFS.mkdir(userId, target);
		}

		res.end();
	};

	return router;
}

/**
 * Invokes a function on the callback table with the same name as the query parameter.
 * @param req Express request.
 * @param res Express response.
 * @param table Function tables with handlers for each kind of operation.
 * @returns True if the request has handled (successfully or with an error), False if the request
 * must be handled by someone (lacks a query parameter).
 */
async function dispatchQueryOperation(req: Express.Request, res: Express.Response, table: FunctionMap) {
	// If there are no query parameters, let someone else handle the request.
	let queryParams = Object.keys(req.query);	
	if (queryParams.length == 0) return false;

	// Only one special query operation allowed
	if (queryParams.length != 1) {
		res.status(400).send("Only one query operation allowed.");
		return true;
	}

	// Get operation name, and send an error if there is no such operation.
	let operation = queryParams[0];
	let handler = table[operation];
	if (!handler) {
		res.status(400).send("No handler for operation.");
		return true;
	}

	// Invoke handler
	await handler(req, res);
	return true;
}

async function handleThumbRequest(_abs: string, res: Express.Response){
	let absFilePath = Pathx.toFullSystemPath(_abs);
	var thumbsDirectory = Pathx.toFullSystemPath(`./.thumbnails/`);

	let thumbnailName = encodePath(_abs);
	var thumbnail = `${thumbsDirectory}/${thumbnailName}.thb`;

	// If the thumbnail exists, send it.
	if(FS.existsSync(thumbnail)){
		res.sendFile(thumbnail);
		return;
	}

	// If FFMmpeg isn't enabled to create a thumb, stop.
	if(!FFmpeg.enabled) {
		res.status(404).end();
		return;
	}

	// Create thumbnail directory
	if(!FS.existsSync(thumbsDirectory)) FS.mkdirSync(thumbsDirectory);

	let result = await FFmpeg.createThumbOf(absFilePath, thumbnail);

	// If the thumbnail creation fails, create an empty file in the directory to skip it
	// the next time
	if(!result){
		let f = await FS.promises.open(thumbnail, 'w');
		f.close();
	}	

	res.sendFile(thumbnail);
}

function encodePath(path: string): string {
	let stripped = path.replaceAll('/', '_')
	.replaceAll('\\', '_')
	.replaceAll('.', '_')
	.replaceAll(':', '_');
	return btoa(stripped);
	
}