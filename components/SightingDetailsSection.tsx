import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MapPin,
  Sparkles,
} from "lucide-react-native";
import { RarityBadge } from "@/components/RarityBadge";
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

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-start justify-between gap-3 py-1.5">
      <Text className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground/70">
        {label}
      </Text>
      <Text className="max-w-[62%] text-right font-sans text-sm text-foreground">
        {value}
      </Text>
    </View>
  );
}

export function SightingDetailsSection({ sighting }: { sighting: Sighting }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  useEffect(() => {
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

  const when = observedDate(sighting);
  const displayCity = resolvedCity ?? sightingCity(sighting);
  const displayAddress = resolvedAddress ?? sightingAddress(sighting);

  return (
    <View className="border-t border-border">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between px-4 py-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-2">
          <MapPin size={15} color="#c8893a" />
          <Text className="font-sans-medium text-sm text-foreground">
            Sighting details
          </Text>
        </View>
        {open ? (
          <ChevronUp size={18} color="#8a9e82" />
        ) : (
          <ChevronDown size={18} color="#8a9e82" />
        )}
      </Pressable>

      {open ? (
        <View className="gap-3 border-t border-border/60 px-4 pb-4 pt-3">
          <View className="flex-row flex-wrap items-center gap-2">
            <RarityBadge rarity={sighting.rarity} />
            <Text className="font-mono text-xs text-accent">×{sighting.count}</Text>
            {sighting.scientific_name ? (
              <Text className="font-serif-italic text-xs text-foreground/60">
                {sighting.scientific_name}
              </Text>
            ) : null}
          </View>

          {sighting.detected_by !== "manual" && sighting.confidence != null ? (
            <View className="flex-row items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2">
              <Sparkles size={14} color="#5f9470" />
              <Text className="flex-1 font-sans text-xs text-foreground/80">
                {detectionSourceLabel(sighting.detected_by)} ·{" "}
                {Math.round(sighting.confidence * 100)}% match
              </Text>
            </View>
          ) : null}

          <View className="rounded-xl border border-border bg-card px-3 py-2">
            <DetailLine label="Date" value={formatDetailDate(when)} />
            <DetailLine label="Time" value={formatDetailTime(when)} />
            {displayCity ? <DetailLine label="City" value={displayCity} /> : null}
            {displayAddress ? (
              <DetailLine label="Address" value={displayAddress} />
            ) : null}
            {sighting.location_name &&
            sighting.location_name !== displayAddress ? (
              <DetailLine label="Place" value={sighting.location_name} />
            ) : null}
          </View>

          <Pressable
            onPress={() => router.push(`/sighting/${sighting.id}`)}
            className="flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card py-2.5 active:opacity-80"
          >
            <ExternalLink size={14} color="#5f9470" />
            <Text className="font-sans-medium text-sm text-primary">
              Open full sighting record
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
