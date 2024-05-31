/**
 * Network facing virtual file system routes.
 */
import { asyncRoute } from './core.mjs';
import { FileOperationError } from './files.mjs';
import config from './config.mjs';
import * as Pathx from './pathx.mjs';
import * as VFS from './vfs.mjs';
import * as Auth from './auth.mjs'
import * as FFmpeg from './ext/ffmpeg.mjs'
import { NextFunction, Request, Response, Router } from 'express';
import Path from 'node:path';
import FS from 'node:fs';

/** Object map from names to async request handlers */
interface FunctionMap {
	[method: string]: (req: Request, res: Response) => Promise<void>;
}

// Add some properties to the Express request object
declare global {
	namespace Express {
		interface Request {
			/** User associated with this request. */
			userId: string;

			/** VFS path for this request. */
			virtualPath: string;

			/** Obtains the physical path translation of the virtual path associated with this
			 * request. */
			getPhysicalPath: () => string | null;
		}
	}
}

/**
 * Initializes virtual file system router.
 */
export function init() {
	VFS.init();
}

/**
 * Obtains the client-side virtual file system router. Already performs authentication.
 * @returns An express router mountable anywhere.
 */
export function getRouter(): Router {
	var router = Router();

	// Middleware handler for every VFS request
	router.use((req, res, next) => {
		// If the user isn't logged in, the request will be denied through an exception.
		Auth.getUserGuard(req);
		decorateRequest(req);
		next();
	});

	let getOperations: FunctionMap = {};
	let patchOperations: FunctionMap = {};
	let putOperations: FunctionMap = {};

	// GET: Query route
	router.get('/*', asyncRoute(async (req, res) => {
		// Handle special operations
		let handled = await dispatchQueryOperation(req, res, getOperations);
		if (handled) return;

		// If querying a path that doesn't end in a slash, just send the file.
		if (!req.virtualPath.endsWith('/')) {
			resSendFile(res, req);
			return;
		}

		// Otherwise, perform a directory listing
		let results = await VFS.list(req.userId, req.virtualPath);
		res.json(results);
	}));

	// POST: Upload files trough upload form
	router.post('/*', asyncRoute(async (req, res) => {	
		resFetchFiles(res, req);
	}));	

	// PUT: Upload data to new or existing file
	router.put('/*', asyncRoute(async (req, res) => {
		// Handle special operations specified though query parameters
		let handled = await dispatchQueryOperation(req, res, putOperations);
		if (handled) return;

		// Obtain physical target path and make sure it is valid.
		let path = req.getPhysicalPath();
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
	router.delete('/*', asyncRoute(async (req, res) => {
		await VFS.erase(req.userId, req.virtualPath);
		res.status(200).end();
	}));

	// PATCH: General file operations without response and non-cacheable
	router.patch('/*', asyncRoute(async (req, res) => {
		// Handle special operations specified though query parameters
		let handled = await dispatchQueryOperation(req, res, patchOperations);
		if (handled) return;

		// Patch requests without an operation are malformed
		res.status(400).end();
	}));

	// PATCH?=RENAME: Renames (moves) a path from one place to another
	patchOperations['rename'] = async (req, res) => {
		let from = req.virtualPath;
		let target: any = req.query['rename'];
		if (!target) {
			res.status(400).end();
			return;
		}

		let targetURI = decodeURIComponent(target);

		await VFS.rename(req.userId, from, targetURI);

		res.end();
	}

	// PATCH?=COPY: Copies a path from one place to another
	patchOperations['copy'] = async (req, res) => {
		let target = decodeURIComponent((req.query['copy'] as string));

		await VFS.copy(req.userId, req.virtualPath, target);
		res.status(200).end();
	}

	// GET?=STATS
	getOperations['stats'] = async (req, res) => {
		let result = await VFS.stats(req.userId, req.virtualPath);
		res.json(result).end();
	}

	// GET?=THUMB Thumbnail GET request
	getOperations['thumb'] = async (req, res) => {
		let path = req.getPhysicalPath();
		if (!path) {
			res.status(404).end();
			return;
		}

		if (Pathx.isFileExtVideo(path) || Pathx.isFileExtPicture(path)) {
			await resThumbnail(res, req);
		} else {
			res.sendFile(path);
		}
	};

	// PUT?=MAKE
	putOperations['make'] = async (req, res) => {
		// Trying to create a path that isn't a folder is a malformed request.
		if (!req.virtualPath.endsWith('/')) {
			res.status(400).end();
			return;
		}

		await VFS.mkdir(req.userId, req.virtualPath);
		res.status(200).end();
	};

	// General file operation error handler
	router.use((err: Error, req: any, res: Response, next: any): void => {
		if (err instanceof FileOperationError) {
			if (config.log_fs_operations) {
				console.log(':: ', err);
			}
			res.status(err.getHTTPCode()).end();
			return;
		}

		next(err);
	});

	return router;
}

/**
 * Send a file as the response to a user.
 * Used in the GET <file> route
 * @param res Express response object.
 * @param user Id of the request user.
 * @param path Virtual path to the desired resource.
 */
function resSendFile(res: Response, req: Request): void {
	// Translate the virtual path to a real one
	let fPath = req.getPhysicalPath();
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
function resFetchFiles(res: Response, req: Request): void {
	let files = req.files;

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
	let fDir = req.getPhysicalPath();
	if (!fDir) {
		res.status(500).end();
		return;
	}

	// Make sure uploaded files are in an array
	let uploadedFiles = [files.upload].flat();

	// Move the uploaded files into their target path
	for(let file of uploadedFiles){
		file.mv(Path.join(fDir, file.name));
	}	

	res.status(200).end();
}

/**
 * Sends a thumbnail to the user based on the original file requested.
 * @param res Express response.
 * @param req Express request.
 */
async function resThumbnail(res: Response, req: Request): Promise<void> {
	let _abs = req.getPhysicalPath() as string;
	let absFilePath = Pathx.toFullSystemPath(_abs);
	var thumbsDirectory = Pathx.toFullSystemPath(`./.thumbnails/`);

	let thumbnailName = encodePath(_abs);
	var thumbnail = `${thumbsDirectory}/${thumbnailName}.thb`;

	// If the thumbnail exists, send it.
	if(FS.existsSync(thumbnail)){
		res.sendFile(thumbnail);
		return;
	}

	// If FFMpeg isn't enabled to create a thumb, stop.
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

/**
 * Invokes a function on the callback table with the same name as the query parameter.
 * @param req Express request.
 * @param res Express response.
 * @param table Function tables with handlers for each kind of operation.
 * @returns True if the request has handled (successfully or with an error), False if the request
 * must be handled by someone (lacks a query parameter).
 */
async function dispatchQueryOperation(req: Request, res: Response, table: FunctionMap) {
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

/**
 * Appends VFS related properties to every request object.
 * @param req Express request.
 */
function decorateRequest(req: Request) {
	// Obtains the user id in every request.
	req.userId = Auth.getUserGuard(req);

	// Format the virtual path
	req.virtualPath = decodeURIComponent(req.path);

	// Allow obtaining the physical path. Caches the translation result.
	req.getPhysicalPath = () => {
		let self: any = req.getPhysicalPath;
		
		if (self.cachedTranslation === undefined) {
			self.cachedTranslation = VFS.translate(req.userId, req.virtualPath);
		}
		
		return self.cachedTranslation;
	};
}

function encodePath(path: string): string {
	let stripped = path.replaceAll('/', '_')
	.replaceAll('\\', '_')
	.replaceAll('.', '_')
	.replaceAll(':', '_');
	return btoa(stripped);
	
}