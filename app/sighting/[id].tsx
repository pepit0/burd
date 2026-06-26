import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Calendar,
  Clock,
  Feather,
  MapPin,
  Sparkles,
  X,
} from "lucide-react-native";
import { RarityBadge } from "@/components/RarityBadge";
import { getSightingById } from "@/lib/sightings";
import { getErrorMessage } from "@/lib/errors";
import { detectionSourceLabel } from "@/lib/fusePredictions";
import {
  formatDetailDate,
  formatDetailTime,
  observedDate,
  resolveSightingAddress,
  resolveSightingCity,
  sightingAddress,
  sightingCity,
} from "@/lib/sightingFormat";
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

export default function SightingDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [sighting, setSighting] = useState<Sighting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

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
        if (!cancelled) setError(getErrorMessage(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

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

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center justify-between border-b border-border px-4 pb-3 pt-2">
        <Pressable onPress={() => router.back()} className="p-1">
          <X size={22} color="#8a9e82" />
        </Pressable>
        <Text className="font-serif-semibold text-lg text-foreground">Sighting</Text>
        <View className="w-7" />
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
        >
          <View className="h-56 bg-muted">
            {sighting.photo_url ? (
              <Image
                source={{ uri: sighting.photo_url }}
                className="h-full w-full"
                resizeMode="cover"
              />
            ) : (
              <View className="h-full w-full items-center justify-center">
                <Feather size={36} color="#3a4e35" />
              </View>
            )}
          </View>

          <View className="gap-5 px-4 pt-5">
            <View>
              <Text className="font-serif-semibold text-2xl text-foreground">
                {sighting.species}
              </Text>
              {sighting.scientific_name ? (
                <Text className="mt-1 font-serif-italic text-sm text-foreground/60">
                  {sighting.scientific_name}
                </Text>
              ) : null}
              <View className="mt-3 flex-row flex-wrap items-center gap-2">
                <RarityBadge rarity={sighting.rarity} />
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

            <View className="gap-4 rounded-2xl border border-border bg-card p-4">
              <DetailRow
                icon={Calendar}
                label="Date"
                value={formatDetailDate(when)}
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
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}
