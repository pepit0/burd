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
import { UserPlus, X } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { DisplayNameWithBadges } from "@/components/DisplayNameWithBadges";
import { SearchBar } from "@/components/SearchBar";
import { getLoadErrorMessage } from "@/lib/errors";
import { getFriendsList, type UserListItem } from "@/lib/social";
import type { SightingCompanion } from "@/types";

interface CompanionPickerProps {
  visible: boolean;
  userId: string | null;
  selected: SightingCompanion[];
  onClose: () => void;
  onChange: (companions: SightingCompanion[]) => void;
}

function toCompanion(user: UserListItem): SightingCompanion {
  return {
    user_id: user.id,
    username: user.username,
    avatar_color: user.avatar_color,
    avatar_url: user.avatar_url ?? null,
    full_name: user.full_name,
  };
}

export function CompanionPicker({
  visible,
  userId,
  selected,
  onClose,
  onChange,
}: CompanionPickerProps) {
  const [friends, setFriends] = useState<UserListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!visible || !userId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    getFriendsList(userId, userId)
      .then((rows) => {
        if (!cancelled) setFriends(rows);
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

  const selectedIds = new Set(selected.map((row) => row.user_id));
  const filteredFriends = friends.filter((friend) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      friend.username.toLowerCase().includes(q) ||
      (friend.full_name ?? "").toLowerCase().includes(q)
    );
  });

  function toggleFriend(friend: UserListItem) {
    if (selectedIds.has(friend.id)) {
      onChange(selected.filter((row) => row.user_id !== friend.id));
      return;
    }
    onChange([...selected, toCompanion(friend)]);
  }

  function handleClose() {
    setQuery("");
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
          <Pressable onPress={handleClose} className="p-1">
            <X size={22} color="#8a9e82" />
          </Pressable>
          <Text className="font-serif-semibold text-lg text-foreground">
            Tag people with you
          </Text>
          <View className="w-7" />
        </View>

        <View className="px-4 pb-3 pt-4">
          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search friends"
          />
        </View>

        {selected.length > 0 ? (
          <View className="flex-row flex-wrap gap-2 px-4 pb-3">
            {selected.map((companion) => (
              <Pressable
                key={companion.user_id}
                onPress={() =>
                  onChange(selected.filter((row) => row.user_id !== companion.user_id))
                }
                className="flex-row items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1.5"
              >
                <Avatar
                  user={companion.username}
                  color={companion.avatar_color}
                  avatarUrl={companion.avatar_url}
                  size={20}
                />
                <Text className="font-sans-medium text-xs text-primary">
                  @{companion.username}
                </Text>
                <X size={12} color="#5f9470" />
              </Pressable>
            ))}
          </View>
        ) : null}

        <ScrollView
          contentContainerClassName="gap-2 px-4 pb-12 pt-1"
          showsVerticalScrollIndicator={false}
        >
          <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
            Choose friends who were with you. They&apos;ll appear as &ldquo;with
            @username&rdquo; on your post.
          </Text>

          {loading ? (
            <ActivityIndicator className="mt-12" color="#5f9470" />
          ) : error ? (
            <Text className="mt-12 text-center font-sans text-sm text-muted-foreground">
              {error}
            </Text>
          ) : filteredFriends.length === 0 ? (
            <View className="mt-12 items-center px-4">
              <UserPlus size={28} color="#3a4e35" />
              <Text className="mt-3 text-center font-sans text-sm leading-relaxed text-muted-foreground">
                {friends.length === 0
                  ? "Add friends first to tag them on posts."
                  : "No friends match your search."}
              </Text>
            </View>
          ) : (
            filteredFriends.map((friend) => {
              const active = selectedIds.has(friend.id);
              return (
                <Pressable
                  key={friend.id}
                  onPress={() => toggleFriend(friend)}
                  className={`flex-row items-center gap-3 rounded-2xl border px-4 py-3 active:opacity-90 ${
                    active ? "border-primary bg-primary/10" : "border-border bg-card"
                  }`}
                >
                  <Avatar
                    user={friend.username}
                    color={friend.avatar_color}
                    avatarUrl={friend.avatar_url}
                    size={40}
                  />
                  <View className="min-w-0 flex-1">
                    <DisplayNameWithBadges
                      text={friend.full_name || friend.username}
                      isVerified={friend.is_verified}
                      isBeta={friend.is_beta}
                      className="font-sans-medium text-sm text-foreground"
                      numberOfLines={1}
                    />
                    <Text className="font-mono text-xs text-muted-foreground" numberOfLines={1}>
                      @{friend.username}
                    </Text>
                  </View>
                  <Text
                    className={`font-sans-medium text-xs ${
                      active ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {active ? "Added" : "Add"}
                  </Text>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
