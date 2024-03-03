import Express from 'express';

import * as Auth from './auth.mjs';

var totalDataRead = 0;
var totalDataWritten = 0;
var liveSocketMap = null;

export function init() {
	liveSocketMap = new Map();
}

export function getTracker() {
	return (req, res, next) => {
		updateSocket(req.socket);

		for (let s of liveSocketMap.keys()) {
			updateSocket(s);
		}

		next();
	};
}

export function getRouter() {
	let router = Express.Router();

	router.get('/net', (req, res) => {
		let userId = Auth.getUser(req);

		res.json({
			'bytesWritten': totalDataWritten,
			'bytesRead': totalDataRead,
		});
	});

	return router;
}

function updateSocket(socket) {
	// Obtain the user live sockets
	let socketData = getSocketData(socket);
	if (socketData) {
		// If this socket is still alive, only add the difference to the count
		totalDataWritten += socket.bytesWritten - socketData.written;
		totalDataRead += socket.bytesRead - socketData.read;
	} else {
		socketData = createSocketData(socket);
		totalDataWritten += socket.bytesWritten;
		totalDataRead += socket.bytesRead;
	}

	if (socketData.state == 'dead') {
		deleteSocketData(socket);

		if (socketData.written != socket.bytesWritten || socketData.read != socket.bytesRead) {
			console.warn('WARNING: DEAD SOCKET TRANSFERRED DATA?');
		}
		return;
	}

	// Update socket data information
	socketData.written = socket.bytesWritten;
	socketData.read = socket.bytesRead;

	let state = socket.readyState;
	if (state == 'closed') {
		socketData.state = 'dead';
	}
}

function getSocketData(socket) {
	return liveSocketMap.get(socket);
}

function createSocketData(socket) {
	let socketData = {};
	liveSocketMap.set(socket, socketData);
	return socketData;
}

function deleteSocketData(socket) {
	liveSocketMap.delete(socket);
}