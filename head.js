<script>
	var currentLocation = window.location + "";

	function entry() {
		console.log('------------ LOADED -------------')
		
		// Announce new location
		console.log('Alive from: ' + currentLocation);
		window.top.postMessage('Location:' + currentLocation, 'http://localhost:9200/')

		hijackFetch();
		hijackHTTPReq();
		//observeElements();
	}

	function observeElements() {
		let callback = (list) => {
			for (const mutation of list) {
				//console.log('A child node has been added or removed.');
				
				if (mutation.type == 'childList') {
					for (let node of mutation.addedNodes) {
						if (!node.tagName) continue;

						let tag = node.tagName.toLowerCase();
						if (tag == 'form') {
							let action = node.getAttribute('action');
							if (!action) continue;

							node.setAttribute('action', transformUrl(action));
						} else if (tag == 'a') {
							let action = node.getAttribute('href');
							if (!action) continue;

							node.setAttribute('href', transformUrl(action));
							//console.log(node);
						}
					}
				}
			}
		};

		let observer = new MutationObserver(callback);
		observer.observe(document.documentElement, {
			childList: true,
			subtree: true
		});
	}

	function hijackFetch() {
		let rawFetch = window.fetch;
		window.fetch = async (...args) => {
			//console.log('FETCH: ', args);
			let url = args[0];
			if (url) {
				args[0] = transformUrl(url);
			}
			return await rawFetch(...args);
		};
	}

	function hijackHTTPReq() {
		let rawOpen = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function() {
			let url = arguments[1];
			if (url) {
				arguments[1] = transformUrl(url);
			}
			rawOpen.apply(this, arguments)
		};
	}

	function transformUrl(url) {
		let proxy = 'http://localhost:9201/';

		//console.log('FROM: ' + url);
		if (url.startsWith('/')) {
			let loc = currentLocation;
			let htt = loc.indexOf('http', 1);
			let ls = loc.indexOf('/', htt + 8);
			let domain = loc.substring(htt, ls);
			let result = proxy + domain + url;
			//console.log('TO: ' + result);
			return result;
		}
		if (url.startsWith('http')) {
			let result = proxy + url;
			//console.log('TO: ' + result);
			return result;
		}
		//console.log('AS is:');
		return url;
	}

	function setCookie(name, value, time) {
		if (!time) time = 365;

		let d = new Date();
		d.setTime(d.getTime() + (time*24*60*60*1000));
		let expires = "expires="+ d.toUTCString();
		document.cookie = name + "=" + value + ";" + expires + ";path=/https://www.google.com/";
	}

	entry();
</script>