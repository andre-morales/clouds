import { Container } from "./container.mjs";
import MediaPlayer from "./media_player.mjs";
import Fullscreen from "/@sys/ui/fullscreen.mjs";

export class ImageContainer extends Container {
	private $image: $Element;

	constructor(player: MediaPlayer, $root: $Element) {
		super(player, $root);
		this.$image = $root.find('img');
		this.initControls();
	}

	initControls() {
		let $container = this.$root.find('.image-container');

		let $image = $container.find("img");
		$container.dblclick(() => {
			// Toggle fullscreen
			if (Fullscreen.element == $container[0]) {
				this.player.app.setFullscreen(null);
			} else {
				this.player.app.setFullscreen($container[0]);
			}
		});

		let $controls = $container.find('.controls');
		$image.click(() => {
			$controls.toggleClass('visible');
		});

		$controls.find('.prev-btn').click(() => {
			this.player.goPreviousFile();
		});

		$controls.find('.next-btn').click(() => {
			this.player.goNextFile();
		});

		this.player.app.gestures.on($image[0]);
	}

	setContentUrl(url: string) {
		super.setContentUrl(url);
		this.$image.attr("src", url);
	}

	unload(): void {
		this.$image.attr("src", "");
	}

	getMediaElement(): $Element {
		return this.$image;
	}
}