// AudioWorklet that turns microphone audio into 16 kHz, 16-bit little-endian PCM
// (the "linear16" encoding Sully's streaming endpoint expects) and posts
// 100 ms chunks (1,600 samples = 3,200 bytes) to the main thread.
class PcmWorklet extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / 16000; // input samples per output sample (sampleRate is a worklet global)
    this.phase = 0;
    this.sum = 0;
    this.count = 0;
    this.chunk = new Int16Array(1600);
    this.index = 0;
    this.port.onmessage = (event) => {
      if (event.data === "flush" && this.index > 0) {
        this.port.postMessage(this.chunk.slice(0, this.index).buffer);
        this.index = 0;
      }
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      // Average the input samples that fall into each output sample (simple low-pass + downsample).
      this.sum += channel[i];
      this.count += 1;
      this.phase += 1;
      if (this.phase >= this.ratio) {
        this.phase -= this.ratio;
        const s = Math.max(-1, Math.min(1, this.sum / this.count));
        this.chunk[this.index++] = s < 0 ? s * 0x8000 : s * 0x7fff;
        this.sum = 0;
        this.count = 0;
        if (this.index === this.chunk.length) {
          const out = this.chunk;
          this.port.postMessage(out.buffer, [out.buffer]);
          this.chunk = new Int16Array(1600);
          this.index = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor("pcm-worklet", PcmWorklet);
