import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { Check, Search } from "lucide-react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesImage } from "@/components/SpeciesImage";
import { useAuth } from "@/hooks/useAuth";
import { useMySightings } from "@/hooks/useMySightings";
import {
  buildSightingIndex,
  countLoggedInCatalog,
  filterCatalog,
  toFieldGuideEntry,
  type FieldGuideEntry,
} from "@/lib/fieldGuide";
import { resetFieldGuideImageLoader } from "@/lib/fieldGuideImageLoader";
import { SPECIES_CATALOG } from "@/lib/speciesCatalog";

/** Species shown on first paint (5 rows × 2 columns). */
const INITIAL_COUNT = 10;
/** Species added each time the user reaches the bottom (3 rows). */
const LOAD_MORE_COUNT = 6;
const ROW_HEIGHT = 200;
const LOAD_COOLDOWN_MS = 500;

interface GuideRow {
  id: string;
  left: FieldGuideEntry;
  right: FieldGuideEntry | null;
}

function entriesToRows(entries: FieldGuideEntry[]): GuideRow[] {
  const rows: GuideRow[] = [];
  for (let i = 0; i < entries.length; i += 2) {
    const left = entries[i];
    const right = entries[i + 1] ?? null;
    rows.push({
      id: right ? `${left.id}-${right.id}` : left.id,
      left,
      right,
    });
  }
  return rows;
}

interface SpeciesCardProps {
  entry: FieldGuideEntry;
  onPress: (id: string) => void;
}

const SpeciesCard = memo(function SpeciesCard({
  entry,
  onPress,
}: SpeciesCardProps) {
  return (
    <Pressable
      onPress={() => onPress(entry.id)}
      style={{ flex: 1 }}
      className="overflow-hidden rounded-2xl border border-border bg-card active:opacity-90"
    >
      <View className="h-28 bg-muted">
        <SpeciesImage
          catalogId={entry.id}
          scientificName={entry.scientific_name}
          gridLoader
          className="h-full w-full"
        />
        {entry.logged && (
          <View className="absolute right-2 top-2 h-5 w-5 items-center justify-center rounded-full bg-primary">
            <Check size={10} color="#f0ead6" strokeWidth={2.5} />
          </View>
        )}
      </View>
      <View className="p-2.5">
        <Text className="font-serif text-sm leading-tight text-foreground">
          {entry.species}
        </Text>
        <Text
          className="mb-1 font-serif-italic text-[10px] text-muted-foreground"
          numberOfLines={1}
        >
          {entry.scientific_name}
        </Text>
        <Text
          className="mb-1.5 font-sans text-[10px] leading-snug text-muted-foreground/80"
          numberOfLines={2}
        >
          {entry.family}
          {entry.habitat ? ` · ${entry.habitat}` : ""}
        </Text>
        <RarityBadge rarity={entry.rarity} />
      </View>
    </Pressable>
  );
});

interface GuideRowViewProps {
  row: GuideRow;
  onPress: (id: string) => void;
}

const GuideRowView = memo(function GuideRowView({
  row,
  onPress,
}: GuideRowViewProps) {
  return (
    <View style={{ height: ROW_HEIGHT, flexDirection: "row", gap: 12, paddingVertical: 6 }}>
      <SpeciesCard entry={row.left} onPress={onPress} />
      {row.right ? (
        <SpeciesCard entry={row.right} onPress={onPress} />
      ) : (
        <View style={{ flex: 1 }} />
      )}
    </View>
  );
});

export default function FieldGuideScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { sightings, loading, refreshing, error, refresh, silentRefresh } =
    useMySightings(userId);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);

  const loadingMore = useRef(false);
  const lastLoadAt = useRef(0);
  const visibleCountRef = useRef(INITIAL_COUNT);
  const filteredLengthRef = useRef(SPECIES_CATALOG.length);

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

  const sightingIndex = useMemo(
    () => buildSightingIndex(sightings),
    [sightings],
  );

  const filteredCatalog = useMemo(
    () => filterCatalog(SPECIES_CATALOG, search),
    [search],
  );

  filteredLengthRef.current = filteredCatalog.length;
  visibleCountRef.current = visibleCount;

  const searchResetReady = useRef(false);

  useEffect(() => {
    if (!searchResetReady.current) {
      searchResetReady.current = true;
      return;
    }

    setVisibleCount(INITIAL_COUNT);
    visibleCountRef.current = INITIAL_COUNT;
    loadingMore.current = false;
    lastLoadAt.current = 0;
    resetFieldGuideImageLoader();
  }, [search]);

  const visibleEntries = useMemo(() => {
    return filteredCatalog
      .slice(0, visibleCount)
      .map((item) => toFieldGuideEntry(item, sightingIndex));
  }, [filteredCatalog, visibleCount, sightingIndex]);

  const rows = useMemo(() => entriesToRows(visibleEntries), [visibleEntries]);
  const hasMore = visibleCount < filteredCatalog.length;

  const loggedCount = useMemo(
    () => countLoggedInCatalog(SPECIES_CATALOG, sightingIndex),
    [sightingIndex],
  );
  const progress = (loggedCount / SPECIES_CATALOG.length) * 100;

  const loadMore = useCallback(() => {
    const total = filteredLengthRef.current;
    if (loadingMore.current || visibleCountRef.current >= total) return;

    const now = Date.now();
    if (now - lastLoadAt.current < LOAD_COOLDOWN_MS) return;

    loadingMore.current = true;
    lastLoadAt.current = now;

    const next = Math.min(
      visibleCountRef.current + LOAD_MORE_COUNT,
      total,
    );
    visibleCountRef.current = next;
    setVisibleCount(next);

    setTimeout(() => {
      loadingMore.current = false;
    }, LOAD_COOLDOWN_MS);
  }, []);

  const tryLoadMoreAtBottom = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } =
        event.nativeEvent;

      if (contentSize.height <= layoutMeasurement.height + 40) return;
      if (contentOffset.y < 16) return;

      const distanceFromBottom =
        contentSize.height - layoutMeasurement.height - contentOffset.y;

      if (distanceFromBottom <= 200) {
        loadMore();
      }
    },
    [loadMore],
  );

  const openSpecies = useCallback(
    (id: string) => {
      router.push(`/species/${id}`);
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item }: { item: GuideRow }) => (
      <GuideRowView row={item} onPress={openSpecies} />
    ),
    [openSpecies],
  );

  const getRowLayout = useCallback(
    (_: ArrayLike<GuideRow> | null | undefined, index: number) => ({
      length: ROW_HEIGHT,
      offset: ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  const listFooter = (
    <View style={{ height: 56, alignItems: "center", justifyContent: "center" }}>
      {hasMore ? <ActivityIndicator color="#5f9470" size="small" /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-background">
      <ScreenHeader title="Field Guide" />

      <View className="gap-3 px-4 pb-3 pt-3">
        <View className="flex-row items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
          <Search size={14} color="#8a9e82" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Find a species..."
            placeholderTextColor="#8a9e82"
            className="flex-1 font-sans text-sm text-foreground"
          />
        </View>

        <View className="rounded-xl border border-border bg-card p-3.5">
          <View className="mb-2.5 flex-row items-center justify-between">
            <Text className="font-sans text-xs text-muted-foreground">
              Lifetime progress
            </Text>
            <Text className="font-mono text-xs text-accent">
              {loggedCount}/{SPECIES_CATALOG.length} species logged
            </Text>
          </View>
          <View className="h-1.5 overflow-hidden rounded-full bg-muted">
            <View
              className="h-full rounded-full bg-primary"
              style={{ width: `${progress}%` }}
            />
          </View>
        </View>
      </View>

      {loading && sightings.length === 0 ? (
        <ActivityIndicator className="mt-16" color="#5f9470" />
      ) : error ? (
        <Text className="mt-16 px-8 text-center font-sans text-sm text-muted-foreground">
          {error}
        </Text>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          getItemLayout={getRowLayout}
          ListFooterComponent={listFooter}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={3}
          windowSize={5}
          onScrollEndDrag={tryLoadMoreAtBottom}
          onMomentumScrollEnd={tryLoadMoreAtBottom}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#5f9470"
            />
          }
          ListEmptyComponent={
            <Text className="mt-16 px-8 text-center font-sans text-sm leading-relaxed text-muted-foreground">
              No species match your search.
            </Text>
          }
        />
      )}
    </SafeAreaView>
  );
}
