import {
  createAudioPlayer,
  setAudioModeAsync,
  type AudioPlayer,
} from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import {
  encodeWavBase64,
  synthesizeChirpPcm,
  synthesizeUnlockTweetPcm,
} from "@/lib/pocketBird/birdsongCore";

const SAMPLE_RATE = 44100;
let audioModeReady = false;
let unlockTweetPath: string | null = null;

async function ensurePlaybackMode(): Promise<void> {
  if (audioModeReady) return;
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: "duckOthers",
    shouldRouteThroughEarpiece: false,
  });
  audioModeReady = true;
}

async function playWav(uri: string, volume: number): Promise<void> {
  const player: AudioPlayer = createAudioPlayer(uri, {
    updateInterval: 100,
  });
  player.volume = volume;

  const subscription = player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) {
      subscription.remove();
      player.remove();
    }
  });

  player.play();
}

/** Procedural chirp synthesized to WAV and played with expo-audio. */
export async function playBirdChirp(): Promise<void> {
  await ensurePlaybackMode();

  const pcm = synthesizeChirpPcm(SAMPLE_RATE);
  const base64 = encodeWavBase64(pcm, SAMPLE_RATE);
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error("No cache directory available for chirp playback.");
  }

  const path = `${cacheDir}pocket-bird-chirp-${Date.now()}.wav`;
  await FileSystem.writeAsStringAsync(path, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const player: AudioPlayer = createAudioPlayer(path, {
    updateInterval: 100,
  });
  player.volume = 1;

  const subscription = player.addListener("playbackStatusUpdate", (status) => {
    if (status.didJustFinish) {
      subscription.remove();
      player.remove();
      void FileSystem.deleteAsync(path, { idempotent: true });
    }
  });

  player.play();
}

/** Short two-note tweet for badge and card unlocks. */
export async function playUnlockTweet(): Promise<void> {
  await ensurePlaybackMode();

  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return;

  if (!unlockTweetPath) {
    const base64 = encodeWavBase64(synthesizeUnlockTweetPcm(SAMPLE_RATE), SAMPLE_RATE);
    const path = `${cacheDir}burd-unlock-tweet.wav`;
    await FileSystem.writeAsStringAsync(path, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    unlockTweetPath = path;
  }

  await playWav(unlockTweetPath, 0.85);
}
