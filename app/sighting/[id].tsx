import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Edit3,
  EyeOff,
  Feather,
  MapPin,
  Mic,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react-native";
import { RarityBadge } from "@/components/RarityBadge";
import { PlaybackWaveform } from "@/components/PlaybackWaveform";
import { PinchZoomImage } from "@/components/PinchZoomImage";
import {
  DismissKeyboardArea,
  dismissKeyboardOnScrollDrag,
  keyboardAwareScrollProps,
} from "@/components/DismissKeyboard";
import { useAuth } from "@/hooks/useAuth";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { getLoadErrorMessage, getUserFacingMessage } from "@/lib/errors";
import { deleteMySighting, getSightingById, publishSighting, unpublishSighting } from "@/lib/sightings";
import { detectionSourceLabel } from "@/lib/fusePredictions";
import {
  displayScientificName,
  displaySpeciesName,
} from "@/lib/predictionLabels";
import {
  formatDetailTime,
  formatJournalEntryDate,
  observedDate,
  resolveSightingAddress,
  resolveSightingCity,
  sightingAddress,
  sightingCity,
} from "@/lib/sightingFormat";
import { isAudioSighting, isPhotoSighting } from "@/lib/sightingMedia";
import { rarityForSighting } from "@/lib/rarity";
import type { Sighting } from "@/types";

function DetailRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
}) {
  return (
    <View className="flex-row gap-3">
      <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-lg bg-muted">
        <Icon size={14} color="#c8893a" />
      </View>
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/70">
          {label}
        </Text>
        <Text className="mt-0.5 font-sans text-sm leading-relaxed text-foreground">
          {value}
        </Text>
      </View>
    </View>
  );
}

const SIGHTING_PHOTO_WIDTH = Dimensions.get("window").width;
const SIGHTING_PHOTO_HEIGHT = SIGHTING_PHOTO_WIDTH * (3 / 4);

export default function SightingDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [unpublishing, setUnpublishing] = useState(false);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const audioPlayback = useAudioPlayback(sighting?.audio_url ?? null);
  const rarity = useMemo(
    () => (sighting ? rarityForSighting(sighting) : "common"),
    [sighting],
  );

  useEffect(() => {
    if (!id) {
      setError("Missing sighting.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const row = await getSightingById(id);
        if (!cancelled) {
          setSighting(row);
          if (!row) setError("Sighting not found.");
        }
      } catch (e) {
        if (!cancelled) setError(getLoadErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      if (!id || loading) return;

      let cancelled = false;
      void getSightingById(id).then((row) => {
        if (!cancelled && row) setSighting(row);
      });

      return () => {
        cancelled = true;
      };
    }, [id, loading]),
  );

  useEffect(() => {
    if (!sighting) return;

    let cancelled = false;
    (async () => {
      const [city, address] = await Promise.all([
        resolveSightingCity(sighting),
        resolveSightingAddress(sighting),
      ]);
      if (!cancelled) {
        setResolvedCity(city);
        setResolvedAddress(address);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [sighting]);

  const when = sighting ? observedDate(sighting) : null;
  const displayCity = resolvedCity ?? (sighting ? sightingCity(sighting) : "");
  const displayAddress =
    resolvedAddress ?? (sighting ? sightingAddress(sighting) : null);

  const isOwner = Boolean(userId && sighting && sighting.user_id === userId);
  const isJournalOnly = Boolean(sighting && !sighting.published_at);
  const isPosted = Boolean(sighting?.published_at);

  useEffect(() => {
    if (loading || !sighting) return;
    if (userId && sighting.user_id === userId) return;
    router.replace(`/post/${sighting.id}`);
  }, [loading, router, sighting, userId]);

  async function handlePublish() {
    if (!userId || !sighting || sighting.published_at) return;

    setPublishing(true);
    try {
      await publishSighting(userId, sighting.id);
      setSighting({ ...sighting, published_at: new Date().toISOString() });
      Alert.alert(
        "Posted to profile",
        "This sighting is now visible on your profile and in the feed.",
        [
          { text: "View post", onPress: () => router.push(`/post/${sighting.id}`) },
          { text: "OK", style: "cancel" },
        ],
      );
    } catch (e) {
      Alert.alert("Could not post", getUserFacingMessage(e));
    } finally {
      setPublishing(false);
    }
  }

  async function handleUnpublish() {
    if (!userId || !sighting || !sighting.published_at) return;

    Alert.alert(
      "Remove from profile?",
      "This takes the post off your profile and the public feed. It stays in your journal so you can post it again later.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            void (async () => {
              setUnpublishing(true);
              try {
                await unpublishSighting(userId, sighting.id);
                setSighting({ ...sighting, published_at: null });
              } catch (e) {
                Alert.alert("Could not remove post", getUserFacingMessage(e));
              } finally {
                setUnpublishing(false);
              }
            })();
          },
        },
      ],
    );
  }

  function handleDelete() {
    if (!userId || !sighting) return;
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
                router.back();
              } catch (e) {
                Alert.alert("Could not delete", getUserFacingMessage(e));
              }
            })();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">Sighting</Text>
        {isOwner ? (
          <Pressable
            onPress={() => router.push(`/edit-journal-sighting/${id}` as never)}
            className="rounded-full p-1.5 active:bg-card"
            accessibilityLabel="Edit journal entry"
          >
            <Edit3 size={18} color="#5f9470" />
          </Pressable>
        ) : (
          <View className="w-7" />
        )}
      </View>

      {loading ? (
        <ActivityIndicator className="mt-20" color="#5f9470" />
      ) : error || !sighting || !when ? (
        <Text className="mt-20 px-8 text-center font-sans text-sm text-muted-foreground">
          {error ?? "Sighting not found."}
        </Text>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerClassName="pb-12"
          onScrollBeginDrag={dismissKeyboardOnScrollDrag}
          {...keyboardAwareScrollProps}
        >
          <DismissKeyboardArea>
          {isPhotoSighting(sighting) ? (
            <View className="overflow-hidden bg-muted/40">
              <PinchZoomImage
                uri={sighting.photo_url!}
                width={SIGHTING_PHOTO_WIDTH}
                height={SIGHTING_PHOTO_HEIGHT}
                contentFit="contain"
              />
            </View>
          ) : isAudioSighting(sighting) ? (
            <View className="h-56 bg-muted">
              <PlaybackWaveform
                playback={audioPlayback}
                className="h-full w-full"
                variant="hero"
                interactive
              />
            </View>
          ) : (
            <View className="aspect-[4/3] items-center justify-center bg-muted">
              <Feather size={36} color="#3a4e35" />
            </View>
          )}

          {(() => {
            const heard = sighting.audio_predictions ?? [];
            const loggedKey = (
              sighting.scientific_name?.trim().toLowerCase() ||
              sighting.species.trim().toLowerCase()
            );
            const displayList =
              heard.length > 1
                ? heard
                : heard.filter((prediction) => {
                    const key =
                      prediction.scientific_name?.trim().toLowerCase() ||
                      prediction.species.trim().toLowerCase();
                    return key !== loggedKey;
                  });
            if (displayList.length === 0) return null;

            return (
              <View className="gap-2 border-b border-border px-4 py-3">
                <Text className="font-sans-medium text-sm text-foreground">
                  {displayList.length > 1
                    ? "Species heard in this clip"
                    : "Also heard in this clip"}
                </Text>
                {displayList.map((prediction, index) => (
                  <View
                    key={`${prediction.species}-${index}`}
                    className="flex-row items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
                  >
                    <Mic size={14} color="#5f9470" />
                    <View className="min-w-0 flex-1">
                      <Text className="font-serif text-sm text-foreground">
                        {displaySpeciesName(prediction)}
                      </Text>
                      {displayScientificName(prediction) ? (
                        <Text className="font-serif-italic text-xs text-muted-foreground">
                          {displayScientificName(prediction)}
                        </Text>
                      ) : null}
                    </View>
                    <Text className="font-mono text-[10px] text-muted-foreground">
                      {Math.round(prediction.confidence * 100)}%
                    </Text>
                  </View>
                ))}
              </View>
            );
          })()}

          <View className="gap-5 px-4 pt-5">
            <View>
              <Text className="font-serif-semibold text-2xl text-foreground">
                {displaySpeciesName({
                  species: sighting.species,
                  scientific_name: sighting.scientific_name,
                  confidence: sighting.confidence ?? 0,
                })}
              </Text>
              {sighting.scientific_name ? (
                <Text className="mt-1 font-serif-italic text-sm text-foreground/60">
                  {sighting.scientific_name}
                </Text>
              ) : null}
              <View className="mt-3 flex-row flex-wrap items-center gap-2">
                <RarityBadge rarity={rarity} />
                <Text className="font-mono text-sm text-accent">×{sighting.count}</Text>
              </View>
            </View>

            {sighting.detected_by !== "manual" && sighting.confidence != null ? (
              <View className="flex-row items-center gap-2 rounded-xl border border-primary/40 bg-primary/10 px-3 py-2.5">
                <Sparkles size={15} color="#5f9470" />
                <Text className="flex-1 font-sans text-xs text-foreground/80">
                  Identified by {detectionSourceLabel(sighting.detected_by)} ·{" "}
                  {Math.round(sighting.confidence * 100)}% match
                </Text>
              </View>
            ) : null}

            {isJournalOnly && isOwner ? (
              <View className="gap-3 rounded-xl border border-border bg-card p-4">
                <Text className="font-sans-medium text-sm text-foreground">
                  Journal only
                </Text>
                <Text className="font-sans text-xs leading-relaxed text-muted-foreground">
                  This sighting is private in your journal. Edit it anytime, or share it when you
                  are ready for it to appear on your profile.
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => router.push(`/edit-journal-sighting/${id}` as never)}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 active:opacity-90"
                  >
                    <Edit3 size={16} color="#5f9470" />
                    <Text className="font-sans-medium text-sm text-foreground">Edit entry</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => void handlePublish()}
                    disabled={publishing}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary py-3 active:opacity-90 disabled:opacity-60"
                  >
                    {publishing ? (
                      <ActivityIndicator color="#f0ead6" size="small" />
                    ) : (
                      <Share2 size={16} color="#f0ead6" />
                    )}
                    <Text className="font-sans-medium text-sm text-primary-foreground">
                      Post to profile
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {isPosted && isOwner ? (
              <View className="gap-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                <Text className="font-sans-medium text-sm text-foreground">Posted to profile</Text>
                <Text className="font-sans text-xs leading-relaxed text-muted-foreground">
                  This sighting is on your profile and in your journal. Edit the journal entry anytime
                  — changes appear on your public post. Remove from profile to hide it from the feed
                  without deleting your journal record.
                </Text>
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => router.push(`/edit-journal-sighting/${id}` as never)}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 active:opacity-90"
                  >
                    <Edit3 size={16} color="#5f9470" />
                    <Text className="font-sans-medium text-sm text-foreground">Edit entry</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => router.push(`/post/${sighting.id}`)}
                    className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-3 active:opacity-90"
                  >
                    <Share2 size={16} color="#5f9470" />
                    <Text className="font-sans-medium text-sm text-primary">View post</Text>
                  </Pressable>
                </View>
                <Pressable
                  onPress={() => void handleUnpublish()}
                  disabled={unpublishing}
                  className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-background py-3 active:opacity-90 disabled:opacity-60"
                >
                  {unpublishing ? (
                    <ActivityIndicator color="#5f9470" size="small" />
                  ) : (
                    <EyeOff size={16} color="#8a9e82" />
                  )}
                  <Text className="font-sans-medium text-sm text-foreground">
                    Remove from profile
                  </Text>
                </Pressable>
              </View>
            ) : null}

            <View className="gap-4 rounded-2xl border border-border bg-card p-4">
              <DetailRow
                icon={Calendar}
                label="Date"
                value={formatJournalEntryDate(when)}
              />
              <DetailRow icon={Clock} label="Time" value={formatDetailTime(when)} />
              <DetailRow icon={MapPin} label="City" value={displayCity} />
              {displayAddress ? (
                <DetailRow
                  icon={MapPin}
                  label="Address"
                  value={displayAddress}
                />
              ) : null}
              {sighting.location_name &&
              sighting.location_name !== displayAddress ? (
                <DetailRow
                  icon={MapPin}
                  label="Place"
                  value={sighting.location_name}
                />
              ) : null}
              {sighting.latitude != null && sighting.longitude != null ? (
                <DetailRow
                  icon={MapPin}
                  label="Coordinates"
                  value={`${sighting.latitude.toFixed(5)}, ${sighting.longitude.toFixed(5)}`}
                />
              ) : null}
            </View>

            {sighting.notes ? (
              <View>
                <Text className="mb-1.5 font-sans-medium text-sm text-foreground/80">
                  Notes
                </Text>
                <Text className="rounded-xl border border-border bg-card px-4 py-3 font-sans text-sm leading-relaxed text-foreground/85">
                  {sighting.notes}
                </Text>
              </View>
            ) : null}

            {isOwner ? (
              <Pressable
                onPress={handleDelete}
                className="flex-row items-center justify-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 py-3 active:opacity-90"
              >
                <Trash2 size={16} color="#f87171" />
                <Text className="font-sans-medium text-sm text-foreground">Delete from journal</Text>
              </Pressable>
            ) : null}
          </View>
          </DismissKeyboardArea>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
