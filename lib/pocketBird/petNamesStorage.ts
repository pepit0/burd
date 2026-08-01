import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "pet:pocket-bird-names";
export const PET_NAME_MAX_LENGTH = 25;

type PetNamesListener = (names: Record<string, string>) => void;
const listeners = new Set<PetNamesListener>();

export function subscribePetNames(listener: PetNamesListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notifyPetNames(names: Record<string, string>) {
  for (const listener of listeners) {
    listener(names);
  }
}

export async function getPetNames(): Promise<Record<string, string>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function getPetName(speciesId: string): Promise<string | null> {
  const names = await getPetNames();
  const name = names[speciesId]?.trim();
  return name || null;
}

export async function setPetName(
  speciesId: string,
  name: string,
): Promise<Record<string, string>> {
  const names = await getPetNames();
  const trimmed = name.trim().slice(0, PET_NAME_MAX_LENGTH);

  if (trimmed) {
    names[speciesId] = trimmed;
  } else {
    delete names[speciesId];
  }

  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(names));
  notifyPetNames(names);
  return names;
}

export function resolvePetDisplayName(
  speciesId: string,
  speciesName: string,
  names: Record<string, string>,
): string {
  const custom = names[speciesId]?.trim();
  return custom || speciesName;
}

export function hasCustomPetName(
  speciesId: string,
  names: Record<string, string>,
): boolean {
  return Boolean(names[speciesId]?.trim());
}
