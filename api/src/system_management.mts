import Express from 'express';
import * as Core from './core.mjs';

async function shutdown() {
	await Core.shutdown();

	process.on('exit', () => {
		if (!process.exitCode) {
			// Indicate runner this is a regular shutdown.
			process.exitCode = 777;
		}
		console.log("Process exited with code: " + process.exitCode);
	});
}

function restart() {
	Core.shutdown();
}

async function kill() {
	process.exit(778);
}

export function getRouter(): Express.Router {
	let router = Express.Router();
	router.get('/kill',  () => {
		kill();
	});

	router.get('/shutdown', (req, res) => {
		shutdown();
		res.end();
	})

	router.get('/restart', (req, res) => {
		restart();
		res.end();
	})
	return router;
}