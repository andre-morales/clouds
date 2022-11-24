window.VTTableApp = class VTTableApp extends App {
	constructor() {
		super();
		this.window = null;
	}

	async init() {
		let self = this;

		// Require resources
		this.requireStyle('/app/vttable/res/style.css');

		// Create window and fetch app body
		this.window = WebSys.desktop.createWindow();
		this.window.setIcon('/res/img/apps/vttable128.png');
		this.window.on('closereq', () => this.close());
		this.window.setTitle('Virtual Turn Table v1.0');

		let $win = this.window.$window;
		let $app = $win.find('.body');
		$app.addClass('app-vttable');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/vttable/res/main.html');

		this.$video = $app.find('video');
		this.$video.dblclick(() => {
			if (Fullscreen.element == this.$video[0]) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.fullscreen = this.$video[0];
				Fullscreen.on(this.$video[0]);
			}
		});
		$app.find('video').click(() => {
			$app.find('.fg-layer').toggleClass('invisible');
		});
		$app.find('.play-btn').click(() => {
			let el = this.$video[0];
			if (el.paused) {
				el.play();
				//$videoc.addClass('playing');
			} else {
				el.pause();
				//$videoc.removeClass('playing');
			}
		});
		$app.find('.add-songs-btn').click(() => {
			$app.find('.search-layer').removeClass('d-none');
		});
		$app.find('.search-layer .close-btn').click(() => {
			$app.find('.search-layer').addClass('d-none');
		});
		this.$searchBar = $app.find('input');
		this.$searchBar.on('change', function () {
			self.querySongs(this.value);
		});

		let track = WebSys.audio.context.createMediaElementSource(this.$video[0]);
		track.connect(WebSys.audio.destination);

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
	}

	async querySongs(query) {
		if (this.searching) return;

		this.searching = true;
		this.$searchBar.css('color', 'green');
		let queryStr = '/mstr/search/' + query;
		
		let response = await fetch(queryStr);
		let data = await response.json();
		
		this.searching = false;
		this.$searchBar.css('color', '');
		this.setResults(data);
	}

	setResults(data) {
		let results = this.window.$window.find('.results');
		results.empty();

		for (let i = 0; i < data.length; i++) {
			let vID = data[i][1];
			let vName = data[i][2];
			let vThumb = data[i][3];

			let item = document.createElement('li');
			item.innerHTML = `<img src='${vThumb}'><span>${vName}<span></img>`;

			item.addEventListener('click', async () => {
				await fetch('/mstr/download/' + encodeURIComponent(vID));

				this.$video.find('source').attr('src', '/mstr/res/' + vID + '.webm'); 
				this.$video[0].load();
				this.$video[0].play();

			});

			results.append(item);
		}
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}
}