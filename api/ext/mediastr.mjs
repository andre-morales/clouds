import * as CProc from 'child_process';
import FS from 'fs';
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
	router.get('/list', async (req, res) => {
		let query = req.query.url;
		let result = await listQuery(query);
		res.json(result);
	});
	router.get('/download/*', async (req, res) => {
		let query = req.params[0];
		await downloadVideo(query, req.query.f);
		res.json(query);
	});
	router.get('/check/*', async (req, res) => {
		let name = req.params[0];
		try {
			await FS.promises.stat('./mediares/' + name);
			res.sendStatus(200);
		} catch (err) {
			console.log(err);
			res.sendStatus(404);
		}
	});
	router.use('/res', Express.static('mediares'))
	return router;
}

function downloadVideo(videoId, format) {
	console.log(`Download request for '${videoId}'`);
	return new Promise((resolve, reject) => {
		let qargs = [`${videoId}`, '--no-part'];
		switch(format) {
		case 'audio':
			qargs.push('-f', 'bestaudio');
			qargs.push('--output', `mediares/${videoId}.a.webm`);
			break;
		case 'video':
			qargs.push('-f', 'bestvideo');
			qargs.push('--output', `mediares/${videoId}.v.webm`);
			break;
		default:
			qargs.push('--output', `mediares/${videoId}.c.webm`);
			break;
		}

		let fargs = toolArgs.concat(qargs); // Final args
		let proc = CProc.execFile(toolCmd, fargs, (error, stdout, stderr) => {
			if (error) {
				console.log(error);
				console.log(stderr);
				reject(error);
			} else {
				console.log('Done downloading: ' + videoId);
				resolve(stdout);
			}
		});
	});
}

function listQuery(queryStr) {
	console.log(`List query for '${queryStr}'`);
	let qargs = [`${queryStr}`, '--flat-playlist', '--skip-download', '-J'];
	let fargs = toolArgs.concat(qargs); // Final args

	return new Promise((resolve, reject) => {
		let proc = CProc.execFile(toolCmd, fargs, (error, stdout, stderr) => {
			if (error) {
				reject(error, stderr, stdout);
				return;
			}

			try {
				let data = JSON.parse(stdout);

				if (data.entries) {
					let output = [];
					for (let entry of data.entries) {
						output.push([0, entry.id, entry.title, entry.thumbnails[0].url]);
					}
					resolve(output);
				} else {
					resolve([[0, data.id, data.title, data.thumbnails[0].url]]);
				}			
			} catch (err) {
				reject(err);
			}
		});
	});
}

function searchQuery(queryStr, resultsN) {
	console.log(`Search request for '${queryStr}'`);
	// Query Args
	let qargs = [`ytsearch${resultsN}:${queryStr}`, '--flat-playlist', '--skip-download', '-J'];
	let fargs = toolArgs.concat(qargs); // Final args

	return new Promise((resolve, reject) => {
		let proc = CProc.execFile(toolCmd, fargs, (error, stdout, stderr) => {
			if (error) {
				reject(error, stderr, stdout);
				return;
			}

			try {
				let data = JSON.parse(stdout);
				let output = [];
				for (let entry of data.entries) {
					output.push([0, entry.id, entry.title, entry.thumbnails[0].url]);
				}

				resolve(output);
			} catch (err) {
				reject(err);
			}
		});
	});
}