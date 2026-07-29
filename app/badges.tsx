import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { ProfileBadges } from "@/components/ProfileBadges";
import { useAuth } from "@/hooks/useAuth";
import { useMySightings } from "@/hooks/useMySightings";
import { useProfileBadges } from "@/hooks/useProfileBadges";
import { useProfile } from "@/hooks/useProfile";
import { getFriendCounts } from "@/lib/social";
import { getMyProfile, getMySightings } from "@/lib/sightings";
import type { Sighting } from "@/types";

export default function BadgesScreen() {
  const router = useRouter();
  const { userId: paramUserId, username: paramUsername } = useLocalSearchParams<{
    userId?: string;
    username?: string;
  }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const targetUserId = paramUserId ?? currentUserId;
  const isSelf = Boolean(targetUserId && targetUserId === currentUserId);

  const { friends: ownFriends } = useProfile(isSelf ? currentUserId : null);
  const { sightings: ownSightings, loading: ownSightingsLoading } = useMySightings(
    isSelf ? currentUserId : null,
  );

  const [otherSightings, setOtherSightings] = useState<Sighting[]>([]);
  const [otherFriends, setOtherFriends] = useState(0);
  const [otherUsername, setOtherUsername] = useState(paramUsername ?? "");
  const [otherLoading, setOtherLoading] = useState(!isSelf);

  useEffect(() => {
    if (isSelf || !targetUserId) {
      setOtherLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setOtherLoading(true);
      try {
        const [profile, counts, sightings] = await Promise.all([
          getMyProfile(targetUserId),
          getFriendCounts(targetUserId),
          getMySightings(targetUserId, {
            publishedOnly: true,
            viewerUserId: currentUserId,
          }),
        ]);
        if (cancelled) return;
        setOtherUsername(profile?.username ?? paramUsername ?? "Birder");
        setOtherFriends(counts.friends);
        setOtherSightings(sightings.filter((row) => !row.removed_at));
      } finally {
        if (!cancelled) setOtherLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSelf, targetUserId, currentUserId, paramUsername]);

  const sightings = isSelf ? ownSightings : otherSightings;
  const friends = isSelf ? ownFriends : otherFriends;
  const { badges, earnedCount } = useProfileBadges(targetUserId, sightings, friends);

  const title = useMemo(() => {
    if (isSelf) return "Your badges";
    const name = otherUsername || paramUsername;
    return name ? `@${name}'s badges` : "Badges";
  }, [isSelf, otherUsername, paramUsername]);

  const loading = isSelf ? ownSightingsLoading : otherLoading;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-3 pb-2.5 pt-1">
        <Pressable onPress={() => router.back()} className="rounded-full p-2 active:bg-card">
          <ArrowLeft size={22} color="#eee8d4" />
        </Pressable>
        <Text className="font-serif-semibold text-base text-foreground">{title}</Text>
        <View className="w-10" />
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#5f9470" />
        </View>
      ) : (
        <KeyboardScreen contentContainerClassName="px-4 pb-12 pt-4">
          <ProfileBadges badges={badges} earnedCount={earnedCount} />
        </KeyboardScreen>
      )}
    </SafeAreaView>
  );
}
