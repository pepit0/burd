import { useCallback } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, Bell } from "lucide-react-native";
import { ActivityRow } from "@/components/ActivityRow";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { useAuth } from "@/hooks/useAuth";
import { useNotificationBadge } from "@/hooks/useNotificationBadge";
import { useNotificationInbox } from "@/hooks/useNotificationInbox";
import type { ActivityItem } from "@/types";

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { refresh: refreshBadge } = useNotificationBadge();

  const {
    notifications,
    loading,
    refreshing,
    error,
    refresh,
    markRead,
    markAllRead,
    clearOne,
    clearAll,
  } = useNotificationInbox(userId);

  useFocusEffect(
    useCallback(() => {
      refresh();
      refreshBadge();
    }, [refresh, refreshBadge]),
  );

  async function handleOpen(event: ActivityItem) {
    if (!event.read_at) {
      await markRead(event.id);
      refreshBadge();
    }
  }

  async function handleClear(event: ActivityItem) {
    await clearOne(event.id);
    refreshBadge();
  }

  async function handleClearAll() {
    await clearAll();
    refreshBadge();
  }

  async function handleMarkAllRead() {
    await markAllRead();
    refreshBadge();
  }

  const hasUnread = notifications.some((n) => !n.read_at);

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-3 pb-3 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <ArrowLeft size={22} color="#eee8d4" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">Notifications</Text>
        <View className="w-10" />
      </View>

      {notifications.length > 0 ? (
        <View className="flex-row items-center justify-end gap-3 border-b border-border/60 px-4 py-2">
          {hasUnread ? (
            <Pressable onPress={() => void handleMarkAllRead()} className="active:opacity-70">
              <Text className="font-sans-medium text-xs text-accent">Mark all read</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => void handleClearAll()} className="active:opacity-70">
            <Text className="font-sans-medium text-xs text-muted-foreground">Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      <KeyboardScreen
        className="flex-1"
        contentContainerClassName="px-4 pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#5f9470" />
        }
      >
        {loading && notifications.length === 0 ? (
          <ActivityIndicator className="mt-16" color="#5f9470" />
        ) : error ? (
          <Text className="mt-16 text-center font-sans text-sm text-muted-foreground">
            {error}
          </Text>
        ) : notifications.length === 0 ? (
          <View className="items-center px-8 pt-20">
            <Bell size={28} color="#8a9e82" />
            <Text className="mt-4 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              No notifications yet. Likes, follows, and comments will show up here.
            </Text>
          </View>
        ) : (
          notifications.map((event) => (
            <ActivityRow
              key={event.id}
              event={event}
              showClear
              onOpen={(item) => void handleOpen(item)}
              onClear={(item) => void handleClear(item)}
            />
          ))
        )}
      </KeyboardScreen>
    </SafeAreaView>
  );
}
