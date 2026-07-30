import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Minus, Plus } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { RarityBadge } from "@/components/RarityBadge";
import { SightingPhotoCropModal } from "@/components/SightingPhotoCropModal";
import { useAuth } from "@/hooks/useAuth";
import { readPhotoBase64 } from "@/lib/captureDrafts";
import { getUserFacingMessage } from "@/lib/errors";
import { observedDate } from "@/lib/sightingFormat";
import { lookupRegionalRarity, rarityForSighting } from "@/lib/rarity";
import { isPhotoSighting } from "@/lib/sightingMedia";
import {
  SIGHTING_PHOTO_ASPECT,
  type CroppedSightingPhoto,
} from "@/lib/sightingPhotoFrame";
import {
  getSightingById,
  updateMyJournalSighting,
  uploadSightingPhoto,
} from "@/lib/sightings";
import type { Sighting } from "@/types";

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

  async function handleSave() {
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
          onPress={() => void handleSave()}
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
              Changes here update your public post too. Remove from profile only if you want to hide
              it from the feed without deleting your journal entry.
            </Text>
          </View>
        ) : null}

        {isPhotoSighting(sighting) && photoDisplayUri ? (
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
        ) : null}

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Species</Text>
        <TextInput
          value={species}
          onChangeText={setSpecies}
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Scientific name</Text>
        <TextInput
          value={scientific}
          onChangeText={setScientific}
          autoCapitalize="none"
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-serif-italic text-sm text-foreground"
        />

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
    </SafeAreaView>
  );
}
