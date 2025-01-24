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

export async function getHistogram(path: string, intervals: number): Promise<number[]> {
	let fileInfo = await getFileInfo(path);
	let duration = fileInfo.duration;
	let sampleRate = fileInfo.sampleRate;
	
	let sampling = duration / intervals * sampleRate;
	let ffmpegExec = config.ffmpeg_exec;
	let args = [
		"-loglevel", "error",
		"-i", path,
		"-af", `asetnsamples=${sampling},astats=metadata=1:reset=1,ametadata=print:key=lavfi.astats.Overall.RMS_level:file=-`,
		"-f", "null",
		"-"
	]

	let result = await execute(ffmpegExec, args, {});
	let hist = rawToHistogram(result.stdout);
	return hist;
}

function rawToHistogram(raw: string) {
	let lines = raw.split('\n')

	let volumes = [];
	for (let i = 0; i < lines.length - 1; i += 2) {
		let volume = Number(lines[i + 1].split('=')[1]);
		volumes.push(volume);  
	}

	let minVol = Math.min(...volumes);
	let maxVol = Math.max(...volumes);
		
	for (let i = 0; i < volumes.length; i++) {
		volumes[i] -= minVol;
		volumes[i] /= (maxVol - minVol);
	}

	return volumes;
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

async function getFileInfo(path: string) {
	const ffprobeExec = config.ffprobe_exec;

	let args = [
		'-i', `${path}`,
		'-show_entries', 'format=duration',
		'-show_entries', 'stream=duration,sample_rate',
		'-v', 'error',
		'-of', 'json'
	];
	let ffprobe = await execute(ffprobeExec, args, {});
	let output = JSON.parse(ffprobe.stdout);

	// Parse output streams for biggest length and extracting sample rate
	let videoLength = Number(output.format.duration);
	let sampleRate = 0;
	for (let stream of output.streams) {
		//let streamLength = Number(stream.duration);
		//if (streamLength > videoLength) videoLength = streamLength;

		if (stream.sample_rate) sampleRate = stream.sample_rate;
	}

	return {
		duration: videoLength,
		sampleRate: sampleRate
	};
}

/**
 * Invokes ffmpeg to figure out how long a video or clip is.
 * @param path The physical path to the file.
 * @returns The clip duration in seconds.
 */
export async function getVideoLength(path: string): Promise<number> {
	const ffprobeExec = config.ffprobe_exec;

	let videoLength = 0;
	let args = ['-i', `${path}`, '-show_entries', 'format=duration', '-v', 'quiet', '-of', 'csv'];

	let ffprobe : any = await execute(ffprobeExec, args, {});
	videoLength = ffprobe.stdout.split("format,")[1] * 1.0;
	return videoLength;
}

function execute(file: string, args: string[], options: object): Promise<{stdout: string, stderr: string}>{
	return new Promise((resolve, reject) => {
		let proc;
		let callback = (err: any, stdout: any, stderr: any) => { 
			if (err){
				reject(err);
			} else {
				resolve({'stdout': stdout, 'stderr': stderr});
			}
		};
		
		proc = CProc.execFile(file, args, options, callback);
	});
}