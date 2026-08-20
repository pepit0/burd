import { Audio } from "expo-av";
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
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });
  audioModeReady = true;
}

async function playWav(uri: string, volume: number): Promise<void> {
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, volume },
  );

  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      void sound.unloadAsync();
    }
  });
}

/** Procedural chirp synthesized to WAV and played with expo-av. */
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

  const { sound } = await Audio.Sound.createAsync(
    { uri: path },
    { shouldPlay: true, volume: 1 },
  );

  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      void sound.unloadAsync();
      void FileSystem.deleteAsync(path, { idempotent: true });
    }
  });
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
