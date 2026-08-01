import AsyncStorage from "@react-native-async-storage/async-storage";

import { NO_HAT_ID, type PocketBirdHatId } from "@/lib/pocketBird/hats";

const STORAGE_KEY = "colony:pocket-bird-hat";

type PetHatListener = (hatId: PocketBirdHatId) => void;
const listeners = new Set<PetHatListener>();

export function subscribePetHatId(listener: PetHatListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyPetHatId(hatId: PocketBirdHatId) {
  for (const listener of listeners) {
    listener(hatId);
  }
}

export async function getPetHatId(): Promise<PocketBirdHatId> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return (saved as PocketBirdHatId | null) ?? NO_HAT_ID;
}

export async function setPetHatId(hatId: PocketBirdHatId): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, hatId);
  notifyPetHatId(hatId);
}
