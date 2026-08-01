import { useCallback, useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { PocketBirdPet } from "@/components/PocketBirdPet";
import { ImageOverlayText } from "@/components/ImageOverlayText";
import { PocketBirdHatPicker } from "@/components/PocketBirdHatPicker";
import { PocketBirdSpeciesPicker } from "@/components/PocketBirdSpeciesPicker";
import { useAuth } from "@/hooks/useAuth";
import { getPocketBirdSpeciesById } from "@/lib/pocketBird/matchSpecies";
import { NO_HAT_ID, type PocketBirdHatId } from "@/lib/pocketBird/hats";
import {
  getPetHatId,
  setPetHatId,
  subscribePetHatId,
} from "@/lib/pocketBird/petHatStorage";
import {
  getPetNames,
  hasCustomPetName,
  PET_NAME_MAX_LENGTH,
  resolvePetDisplayName,
  setPetName,
  subscribePetNames,
} from "@/lib/pocketBird/petNamesStorage";
import {
  getPetSoundEnabled,
  setPetSoundEnabled,
} from "@/lib/pocketBird/petSoundStorage";
import { DEFAULT_PET, getPetSpeciesId, setPetSpeciesId } from "@/lib/pocketBird/petStorage";

interface ColonyTabProps {
  tabBarClearance: number;
}

export function ColonyTab({ tabBarClearance }: ColonyTabProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [petId, setPetId] = useState<string>(DEFAULT_PET);
  const [hatId, setHatId] = useState<PocketBirdHatId>(NO_HAT_ID);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [petNames, setPetNames] = useState<Record<string, string>>({});
  const [nameDraft, setNameDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getPetSpeciesId(), getPetSoundEnabled(), getPetNames(), getPetHatId()]).then(
      ([id, sound, names, hat]) => {
        if (cancelled) return;
        setPetId(id);
        setHatId(hat);
        setSoundEnabled(sound);
        setPetNames(names);
        setNameDraft(names[id]?.trim() ?? "");
        if (userId) {
          void setPetSpeciesId(id, userId);
          void setPetHatId(hat, userId);
        }
      },
    );
    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    return subscribePetNames(setPetNames);
  }, []);

  useEffect(() => {
    return subscribePetHatId(setHatId);
  }, []);

  useEffect(() => {
    setNameDraft(petNames[petId]?.trim() ?? "");
  }, [petId, petNames]);

  const persistNameDraft = useCallback(async () => {
    const next = await setPetName(petId, nameDraft);
    setPetNames(next);
    setNameDraft(next[petId]?.trim() ?? "");
  }, [nameDraft, petId]);

  const onSelectPet = useCallback(
    (speciesId: string) => {
      if (speciesId === petId) return;
      void persistNameDraft().then(() => {
        setPetId(speciesId);
        void setPetSpeciesId(speciesId, userId);
      });
    },
    [petId, persistNameDraft, userId],
  );

  const onSelectHat = useCallback(
    (nextHatId: PocketBirdHatId) => {
      setHatId(nextHatId);
      void setPetHatId(nextHatId, userId);
    },
    [userId],
  );

  const onToggleSound = useCallback(() => {
    setSoundEnabled((current) => {
      const next = !current;
      void setPetSoundEnabled(next);
      return next;
    });
  }, []);

  const pet = getPocketBirdSpeciesById(petId);
  const displayName = resolvePetDisplayName(petId, pet.name, petNames);
  const usingCustomName = hasCustomPetName(petId, petNames);

  return (
    <ScrollView
      className="flex-1 px-3"
      contentContainerStyle={{ paddingBottom: tabBarClearance + 16 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View className="mb-4 rounded-xl border border-border bg-card/80 px-3 py-2.5">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 pr-3">
            <Text className="font-serif-semibold text-base text-foreground">Pet</Text>
            <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
              Your pocket pet · hops on your profile too
            </Text>
          </View>
          <Pressable
            onPress={onToggleSound}
            accessibilityRole="button"
            accessibilityLabel={soundEnabled ? "Disable pet sounds" : "Enable pet sounds"}
            className="rounded-full border border-border px-3 py-1.5"
          >
            <Text className="font-sans text-xs text-foreground">
              {soundEnabled ? "Sound on" : "Sound off"}
            </Text>
          </Pressable>
        </View>
      </View>
      <View className="mb-4 items-center rounded-2xl border border-border bg-card px-4 py-6">
        <ImageOverlayText
          className="font-serif-semibold text-xl text-foreground"
          containerStyle={{ alignSelf: "center" }}
          style={{ color: pet.highlightColor }}
        >
          {displayName}
        </ImageOverlayText>
        {usingCustomName ? (
          <Text className="mt-1 font-sans text-sm text-muted-foreground">{pet.name}</Text>
        ) : null}
        <ImageOverlayText
          className="font-sans text-sm text-muted-foreground"
          containerClassName={usingCustomName ? "mt-0.5" : "mt-1"}
          containerStyle={{ alignSelf: "center" }}
          onPress={() => void Linking.openURL(pet.url)}
        >
          {pet.latinName}
        </ImageOverlayText>

        <View className="my-5 min-h-[180px] w-full">
          <PocketBirdPet
            speciesId={petId}
            hatId={hatId}
            size={176}
            soundEnabled={soundEnabled}
          />
        </View>

        <View className="mb-4 w-full">
          <Text className="mb-1 font-sans-medium text-xs text-foreground/80">
            Private name
          </Text>
          <TextInput
            autoCapitalize="words"
            autoCorrect={false}
            onChangeText={setNameDraft}
            onBlur={() => void persistNameDraft()}
            placeholder={pet.name}
            placeholderTextColor="#8a9e82"
            value={nameDraft}
            maxLength={PET_NAME_MAX_LENGTH}
            returnKeyType="done"
            onSubmitEditing={() => void persistNameDraft()}
            className="rounded-xl border border-border bg-background px-4 py-3 font-sans text-base text-foreground"
          />
          <Text className="mt-1 font-sans text-[10px] text-muted-foreground">
            Only you see this · each bird can have its own name
          </Text>
        </View>

        <Text className="text-center font-sans text-sm leading-5 text-foreground">
          {pet.description}
        </Text>
        <Text className="mt-3 text-center font-sans text-xs text-muted-foreground">
          Tap your bird to pet it
        </Text>
      </View>

      <PocketBirdSpeciesPicker
        selectedId={petId}
        petNames={petNames}
        onSelect={onSelectPet}
      />

      <PocketBirdHatPicker selectedId={hatId} onSelect={onSelectHat} />
    </ScrollView>
  );
}
