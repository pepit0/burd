import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useAuth } from "@/hooks/useAuth";
import { getUserFacingMessage } from "@/lib/errors";
import { getSightingById, updateMyPublishedPost } from "@/lib/sightings";
import type { Sighting } from "@/types";

export default function EditPostScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [post, setPost] = useState<Sighting | null>(null);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const loadPost = useCallback(async () => {
    if (!id || !userId) return;

    setLoading(true);
    try {
      const row = await getSightingById(id);
      if (!row || row.user_id !== userId) {
        Alert.alert("Not found", "This post could not be loaded.", [
          { text: "OK", onPress: () => router.back() },
        ]);
        return;
      }

      if (!row.published_at) {
        Alert.alert(
          "Not posted yet",
          "This sighting is still journal-only. Edit it from your journal entry instead.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      if (row.removed_at) {
        Alert.alert(
          "Post removed",
          "Removed posts can't be edited.",
          [{ text: "OK", onPress: () => router.back() }],
        );
        return;
      }

      setPost(row);
      setNotes(row.notes ?? "");
    } catch (e) {
      Alert.alert("Could not load", getUserFacingMessage(e), [
        { text: "OK", onPress: () => router.back() },
      ]);
    } finally {
      setLoading(false);
    }
  }, [id, userId, router]);

  useFocusEffect(
    useCallback(() => {
      void loadPost();
    }, [loadPost]),
  );

  useEffect(() => {
    if (!userId) {
      router.back();
    }
  }, [userId, router]);

  async function handleSave() {
    if (!id || !userId || submitting || !post) return;

    setSubmitting(true);
    try {
      await updateMyPublishedPost(userId, id, {
        notes: notes.trim() || null,
      });
      Alert.alert("Saved", "Your post caption was updated.", [
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

  if (!post) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-8">
        <Text className="text-center font-sans text-sm text-muted-foreground">
          Post not found.
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
        <Text className="font-serif-semibold text-base text-foreground">Edit post</Text>
        <Pressable
          onPress={() => void handleSave()}
          disabled={submitting}
          className={`rounded-full px-3 py-1.5 active:opacity-90 ${
            submitting ? "opacity-40" : "bg-primary"
          }`}
        >
          <Text className="font-sans-medium text-sm text-primary-foreground">Save</Text>
        </Pressable>
      </View>

      <KeyboardScreen contentContainerClassName="px-4 pb-12 pt-4">
        <View className="mb-4 rounded-xl border border-border bg-card p-4">
          <Text className="font-serif-semibold text-base text-foreground">{post.species}</Text>
          <Text className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
            For a quick caption change only. To edit species, date, location, and other details, use
            Edit entry from the journal sighting screen — those changes update your public post too.
          </Text>
        </View>

        <Text className="mb-1 font-sans text-xs text-muted-foreground">Caption</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          multiline
          placeholder="Add a caption for your post…"
          placeholderTextColor="#5a6e52"
          className="min-h-[120px] rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm text-foreground"
          textAlignVertical="top"
        />
      </KeyboardScreen>
    </SafeAreaView>
  );
}
