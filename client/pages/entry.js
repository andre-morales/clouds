(function () {
	window.EntrySpace = {};

	var ES = window.EntrySpace;

	ES.log = function (msg) {
		var bootLog = document.getElementById('boot-log');
		var p = document.createElement('p');
		p.innerHTML = msg;
		bootLog.appendChild(p);
		return p;
	};

	ES.scriptFailed = function (elem) {
		EntrySpace.log("[!] Core boot script <b>" + elem.src + "</b> failed.")
	};

	ES.enableHandlers = function () {
		window.onunhandledrejection = function (ev) {
			var detail;
			if (ev.reason) {
				var trace = (ev.reason.stack) ? ev.reason.stack : 'unavailable';
				detail = ev.reason + '\n trace: ' + trace;
			}
			EntrySpace.log('[!] Unhandled rejection\n ' + detail);
		};
		window.onerror = function (ev) {
			EntrySpace.log('[!] Unhandled error\n ' + ev + '');
		};
	};

	ES.disableHandlers = function () {
		EntrySpace.log('Handlers disabled.');
		window.onerror = undefined;
		window.onunhandledrejection = undefined;
	};

	ES.addScript = function (src) {
		var log = ES.log('Loading <b>' + src + '</b>... ');
		var elem = document.createElement('script');
		elem.onerror = function (err) {
			ES.scriptFailed(elem);
		}
		elem.onload = function () {
			log.innerHTML += "Done.";
		}
		elem.setAttribute('src', src);
		document.head.appendChild(elem);
	}

	ES.addStyle = function (src) {
		var log = ES.log('Loading <b>' + src + '</b>... ');
		var elem = document.createElement('link');
		elem.setAttribute('rel', 'stylesheet');
		elem.setAttribute('type', 'text/css');
		elem.onerror = function (err) {
			ES.scriptFailed(elem);
		}
		elem.onload = function () {
			log.innerHTML += "Done.";
		}
		elem.setAttribute('href', src);
		document.head.appendChild(elem);
	}

	ES.addFavicon = function(src) {
		ES.log('Added favicon <b>' + src + '</b>.');
		var elem = document.createElement('link');
		elem.setAttribute('rel', 'icon');
		elem.setAttribute('type', 'image/x-icon');
		elem.setAttribute('href', src);
		document.head.appendChild(elem);
	}

	ES.onLoad = function() {
		ES.log("Document finished loading.");

		function onAssetMap(req) {
			if (req.status != 200) {
				ES.log('[!] Asset map failed to load with status code ' + req.status + '.');
				return;
			}

			// Save the asset map and queue the entry module
			ES.assetMap = JSON.parse(req.responseText);
			ES.addScript('/res/pack/entry.js?v=' + ES.assetMap.all);
			ES.addStyle('/res/pack/entry.css?v=' + ES.assetMap.all);
			ES.addFavicon('/res/favicon.png?v=' + ES.assetMap.all);
		}

		function onAssetMapOutdated() {
			ES.log("<p style='color: yellow;'>Asset map cache outdated! Reload to use the new assets.</p>")
		}

		// Fetch asset map from offline cache, but update it in the background.
		// If the asset map is truly outdated, tell the user.
		cacheFetch('/res/asset_map.json', onAssetMap, onAssetMapOutdated);
	}

	function cacheFetch(url, done, update) {
		var log = ES.log("Fetching <b>" + url + '</b> from cache... ');
		var offReq, offReqTag;
		var onReq, onReqTag;

		// Offline fetch
		offReq = fetchx(url, {}, function() {
			offReqTag = offReq.getResponseHeader('etag');
			
			done(offReq);
			log.innerHTML += ' Done.';

			if (!onReqTag) return;
			if (offReqTag != onReqTag)
				update(onReq);
		});

		// Online fetch. The cache will be updated automatically.
		onReq = fetchx(url, { cache: 'no-cache' }, function() {
			onReqTag = onReq.getResponseHeader('etag');

			if (!offReqTag) return;
			if (offReqTag != onReqTag)
				update(onReq);
		});
	}

	function fetchx(url, options, done) {
		var req = new XMLHttpRequest();
		req.open('GET', url);

		if (options.cache)
			req.setRequestHeader('cache-control', options.cache);

		req.onreadystatechange = function() {
			if (req.readyState == 4)
				done();
		};
		req.send();
		return req;
	}

	ES.enableHandlers();
	ES.startTime = Date.now();
})();