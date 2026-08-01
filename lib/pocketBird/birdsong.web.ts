import {
  CHIRP_TIMES,
  CHIRP_VOLUMES,
  chirpBurstCount,
  chirpFrequencies,
} from "@/lib/pocketBird/birdsongCore";

type AudioContextCtor = typeof AudioContext;

function getAudioContextCtor(): AudioContextCtor | null {
  if (typeof globalThis.AudioContext !== "undefined") {
    return globalThis.AudioContext;
  }
  const webkit = (globalThis as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  return webkit ?? null;
}

let audioContext: AudioContext | undefined;

/** Procedural chirp using Web Audio — direct port of Pocket Bird `Birdsong`. */
export async function playBirdChirp(): Promise<void> {
  const AudioCtx = getAudioContextCtor();
  if (!AudioCtx) return;

  if (!audioContext) {
    audioContext = new AudioCtx();
  }
  const ctx = audioContext;
  if (ctx.state === "suspended") {
    await ctx.resume();
  }

  const count = chirpBurstCount();
  for (let i = 0; i < count; i++) {
    window.setTimeout(() => {
      const frequencies = chirpFrequencies(count);

      const oscillator = ctx.createOscillator();
      oscillator.type = "sine";
      const gain = ctx.createGain();
      oscillator.connect(gain);
      gain.connect(ctx.destination);

      const now = ctx.currentTime;
      for (let k = 0; k < CHIRP_TIMES.length; k++) {
        const time = CHIRP_TIMES[k]! + now;
        if (k === 0) {
          oscillator.frequency.setValueAtTime(frequencies[k]!, time);
          gain.gain.setValueAtTime(CHIRP_VOLUMES[k]!, time);
        } else {
          oscillator.frequency.exponentialRampToValueAtTime(frequencies[k]!, time);
          gain.gain.exponentialRampToValueAtTime(CHIRP_VOLUMES[k]!, time);
        }
      }

      oscillator.start(now);
      oscillator.stop(now + CHIRP_TIMES[CHIRP_TIMES.length - 1]!);
    }, i * 120);
  }
}
