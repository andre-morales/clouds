import CookieParser from 'cookie-parser';
import Express from 'express';
import Cors from 'cors';
import Cheerio from 'cheerio';
import FS from 'fs';

var proxyApp = null;
var sessions = {};
var headPrepend;
var proxyAddress = 'http://localhost:9201/';
var lastPageHack = true;
var lastPage = '';

export async function init() {
	headPrepend = await FS.promises.readFile('head.js', 'utf8');

	proxyApp = Express();
	proxyApp.use(Cors());
	proxyApp.use(CookieParser());

	proxyApp.use('/*', async (req, res, next) => {
		try {
			let reqUrl = req.originalUrl.substring(1);
			console.log('\n\n+ ' + req.method + ':', reqUrl);
		
			// Find session root
			let host = getRequestHost(req);
			let currPage = getCurrentLocation(req);
			if (!currPage && lastPageHack) currPage = lastPage;
			lastPage = currPage;

			console.log('/Page: ' + currPage);

			// Transform relative URL to absolute
			let fetchUrl = reqUrl;
			//console.log(req.headers);
			if (!reqUrl.startsWith('http')) {
				if (!currPage) {
					console.log('[ERROR] Tried to translate url but unknown referrer!');
					res.sendStatus(404).end();
					return;
				}

				fetchUrl = transformRequestUrl(reqUrl, currPage);
				console.log('/Trans:', fetchUrl);
			}

			// Fetch url and check its type
			let fetchHeaders = {};
			copyHeaders(req.headers, fetchHeaders, ['user-agent', 'cookie']);

			let options = {
				method: req.method,
				headers: fetchHeaders
			};

			let freq = await fetch(fetchUrl, options);
			//console.log('Status: ' + freq.status);
			//console.log(freq.headers);

			let contentType = freq.headers.get('Content-Type');
			if (!contentType || !contentType.includes('text/html')) {
				// It is just a blob
				let blob = await freq.blob();
				res.type(blob.type);

				let buffer = await blob.arrayBuffer();
				res.setHeader('Content-Type', contentType);
				res.send(Buffer.from(buffer));
				return;
			}

			// URL is a text type, decode it.
			let charset = getContentCharset(freq);
			let fresBuff = await freq.arrayBuffer();
			let decoder = new TextDecoder(charset);
			let fres = decoder.decode(fresBuff);

			// Text decoded, check if it is a root
			if(!isRequestNavig(req, fres)) {
				// It is not
				res.send(fres);
				return
			}
		
			// It probably the new page
			lastPage = fetchUrl;
			console.log('/Last: ' + lastPage);

			let $ = Cheerio.load(fres);
			console.log(fres);
			$('head').prepend(headPrepend);
			$('a').each((i, el) => {
				let $el = $(el);
				let href = $el.attr('href');
				if (!href) return;

				$el.attr('href', transformInsideUrl(href, fetchUrl, host));
			});
			$('form').each((i, el) => {
				console.log('FORM-------:');
				let $el = $(el);
				let action = $el.attr('action');
				if (!action) return;
				console.log('From: ' + action);
				let result = transformInsideUrl(action, fetchUrl, host);
				console.log('To: ' + action);
				$el.attr('action', result);
			});
			$('link').each((i, el) => {
				let $el = $(el);
				let href = $el.attr('href');
				if (!href) return;

				let result = transformInsideUrl(href, fetchUrl, host);
				$el.attr('href', result);
			});
			$('script').each((i, el) => {
				let $el = $(el);
				let src = $el.attr('src');
				if (!src) return;

				let result = transformInsideUrl(src, fetchUrl, host);
				$el.attr('src', result);
			});

			res.send($.html());
		} catch(err) {
			console.log(err);
			res.sendStatus(404);
		}
	});
}

function getCurrentLocation(req) {
	let referer = req.headers['referer'];
	console.log('/Referrer:', referer);
	//if (referer) return referer.substring(proxyAddress.length);

	return '';
}

function isRequestNavig(req, doc) {
	//console.log(req.headers);
	if (req.headers['sec-fetch-dest'] == 'iframe') return true;

	//let head = doc.toLowerCase().indexOf('<!doctype');
	//if (head != -1) {
	//	return true;
	//}
	return false;
}

function getRequestHost(req) {
	let host_ = req.headers['host'];
	return 'http://' + host_ + '/';
}

function getContentCharset(req) {
	let type = req.headers.get('content-type');
	if (!type) return 'utf-8';

	let str = 'charset=';
	let cseti = type.indexOf(str); 
	if (cseti == -1) return 'utf-8';

	let sp = type.indexOf(' ', cseti);
	if (sp != -1) {
		return type.substring(cseti + str.length, sp);
	} else {
		return type.substring(cseti + str.length);
	}
}

function copyHeaders(src, dst, headers) {
	//console.log(src);
	//if (src.get) {
	//	for (let header of headers) {
	//		let v = src.get(header);
	//		if (v) dst[header] = v;
	//	}
	//} else {
		for (let header of headers) {
			let v = src[header];
			//if (v) dst.setHeader(header, v);
			if (v) dst[header] = v;
		}
	//}
}

function transformInsideUrl(url, page, host) {
	let q = page.indexOf('?');
	if (q != -1) page = page.substring(0, q);

	let pr = page.indexOf('://');
	let domain = page.substring(0, page.indexOf('/', pr + 3));

	if (url.startsWith('http')) {
		return host + url;
	} else if (url.startsWith('//')) {
		return host + 'https:' + url;
	} else {
		if (url.startsWith('/')) {
			return host + domain + url;
		}

		if (page.endsWith('/')) page = page.slice(0, -1);
		if (url.startsWith('/')) url = url.substring(1);

		return host + page + '/' + url;
	}

	return url;
}

function transformRequestUrl(url, page) {
	let i = page.indexOf('://');
	let ls = page.indexOf('/', i + 3);
	let domain = page.substring(0, ls + 1);

	return domain + url;
}

export function start() {
	proxyApp.listen(9200+1);
}