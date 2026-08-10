import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Mic, Users, Volume2, X } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Avatar } from "@/components/Avatar";
import { getLoadErrorMessage } from "@/lib/errors";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import { getFriendBorrowableSounds, type FriendSoundPost } from "@/lib/friendSounds";
import { getAttachableSoundLibrary } from "@/lib/soundLibrary";
import type { SoundLibraryEntry } from "@/types";

export type AttachedSoundSelection =
  | { kind: "library"; entry: SoundLibraryEntry }
  | { kind: "friend"; post: FriendSoundPost };

interface AttachSoundSheetProps {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onSelect: (selection: AttachedSoundSelection) => void;
}

type Tab = "library" | "friends";

export function AttachSoundSheet({
  visible,
  userId,
  onClose,
  onSelect,
}: AttachSoundSheetProps) {
  const [tab, setTab] = useState<Tab>("library");
  const [libraryEntries, setLibraryEntries] = useState<SoundLibraryEntry[]>([]);
  const [friendSounds, setFriendSounds] = useState<FriendSoundPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || !userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getAttachableSoundLibrary(userId), getFriendBorrowableSounds(userId)])
      .then(([library, friends]) => {
        if (cancelled) return;
        setLibraryEntries(library);
        setFriendSounds(friends);
        if (library.length === 0 && friends.length > 0) {
          setTab("friends");
        }
      })
      .catch((e) => {
        if (!cancelled) setError(getLoadErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, userId]);

  function handleSelectLibrary(entry: SoundLibraryEntry) {
    onSelect({ kind: "library", entry });
    onClose();
  }

  function handleSelectFriend(post: FriendSoundPost) {
    onSelect({ kind: "friend", post });
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
          <Pressable onPress={onClose} className="p-1">
            <X size={22} color="#8a9e82" />
          </Pressable>
          <Text className="font-serif-semibold text-lg text-foreground">
            Attach bird call
          </Text>
          <View className="w-7" />
        </View>

        <View className="flex-row gap-2 px-4 py-3">
          <Pressable
            onPress={() => setTab("library")}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full border px-3 py-2 ${
              tab === "library" ? "border-primary bg-primary/15" : "border-border bg-card"
            }`}
          >
            <Volume2 size={14} color={tab === "library" ? "#5f9470" : "#8a9e82"} />
            <Text
              className={`font-sans text-xs ${
                tab === "library" ? "font-sans-medium text-primary" : "text-muted-foreground"
              }`}
            >
              My library
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setTab("friends")}
            className={`flex-1 flex-row items-center justify-center gap-2 rounded-full border px-3 py-2 ${
              tab === "friends" ? "border-primary bg-primary/15" : "border-border bg-card"
            }`}
          >
            <Users size={14} color={tab === "friends" ? "#5f9470" : "#8a9e82"} />
            <Text
              className={`font-sans text-xs ${
                tab === "friends" ? "font-sans-medium text-primary" : "text-muted-foreground"
              }`}
            >
              Friends&apos; posts
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerClassName="gap-3 px-4 pb-12 pt-1"
          showsVerticalScrollIndicator={false}
        >
          {tab === "library" ? (
            <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
              Pick a saved clip from your sound library.
            </Text>
          ) : (
            <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
              Use a bird call from a friend&apos;s public post. They&apos;ll be credited as
              the recorder.
            </Text>
          )}

          {loading ? (
            <ActivityIndicator className="mt-12" color="#5f9470" />
          ) : error ? (
            <Text className="mt-12 text-center font-sans text-sm text-muted-foreground">
              {error}
            </Text>
          ) : tab === "library" ? (
            libraryEntries.length === 0 ? (
              <View className="mt-12 items-center px-4">
                <Mic size={28} color="#3a4e35" />
                <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
                  No saved clips available. Record from the camera mic or Sound ID first.
                </Text>
              </View>
            ) : (
              libraryEntries.map((entry) => {
                const top = entry.predictions[0];
                return (
                  <Pressable
                    key={entry.id}
                    onPress={() => handleSelectLibrary(entry)}
                    className="gap-2 rounded-2xl border border-border bg-card p-4 active:opacity-90"
                  >
                    <Text className="font-serif text-base text-foreground">
                      {entry.label?.trim() ||
                        (top ? displaySpeciesName(top) : "Bird call")}
                    </Text>
                    {top && displayScientificName(top) ? (
                      <Text className="font-serif-italic text-xs text-muted-foreground">
                        {displayScientificName(top)}
                      </Text>
                    ) : null}
                    <AudioPlayer uri={entry.audio_url} durationMs={entry.duration_ms} />
                  </Pressable>
                );
              })
            )
          ) : friendSounds.length === 0 ? (
            <View className="mt-12 items-center px-4">
              <Users size={28} color="#3a4e35" />
              <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
                No public sound posts from friends yet.
              </Text>
            </View>
          ) : (
            friendSounds.map((post) => (
              <Pressable
                key={post.sighting_id}
                onPress={() => handleSelectFriend(post)}
                className="gap-3 rounded-2xl border border-border bg-card p-4 active:opacity-90"
              >
                <View className="flex-row items-center gap-3">
                  <Avatar
                    user={post.username}
                    color={post.avatar_color}
                    avatarUrl={post.avatar_url}
                    size={36}
                  />
                  <View className="min-w-0 flex-1">
                    <Text className="font-sans-medium text-sm text-foreground">
                      @{post.username}
                    </Text>
                    <Text className="font-serif text-sm text-foreground/90">
                      {displaySpeciesName({
                        species: post.species,
                        scientific_name: post.scientific_name,
                        confidence: 0,
                      })}
                    </Text>
                  </View>
                </View>
                <AudioPlayer uri={post.audio_url} compact />
              </Pressable>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
