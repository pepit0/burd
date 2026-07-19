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
import { useAdmin } from "@/hooks/useAdmin";
import { getUserFacingMessage } from "@/lib/errors";
import { updatePostAsAdmin } from "@/lib/moderation";
import { getSightingById } from "@/lib/sightings";
import type { Rarity, Sighting } from "@/types";

const RARITIES: Rarity[] = ["common", "uncommon", "rare"];

export default function AdminEditPostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { isAdmin, loading: adminLoading } = useAdmin(userId);

  const [post, setPost] = useState<Sighting | null>(null);
  const [species, setSpecies] = useState("");
  const [scientific, setScientific] = useState("");
  const [notes, setNotes] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState("");
  const [locationAddress, setLocationAddress] = useState("");
  const [rarity, setRarity] = useState<Rarity>("common");
  const [count, setCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!adminLoading && !isAdmin) router.back();
  }, [adminLoading, isAdmin, router]);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const row = await getSightingById(id);
        if (cancelled || !row) return;
        setPost(row);
        setSpecies(row.species);
        setScientific(row.scientific_name ?? "");
        setNotes(row.notes ?? "");
        setLocationName(row.location_name ?? "");
        setLocationCity(row.location_city ?? "");
        setLocationAddress(row.location_address ?? "");
        setRarity(row.rarity);
        setCount(row.count);
      } catch (e) {
        if (!cancelled) Alert.alert("Could not load post", getUserFacingMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  async function handleSave() {
    if (!id || !species.trim() || submitting) return;
    setSubmitting(true);
    try {
      await updatePostAsAdmin(id, {
        species: species.trim(),
        scientific_name: scientific.trim() || null,
        notes: notes.trim() || null,
        location_name: locationName.trim() || null,
        location_city: locationCity.trim() || null,
        location_address: locationAddress.trim() || null,
        rarity,
        count,
      });
      Alert.alert("Post updated", "Changes were saved.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert("Could not save", getUserFacingMessage(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (adminLoading || loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator color="#5f9470" />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center font-sans text-sm text-muted-foreground">Post not found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-3 pb-2.5 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <ArrowLeft size={22} color="#eee8d4" />
        </Pressable>
        <Text className="font-serif-semibold text-base text-foreground">Edit post</Text>
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
          className="mb-4 rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
        />

        <Text className="mb-2 font-sans text-xs text-muted-foreground">Rarity</Text>
        <View className="mb-4 flex-row flex-wrap gap-2">
          {RARITIES.map((option) => (
            <Pressable
              key={option}
              onPress={() => setRarity(option)}
              className={rarity === option ? "rounded border border-primary" : "rounded border border-transparent"}
            >
              <RarityBadge rarity={option} />
            </Pressable>
          ))}
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

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Location</Text>
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
