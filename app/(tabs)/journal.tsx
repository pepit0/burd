import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import {
  Camera,
  ChevronRight,
  Clock,
  Feather,
  MapPin,
  Plus,
  Search,
  Trash2,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AudioPostThumb } from "@/components/AudioPostThumb";
import { useAuth } from "@/hooks/useAuth";
import { useMySightings } from "@/hooks/useMySightings";
import { useResolvedCities } from "@/hooks/useResolvedCities";
import { getErrorMessage } from "@/lib/errors";
import { deleteMySighting } from "@/lib/sightings";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import {
  formatJournalWhen,
  observedDate,
  sightingCity,
} from "@/lib/sightingFormat";
import type { Sighting } from "@/types";

const STAT_ICONS: Record<string, LucideIcon> = {
  feather: Feather,
  camera: Camera,
  zap: Zap,
};

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

export default function JournalScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { sightings, loading, refreshing, error, refresh, silentRefresh } =
    useMySightings(userId);
  const cityFor = useResolvedCities(sightings);
  const [search, setSearch] = useState("");

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      silentRefresh();
    }, [silentRefresh]),
  );

  const filteredSightings = useMemo(
    () => sightings.filter((s) => matchesSearch(s, search)),
    [sightings, search],
  );

  const stats = useMemo(
    () => [
      {
        icon: "feather",
        label: "Species",
        value: new Set(sightings.map((s) => s.species.toLowerCase())).size,
      },
      {
        icon: "camera",
        label: "Photos",
        value: sightings.filter((s) => s.photo_url).length,
      },
      { icon: "zap", label: "Logged", value: sightings.length },
    ],
    [sightings],
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

  function confirmDeleteSighting(sighting: Sighting) {
    if (!userId) return;
    Alert.alert(
      "Delete this sighting?",
      sighting.published_at
        ? "This removes it from your journal and profile."
        : "This removes it from your journal.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await deleteMySighting(userId, sighting.id);
                await refresh();
              } catch (e) {
                Alert.alert("Could not delete", getErrorMessage(e));
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="My Journal" />

      <View className="gap-3 px-4 pb-3 pt-3">
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

        <Pressable
          onPress={() => router.push("/sounds")}
          className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-4 py-3.5 active:opacity-90"
        >
          <View className="h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Volume2 size={18} color="#5f9470" />
          </View>
          <View className="min-w-0 flex-1">
            <Text className="font-sans-medium text-sm text-foreground">
              Sound library
            </Text>
            <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
              Saved recordings from Sound ID and the camera
            </Text>
          </View>
          <ChevronRight size={16} color="#8a9e82" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerClassName="pb-28"
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
        ) : sightings.length === 0 ? (
          <Text className="mt-16 px-8 text-center font-sans text-sm leading-relaxed text-muted-foreground">
            No sightings logged yet. Tap the + to record your first bird.
          </Text>
        ) : filteredSightings.length === 0 ? (
          <Text className="mt-16 px-8 text-center font-sans text-sm leading-relaxed text-muted-foreground">
            No journal entries match your search.
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
                          onPress={() => router.push(`/sighting/${e.id}`)}
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
                            {!e.published_at ? (
                              <Text className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                                Journal only
                              </Text>
                            ) : null}
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
                          <Pressable
                            onPress={() => confirmDeleteSighting(e)}
                            hitSlop={8}
                            className="rounded-full p-2 active:bg-card"
                            accessibilityLabel="Delete sighting"
                          >
                            <Trash2 size={14} color="#8a9e82" />
                          </Pressable>
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

      <Pressable
        onPress={() => router.push("/new-sighting")}
        className="absolute bottom-6 right-5 h-[52px] w-[52px] items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90"
      >
        <Plus size={20} color="#f0ead6" />
      </Pressable>
    </SafeAreaView>
  );
}
