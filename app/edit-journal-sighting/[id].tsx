import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Camera, ChevronDown, Mic, Minus, Plus, Volume2 } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { AudioTrimModal } from "@/components/AudioTrimModal";
import {
  AttachSoundSheet,
  type AttachedSoundSelection,
} from "@/components/AttachSoundSheet";
import { KeyboardScreen } from "@/components/KeyboardScreen";import { RarityBadge } from "@/components/RarityBadge";
import { SightingPhotoCropModal } from "@/components/SightingPhotoCropModal";
import {
  SpeciesPickerSheet,
  type SpeciesPickerSuggestion,
} from "@/components/SpeciesPickerSheet";
import { useAuth } from "@/hooks/useAuth";
import { readPhotoBase64 } from "@/lib/captureDrafts";
import { getUserFacingMessage } from "@/lib/errors";
import { observedDate } from "@/lib/sightingFormat";
import { isSpeciesRarityVisible, lookupRegionalRarity, rarityForSighting } from "@/lib/rarity";
import { sightingHasAttachedAudio, sightingHasPhoto } from "@/lib/sightingMedia";
import type { PostAudioTrim } from "@/lib/sightingAudio";
import { insertSightingPhotos } from "@/lib/sightingPhotos";
import { linkSoundToSighting } from "@/lib/soundLibrary";
import type { FriendSoundPost } from "@/lib/friendSounds";
import {
  SIGHTING_PHOTO_ASPECT,
  type CroppedSightingPhoto,
} from "@/lib/sightingPhotoFrame";
import {
  getSightingById,
  applyJournalSpeciesCorrection,
  updateMyJournalSighting,
  updateSightingMedia,
  uploadSightingPhoto,
} from "@/lib/sightings";
import type { Sighting, SoundLibraryEntry } from "@/types";

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toTimeInputValue(date: Date): string {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

function parseObservedAt(dateStr: string, timeStr: string): string | null {
  const date = dateStr.trim();
  const time = timeStr.trim();
  if (!date) return null;

  const iso = time ? `${date}T${time}:00` : `${date}T12:00:00`;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

export default function EditJournalSightingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [species, setSpecies] = useState("");
  const [scientific, setScientific] = useState("");
  const [notes, setNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [observedDateInput, setObservedDateInput] = useState("");
  const [observedTimeInput, setObservedTimeInput] = useState("");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [photoDisplayUri, setPhotoDisplayUri] = useState<string | null>(null);
  const [originalPhotoUri, setOriginalPhotoUri] = useState<string | null>(null);
  const [cropSourceUri, setCropSourceUri] = useState<string | null>(null);
  const [pendingPhotoUri, setPendingPhotoUri] = useState<string | null>(null);
  const [pendingPhotoBase64, setPendingPhotoBase64] = useState<string | null>(null);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [cropModalOpen, setCropModalOpen] = useState(false);
  const [speciesPickerOpen, setSpeciesPickerOpen] = useState(false);
  const [libraryEntry, setLibraryEntry] = useState<SoundLibraryEntry | null>(null);
  const [friendSound, setFriendSound] = useState<FriendSoundPost | null>(null);
  const [soundLibraryId, setSoundLibraryId] = useState<string | null>(null);
  const [soundPickerOpen, setSoundPickerOpen] = useState(false);
  const [audioTrimModalOpen, setAudioTrimModalOpen] = useState(false);

  const addingAudio = Boolean(libraryEntry || friendSound);
  const attachedAudioForTrim = useMemo(() => {
    if (libraryEntry) {
      return { url: libraryEntry.audio_url, durationMs: libraryEntry.duration_ms };
    }
    if (friendSound) {
      return { url: friendSound.audio_url };
    }
    return null;
  }, [friendSound, libraryEntry]);

  const speciesSuggestions = useMemo((): SpeciesPickerSuggestion[] => {
    if (!sighting) return [];

    const suggestions: SpeciesPickerSuggestion[] = [];
    const seen = new Set<string>();

    function addSuggestion(
      speciesName: string,
      scientificName: string | null | undefined,
      subtitle?: string,
    ) {
      const key = `${speciesName.trim().toLowerCase()}|${(scientificName ?? "").trim().toLowerCase()}`;
      if (!speciesName.trim() || seen.has(key)) return;
      seen.add(key);
      suggestions.push({
        species: speciesName.trim(),
        scientific_name: scientificName?.trim() || "",
        subtitle,
      });
    }

    addSuggestion(sighting.species, sighting.scientific_name, "Current entry");
    for (const prediction of sighting.audio_predictions ?? []) {
      addSuggestion(
        prediction.species,
        prediction.scientific_name,
        prediction.confidence != null
          ? `${Math.round(prediction.confidence * 100)}% heard in clip`
          : "Heard in clip",
      );
    }

    return suggestions;
  }, [sighting]);

  useEffect(() => {
    if (!id || !userId) return;

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = await getSightingById(id);
        if (cancelled) return;

        if (!row || row.user_id !== userId) {
          Alert.alert("Not found", "This sighting could not be loaded.", [
            { text: "OK", onPress: () => router.back() },
          ]);
          return;
        }

        const when = observedDate(row);
        setSighting(row);
        setSpecies(row.species);
        setScientific(row.scientific_name ?? "");
        setNotes(row.notes ?? "");
        setLocationName(row.location_name ?? "");
        setLocationCity(row.location_city ?? "");
        setLocationAddress(row.location_address ?? "");
        setObservedDateInput(toDateInputValue(when));
        setObservedTimeInput(toTimeInputValue(when));
        setCount(row.count);
        if (row.photo_url) {
          setPhotoDisplayUri(row.photo_url);
          setOriginalPhotoUri(row.photo_url);
          setCropSourceUri(row.photo_url);
        }
      } catch (e) {
        if (!cancelled) {
          Alert.alert("Could not load", getUserFacingMessage(e), [
            { text: "OK", onPress: () => router.back() },
          ]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, userId, router]);

  function openPhotoCrop() {
    const uri = originalPhotoUri ?? sighting?.photo_url ?? null;
    if (!uri) return;
    setCropSourceUri(uri);
    setCropModalOpen(true);
  }

  function applyCroppedPhoto(cropped: CroppedSightingPhoto) {
    setPendingPhotoUri(cropped.uri);
    setPendingPhotoBase64(cropped.base64);
    setPhotoDisplayUri(cropped.uri);
    setPhotoChanged(true);
    setCropModalOpen(false);
  }

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setCropSourceUri(asset.uri);
    setPendingPhotoBase64(asset.base64 ?? null);
    setCropModalOpen(true);
  }

  function attachLibraryEntry(entry: SoundLibraryEntry) {
    setLibraryEntry(entry);
    setFriendSound(null);
    setSoundLibraryId(entry.id);
  }

  function attachFriendSound(post: FriendSoundPost) {
    setFriendSound(post);
    setLibraryEntry(null);
    setSoundLibraryId(null);
  }

  function attachSoundSelection(selection: AttachedSoundSelection) {
    if (selection.kind === "library") {
      attachLibraryEntry(selection.entry);
      return;
    }
    attachFriendSound(selection.post);
  }

  function detachPendingAudio() {
    setLibraryEntry(null);
    setFriendSound(null);
    setSoundLibraryId(null);
  }

  function beginSave() {
    if (!id || !userId || !species.trim() || submitting || !sighting) return;

    const observedAt = parseObservedAt(observedDateInput, observedTimeInput);
    if (observedDateInput.trim() && !observedAt) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD and HH:MM for when you saw this bird.");
      return;
    }

    if (addingAudio && sighting.published_at && attachedAudioForTrim) {
      setAudioTrimModalOpen(true);
      return;
    }

    void handleSave(null);
  }

  async function handleSave(audioTrim: PostAudioTrim | null) {
    if (!id || !userId || !species.trim() || submitting || !sighting) return;

    const observedAt = parseObservedAt(observedDateInput, observedTimeInput);
    if (observedDateInput.trim() && !observedAt) {
      Alert.alert("Invalid date", "Use YYYY-MM-DD and HH:MM for when you saw this bird.");
      return;
    }

    setSubmitting(true);
    try {
      const rarity = lookupRegionalRarity({
        species: species.trim(),
        scientificName: scientific.trim() || null,
        lat: sighting.latitude,
        lng: sighting.longitude,
        observedAt,
      });

      let photoUrl: string | undefined;
      if (photoChanged) {
        let base64 = pendingPhotoBase64;
        if (!base64 && pendingPhotoUri) {
          base64 = await readPhotoBase64(pendingPhotoUri);
        }
        if (!base64) {
          throw new Error("Could not read the cropped photo.");
        }
        photoUrl = await uploadSightingPhoto(userId, base64);
      }

      await updateMyJournalSighting(userId, id, {
        species: species.trim(),
        scientific_name: scientific.trim() || null,
        notes: notes.trim() || null,
        location_name: locationName.trim() || null,
        location_city: locationCity.trim() || null,
        location_address: locationAddress.trim() || null,
        observed_at: observedAt,
        rarity,
        count,
        photo_url: photoUrl ?? null,
      });

      if (photoUrl && !sightingHasPhoto(sighting)) {
        await insertSightingPhotos(id, [
          {
            photo_url: photoUrl,
            captured_at: observedAt,
            species: species.trim(),
            scientific_name: scientific.trim() || null,
            count,
            confidence: sighting.confidence,
            detected_by: sighting.detected_by,
          },
        ]);
        await updateSightingMedia(userId, id, { photo_count: 1 });
      }

      if (addingAudio) {
        await updateSightingMedia(userId, id, {
          audio_url: libraryEntry?.audio_url ?? friendSound!.audio_url,
          audio_predictions:
            libraryEntry?.predictions ?? friendSound!.audio_predictions ?? null,
          audio_source_sighting_id: friendSound?.sighting_id ?? null,
          published_audio_start_ms:
            sighting.published_at && audioTrim ? audioTrim.startMs : null,
          published_audio_end_ms:
            sighting.published_at && audioTrim ? audioTrim.endMs : null,
        });
        if (soundLibraryId) {
          await linkSoundToSighting(soundLibraryId, id);
        }
      }

      await applyJournalSpeciesCorrection(sighting, species.trim(), scientific.trim() || null);
      setAudioTrimModalOpen(false);
      Alert.alert(
        "Saved",
        sighting.published_at
          ? "Your journal entry and post were updated."
          : "Your journal entry was updated.",
        [{ text: "OK", onPress: () => router.back() }],
      );
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#5f9470" />
      </SafeAreaView>
    );
  }

  if (!sighting) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center font-sans text-sm text-muted-foreground">
          Sighting not found.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-3 pb-2.5 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <ArrowLeft size={22} color="#eee8d4" />
        </Pressable>
        <Text className="font-serif-semibold text-base text-foreground">Edit entry</Text>
        <Pressable
          onPress={beginSave}
          disabled={submitting || !species.trim()}
          className={`rounded-full px-3 py-1.5 active:opacity-90 ${
            submitting || !species.trim() ? "opacity-40" : "bg-primary"
          }`}
        >
          <Text className="font-sans-medium text-sm text-primary-foreground">Save</Text>
        </Pressable>
      </View>

      <KeyboardScreen contentContainerClassName="px-4 pb-12 pt-4">
        {sighting.published_at ? (
          <View className="mb-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
            <Text className="font-sans-medium text-sm text-foreground">Posted to profile</Text>
            <Text className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
              Changes here update your public post too. You can also add a photo or bird call below.
              Remove from profile only if you want to hide it from the feed without deleting your journal entry.
            </Text>
          </View>
        ) : null}

        {photoDisplayUri ? (
          <View className="mb-5 gap-2">
            <Text className="font-sans text-xs text-muted-foreground">Photo</Text>
            <Pressable
              onPress={openPhotoCrop}
              className="overflow-hidden rounded-2xl border border-border bg-muted/40 active:opacity-95"
            >
              <Image
                source={{ uri: photoDisplayUri }}
                style={{ width: "100%", aspectRatio: SIGHTING_PHOTO_ASPECT }}
                contentFit="contain"
                transition={200}
              />
            </Pressable>
            <Text className="text-center font-sans text-xs text-muted-foreground">
              Tap photo to crop or zoom
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={() => void pickPhoto()}
            className="mb-5 items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-8 active:opacity-90"
          >
            <Camera size={24} color="#5f9470" />
            <Text className="font-sans-medium text-sm text-foreground">Add a photo</Text>
            <Text className="text-center font-sans text-xs text-muted-foreground">
              Attach a photo to this entry or post.
            </Text>
          </Pressable>
        )}

        {sightingHasAttachedAudio(sighting) || addingAudio ? (
          <View className="mb-5 gap-3 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2">
                <Mic size={15} color="#5f9470" />
                <Text className="font-sans-medium text-sm text-foreground">Bird call</Text>
              </View>
              {addingAudio ? (
                <Pressable onPress={detachPendingAudio} className="rounded-full px-2 py-1">
                  <Text className="font-sans text-xs text-muted-foreground">Remove</Text>
                </Pressable>
              ) : null}
            </View>
            {friendSound ? (
              <Text className="font-sans text-xs text-muted-foreground">
                From @{friendSound.username}&apos;s post · they&apos;ll be credited as the recorder
              </Text>
            ) : null}
            {libraryEntry ? (
              <AudioPlayer
                uri={libraryEntry.audio_url}
                durationMs={libraryEntry.duration_ms}
              />
            ) : friendSound ? (
              <AudioPlayer uri={friendSound.audio_url} compact />
            ) : sighting.audio_url ? (
              <AudioPlayer uri={sighting.audio_url} />
            ) : null}
          </View>
        ) : (
          <Pressable
            onPress={() => setSoundPickerOpen(true)}
            className="mb-5 flex-row items-center justify-center gap-2 rounded-2xl border border-dashed border-primary/40 bg-primary/5 px-5 py-5 active:opacity-90"
          >
            <Volume2 size={16} color="#5f9470" />
            <Text className="font-sans-medium text-sm text-foreground">Attach bird call</Text>
          </Pressable>
        )}

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Species</Text>
        <Pressable
          onPress={() => setSpeciesPickerOpen(true)}
          className="mb-1 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:opacity-90"
        >
          <Text
            className={`min-w-0 flex-1 font-sans text-sm ${
              species.trim() ? "text-foreground" : "text-muted-foreground"
            }`}
            numberOfLines={2}
          >
            {species.trim() || "Search for a species"}
          </Text>
          <ChevronDown size={16} color="#8a9e82" />
        </Pressable>
        <Text className="mb-4 font-sans text-xs leading-relaxed text-muted-foreground">
          Tap to search the field guide or pick another ID suggestion if photo or sound ID looks wrong.
        </Text>

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Scientific name</Text>
        <TextInput
          value={scientific}
          onChangeText={setScientific}
          autoCapitalize="none"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-serif-italic text-sm text-foreground"
        />

        {isSpeciesRarityVisible() ? (
          <>
            <Text className="mb-2 font-sans text-xs text-muted-foreground">Rarity</Text>
            <View className="mb-4">
              <RarityBadge rarity={rarityForSighting({
                species: species.trim() || sighting.species,
                scientific_name: scientific.trim() || sighting.scientific_name,
                latitude: sighting.latitude,
                longitude: sighting.longitude,
                observed_at: parseObservedAt(observedDateInput, observedTimeInput),
                created_at: sighting.created_at,
              })} />
            </View>
          </>
        ) : null}

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Count</Text>
        <View className="mb-4 flex-row items-center gap-3">
          <Pressable
            onPress={() => setCount((c) => Math.max(1, c - 1))}
            className="rounded-full border border-border p-2"
          >
            <Minus size={16} color="#eee8d4" />
          </Pressable>
          <Text className="font-mono text-base text-foreground">{count}</Text>
          <Pressable
            onPress={() => setCount((c) => Math.min(99, c + 1))}
            className="rounded-full border border-border p-2"
          >
            <Plus size={16} color="#eee8d4" />
          </Pressable>
        </View>

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Date seen</Text>
        <View className="mb-4 flex-row gap-2">
          <TextInput
            value={observedDateInput}
            onChangeText={setObservedDateInput}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#5a6e52"
            autoCapitalize="none"
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm text-foreground"
          />
          <TextInput
            value={observedTimeInput}
            onChangeText={setObservedTimeInput}
            placeholder="HH:MM"
            placeholderTextColor="#5a6e52"
            autoCapitalize="none"
            className="w-28 rounded-xl border border-border bg-card px-4 py-3 font-mono text-sm text-foreground"
          />
        </View>

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Place name</Text>
        <TextInput
          value={locationName}
          onChangeText={setLocationName}
          className="mb-2 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />
        <TextInput
          value={locationCity}
          onChangeText={setLocationCity}
          placeholder="City"
          placeholderTextColor="#5a6e52"
          className="mb-2 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />
        <TextInput
          value={locationAddress}
          onChangeText={setLocationAddress}
          placeholder="Address"
          placeholderTextColor="#5a6e52"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          className="min-h-[96px] rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
          textAlignVertical="top"
        />
      </KeyboardScreen>

      <SightingPhotoCropModal
        visible={cropModalOpen}
        uri={cropSourceUri}
        onCancel={() => setCropModalOpen(false)}
        onConfirm={applyCroppedPhoto}
      />

      <SpeciesPickerSheet
        visible={speciesPickerOpen}
        title="Change species"
        suggestions={speciesSuggestions}
        onClose={() => setSpeciesPickerOpen(false)}
        onSelect={(selection) => {
          setSpecies(selection.species);
          setScientific(selection.scientific_name);
        }}
      />

      <AttachSoundSheet
        visible={soundPickerOpen}
        userId={userId}
        onClose={() => setSoundPickerOpen(false)}
        onSelect={attachSoundSelection}
      />

      {attachedAudioForTrim ? (
        <AudioTrimModal
          visible={audioTrimModalOpen}
          audioUrl={attachedAudioForTrim.url}
          durationMs={attachedAudioForTrim.durationMs}
          onCancel={() => setAudioTrimModalOpen(false)}
          onConfirm={(trim) => void handleSave(trim)}
        />
      ) : null}
    </SafeAreaView>
  );
}
