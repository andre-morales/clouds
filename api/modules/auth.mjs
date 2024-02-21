import FS from 'fs';
import Express from 'express';
import config from './config.mjs';
import { BadAuthException } from './errors.mjs';

export var logins = null;
var userDefs = null;

export function init() {
	logins = {};

	userDefs = JSON.parse(FS.readFileSync('config/users.json'));
}

// Tries to login a user with an id and password, returns its authkey on success, or 0 on failure.
export function login(id, pass) {
	if ((id in userDefs) && (userDefs[id].pass === pass)) {
		let key = getRandomInt(1, 32768);
		logins[id] = key;

		return key;
	}
	return 0;
}

// Returns the user associated with the request.
// If no-auth was set in config, returns the no-auth user.
// Returns null if the request has no user or an invalid one associated with it.
export function getUser(req) {
	let key = req.cookies.authkey;
	
	// Iterate over logged in users and compare authentication key
	for (let user in logins) {
		if (logins[user] == key) return user;
	}

	// If the key isn't registered, check if we have a no-auth user configured
	if (config.noauth) {
		return config.noauth;
	}
	
	// If no user, return null
	return null;
}

// Returns the user associated with the request.
// If no user is associated or if it's an invalid user, throws a BadAuthException
export function getUserGuard(req) {
	let user = getUser(req);
	if (!user) throw new BadAuthException();
	return user;
}

export function getRouter() {
	let router = Express.Router();

	// Login request
	router.post('/', (req, res) => {
		let id = req.body.id;
		let pass = req.body.pass;
		let newKey = login(id, pass);

		res.json({ ok: (newKey != 0), key: newKey })
	});

	// Authentication test
	router.get('/test', (req, res) => {
		let result = getUser(req) != null;
		res.json({ 'ok': result });
	});
	return router;
}

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}