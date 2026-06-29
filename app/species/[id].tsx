import { useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronRight, Camera, X } from "lucide-react-native";
import { FieldGuideAttribution } from "@/components/FieldGuideAttribution";
import { KeyboardScreen } from "@/components/KeyboardScreen";
import { RarityBadge } from "@/components/RarityBadge";
import { SpeciesAskGuide } from "@/components/SpeciesAskGuide";
import { SpeciesImage } from "@/components/SpeciesImage";
import { useAuth } from "@/hooks/useAuth";
import { useFieldGuideAuthor } from "@/hooks/useFieldGuideAuthor";
import { useMySightings } from "@/hooks/useMySightings";
import { useSpeciesProfile } from "@/hooks/useSpeciesProfile";
import { getSightingsForSpecies } from "@/lib/fieldGuide";
import { getCatalogSpeciesById } from "@/lib/speciesCatalog";
import { hasDetailedFieldGuide } from "@/lib/speciesProfileLoad";
import { formatDetailDate, observedDate } from "@/lib/sightingFormat";

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <View className="gap-1">
      <Text className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
        {label}
      </Text>
      <Text className="font-sans text-sm leading-relaxed text-foreground/90">
        {value}
      </Text>
    </View>
  );
}

export default function SpeciesDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const { sightings } = useMySightings(user?.id ?? null);

  const species = id ? getCatalogSpeciesById(id) : undefined;
  const {
    profile,
    loading: profileLoading,
    generating: profileGenerating,
    error: profileError,
    fieldGuideLocked,
    hasPhotoSighting,
    generateFieldGuide,
  } = useSpeciesProfile(species, {
    authLoading,
    userId: user?.id ?? null,
    sightings,
  });

  const userSightings = useMemo(
    () => (species ? getSightingsForSpecies(species, sightings) : []),
    [species, sightings],
  );

  const { author, loading: authorLoading } = useFieldGuideAuthor(
    species,
    authLoading,
    userSightings.length + (fieldGuideLocked ? 0 : 1000),
  );

  const latestSighting = userSightings[0] ?? null;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">
          Species
        </Text>
        <View className="w-7" />
      </View>

      {!species ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          Species not found.
        </Text>
      ) : (
        <KeyboardScreen
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-12"
        >
          <View className="h-56 bg-muted">
            <SpeciesImage
              catalogId={species.id}
              scientificName={species.scientific_name}
              size="large"
              className="h-full w-full"
            />
            {userSightings.length > 0 && (
              <View className="absolute right-3 top-3 flex-row items-center gap-1 rounded-full bg-background/80 px-2.5 py-1">
                <Check size={10} color="#5f9470" strokeWidth={2.5} />
                <Text className="font-mono text-[10px] text-primary">
                  in your life list
                </Text>
              </View>
            )}
          </View>

          <View className="gap-5 px-4 pt-5">
            <View>
              <Text className="font-serif-semibold text-2xl text-foreground">
                {species.species}
              </Text>
              <Text className="mt-1 font-serif-italic text-sm text-foreground/60">
                {species.scientific_name}
              </Text>
              <View className="mt-3 flex-row flex-wrap items-center gap-2">
                <RarityBadge rarity={species.rarity} />
                <Text className="font-sans text-xs text-muted-foreground">
                  {profile?.family ?? species.family}
                  {profile?.size ? ` · ${profile.size}` : ""}
                </Text>
              </View>
              {!profileLoading && !profileGenerating ? (
                <View className="mt-2">
                  <FieldGuideAttribution
                    author={author}
                    fieldGuideLocked={fieldGuideLocked}
                    fieldGuidePublished={
                      Boolean(profile && hasDetailedFieldGuide(profile))
                    }
                    loading={authorLoading}
                  />
                </View>
              ) : null}
            </View>

            {profileLoading || profileGenerating ? (
              <View className="items-center py-6">
                <ActivityIndicator color="#5f9470" />
                <Text className="mt-2 font-sans text-xs text-muted-foreground">
                  {profileGenerating
                    ? "Building field guide for everyone…"
                    : "Loading field guide…"}
                </Text>
              </View>
            ) : null}

            {profileError ? (
              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <Text className="font-sans text-sm text-muted-foreground">
                  {profileError}
                </Text>
                {hasPhotoSighting ? (
                  <Pressable
                    onPress={() => void generateFieldGuide()}
                    className="items-center rounded-xl bg-primary py-3 active:opacity-90"
                  >
                    <Text className="font-sans-medium text-sm text-primary-foreground">
                      Try again
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}

            {fieldGuideLocked && !profileLoading && !profileGenerating ? (
              <View className="gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-4">
                <Text className="font-sans-medium text-sm text-foreground">
                  Field guide not written yet
                </Text>
                <Text className="font-sans text-sm leading-relaxed text-muted-foreground">
                  Open the camera, photograph this bird, and log the sighting to
                  unlock habitat, range, diet, and field marks for everyone.
                </Text>
                <Pressable
                  onPress={() => router.push("/camera")}
                  className="flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-90"
                >
                  <Camera size={16} color="#f0ead6" />
                  <Text className="font-sans-medium text-sm text-primary-foreground">
                    Open camera
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {profile?.summary ? (
              <Text className="font-sans text-sm leading-relaxed text-foreground/85">
                {profile.summary}
              </Text>
            ) : null}

            {profile && !fieldGuideLocked && profile.field_marks.length > 0 ? (
              <View className="gap-3 rounded-2xl border border-border bg-card p-4">
                <Text className="font-sans-medium text-sm text-foreground">
                  Field marks
                </Text>
                {profile.field_marks.map((mark) => (
                  <View key={mark} className="flex-row gap-2">
                    <Text className="font-sans text-sm text-accent">·</Text>
                    <Text className="flex-1 font-sans text-sm leading-relaxed text-foreground/85">
                      {mark}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}

            {profile &&
            !fieldGuideLocked &&
            (profile.habitat || profile.range || profile.diet) ? (
              <View className="gap-4 rounded-2xl border border-border bg-card p-4">
                {profile.habitat ? (
                  <InfoBlock label="Habitat" value={profile.habitat} />
                ) : null}
                {profile.range ? (
                  <InfoBlock label="Range" value={profile.range} />
                ) : null}
                {profile.diet ? (
                  <InfoBlock label="Diet" value={profile.diet} />
                ) : null}
              </View>
            ) : null}

            <SpeciesAskGuide
              commonName={species.species}
              scientificName={species.scientific_name}
            />

            {userSightings.length > 0 && latestSighting ? (
              <View className="gap-3 rounded-2xl border border-border/60 bg-card/50 p-4">
                <Text className="font-sans text-xs text-muted-foreground">
                  Your sightings
                </Text>
                <Text className="font-sans text-sm text-foreground/80">
                  Logged {userSightings.length}{" "}
                  {userSightings.length === 1 ? "time" : "times"} · last seen{" "}
                  {formatDetailDate(observedDate(latestSighting))}
                </Text>
                {userSightings.slice(0, 3).map((sighting) => (
                  <Pressable
                    key={sighting.id}
                    onPress={() => router.push(`/sighting/${sighting.id}`)}
                    className="flex-row items-center justify-between rounded-xl border border-border/40 bg-background/40 px-3 py-2.5 active:opacity-80"
                  >
                    <Text className="font-sans text-sm text-foreground/75">
                      {formatDetailDate(observedDate(sighting))}
                      {sighting.location_name
                        ? ` · ${sighting.location_name}`
                        : ""}
                    </Text>
                    <ChevronRight size={14} color="#8a9e82" />
                  </Pressable>
                ))}
                {userSightings.length > 3 ? (
                  <Text className="font-sans text-xs text-muted-foreground/80">
                    +{userSightings.length - 3} more in your journal
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        </KeyboardScreen>
      )}
    </SafeAreaView>
  );
}
