import { ClientClass } from "/@sys/client_core.mjs";
import { App } from '/@sys/app.mjs';
import Window, { CloseBehavior } from '/@sys/ui/window.mjs';
import { UISlider } from "/@sys/ui/controls/slider.mjs";
import { AppAudioSource } from "/@sys/drivers/audio_system.mjs";

export default class SoundsApp extends App {
	private window: Window;
	private $app: $Element;
	private apps: Map<AppAudioSource, $Element>;

	constructor(...args: ConstructorParameters<typeof App>) {
		super(...args);
		
		this.window = null;
		this.apps = new Map();
	}

	async init() {
		this.window = ClientClass.get().desktop.createWindow(this);
		this.window.setTitle('Sounds');
		this.window.setCloseBehavior(CloseBehavior.EXIT_APP);
		
		let $app = this.window.$window.find('.window-body').addClass('app-sounds');
		this.$app = $app;
		await this.window.setContentToUrl('/app/sounds/body.html');

		this.window.setVisible(true);

		const Audio = ClientClass.get().audio;
		for (let source of Audio.getAppSources()) {
			this.createApp(source);
		}

		Audio.events.on('source-connected', (ev) => {
			this.createApp(ev.audioSource);
		})
		Audio.events.on('source-disconnected', (ev) => {
			this.destroyApp(ev.audioSource);
		})
	}

	private createApp(src: AppAudioSource) {
		const $app = $('<div>').addClass('app');
		$app.append(`<img class="app-icon" src="${src.app.icon}"/>`);
		$app.append(`<span>${src.app.displayName}</span>`);
		const $slider = $('<ui-slider min="0" max="2" vertical/>').appendTo($app);
		const $text = $('<span></span>').appendTo($app);

		const change = () => {$text.text((src.volume.gain.value * 100).toFixed(0) + '%')};
		
		let slider = $slider[0] as UISlider;
		slider.value = src.volume.gain.value;
		$slider.on('change', () => {
			src.volume.gain.value = slider.value;
			change();
		});

		change();
		this.$app.append($app);
		this.apps.set(src, $app);
	}

	private destroyApp(src: AppAudioSource) {
		let $elem = this.apps.get(src);
		this.apps.delete(src);

		$elem.remove();
	}
}