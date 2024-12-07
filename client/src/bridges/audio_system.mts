import App from "../app.mjs";
import { Reactor, ReactorEvent } from "../events.mjs";
import Resource from "../resource.mjs";
import Arrays from "../utils/arrays.mjs";

export class AudioSystem {
	public readonly events: Reactor<{
		'source-connected': AudioSourceEvent
		'source-disconnected': AudioSourceEvent
	}>;
	private appSources: AppAudioSource[];

	private context: AudioContext;
	private destination: AudioNode;
	private enabled: boolean;
	private initialized: boolean;

	/*reverbWetGain: any;
	reverbDryGain: any;*/

	constructor() {
		this.enabled = true;
		this.initialized = false;
		this.events = new Reactor();
		this.appSources = [];
		this.events.register('source-connected', 'source-disconnected');
	}

	private init(): boolean {
		if (!this.enabled) return false;
		if (this.initialized) return true;

		this.initialized = true;
		this.context = new AudioContext();
		this.destination = this.context.createGain();

		// -- Eq Creator
		/*this.eqPoints = [];
		let pointsc = 6;
		let filter;
		for (let i = 0; i < pointsc; i++) {
			filter = this.context.createBiquadFilter();
			filter.frequency.value = 2 ** (10/(pointsc + 1) * (i + 1)) * 20;

			if (i == 0) {
				filter.type = 'lowshelf';
			} else if (i == pointsc - 1) {
				filter.type = 'highshelf';
			} else {
				filter.type = 'peaking';
			}

			this.eqPoints.push(filter);
		}
		let lastEqPoint = filter;
		
		// -- Reverb
		let reverbNode = this.context.createConvolver();
		reverbNode.buffer = this.impulseResponse(3, 7);
		this.reverbDryGain = this.context.createGain();
		this.reverbDryGain.gain.value = 1;
		this.reverbWetGain = this.context.createGain();
		this.reverbWetGain.gain.value = 0;

		// -- Final volume control
		this.final = this.context.createGain();

		// -- Clipper
		this.clipEnabled = false;
		this.clipBound = 1;
		let clipper = this.context.createScriptProcessor(0, 1, 1);
		clipper.onaudioprocess = (ev) => {
			let input = ev.inputBuffer.getChannelData(0);
			let output = ev.outputBuffer.getChannelData(0);

			if (!this.clipEnabled) { 
				output.set(input);
				return;
			}

			let b = this.clipBound;
			for (let i = 0; i < input.length; i++) {
				let v = input[i] * 1.0 / this.clipBound;
				if (v > b) v = b;
				if (v < -b) v = -b;
				output[i] = v;
			}
		};

		// -- Delay
		let feedback = this.context.createGain();
		feedback.gain.value = 0.3;
		this.delayFeedbackGain = feedback;
		let delayNode = this.context.createDelay();
		delayNode.delayTime.value = 0.03;

		// -- Final connection
		//this.connectArr([
		//	lastEqPoint,
		//	feedback,
		//	delayNode
		//]);

		//this.connectArr([
		//	feedback,
		//	delayNode
		//]);

		//this.connectArr([delayNode, this.reverbWetGain]);
		//this.connectArr([delayNode, this.reverbDryGain]);*/

		// Master pipeline without reverb effect
		this.connectArr([
			this.destination,
			/*...this.eqPoints,
			this.reverbDryGain,
			this.final,
			clipper,*/
			this.context.destination
		]);

		// Extra pipe with reverb
		/*this.connectArr([
			lastEqPoint,
			reverbNode,
			this.reverbWetGain,
			this.final,
		]);*/
		return true;
	}

	public resume() {
		if (!this.enabled) return;
		this.context.resume();
	}

	public isEnabled() {
		return this.enabled;
	}

	public getAppSources(): readonly AppAudioSource[] {
		return this.appSources;
	}

	public createMediaNode(mediaElement: HTMLMediaElement): MediaElementAudioSourceNode {
		if (!this.initialized) this.init();

		return this.context.createMediaElementSource(mediaElement);
	}

	public connect(node: AudioNode, app: App) {
		// Make sure the audio system is initialized
		if (!this.initialized) this.init();

		// Create audio context connection
		let gain = this.context.createGain();
		node.connect(gain);
		gain.connect(this.destination);

		let audioSource = new AppAudioSource(app, gain);
		this.appSources.push(audioSource);

		// Store resource on app to represent this audio connection. This resource will be freed
		// when the app is closed.
		let res = new Resource();
		res.setUnloadCallback(() => {
			gain.disconnect();
			Arrays.erase(this.appSources, audioSource);

			this.events.fire('source-disconnected', new AudioSourceEvent(audioSource));
		});
		res.addUser(app);
		app.resources.add(res);

		// Make listeners aware of this connection
		this.events.fire('source-connected', new AudioSourceEvent(audioSource));
	}

	private connectArr(arr: AudioNode[]) {
		for (let i = 0; i < arr.length - 1;) {
			arr[i].connect(arr[++i]);
		}
	}

	/*setReverbBalance(b: number) {
		this.reverbWetGain.gain.value = b;
		this.reverbDryGain.gain.value = 1 - b;
	}

	impulseResponse(duration: number, decay: number, reverse: number) {
		var sampleRate = this.context.sampleRate;
		var length = sampleRate * duration;
		var impulse = this.context.createBuffer(2, length, sampleRate);
		var impulseL = impulse.getChannelData(0);
		var impulseR = impulse.getChannelData(1);

		if (!decay) decay = 2.0;
		for (var i = 0; i < length; i++){
		  var n = reverse ? length - i : i;
		  impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
		  impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
		}
		return impulse;
	}*/
}

export class AppAudioSource {
	public readonly app: App;
	public readonly volume: GainNode;

	constructor(app: App, volume: GainNode) {
		this.app = app;
		this.volume = volume;
	}
}

class AudioSourceEvent extends ReactorEvent {
	public readonly audioSource: AppAudioSource;

	constructor(audioSource: AppAudioSource) {
		super();
		this.audioSource = audioSource;
	}
}

export default { AudioSystem };