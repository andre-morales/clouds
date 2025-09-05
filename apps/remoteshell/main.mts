import App from '/@sys/app.mjs';
import { ClientClass } from '/@sys/client_core.mjs';
import { ContextMenu } from '/@sys/ui/controls/context_menu/ctx_menu.mjs';
import Window from '/@sys/ui/window.mjs';

var Client: ClientClass;

export default class RemoteShellApp extends App {
	window: Window;
	shellId: number;
	textWrapping: boolean;
	$content: $Element;
	#pingInterval__: any;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		Client = ClientClass.get();
		this.window = null;
		this.shellId = null;
	}

	async init() {
		let fRes = await fetch('/shell/0/init');
		if (fRes.status != 200) {
			Client.showErrorDialog('Error', 'Shell creation failed.');
			this.exit();
			return;
		}

		this.shellId = await fRes.json();

		// Require resources
		await this.requireStyle('/app/remoteshell/res/style.css');

		// Create window and fetch app body
		this.window = Client.desktop.createWindow(this);
		this.window.on('closing', () => this.doCleanup());
		
		this.window.setTitle('Remote Shell');
		let $app = this.window.$window.find('.window-body');
		$app.addClass('app-remoteshell');

		// Fetch app body
		await this.window.setContentToUrl('/app/remoteshell/res/main.html');
		this.$content = $app.find('.content');

		let fileMenu = ContextMenu.fromDefinition([
			['-Exit', () => { this.window.close(); }]
		]);
	
		$app.find('.file-menu').click((ev: MouseEvent) => {
			Client.desktop.openCtxMenuAt(fileMenu, ev.clientX, ev.clientY);
		});

		$app.find('.view-menu').click((ev: MouseEvent) => {
			let menu = ContextMenu.fromDefinition([
				['*Wrap text', (v: boolean) => { this.setTextWrapping(v); }, { checked: this.textWrapping} ],
				['-Clear', () => { this.clear(); }]
			]);
			Client.desktop.openCtxMenuAt(menu, ev.clientX, ev.clientY);
		});

		let $field = $app.find('input');

		// Whether the code or key properties of keydown will be available depend on the platform.
		$field.on('keydown', (ev: KeyboardEvent) => {
			if (![ev.code, ev.key].includes('Enter'))
				return;
			
			let cmd = $field.val();
			fetch('/shell/' + this.shellId + '/send', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
			    },
				body: JSON.stringify({'cmd': cmd})
			});
			$field.val('');
		})

		this.trackOutput();

		this.#pingInterval__ = setInterval(async () => {
			fetch('/shell/' + this.shellId + '/ping');
		}, 10000)

		// Make the window visible
		await this.window.setVisible(true);
		$field[0].focus({ preventScroll: true });
	}

	updateLog(content: string) {
		let cont = this.$content[0];

		let onBottom;
		if (cont.scrollTop + cont.offsetHeight >= cont.scrollHeight - 2) {
			onBottom = true;
		}

		let $msg = $(`<span></span>`)
		$msg.text(content);

		this.$content.append($msg);

		if (onBottom) {
			cont.scrollTo(0, cont.scrollHeight);
		}
	}

	setTextWrapping(w: boolean) {
		this.textWrapping = w;
		if (w) {
			this.$content.css('white-space', 'pre-wrap');
		} else {
			this.$content.css('white-space', 'pre');
		}
	}

	clear() {
		this.$content.empty();
	}

	doCleanup() {
		clearInterval(this.#pingInterval__);

		if (this.shellId) fetch('/shell/' + this.shellId + '/kill');

		this.exit();
	}

	private trackOutput() {
		let ws = new WebSocket(`ws://${window.location.host}/shell/${this.shellId}/socket`);
		ws.onmessage = (msg) => {
			this.updateLog(msg.data);
		};
	}
}