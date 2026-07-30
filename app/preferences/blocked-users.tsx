import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Avatar } from "@/components/Avatar";
import { ScreenHeader } from "@/components/ScreenHeader";
import { useAuth } from "@/hooks/useAuth";
import { listBlockedUsers, unblockUser, type BlockedUser } from "@/lib/blocks";
import { getUserFacingMessage } from "@/lib/errors";

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [rows, setRows] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setRows(await listBlockedUsers(userId));
    } catch (e) {
      Alert.alert("Could not load blocked users", getUserFacingMessage(e));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleUnblock(row: BlockedUser) {
    if (submittingId) return;
    Alert.alert(`Unblock @${row.username}?`, "Their posts may appear in your feed again.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Unblock",
        onPress: () => {
          void (async () => {
            setSubmittingId(row.id);
            try {
              await unblockUser(row.id);
              setRows((prev) => prev.filter((item) => item.id !== row.id));
            } catch (e) {
              Alert.alert("Could not unblock user", getUserFacingMessage(e));
            } finally {
              setSubmittingId(null);
            }
          })();
        },
      },
    ]);
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Blocked users" onBack={() => router.back()} />
      {loading ? (
        <ActivityIndicator className="mt-16" color="#5f9470" />
      ) : rows.length === 0 ? (
        <Text className="mt-16 px-6 text-center font-sans text-sm text-muted-foreground">
          You have not blocked anyone. Blocked users are removed from your feed immediately and
          reported to Burd moderators for review.
        </Text>
      ) : (
        <ScrollView className="flex-1" contentContainerClassName="px-4 pb-10 pt-2">
          {rows.map((row) => (
            <View
              key={row.id}
              className="mb-3 flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <Avatar
                user={row.username}
                color={row.avatar_color}
                avatarUrl={row.avatar_url}
                size={40}
              />
              <View className="min-w-0 flex-1">
                <Text className="font-sans-medium text-sm text-foreground">
                  @{row.username}
                </Text>
                {row.full_name ? (
                  <Text className="font-sans text-xs text-muted-foreground">{row.full_name}</Text>
                ) : null}
              </View>
              <Pressable
                onPress={() => void handleUnblock(row)}
                disabled={submittingId === row.id}
                className="rounded-lg border border-border px-3 py-2 active:opacity-90"
              >
                <Text className="font-sans-medium text-xs text-foreground">Unblock</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
