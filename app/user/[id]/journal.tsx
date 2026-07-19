import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Clock,
  Feather,
  MapPin,
  Search,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { AudioPostThumb } from "@/components/AudioPostThumb";
import { useAuth } from "@/hooks/useAuth";
import { useMySightings } from "@/hooks/useMySightings";
import { useResolvedCities } from "@/hooks/useResolvedCities";
import { useUserProfile } from "@/hooks/useUserProfile";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import {
  formatJournalWhen,
  observedDate,
  sightingCity,
} from "@/lib/sightingFormat";
import type { Sighting } from "@/types";

type JournalMediaTab = "photos" | "sounds";

const STAT_ICONS: Record<string, LucideIcon> = {
  camera: Camera,
  volume: Volume2,
  zap: Zap,
};

const MEDIA_TABS: { id: JournalMediaTab; label: string }[] = [
  { id: "photos", label: "Photos" },
  { id: "sounds", label: "Sounds" },
];

function groupLabel(dateString: string): string {
  const d = new Date(dateString);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return "Today";
  if (sameDay(d, yesterday)) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function matchesSearch(sighting: Sighting, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return (
    sighting.species.toLowerCase().includes(q) ||
    (sighting.scientific_name ?? "").toLowerCase().includes(q) ||
    (sighting.location_name ?? "").toLowerCase().includes(q) ||
    (sighting.location_city ?? "").toLowerCase().includes(q) ||
    (sighting.location_address ?? "").toLowerCase().includes(q) ||
    sightingCity(sighting).toLowerCase().includes(q)
  );
}

function matchesMediaTab(sighting: Sighting, tab: JournalMediaTab): boolean {
  if (tab === "sounds") return isAudioSighting(sighting);
  return !isAudioSighting(sighting);
}

export default function UserJournalScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const currentUserId = user?.id ?? null;
  const targetId = id ?? null;

  const { profile } = useUserProfile(targetId, currentUserId);
  const { sightings, loading, refreshing, error, refresh } = useMySightings(targetId);
  const cityFor = useResolvedCities(sightings);
  const [search, setSearch] = useState("");
  const [mediaTab, setMediaTab] = useState<JournalMediaTab>("photos");

  const stats = useMemo(
    () => [
      {
        icon: "camera",
        label: "Photos",
        value: sightings.filter((s) => isPhotoSighting(s)).length,
      },
      {
        icon: "volume",
        label: "Sounds",
        value: sightings.filter((s) => isAudioSighting(s)).length,
      },
      { icon: "zap", label: "Logged", value: sightings.length },
    ],
    [sightings],
  );

  const filteredSightings = useMemo(
    () =>
      sightings.filter(
        (s) => matchesSearch(s, search) && matchesMediaTab(s, mediaTab),
      ),
    [sightings, search, mediaTab],
  );

  const groups = useMemo(() => {
    const map = new Map<string, Sighting[]>();
    for (const s of filteredSightings) {
      const key = groupLabel(observedDate(s).toISOString());
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return Array.from(map, ([date, entries]) => ({ date, entries }));
  }, [filteredSightings]);

  const title = profile?.username ? `@${profile.username}'s Journal` : "Journal";

  const emptyCopy = (() => {
    if (search.trim()) return "No journal entries match your search.";
    if (sightings.length === 0) {
      return profile?.username
        ? `@${profile.username} has not logged any sightings yet.`
        : "No sightings logged yet.";
    }
    if (mediaTab === "sounds") {
      return profile?.username
        ? `@${profile.username} has no sound sightings yet.`
        : "No sound sightings yet.";
    }
    return profile?.username
      ? `@${profile.username} has no photo sightings yet.`
      : "No photo sightings yet.";
  })();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <View className="flex-row items-center gap-2 border-b border-border px-3 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <ChevronLeft size={22} color="#8a9e82" />
        </Pressable>
        <Text className="flex-1 font-serif-semibold text-lg text-foreground" numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View className="gap-3 px-4 pb-3 pt-3">
        <View className="flex-row gap-3">
          {stats.map((stat) => {
            const Icon = STAT_ICONS[stat.icon];
            return (
              <View
                key={stat.label}
                className="flex-1 items-center rounded-xl border border-border bg-card p-3"
              >
                <Icon size={15} color="#c8893a" />
                <Text className="mt-1.5 font-serif-semibold text-2xl leading-none text-foreground">
                  {stat.value}
                </Text>
                <Text className="mt-1 text-[9px] uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </Text>
              </View>
            );
          })}
        </View>

        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Search size={14} color="#8a9e82" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search species, locations..."
            placeholderTextColor="#8a9e82"
            className="flex-1 font-sans text-sm text-foreground"
          />
        </View>

        <View className="flex-row items-center justify-start gap-2">
          {MEDIA_TABS.map((tab) => {
            const active = mediaTab === tab.id;
            return (
              <Pressable
                key={tab.id}
                onPress={() => setMediaTab(tab.id)}
                className={`rounded-full px-3 py-1 ${
                  active ? "bg-primary" : "border border-border bg-card"
                }`}
              >
                <Text
                  className={`text-xs ${
                    active
                      ? "font-sans-medium text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {tab.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-12"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#5f9470" />
        }
      >
        {loading && sightings.length === 0 ? (
          <ActivityIndicator className="mt-16" color="#5f9470" />
        ) : error ? (
          <Text className="mt-16 px-8 text-center font-sans text-sm text-muted-foreground">
            {error}
          </Text>
        ) : sightings.length === 0 || filteredSightings.length === 0 ? (
          <Text className="mt-16 px-8 text-center font-sans text-sm leading-relaxed text-muted-foreground">
            {emptyCopy}
          </Text>
        ) : (
          <View className="gap-6 px-4">
            {groups.map((group) => {
              const total = group.entries.reduce((n, e) => n + e.count, 0);
              return (
                <View key={group.date}>
                  <View className="mb-3 flex-row items-center gap-3">
                    <Text className="font-mono text-[10px] uppercase tracking-widest text-accent">
                      {group.date}
                    </Text>
                    <View className="h-px flex-1 bg-border" />
                    <Text className="font-mono text-[10px] text-muted-foreground/40">
                      {total} birds
                    </Text>
                  </View>

                  <View className="gap-2">
                    {group.entries.map((e) => {
                      const when = observedDate(e);
                      return (
                        <Pressable
                          key={e.id}
                          onPress={() => router.push(`/post/${e.id}`)}
                          className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3 active:opacity-90"
                        >
                          <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-lg bg-muted">
                            {isPhotoSighting(e) ? (
                              <Image
                                source={{ uri: e.photo_url! }}
                                className="h-full w-full"
                                resizeMode="cover"
                              />
                            ) : isAudioSighting(e) ? (
                              <AudioPostThumb size="sm" className="h-full w-full" />
                            ) : (
                              <Feather size={16} color="#3a4e35" />
                            )}
                          </View>
                          <View className="min-w-0 flex-1">
                            <Text
                              className="font-serif text-sm text-foreground"
                              numberOfLines={1}
                            >
                              {e.species}
                            </Text>
                            <View className="mt-0.5 flex-row items-center gap-1">
                              <MapPin size={9} color="#8a9e82" />
                              <Text
                                className="text-[11px] text-muted-foreground"
                                numberOfLines={1}
                              >
                                {cityFor(e)}
                              </Text>
                            </View>
                            <View className="mt-0.5 flex-row items-center gap-1">
                              <Clock size={9} color="#8a9e82" />
                              <Text className="text-[10px] text-muted-foreground/80">
                                {formatJournalWhen(when)}
                              </Text>
                            </View>
                          </View>
                          <View className="items-end">
                            <Text className="font-mono text-sm text-accent">×{e.count}</Text>
                            <Text className="mt-0.5 text-[9px] uppercase tracking-wider text-muted-foreground/50">
                              birds
                            </Text>
                          </View>
                          <ChevronRight size={13} color="#8a9e82" />
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
