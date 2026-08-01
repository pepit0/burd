import AsyncStorage from "@react-native-async-storage/async-storage";

import { updateProfilePetSpecies } from "@/lib/profilePet";

const STORAGE_KEY = "colony:pocket-bird-pet";
const DEFAULT_PET = "bluebird";

type PetSpeciesListener = (speciesId: string) => void;
const petSpeciesListeners = new Set<PetSpeciesListener>();

export function subscribePetSpeciesId(listener: PetSpeciesListener): () => void {
  petSpeciesListeners.add(listener);
  return () => {
    petSpeciesListeners.delete(listener);
  };
}

function notifyPetSpeciesId(speciesId: string) {
  for (const listener of petSpeciesListeners) {
    listener(speciesId);
  }
}

export async function getPetSpeciesId(): Promise<string> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY);
  return saved ?? DEFAULT_PET;
}

export async function setPetSpeciesId(
  speciesId: string,
  userId?: string | null,
): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, speciesId);
  notifyPetSpeciesId(speciesId);

  if (!userId) return;

  try {
    await updateProfilePetSpecies(userId, speciesId);
  } catch (error) {
    if (__DEV__) {
      console.warn("[petStorage] Could not sync pet to profile", error);
    }
  }
}

export { DEFAULT_PET };
