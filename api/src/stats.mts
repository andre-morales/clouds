import Express from 'express';
import { Socket } from 'node:net';
import * as Core from './core.mjs';

var totalDataRead = 0;
var totalDataWritten = 0;
var liveSocketMap: Map<Socket, object>;

export function init() {
	liveSocketMap = new Map();
}

export function getTracker() {
	return (req: Express.Request, res: any, next: any) => {
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
		res.json({
			'bytesWritten': totalDataWritten,
			'bytesRead': totalDataRead,
		});
	});

	router.get('/version', (req, res) => {
		res.send(Core.KAPI_VERSION);
	});

	return router;
}

function updateSocket(socket: Socket) {
	// Obtain the user live sockets
	let socketData: any = getSocketData(socket);
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

function getSocketData(socket: Socket): object | undefined {
	return liveSocketMap.get(socket);
}

function createSocketData(socket: Socket): object {
	let socketData = {};
	liveSocketMap.set(socket, socketData);
	return socketData;
}

function deleteSocketData(socket: Socket) {
	liveSocketMap.delete(socket);
}