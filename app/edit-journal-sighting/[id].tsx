import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Minus, Plus } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { RarityBadge } from "@/components/RarityBadge";
import { useAuth } from "@/hooks/useAuth";
import { getUserFacingMessage } from "@/lib/errors";
import { observedDate } from "@/lib/sightingFormat";
import { lookupRegionalRarity, rarityForSighting } from "@/lib/rarity";
import { getSightingById, updateMyJournalSighting } from "@/lib/sightings";
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

        if (row.published_at) {
          Alert.alert(
            "Already posted",
            "Posted sightings can't be edited. Delete this entry and log it again if you need to make changes.",
            [{ text: "OK", onPress: () => router.back() }],
          );
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
      });
      Alert.alert("Saved", "Your journal entry was updated.", [
        { text: "OK", onPress: () => router.back() },
      ]);
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
    </SafeAreaView>
  );
}
