import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Feather, MapPin } from "lucide-react-native";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";

const COVER =
  "https://images.unsplash.com/photo-1448375240586-882707db888b?w=800&h=200&fit=crop&auto=format";

export default function UserProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;

  const {
    profile,
    followers,
    following,
    sightings,
    followingThem,
    isSelf,
    loading,
    error,
    toggleFollow,
  } = useUserProfile(id ?? null, currentUserId);

  const speciesCount = new Set(sightings.map((s) => s.species.toLowerCase())).size;
  const displayName = profile?.full_name || profile?.username || "Birder";
  const stats = [
    { label: "Sightings", value: sightings.length },
    { label: "Species", value: speciesCount },
    { label: "Followers", value: followers },
    { label: "Following", value: following },
  ];

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="absolute left-3 top-12 z-10">
        <Pressable
          onPress={() => router.back()}
          className="h-9 w-9 items-center justify-center rounded-full bg-background/70"
        >
          <ChevronLeft size={22} color="#eee8d4" />
        </Pressable>
      </View>

      {loading && !profile ? (
        <ActivityIndicator className="mt-20" color="#5f9470" />
      ) : error ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          {error}
        </Text>
      ) : !profile ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          This birder could not be found.
        </Text>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerClassName="pb-12">
          <View className="h-28 bg-muted">
            <Image source={{ uri: COVER }} className="h-full w-full" resizeMode="cover" />
            <LinearGradient
              colors={["transparent", "rgba(24,30,22,0.8)"]}
              className="absolute inset-0"
            />
          </View>

          <View className="-mt-9 px-4">
            <View className="flex-row items-end justify-between">
              <View
                className="mb-3 h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-background"
                style={{ backgroundColor: profile.avatar_color }}
              >
                {profile.avatar_url ? (
                  <Image
                    source={{ uri: profile.avatar_url }}
                    className="h-full w-full"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="h-full w-full items-center justify-center">
                    <Text className="font-serif-semibold text-2xl text-primary-foreground">
                      {displayName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              {!isSelf && (
                <View className="mb-3">
                  <FollowButton following={followingThem} onPress={toggleFollow} size="md" />
                </View>
              )}
            </View>

            <Text className="font-serif-semibold text-xl text-foreground">{displayName}</Text>
            <Text className="mt-0.5 font-mono text-xs text-muted-foreground">
              @{profile.username}
              {profile.location_name ? ` · ${profile.location_name}` : ""}
              {isSelf ? " · This is you" : ""}
            </Text>
            {profile.bio ? (
              <Text className="mt-2.5 font-sans text-sm leading-relaxed text-foreground/70">
                {profile.bio}
              </Text>
            ) : null}

            <View className="mt-4 flex-row gap-2">
              {stats.map((s) => (
                <View
                  key={s.label}
                  className="flex-1 items-center rounded-xl border border-border bg-card p-2.5"
                >
                  <Text className="font-serif-semibold text-lg leading-none text-foreground">
                    {s.value}
                  </Text>
                  <Text className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </Text>
                </View>
              ))}
            </View>

            <View className="mt-6">
              <Text className="mb-3 font-serif-semibold text-base text-foreground">
                Recent Sightings
              </Text>
              {sightings.length === 0 ? (
                <Text className="font-sans text-sm text-muted-foreground">
                  No sightings yet.
                </Text>
              ) : (
                <View className="gap-2">
                  {sightings.slice(0, 8).map((e) => (
                    <View
                      key={e.id}
                      className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <View className="h-10 w-10 items-center justify-center overflow-hidden rounded-lg bg-muted">
                        {e.photo_url ? (
                          <Image
                            source={{ uri: e.photo_url }}
                            className="h-full w-full"
                            resizeMode="cover"
                          />
                        ) : (
                          <Feather size={15} color="#3a4e35" />
                        )}
                      </View>
                      <View className="min-w-0 flex-1">
                        <Text className="font-serif text-sm text-foreground" numberOfLines={1}>
                          {e.species}
                        </Text>
                        <View className="mt-0.5 flex-row items-center gap-1">
                          <MapPin size={9} color="#8a9e82" />
                          <Text
                            className="text-[11px] text-muted-foreground"
                            numberOfLines={1}
                          >
                            {e.location_name ?? "Unknown location"}
                          </Text>
                        </View>
                      </View>
                      <Text className="font-mono text-sm text-accent">×{e.count}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
