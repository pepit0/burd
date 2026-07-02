import { computePeaks } from "@/lib/audioPeaks";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof globalThis.AudioContext !== "undefined") {
    return globalThis.AudioContext;
  }
  const webkit = (globalThis as { webkitAudioContext?: typeof AudioContextCtor }).webkitAudioContext;
  return webkit ?? null;
}

export class WebAudioPlaybackEngine {
  private context: AudioContext | null = null;
  private buffer: AudioBuffer | null = null;
  private source: AudioBufferSourceNode | null = null;
  private analyser: AnalyserNode | null = null;
  private pauseOffsetMs = 0;
  private startTime = 0;
  private playing = false;
  private onEnded: (() => void) | null = null;

  peaks: number[] = [];

  async load(uri: string, barCount: number): Promise<void> {
    const AudioCtx = getAudioContextCtor();
    if (!AudioCtx) {
      throw new Error("Web Audio is unavailable.");
    }

    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("Could not load audio.");
    }

    const bytes = await response.arrayBuffer();
    this.context = new AudioCtx();
    this.buffer = await this.context.decodeAudioData(bytes.slice(0));
    this.peaks = computePeaks(this.buffer.getChannelData(0), barCount);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 512;
    this.analyser.smoothingTimeConstant = 0.35;
    this.analyser.connect(this.context.destination);
  }

  setOnEnded(handler: (() => void) | null) {
    this.onEnded = handler;
  }

  async play(): Promise<void> {
    if (!this.context || !this.buffer || !this.analyser) return;

    await this.context.resume();

    const durationMs = this.getDurationMs();
    if (durationMs > 0 && this.pauseOffsetMs >= durationMs - 20) {
      this.pauseOffsetMs = 0;
    }

    this.stopSource();

    this.source = this.context.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.analyser);
    this.source.onended = () => {
      this.playing = false;
      this.pauseOffsetMs = 0;
      this.source = null;
      this.onEnded?.();
    };

    const offsetSec = this.pauseOffsetMs / 1000;
    this.source.start(0, offsetSec);
    this.startTime = this.context.currentTime - offsetSec;
    this.playing = true;
  }

  pause(): void {
    if (!this.playing || !this.context) return;
    this.pauseOffsetMs = this.getPositionMs();
    this.stopSource();
    this.playing = false;
  }

  getPositionMs(): number {
    if (!this.context || !this.buffer) return this.pauseOffsetMs;
    if (!this.playing) return this.pauseOffsetMs;
    return Math.min(
      (this.context.currentTime - this.startTime) * 1000,
      this.buffer.duration * 1000,
    );
  }

  getDurationMs(): number {
    return (this.buffer?.duration ?? 0) * 1000;
  }

  isPlaying(): boolean {
    return this.playing;
  }

  getLiveLevels(barCount: number): number[] {
    if (!this.analyser || !this.playing) {
      return Array.from({ length: barCount }, () => 0);
    }

    const timeData = new Uint8Array(this.analyser.fftSize);
    this.analyser.getByteTimeDomainData(timeData);
    const freqData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(freqData);

    const timeStep = Math.max(1, Math.floor(timeData.length / barCount));
    const freqStep = Math.max(1, Math.floor(freqData.length / barCount));

    return Array.from({ length: barCount }, (_, index) => {
      const timeSample = timeData[Math.min(timeData.length - 1, index * timeStep)] ?? 128;
      const freqSample = freqData[Math.min(freqData.length - 1, index * freqStep)] ?? 0;
      const time = Math.abs(timeSample - 128) / 128;
      const freq = freqSample / 255;
      return Math.min(1, time * 0.35 + freq * 0.95 + 0.04);
    });
  }

  dispose(): void {
    this.stopSource();
    void this.context?.close().catch(() => undefined);
    this.context = null;
    this.buffer = null;
    this.analyser = null;
    this.playing = false;
    this.pauseOffsetMs = 0;
  }

  private stopSource(): void {
    if (!this.source) return;
    try {
      this.source.onended = null;
      this.source.stop();
    } catch {
      // already stopped or ended
    }
    try {
      this.source.disconnect();
    } catch {
      // ignore
    }
    this.source = null;
  }
}
