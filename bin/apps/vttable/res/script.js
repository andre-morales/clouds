window.VTTableApp = class VTTableApp extends App {
	constructor() {
		super();
		this.window = null;
		this.playlist = [];
		this.paused = false;
		this.currentSong;
		this.queuedPlaySong;
		this.subs();
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
		this.$audio = $app.find('audio');

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
			if (!this.paused) this.pause();
			else this.play();
		});
		$app.find('.add-songs-btn').click(() => {
			$app.find('.search-layer').removeClass('d-none');
		});
		$app.find('.search-layer .close-btn').click(() => {
			$app.find('.search-layer').addClass('d-none');
		});
		this.$searchBar = $app.find('.query-input');
		this.$searchBar.on('change', function () {
			self.querySongs(this.value);
		});


		//let $linkBar = $app.find('.link-input');
		//$linkBar.on('change', function () {
		//	self.listSongs(this.value);
		//});

		let $tabPane = $win.find('.tabpane');
		$tabPane.find('button').click((ev) => {
			let tab = ev.target.getAttribute('data-tab');
			$tabPane.find('.header .btn').removeClass('selected');
			$tabPane.find('.tab').removeClass('visible');

			ev.target.classList.add('selected');
			$tabPane.find(`.tab[data-tab='${tab}']`).addClass('visible');
		});

		this.$playlist = $app.find('.playlist-pan ul');

		let Audio = WebSys.audio;
		Audio.context.createMediaElementSource(this.$video[0]).connect(Audio.destination);
		Audio.context.createMediaElementSource(this.$audio[0]).connect(Audio.destination);

		// Make the window visible
		this.restoreAppWindowState(this.window);
		this.window.setVisible(true);
	}

	async querySongs(query) {
		if (this.searching) return;

		this.searching = true;
		this.$searchBar.css('color', 'green');

		let queryStr;
		if (query.includes('youtube.com')) {
			queryStr = '/mstr/list/?url=' + encodeURIComponent(query);
		} else {
			queryStr = '/mstr/search/' + query;
		}
		try {
			let response = await fetch(queryStr);
			let data = await response.json();
			this.setResults(data);
		} catch (err) {
			console.log(err);
		}

		this.searching = false;
		this.$searchBar.css('color', '');		
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
				let song = new this.Song(vID, vName, vThumb);
				this.pl_push(song);
				
			});

			results.append(item);
		}
	}

	pause() {
		this.paused = true;
		this.$audio[0].pause();
	}

	play() {
		if (!this.playlist.length) return;

		this.paused = false;
		if (!this.currentSong) this.currentSong = this.playlist[0];
			
		if(!this.currentSong.ready) {
			this.fetchAndPlay(this.currentSong);
			return;
		}

		if (this.$audio[0].paused) {
			this.paused = false;
			this.$audio[0].play();
		}
	}

	fetchAndPlay(song) {
		this.paused = false;
		song.fetch().then(() => {
			if (this.currentSong == song && song.ready) {
				song.play();
			}
		});
	}

	pl_push(song) {
		this.playlist.push(song);
		this.$playlist.append(song.getItem());
	}

	onClose() {
		this.saveAppWindowState(this.window);
		this.window.close();
	}

	subs() {
		let vtt = this;

		this.Song = class Song {
			constructor(id, title, thumb) {
				this.id = id;
				this.title = title;
				this.thumb = thumb;
				this.ready = false;
			}

			getItem() {
				if (!this.$item) {
					this.$item = $(`<li class='song'><img src='${this.thumb}'><span>${this.title}<span></img></li>`);
				}

				return this.$item;
			}

			async fetch() {
				if (this.ready) return;
				if (this.fetching) return;

				this.fetching = true;
				try {
					let res = await fetch('/mstr/check/' + this.id + '.a.webm');
					if (res.status == 200) {
						this.ready = true;
						this.fetching = false;
						return;
					}
				} catch(e){}
				
				await fetch('/mstr/download/' + encodeURIComponent(this.id) + '?f=audio');
				this.ready = true;
				this.fetching = false;
			}

			play() {
				if (!this.ready) return false;

				vtt.$audio.find('source').attr('src', '/mstr/res/' + this.id + '.a.webm'); 
				vtt.$audio[0].load();
				vtt.$audio[0].play();
				return true;
			}
		}
	}
}