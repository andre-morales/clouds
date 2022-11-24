import * as CProc from 'child_process';
import Express from 'express';

var config;
var toolCmd;
var toolArgs;

export function init(_config) {
	config = _config;
	[toolCmd, ...toolArgs] = config.ytdl.split(' ');
}

export function getExpressRouter() {
	let router = Express.Router();
	router.get('/search/*', async (req, res) => {
		let query = req.params[0];
		let n = req.query['n'];
		if (!n) n = 7;
		let result = await searchQuery(query, n);
		res.json(result);
	});
	router.get('/download/*', async (req, res) => {
		let query = req.params[0];
		await downloadVideo(query);
		res.json(query);
	});
	router.use('/res', Express.static('mediares'))
	return router;
}

function downloadVideo(videoId) {
	console.log(`Download request for '${videoId}'`);
	return new Promise((resolve, reject) => {
		let qargs = [`${videoId}`, '--no-part', '--output', `mediares/${videoId}.webm`];
		let fargs = toolArgs.concat(qargs); // Final args

		let proc = CProc.execFile(toolCmd, fargs, (error, stdout, stderr) => {
			if (error) {
				console.log(error);
				console.log(stderr);
				reject(error);
			} else {
				resolve(stdout);
			}
		});

		//setTimeout(resolve, 1000);
	});
}

function searchQuery(queryStr, resultsN) {
	// Query Args
	//, '--skip-download', '-J'
	let qargs = [`ytsearch${resultsN}:${queryStr}`, '--flat-playlist'];
	let fargs = toolArgs.concat(qargs); // Final args

	return new Promise((resolve, reject) => {
		let proc = CProc.execFile(toolCmd, fargs, (error, stdout, stderr) => {
			if (error) {
				reject(error, stderr, stdout);
				return;
			}

			let data = JSON.parse(stdout);
			console.log(data);
			let output = [];
			for (let entry of data.entries) {
				output.push([0, entry.id, entry.title, entry.thumbnails[0].url]);
			}

			resolve(output);
		});
	});
}