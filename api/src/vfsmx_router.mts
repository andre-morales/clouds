import Express from "express"
import { getDecoratorRouter } from "./vfs_router.mjs";
import * as Pathx from './pathx.mjs';
import FS from 'node:fs';
import * as FFmpeg from './ext/ffmpeg.mjs'

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

export function getRouter() {
	let router = Express.Router();

	router.use('/thumb', Express.Router()
	.use(getDecoratorRouter())
	.get('/*path', async (req, res) => {
		let path = req.getPhysicalPath();
		if (!path) {
			res.status(404).end();
			return;
		}

		if (Pathx.isFileExtVideo(path) || Pathx.isFileExtPicture(path)) {
			await resThumbnail(req, res);
		} else {
			res.sendFile(path, {dotfiles: 'allow'});
		}
	}));

	router.use('/hist', Express.Router()
	.use(getDecoratorRouter())
	.get('/*path', async (req, res) => {
		let path = req.getPhysicalPath();
		if (!path) {
			res.status(404).end();
			return;
		}

		let intervals = Number(req.query.i);
		if (!intervals) intervals = 2;
		await resHistogram(req, res, intervals);
	}));

	return router;
}

async function resHistogram(req: Express.Request, res: Express.Response, intervals: number): Promise<void> {
	// If FFMpeg isn't enabled to analyze the file, stop.
	if(!FFmpeg.enabled) {
		res.status(503).end();
		return;
	}

	let path = Pathx.toFullSystemPath(req.getPhysicalPath() as string);
	let hist = await FFmpeg.getHistogram(path, intervals);
	res.json(hist);
}

/**
 * Sends a thumbnail to the user based on the original file requested.
 * @param res Express response.
 * @param req Express request.
 */
async function resThumbnail(req: Express.Request, res: Express.Response): Promise<void> {
	let _abs = req.getPhysicalPath() as string;
	let absFilePath = Pathx.toFullSystemPath(_abs);
	var thumbsDirectory = Pathx.toFullSystemPath(`./.thumbnails/`);

	let thumbnailName = encodePath(_abs);
	var thumbnail = `${thumbsDirectory}/${thumbnailName}.thb`;

	// If the thumbnail exists, send it.
	if(FS.existsSync(thumbnail)){
		res.sendFile(thumbnail, {dotfiles: 'allow'});
		return;
	}

	// If FFMpeg isn't enabled to create a thumb, stop.
	if(!FFmpeg.enabled) {
		res.status(503).end();
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

	res.sendFile(thumbnail, {dotfiles: 'allow'});
}

function encodePath(path: string): string {
	// Remove special characters from path
	let stripped = path.replaceAll(/[\\/.:'#]/g, '_');
	
	// Encode path string into UTF-8 bytes
	let bytes = new TextEncoder().encode(stripped);

	// Convert the bytes into a full string
	let chars = Array.from(bytes, (byte) => String.fromCodePoint(byte));
	let str = chars.join("");

	return btoa(str);
}