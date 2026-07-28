import { useMemo, useRef } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Volume2, X } from "lucide-react-native";
import {
  DismissKeyboardArea,
  dismissKeyboardOnScrollDrag,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesImage } from "@/components/SpeciesImage";
import type { ImageOriginRect } from "@/components/SpeciesImageLightbox";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentLocation } from "@/hooks/useCurrentLocation";
import { useMySightings } from "@/hooks/useMySightings";
import { useSpeciesProfile } from "@/hooks/useSpeciesProfile";
import { getSightingsForSpecies } from "@/lib/fieldGuide";
import type { LiveDetection } from "@/lib/liveSoundSession";
import { enrichPrediction } from "@/lib/predictionLabels";
import { lookupRegionalRarity } from "@/lib/rarity";
import {
  getCatalogSpeciesById,
  resolveCatalogSpecies,
  type CatalogSpecies,
} from "@/lib/speciesCatalog";

const WINDOW_HEIGHT = Dimensions.get("window").height;
export const LIVE_SOUND_FIELD_GUIDE_SHEET_HEIGHT = Math.round(WINDOW_HEIGHT * 0.5);

const SUMMARY_MAX_CHARS = 220;
const MAX_FIELD_MARKS = 3;

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const cut = text.slice(0, maxLen);
  const lastSpace = cut.lastIndexOf(" ");
  const trimmed = lastSpace > maxLen * 0.6 ? cut.slice(0, lastSpace) : cut;
  return `${trimmed.trimEnd()}…`;
}

function speciesFromDetection(detection: LiveDetection): CatalogSpecies | undefined {
  if (detection.catalogId) {
    const byId = getCatalogSpeciesById(detection.catalogId);
    if (byId) return byId;
  }
  const enriched = enrichPrediction(detection.prediction);
  return resolveCatalogSpecies(enriched.species, enriched.scientific_name);
}

interface LiveSoundFieldGuideSheetProps {
  detection: LiveDetection;
  onClose: () => void;
  onImagePress?: (originRect: ImageOriginRect) => void;
}

export function LiveSoundFieldGuideSheet({
  detection,
  onClose,
  onImagePress,
}: LiveSoundFieldGuideSheetProps) {
  const router = useRouter();
  const imageAnchorRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading } = useAuth();
  const { coords } = useCurrentLocation();
  const { sightings } = useMySightings(user?.id ?? null);

  const species = useMemo(() => speciesFromDetection(detection), [detection]);

  const {
    profile,
    loading: profileLoading,
    generating: profileGenerating,
    error: profileError,
    fieldGuideLocked,
  } = useSpeciesProfile(species, {
    authLoading,
    userId: user?.id ?? null,
    sightings,
  });

  const userSightings = useMemo(
    () => (species ? getSightingsForSpecies(species, sightings) : []),
    [species, sightings],
  );

  const rarity = useMemo(() => {
    if (!species) return "common" as const;
    const latest = userSightings[0] ?? null;
    const lat = latest?.latitude ?? coords?.latitude ?? null;
    const lng = latest?.longitude ?? coords?.longitude ?? null;
    const observedAt = latest?.observed_at ?? latest?.created_at ?? null;
    return lookupRegionalRarity({
      species: species.species,
      scientificName: species.scientific_name,
      lat,
      lng,
      observedAt,
    });
  }, [species, userSightings, coords]);

  const commonName =
    species?.species ?? enrichPrediction(detection.prediction).species;
  const scientificName =
    species?.scientific_name ??
    enrichPrediction(detection.prediction).scientific_name ??
    null;

  const summaryText = profile?.summary ? truncate(profile.summary, SUMMARY_MAX_CHARS) : null;
  const fieldMarks = profile?.field_marks.slice(0, MAX_FIELD_MARKS) ?? [];

  function handleImagePress() {
    if (!onImagePress) return;
    imageAnchorRef.current?.measureInWindow((x, y, width, height) => {
      onImagePress({ x, y, width, height, borderRadius: 8 });
    });
  }

  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: LIVE_SOUND_FIELD_GUIDE_SHEET_HEIGHT,
        zIndex: 20,
        elevation: 20,
      }}
      className="border-t border-border bg-card shadow-2xl"
    >
      <View className="items-center pt-2">
        <View className="h-1 w-10 rounded-full bg-border" />
      </View>

      <View className="flex-row items-start gap-3 px-4 pb-2 pt-2">
        {onImagePress ? (
          <Pressable
            onPress={handleImagePress}
            className="active:opacity-80"
            hitSlop={4}
            accessibilityLabel={`Enlarge photo of ${commonName}`}
            accessibilityRole="button"
          >
            <View ref={imageAnchorRef} collapsable={false}>
              <SpeciesImage
                catalogId={species?.id ?? detection.catalogId ?? "unknown-bird"}
                scientificName={scientificName ?? commonName}
                className="h-12 w-12 rounded-lg"
                size="medium"
              />
            </View>
          </Pressable>
        ) : (
          <SpeciesImage
            catalogId={species?.id ?? detection.catalogId ?? "unknown-bird"}
            scientificName={scientificName ?? commonName}
            className="h-12 w-12 rounded-lg"
            size="medium"
          />
        )}
        <View className="min-w-0 flex-1">
          <Text className="font-serif-semibold text-base text-foreground" numberOfLines={1}>
            {commonName}
          </Text>
          {scientificName ? (
            <Text className="font-serif-italic text-xs text-muted-foreground" numberOfLines={1}>
              {scientificName}
            </Text>
          ) : null}
          {species ? (
            <View className="mt-1 flex-row items-center gap-2">
              <RarityBadge rarity={rarity} />
              <Text className="font-sans text-[11px] text-muted-foreground">
                {Math.round(detection.peakConfidence * 100)}% match
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          className="rounded-full bg-muted p-2 active:opacity-80"
          accessibilityLabel="Close field guide"
        >
          <X size={18} color="#8a9e82" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-3 px-4 pt-1"
        contentContainerStyle={{ paddingBottom: insets.bottom + 12 }}
        showsVerticalScrollIndicator={false}
        onScrollBeginDrag={dismissKeyboardOnScrollDrag}
        {...keyboardAwareScrollProps}
      >
        <DismissKeyboardArea>
        <View className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-3 py-3">
          <View className="flex-row items-center gap-2">
            <View className="rounded-full bg-primary/15 p-2">
              <Volume2 size={16} color="#5f9470" />
            </View>
            <Text className="font-sans-medium text-sm text-foreground">Compare call</Text>
          </View>
          <Text className="mt-2 font-sans text-xs leading-relaxed text-muted-foreground">
            Reference recordings are coming soon. Play a typical call for this species here
            while Burd listens, to verify the ID.
          </Text>
        </View>

        {!species ? (
          <Text className="font-sans text-sm text-muted-foreground">
            Field guide unavailable for this detection.
          </Text>
        ) : null}

        {profileLoading || profileGenerating ? (
          <View className="items-center py-3">
            <ActivityIndicator color="#5f9470" />
            <Text className="mt-2 font-sans text-xs text-muted-foreground">
              Loading summary…
            </Text>
          </View>
        ) : null}

        {profileError ? (
          <Text className="font-sans text-sm text-muted-foreground">{profileError}</Text>
        ) : null}

        {species && fieldGuideLocked && !profileLoading && !profileGenerating ? (
          <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
            Log a photo sighting to unlock the full field guide for this species.
          </Text>
        ) : null}

        {summaryText ? (
          <Text className="font-sans text-sm leading-relaxed text-foreground/85">
            {summaryText}
          </Text>
        ) : null}

        {profile && !fieldGuideLocked && fieldMarks.length > 0 ? (
          <View className="gap-1.5">
            <Text className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
              Key marks
            </Text>
            {fieldMarks.map((mark) => (
              <View key={mark} className="flex-row gap-2">
                <Text className="font-sans text-sm text-accent">·</Text>
                <Text className="flex-1 font-sans text-sm leading-snug text-foreground/85">
                  {mark}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {species ? (
          <Pressable
            onPress={() => {
              onClose();
              router.push(`/species/${species.id}`);
            }}
            className="flex-row items-center justify-between rounded-xl border border-border px-3 py-2.5 active:opacity-80"
          >
            <Text className="font-sans-medium text-sm text-primary">Full field guide</Text>
            <ChevronRight size={16} color="#5f9470" />
          </Pressable>
        ) : null}

        <Text className="text-center font-sans text-[11px] text-muted-foreground/80">
          Close this panel to stop recording
        </Text>
        </DismissKeyboardArea>
      </ScrollView>
    </View>
  );
}
