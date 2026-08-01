import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "pet:pocket-bird-sound-enabled";

export async function getPetSoundEnabled(): Promise<boolean> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  if (saved == null) return true;
  return saved === "true";
}

export async function setPetSoundEnabled(enabled: boolean): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}
