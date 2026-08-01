import { Linking, Pressable, Text, View } from "react-native";
import { ExternalLink, Volume2 } from "lucide-react-native";
import { AudioPlayer } from "@/components/AudioPlayer";
import {
  getSpeciesCall,
  speciesCallAttribution,
  type SpeciesCallEntry,
} from "@/lib/speciesCalls";

interface SpeciesCallPlayerProps {
  catalogId: string;
  call?: SpeciesCallEntry | null;
  compact?: boolean;
  title?: string;
}

function openSource(url: string | null) {
  if (!url) return;
  void Linking.openURL(url);
}

export function SpeciesCallPlayer({
  catalogId,
  call: callProp,
  compact = false,
  title = "Bird call",
}: SpeciesCallPlayerProps) {
  const call = callProp ?? getSpeciesCall(catalogId);
  if (!call) return null;

  const subtitle = call.callType
    ? `${title} · ${call.callType}`
    : title;

  if (compact) {
    return (
      <View className="gap-2">
        <View className="flex-row items-center gap-2">
          <Volume2 size={14} color="#5f9470" />
          <Text className="font-sans-medium text-xs text-foreground">{subtitle}</Text>
        </View>
        <AudioPlayer uri={call.audioUrl} compact />
      </View>
    );
  }

  return (
    <View className="gap-3 rounded-2xl border border-border bg-card p-4">
      <View className="flex-row items-center gap-2">
        <View className="rounded-full bg-primary/15 p-2">
          <Volume2 size={16} color="#5f9470" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="font-sans-medium text-sm text-foreground">{subtitle}</Text>
          <Text className="mt-0.5 font-sans text-xs text-muted-foreground">
            Reference recording for learning this species
          </Text>
        </View>
      </View>

      <AudioPlayer uri={call.audioUrl} />

      <Pressable
        onPress={() => openSource(call.sourceUrl ?? call.licenseUrl)}
        accessibilityRole="link"
        className="flex-row items-start gap-1.5 active:opacity-80"
      >
        <ExternalLink size={12} color="#8a9e82" style={{ marginTop: 2 }} />
        <Text className="flex-1 font-sans text-[11px] leading-relaxed text-muted-foreground">
          {speciesCallAttribution(call)}
          {call.sourceUrl ? " · Wikimedia Commons" : ""}
        </Text>
      </Pressable>
    </View>
  );
}
