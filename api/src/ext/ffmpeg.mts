import * as CProc from 'child_process';
import * as Files from '../pathx.mjs';
import * as Config from '../config.mjs';

export var enabled = false;
var config : any = {};

export function init() {
	if (!Config.isExtensionEnabled('ffmpeg')) return;
	enabled = true;

	config = Config.config.extensions.ffmpeg;
}

export async function createThumbOf(path: string, dest: string) {
	// Get path of ffmpeg executable
	let ffmpegExec = config.ffmpeg_exec;
	let args: string[];

	// If the path points to a video
	if (Files.isFileExtVideo(path)) {
		// Run ffprobe on video to get video length.
		let videoLength = 0;
		try {
			videoLength = await getVideoLength(path);
		} catch {}

		let seekPoint = (videoLength / 2).toString();
		args = ['-ss', seekPoint, '-i', path, '-q:v', '4', '-vf', "scale='iw*144/max(iw,ih):-1'", '-vframes', '1', '-f', 'mjpeg', dest];
	// Treat the file as an image otherwise
	} else {
		args = ['-i', path, '-vf', "scale='iw*144/max(iw,ih):-1'", '-f', 'mjpeg', dest];
	}
	
	// Execute ffmpeg with the arguments. If there's an error, fail silently
	try {
		await execute(ffmpegExec, args, {});
		return true;
	} catch(err) {
		console.log(err);
	}

	return false;
}

export async function getVideoLength(path: string): Promise<number> {
	const ffprobeExec = config.ffprobe_exec;

	let videoLength = 0;
	let args = ['-i', `${path}`, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv'];

	let ffprobe : any = await execute(ffprobeExec, args, {});
	videoLength = ffprobe.stdout.split("format,")[1] * 1.0;
	return videoLength;
}

function execute(file: string, args: string[], options: object){
	return new Promise((resolve, reject) => {
		let proc;
		let callback = (err: any, sout: any, serr: any) => {
			if (err){
				reject(err);
			} else {
				resolve({'stdout': sout, 'stderr': serr});
			}
		};
		
		proc = CProc.execFile(file, args, options, callback);
	});
}