import FS from 'fs';
import Express from 'express';
import config from './config.mjs';
import { BadAuthException } from './errors.mjs';

export var logins = null;
var userDefs = null;

export function init() {
	logins = {};
	
	let contents = FS.readFileSync('config/users.json'); 
	userDefs = JSON.parse(contents.toString());
}

/**
 * Tries to login a user with an id and password, returns its authkey on success, or 0 on failure.
 * @param id User's name.
 * @param pass String representation of the user's password.
 * @returns The user's new key, or 0 if the authentication failed.
 */
export function login(id: string, pass: string): number {
	if ((id in userDefs) && (userDefs[id].pass === pass)) {
		let key = getRandomInt(1, 32768);
		logins[id] = key;

		return key;
	}
	return 0;
}

/**
 * Logs out an user.
 * @param {*} user The string id of an user
 */
export function logout(user: string) {
	delete logins[user];
}

// Returns the user associated with the request.
// If no-auth was set in config, returns the no-auth user.
// Returns null if the request has no user or an invalid one associated with it.
export function getUser(req: Express.Request) {
	if (!req.cookies) return null;
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

/**
 * Obtains the user associated with a request. If an invalid user is associated with it, throws a 
 * BadAuthException;
 * @param req Request object
 * @returns The user associated with the request
 */
export function getUserGuard(req: Express.Request) {
	let user = getUser(req);
	if (!user) throw new BadAuthException();
	return user;
}

/**
 * Safeguards a request making sure the user is authenticated. This is meant to be used as a
 * request middleware function. If the user is not authenticated, BadAuthException is thrown.
 * @param req Request object
 * @param res Response object
 * @param next Next middleware function
 */
export function guard(req: Express.Request, res: Express.Response, next: Function) {
	let user = getUser(req);
	if (!user) throw new BadAuthException();
	next();
}

export function getRouter() {
	let router = Express.Router();

	// Login request
	router.post('/login', (req, res) => {
		let id = req.body.id;
		let pass = req.body.pass;
		let newKey = login(id, pass);

		res.json({ ok: (newKey != 0), key: newKey })
	});

	router.post('/logout', (req, res) => {
		let user = getUser(req);
		if (user) logout(user);
		res.status(200).end();
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