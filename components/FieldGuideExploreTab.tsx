import { memo, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { MapPin } from "lucide-react-native";
import { SpeciesAbundanceChart } from "@/components/SpeciesAbundanceChart";
import { SpeciesImage } from "@/components/SpeciesImage";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useRegionalLocationLabel } from "@/hooks/useRegionalLocationLabel";
import {
  abundanceHeadline,
  listLikelySpeciesNearLocation,
  type LikelySpeciesEntry,
} from "@/lib/speciesAbundance";

const ROW_HEIGHT = 96;

interface ExploreRowProps {
  entry: LikelySpeciesEntry;
  onPress: (id: string) => void;
}

const ExploreRow = memo(function ExploreRow({ entry, onPress }: ExploreRowProps) {
  const currentMonth = new Date().getMonth() + 1;
  const today = entry.monthly.find((month) => month.month === currentMonth);
  const headline = abundanceHeadline(
    today?.frequency ?? entry.frequency,
    today?.expected ?? false,
  );

  return (
    <Pressable
      onPress={() => onPress(entry.id)}
      className="flex-row items-center gap-3 border-b border-border/60 py-3 active:opacity-90"
      style={{ minHeight: ROW_HEIGHT }}
    >
      <View className="w-[88px] shrink-0">
        <View className="h-[68px] overflow-hidden rounded-xl bg-muted">
          <SpeciesImage
            catalogId={entry.id}
            scientificName={entry.scientific_name}
            className="h-full w-full"
            size="medium"
          />
        </View>
        <Text
          className="mt-1.5 text-center font-serif text-[11px] leading-tight text-foreground"
          numberOfLines={2}
        >
          {entry.species}
        </Text>
      </View>

      <View className="min-w-0 flex-1">
        <Text className="mb-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
          {headline} this month
        </Text>
        <SpeciesAbundanceChart
          monthly={entry.monthly}
          currentMonth={currentMonth}
          compact
        />
      </View>
    </Pressable>
  );
});

export function FieldGuideExploreTab() {
  const router = useRouter();
  const { coords, status: locStatus, refresh: refreshLocation } = useCurrentLocation();
  const { label, loading: labelLoading } = useRegionalLocationLabel(coords);

  const likelySpecies = useMemo(() => {
    if (!coords) return [];
    return listLikelySpeciesNearLocation(coords.latitude, coords.longitude);
  }, [coords?.latitude, coords?.longitude]);

  const openSpecies = useCallback(
    (id: string) => {
      router.push(`/species/${id}`);
    },
    [router],
  );

  const renderRow = useCallback(
    ({ item }: { item: LikelySpeciesEntry }) => (
      <ExploreRow entry={item} onPress={openSpecies} />
    ),
    [openSpecies],
  );

  const headerCopy = labelLoading
    ? "Finding your area…"
    : `${likelySpecies.length} Likely birds today near ${label?.display ?? "your area"}`;

  if (locStatus === "loading") {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <ActivityIndicator color="#5f9470" />
        <Text className="mt-3 text-center font-sans text-sm text-muted-foreground">
          Getting your location…
        </Text>
      </View>
    );
  }

  if (locStatus === "denied" || locStatus === "error" || !coords) {
    return (
      <View className="flex-1 items-center justify-center px-8">
        <MapPin size={28} color="#8a9e82" />
        <Text className="mt-4 text-center font-sans text-sm leading-relaxed text-muted-foreground">
          Turn on location to see which birds are likely near you today.
        </Text>
        <Pressable
          onPress={() => void refreshLocation()}
          className="mt-4 rounded-xl bg-primary px-4 py-2.5 active:opacity-90"
        >
          <Text className="font-sans-medium text-sm text-primary-foreground">
            Enable location
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <View className="border-b border-border/60 px-4 py-3">
        <Text className="font-sans-medium text-sm text-foreground">{headerCopy}</Text>
        <Text className="mt-1 font-sans text-xs leading-relaxed text-muted-foreground">
          Bars show how common each species is near you through the year. The
          highlighted month is today.
        </Text>
      </View>

      {likelySpecies.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-sans text-sm leading-relaxed text-muted-foreground">
            No likely species found for your area yet. Regional data may be
            sparse here — try again after more sightings are logged nearby.
          </Text>
        </View>
      ) : (
        <FlatList
          data={likelySpecies}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}
