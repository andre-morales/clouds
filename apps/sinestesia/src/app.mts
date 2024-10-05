import { MediaPlayer, ContentType } from './media_player.mjs'
import { Playlist } from './playlist.mjs';
import { Gestures } from './gestures.mjs';
import type ExplorerApp from '../../explorer/main.mjs';
import { ContextCheckbox, ContextMenu } from '/@sys/ui/context_menu.mjs';
import { FileSystem, Paths, FileTypes } from '/@sys/bridges/filesystem.mjs';
import Fullscreen from '/@sys/ui/fullscreen.mjs';
import App from '/@sys/app.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import Window, { CloseBehavior } from '/@sys/ui/window.mjs';

export default class SinestesiaApp extends App {
	public readonly player: MediaPlayer;
	public readonly gestures: Gestures;
	public window: Window;
	public playlist: Playlist;
	private transform: any;
	cancelPauseEvents: boolean;
	lockedPlayback: boolean;
	private fullscreen: HTMLElement;
	private contextMenu: ContextMenu;
	private autoPlay: boolean;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		this.player = new MediaPlayer(this);
		this.window = null;
		this.transform = {
			scale: 1, x: 0, y: 0, rotation: 0,
			flipX: 1, flipY: 1
		};
		this.gestures = new Gestures(() => this.updateTransform());
		this.gestures.setTransform(this.transform);

		this.autoPlay = false;
		this.playlist = new Playlist(this);
	}

	async init() {
		this.on('exit', () => {
			this.playlist = null;
			this.cancelPauseEvents = false;
		});

		// Create window and fetch app body
		this.window = ClientClass.get().desktop.createWindow(this);
		this.window.setTitle('Sinestesia');
		this.window.setCloseBehavior(CloseBehavior.EXIT_APP);
		this.window.on('backnav', () => {
			if (this.fullscreen && Fullscreen.element == this.fullscreen) {
				Fullscreen.rewind();
				this.fullscreen = null;
			} else {
				this.exit();
			}
		});
		this.window.on('closing', () => {
			this.player.unload();
		});

		let $win = this.window.$window;
		$win.find('.window-body').addClass('app-sinestesia');
		
		// Fetch explorer body
		await this.window.setContentToUrl('/app/sinestesia/main.html');

		// Behavior
		this.initContextMenu();
		this.player.init();

		// Make the window visible
		this.window.setVisible(true);

		if (this.buildArgs.length > 0) {
			this.openFile(this.buildArgs[0] as string);
		}
	}

	private initContextMenu() {
		let $win = this.window.$window;
		let ctxMenu = ContextMenu.fromDefinition([
			['-Open...', () => this.showOpenDialog()],
			['-Open folder...', () => this.showOpenFolderDialog()],
			['|'],
			['*Autoplay', (v) => {
				this.autoPlay = v;
			}],
			['*Lock playback', (v) => {
				this.lockedPlayback = v;
				this.cancelPauseEvents = v;
			}],
			['|'],
			['-Flip horizontally', () => {
				this.transform.flipX *= -1;
				this.updateTransform();
			}],
			['-Flip vertically', () => {
				this.transform.flipY *= -1;
				this.updateTransform();
			}],
			['-Rotate right', () => {
				this.transform.rotation += 90;
				this.updateTransform();
			}],
			['-Rotate left', () => {
				this.transform.rotation -= 90;
				this.updateTransform();
			}],
			['*Allow zoom/pan', (v) => {
				this.gestures.setEnabled(v);
			}, {checked: false}],
			['-Reset transform', () => {this.gestures.cleanTransform(); this.updateTransform()}],
		]);
		
		this.contextMenu = ctxMenu;
		ClientClass.get().desktop.addCtxMenuOn($win.find('.window-body'), () => ctxMenu);
	}

	setAutoPlay(auto: boolean) {
		this.autoPlay = auto;
		let items = this.contextMenu.getItems();

		let autoPlayCheck = items[3] as ContextCheckbox;
		autoPlayCheck.setChecked(auto);
	}

	isAutoPlayEnabled() {
		return this.autoPlay;
	}

	async showOpenDialog() {
		let app = await ClientClass.get().runApp('explorer') as ExplorerApp;
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let file = result[0];
		this.openFile('/fsv' + file);
	}

	async showOpenFolderDialog() {
		let app = await ClientClass.get().runApp('explorer') as any;
		app.asFileSelector('open', 'one');
		let result = await app.waitFileSelection();
		if (!result || !result.length) return;

		let folder = result[0];
		this.openFolder(folder);
	}

	async openFolder(dir: string) {
		let files = await FileSystem.list(dir);

		this.playlist.list = files;
		this.playlist.index = 0;
		this.playlist.dir = dir;
		this.setAutoPlay(true);
		this.openFile('/fsv' + dir + this.playlist.list[0][0]);
	}

	openFile(path: string) {	
		// Set window title
		let fname = path.replace(/\/+$/, ''); // Remove trailing slash
		fname = fname.slice(fname.lastIndexOf('/') + 1);
		this.window.setTitle(fname);

		this.player.unload();

		// Judge filetype and play accordingly
		let url = Paths.toURL(path);
		if (FileTypes.isPicture(path)) {
			this.player.setContent(ContentType.IMAGE, url);
		} else if (FileTypes.isVideo(path)) {
			this.player.setContent(ContentType.VIDEO, url);
		} else {
			this.player.setContent(ContentType.VIDEO, url);
		}
	}

	// -- Gestures and transformation --
	updateTransform() {
		let t = this.transform;
		let css = `scale(${t.scale}, ${t.scale}) translate(${t.x}px, ${t.y}px) scale(${t.flipX}, ${t.flipY}) rotate(${t.rotation}deg)`;
		this.player.getMediaElement().css('transform', css);
	}

	/**
	 * Enables fullscreen on the player for the given element.
	 * @param elem The element to be fullscreen. If null, rewinds the fullscreen mode.
	 */
	setFullscreen(elem: HTMLElement) {
		if (elem) {
			this.fullscreen = elem;
			Fullscreen.on(elem);
		} else {
			this.fullscreen = null;
			Fullscreen.rewind();
		}
	}
}