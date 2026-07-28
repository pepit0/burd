import { useCallback, useMemo, useRef, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Camera,
  ChevronRight,
  Clock,
  Feather,
  FileImage,
  Filter,
  MapPin,
  Plus,
  Search,
  Trash2,
  Volume2,
  Zap,
  type LucideIcon,
} from "lucide-react-native";
import { FilterSheet } from "@/components/FilterSheet";
import { RarityBadge } from "@/components/RarityBadge";
import { ScrollScreen } from "@/components/ScrollScreen";
import { TabEmptyState } from "@/components/TabEmptyState";
import { AudioPostThumb } from "@/components/AudioPostThumb";
import { useAuth } from "@/hooks/useAuth";
import { useMySightings } from "@/hooks/useMySightings";
import { useResolvedCities } from "@/hooks/useResolvedCities";
import { useCaptureDrafts } from "@/hooks/useCaptureDrafts";
import { getUserFacingMessage } from "@/lib/errors";
import { deleteMySighting } from "@/lib/sightings";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import { setPendingCapture } from "@/lib/pendingCapture";
import {
  applyJournalFilters,
  countActiveJournalFilters,
  DEFAULT_JOURNAL_FILTERS,
  journalCardClassName,
  shouldGroupJournalByDate,
  type JournalFilters,
  type JournalSort,
} from "@/lib/journalFilters";
import {
  formatJournalWhen,
  observedDate,
  sightingCity,
} from "@/lib/sightingFormat";
import { rarityForSighting } from "@/lib/rarity";
import type { Sighting } from "@/types";
import type { CaptureDraft } from "@/lib/captureDrafts";

type JournalMediaTab = "photos" | "sounds" | "drafts";

const STAT_ICONS: Record<string, LucideIcon> = {
  camera: Camera,
  volume: Volume2,
  zap: Zap,
};

const MEDIA_TABS: { id: JournalMediaTab; label: string }[] = [
  { id: "photos", label: "Photos" },
  { id: "sounds", label: "Sounds" },
  { id: "drafts", label: "Drafts" },
];

/** Small list thumbnail — slightly larger so the full photo fits inside the frame. */
const JOURNAL_THUMB_BOX =
  "h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted";

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
  if (tab === "drafts") return false;
  if (tab === "sounds") return isAudioSighting(sighting);
  // Photos tab: photo sightings + manual logs (anything that isn't a sound entry)
  return !isAudioSighting(sighting);
}

export default function JournalScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { sightings, loading, refreshing, error, refresh, silentRefresh } =
    useMySightings(userId);
  const ownedSightings = useMemo(
    () => (userId ? sightings.filter((s) => s.user_id === userId) : []),
    [sightings, userId],
  );
  const {
    drafts,
    loading: draftsLoading,
    refresh: refreshDrafts,
    remove: removeDraft,
  } = useCaptureDrafts();
  const cityFor = useResolvedCities(ownedSightings);
  const [search, setSearch] = useState("");
  const [mediaTab, setMediaTab] = useState<JournalMediaTab>(() =>
    params.tab === "drafts" ? "drafts" : "photos",
  );
  const [journalFilters, setJournalFilters] = useState<JournalFilters>(
    DEFAULT_JOURNAL_FILTERS,
  );
  const [filterOpen, setFilterOpen] = useState(false);
  const activeFilterCount = countActiveJournalFilters(journalFilters);

  useFocusEffect(
    useCallback(() => {
      if (params.tab === "drafts") {
        setMediaTab("drafts");
      }
    }, [params.tab]),
  );

  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      silentRefresh();
      void refreshDrafts();
    }, [silentRefresh, refreshDrafts]),
  );

  const stats = useMemo(
    () => [
      {
        icon: "camera",
        label: "Photos",
        value: ownedSightings.filter((s) => isPhotoSighting(s)).length,
      },
      {
        icon: "volume",
        label: "Sounds",
        value: ownedSightings.filter((s) => isAudioSighting(s)).length,
      },
      { icon: "zap", label: "Logged", value: ownedSightings.length },
    ],
    [ownedSightings],
  );

  const mediaTabCounts = useMemo(
    () => ({
      photos: ownedSightings.filter((s) => matchesMediaTab(s, "photos")).length,
      sounds: ownedSightings.filter((s) => matchesMediaTab(s, "sounds")).length,
      drafts: drafts.length,
    }),
    [ownedSightings, drafts],
  );

  const filteredSightings = useMemo(() => {
    if (mediaTab === "drafts") return [];

    const tabFiltered = ownedSightings.filter(
      (s) => matchesSearch(s, search) && matchesMediaTab(s, mediaTab),
    );

    return applyJournalFilters(tabFiltered, journalFilters);
  }, [ownedSightings, search, mediaTab, journalFilters]);

  const groupByDate = shouldGroupJournalByDate(journalFilters.sort);

  const filteredDrafts = useMemo(() => {
    if (mediaTab !== "drafts") return [];
    const q = search.trim().toLowerCase();
    if (!q) return drafts;
    return drafts.filter((d) =>
      d.photos.some((p) => p.capturedAt.toLowerCase().includes(q) || d.id.includes(q)),
    );
  }, [drafts, mediaTab, search]);

  const groups = useMemo(() => {
    if (!groupByDate) return [];

    const map = new Map<string, Sighting[]>();
    for (const s of filteredSightings) {
      const key = groupLabel(observedDate(s).toISOString());
      const arr = map.get(key);
      if (arr) arr.push(s);
      else map.set(key, [s]);
    }
    return Array.from(map, ([date, entries]) => ({ date, entries }));
  }, [filteredSightings, groupByDate]);

  function openDraft(draft: CaptureDraft) {
    setPendingCapture({
      photos: draft.photos,
      primaryIndex: draft.primaryIndex,
    });
    router.push({
      pathname: "/new-sighting",
      params: {
        source: "image",
        draftId: draft.id,
      },
    });
  }

  function confirmDeleteDraft(draft: CaptureDraft) {
    Alert.alert(
      "Delete draft?",
      "This removes the saved photos from this device.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void removeDraft(draft.id);
          },
        },
      ],
    );
  }

  function confirmDeleteSighting(sighting: Sighting) {
    if (!userId || sighting.user_id !== userId) return;
    Alert.alert(
      "Delete from journal?",
      sighting.published_at
        ? "This permanently deletes the sighting from your journal and profile. This cannot be undone."
        : "This permanently deletes the sighting from your journal. This cannot be undone.",
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
                Alert.alert("Could not delete", getUserFacingMessage(e));
              }
            })();
          },
        },
      ],
    );
  }

  const emptyTabCopy =
    mediaTab === "sounds"
      ? "No sound sightings yet. Use Sound ID or the camera mic to log one."
      : mediaTab === "drafts"
        ? "No drafts yet. Photos saved offline or when ID is slow will show up here."
        : "No photo sightings yet. Tap the + to log your first bird.";

  function renderJournalEntry(e: Sighting) {
    const when = observedDate(e);
    const rarity = rarityForSighting(e);
    return (
      <Pressable
        onPress={() => router.push(`/sighting/${e.id}`)}
        className={`flex-row items-center gap-3 p-4 active:opacity-90 ${journalCardClassName(rarity)}`}
      >
        <View className={JOURNAL_THUMB_BOX}>
          {isPhotoSighting(e) ? (
            <Image
              source={{ uri: e.photo_url! }}
              className="h-full w-full"
              resizeMode="contain"
            />
          ) : isAudioSighting(e) ? (
            <AudioPostThumb size="sm" className="h-full w-full" />
          ) : (
            <Feather size={16} color="#3a4e35" />
          )}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-serif text-sm text-foreground" numberOfLines={1}>
            {e.species}
          </Text>
          {!e.published_at ? (
            <Text className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
              Journal only
            </Text>
          ) : (
            <Text className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-primary/90">
              Posted
            </Text>
          )}
          <View className="mt-1">
            <RarityBadge rarity={rarity} />
          </View>
          <View className="mt-1 flex-row items-center gap-1">
            <MapPin size={9} color="#8a9e82" />
            <Text className="text-[11px] text-muted-foreground" numberOfLines={1}>
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
          className="rounded-full p-2 active:opacity-70"
          accessibilityLabel="Delete sighting"
        >
          <Trash2 size={14} color="#8a9e82" />
        </Pressable>
        <ChevronRight size={13} color="#8a9e82" />
      </Pressable>
    );
  }

  async function onRefresh() {
    if (mediaTab === "drafts") {
      await refreshDrafts();
      return;
    }
    await refresh();
  }

  const toolbar = (
    <View className="gap-3 px-4">
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

      <View className="flex-row items-center gap-2">
        <View className="flex-1 flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Search size={14} color="#8a9e82" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search species, locations..."
            placeholderTextColor="#8a9e82"
            className="flex-1 font-sans text-sm text-foreground"
          />
        </View>
        <Pressable
          onPress={() => setFilterOpen(true)}
          className={`rounded-xl border p-2.5 active:opacity-80 ${
            activeFilterCount > 0
              ? "border-primary bg-primary/15"
              : "border-border bg-card"
          }`}
          accessibilityLabel="Filter and sort journal"
        >
          <Filter
            size={16}
            color={activeFilterCount > 0 ? "#5f9470" : "#8a9e82"}
          />
        </Pressable>
      </View>

      <View className="flex-row items-center justify-start gap-2">
        {MEDIA_TABS.map((tab) => {
          const active = mediaTab === tab.id;
          const count = mediaTabCounts[tab.id];
          const label = count > 0 ? `${tab.label} (${count})` : tab.label;
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
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );

  return (
    <View className="flex-1">
      <ScrollScreen
        title="Journal"
        hideHeaderOnScroll
        toolbar={toolbar}
        contentClassName="pb-36 pt-2 gap-6"
        refreshControl={
          <RefreshControl
            refreshing={mediaTab === "drafts" ? false : refreshing}
            onRefresh={() => void onRefresh()}
            tintColor="#5f9470"
          />
        }
      >
        {mediaTab === "drafts" ? (
          draftsLoading && drafts.length === 0 ? (
            <TabEmptyState loading />
          ) : filteredDrafts.length === 0 ? (
            <TabEmptyState>{emptyTabCopy}</TabEmptyState>
          ) : (
            <View className="gap-2 px-4">
              {filteredDrafts.map((draft) => {
                const primary =
                  draft.photos[draft.primaryIndex] ?? draft.photos[0];
                const when = new Date(draft.updatedAt || draft.createdAt);
                return (
                  <Pressable
                    key={draft.id}
                    onPress={() => openDraft(draft)}
                    className="flex-row items-center gap-3 rounded-2xl bg-card p-4 active:opacity-90"
                  >
                    <View className={JOURNAL_THUMB_BOX}>
                      {primary?.uri ? (
                        <Image
                          source={{ uri: primary.uri }}
                          className="h-full w-full"
                          resizeMode="contain"
                        />
                      ) : (
                        <FileImage size={16} color="#3a4e35" />
                      )}
                    </View>
                    <View className="min-w-0 flex-1">
                      <Text className="font-serif text-sm text-foreground">
                        Needs ID
                      </Text>
                      <Text className="mt-0.5 font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
                        {draft.inProgress ? "In progress" : "Saved offline"}
                      </Text>
                      <View className="mt-0.5 flex-row items-center gap-1">
                        <Clock size={9} color="#8a9e82" />
                        <Text className="text-[10px] text-muted-foreground/80">
                          {formatJournalWhen(when)}
                        </Text>
                      </View>
                      <Text className="mt-0.5 text-[11px] text-muted-foreground">
                        {draft.photos.length} photo
                        {draft.photos.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Pressable
                      onPress={() => confirmDeleteDraft(draft)}
                      hitSlop={8}
                      className="rounded-full p-2 active:bg-card"
                      accessibilityLabel="Delete draft"
                    >
                      <Trash2 size={14} color="#8a9e82" />
                    </Pressable>
                    <ChevronRight size={13} color="#8a9e82" />
                  </Pressable>
                );
              })}
            </View>
          )
        ) : loading && ownedSightings.length === 0 ? (
          <TabEmptyState loading />
        ) : error ? (
          <TabEmptyState>{error}</TabEmptyState>
        ) : ownedSightings.length === 0 ? (
          <TabEmptyState>
            No sightings logged yet. Tap the + to record your first bird.
          </TabEmptyState>
        ) : filteredSightings.length === 0 ? (
          <TabEmptyState>
            {search.trim() || activeFilterCount > 0
              ? "No journal entries match your search or filters."
              : emptyTabCopy}
          </TabEmptyState>
        ) : groupByDate ? (
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
                    {group.entries.map((e) => (
                      <View key={e.id}>{renderJournalEntry(e)}</View>
                    ))}
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="gap-2 px-4">
            {filteredSightings.map((e) => (
              <View key={e.id}>{renderJournalEntry(e)}</View>
            ))}
          </View>
        )}
      </ScrollScreen>

      <FilterSheet
        visible={filterOpen}
        title="Filter journal"
        onClose={() => setFilterOpen(false)}
        onReset={() => setJournalFilters(DEFAULT_JOURNAL_FILTERS)}
        sections={[
          {
            title: "Rarity",
            value: journalFilters.rarity,
            onSelect: (value) =>
              setJournalFilters((prev) => ({
                ...prev,
                rarity: value as JournalFilters["rarity"],
              })),
            options: [
              { value: "all", label: "All" },
              { value: "common", label: "Common" },
              { value: "uncommon", label: "Uncommon" },
              { value: "rare", label: "Rare" },
            ],
          },
          {
            title: "Sort by",
            value: journalFilters.sort,
            onSelect: (value) =>
              setJournalFilters((prev) => ({
                ...prev,
                sort: value as JournalSort,
              })),
            options: [
              { value: "newest", label: "Newest first" },
              { value: "oldest", label: "Oldest first" },
              { value: "rarest", label: "Rarest first" },
              { value: "most_common", label: "Most common first" },
              { value: "species_az", label: "Species A–Z" },
              { value: "species_za", label: "Species Z–A" },
            ],
          },
        ]}
      />

      <Pressable
        onPress={() => router.push("/new-sighting")}
        className="absolute bottom-28 right-5 z-30 h-[52px] w-[52px] items-center justify-center rounded-full bg-primary shadow-lg active:opacity-90"
      >
        <Plus size={20} color="#f0ead6" />
      </Pressable>
    </View>
  );
}
