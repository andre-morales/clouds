
class AudioSystem {
	constructor() {
		this.context = new AudioContext();
		this.destination = this.context.createGain();
		
		// -- Eq Creator
		this.eqPoints = [];
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
				let v = input[i];
				if (v > b) v = b;
				if (v < -b) v = -b;
				output[i] = v;
			}
		};

		// -- Final connection
		this.connectArr([
			this.destination,
			...this.eqPoints,
			this.reverbDryGain,
			this.final,
			clipper,
			this.context.destination
		]);

		this.connectArr([
			lastEqPoint,
			reverbNode,
			this.reverbWetGain,
			this.final,
		]);
	}

	setReverbBalance(b) {
		this.reverbWetGain.gain.value = b;
		this.reverbDryGain.gain.value = 1 - b;
	}

	impulseResponse( duration, decay, reverse ) {
		var sampleRate = this.context.sampleRate;
		var length = sampleRate * duration;
		var impulse = this.context.createBuffer(2, length, sampleRate);
		var impulseL = impulse.getChannelData(0);
		var impulseR = impulse.getChannelData(1);

		if (!decay)
			decay = 2.0;
		for (var i = 0; i < length; i++){
		  var n = reverse ? length - i : i;
		  impulseL[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
		  impulseR[i] = (Math.random() * 2 - 1) * Math.pow(1 - n / length, decay);
		}
		return impulse;
	}

	connectArr(arr) {
		for (let i = 0; i < arr.length - 1;) {
			arr[i].connect(arr[++i]);
		}
	}
}