import * as CProc from 'child_process';

const Files = await import('./../files.mjs');

export class FFmpeg {
	init(config) {
		this.config = config;
	}

	async createThumbOf(path, dest) {
		// Get path of ffmpeg executable
		let ffmpegExec = this.config.ffmpeg_exec;
		let args;

		// If the path points to a video
		if (Files.isFileExtVideo(path)) {
			// Run ffprobe on video to get video length.
			let videolength = await this.getVideoLength(path);

			args = ['-ss', videolength / 2, '-i', path, '-q:v', '4', '-vf', "scale='iw*144/max(iw,ih):-1'", '-vframes', 1, '-f', 'mjpeg', dest];
		// Treat the file as an image otherwise
		} else {
			args = ['-i', path, '-vf', "scale='iw*144/max(iw,ih):-1'", '-f', 'mjpeg', dest];
		}
		
		// Execute ffmpeg with the arguments. If there's an error, fail silently
		try {
			await execute(ffmpegExec, args);
			return true;
		} catch(err) {
			console.log(err);
		}

		return false;
	}

	async getVideoLength(path) {
		let ffprobeExec = this.config.ffprobe_exec;

		let videolength = 0;
		
		let args = ['-i', `${path}`, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv'];
		try {
			let ffprobe = await execute(ffprobeExec, args);
			videolength = ffprobe.stdout.split("format,")[1] * 1.0;
			return videolength;
		} catch(err) {
			//console.log(err);
			//console.log('Video length query failed.');
		}
		return false;
	}
}

function execute(file, args, options){
	return new Promise((resolve, reject) => {
		let proc;
		let callback = (err, sout, serr) => {
			if (err){
				reject(err);
			} else {
				resolve({'stdout': sout, 'stderr': serr});
			}
		};
		
		proc = CProc.execFile(file, args, options, callback);
		
	});
}