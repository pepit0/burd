import { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  Text,
  View,
  useWindowDimensions,
  type View as RNView,
} from "react-native";
import { Volume2 } from "lucide-react-native";
import { useAudioPlayback } from "@/hooks/useAudioPlayback";
import { getSpeciesCall, hasSpeciesCall } from "@/lib/speciesCalls";

const UNAVAILABLE_HINT =
  "This bird doesn't have a reference call in our library yet.";
const TOOLTIP_MAX_WIDTH = 240;
const SCREEN_EDGE = 12;

interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SpeciesCallButtonProps {
  catalogId: string;
}

export function SpeciesCallButton({ catalogId }: SpeciesCallButtonProps) {
  const { width: screenWidth } = useWindowDimensions();
  const buttonRef = useRef<RNView>(null);
  const [showHint, setShowHint] = useState(false);
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const available = hasSpeciesCall(catalogId);
  const call = available ? getSpeciesCall(catalogId) : null;
  const playback = useAudioPlayback(available ? call?.audioUrl : null);

  const dismissHint = useCallback(() => {
    setShowHint(false);
    setAnchor(null);
  }, []);

  const showUnavailableHint = useCallback(() => {
    buttonRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setShowHint(true);
    });
  }, []);

  const onPress = useCallback(() => {
    if (!available) {
      if (showHint) {
        dismissHint();
        return;
      }
      showUnavailableHint();
      return;
    }
    void playback.toggle();
  }, [available, dismissHint, playback, showHint, showUnavailableHint]);

  const iconColor = available ? "#5f9470" : "#8a9e8266";

  const tooltipLeft =
    anchor == null
      ? SCREEN_EDGE
      : Math.min(
          Math.max(SCREEN_EDGE, anchor.x + anchor.width / 2 - TOOLTIP_MAX_WIDTH / 2),
          screenWidth - TOOLTIP_MAX_WIDTH - SCREEN_EDGE,
        );

  const tooltipTop = anchor == null ? 0 : anchor.y + anchor.height + 6;

  return (
    <>
      <Pressable
        ref={buttonRef}
        onPress={onPress}
        hitSlop={8}
        disabled={available && playback.loading}
        accessibilityRole="button"
        accessibilityLabel={
          available
            ? playback.playing
              ? "Stop bird call"
              : "Play bird call"
            : "Reference call unavailable"
        }
        accessibilityHint={
          available ? "Plays a reference recording for this species" : UNAVAILABLE_HINT
        }
        className="mt-1 h-9 w-9 shrink-0 items-center justify-center rounded-full active:opacity-80"
        style={{
          backgroundColor: available ? "rgba(95, 148, 112, 0.12)" : "rgba(138, 158, 130, 0.08)",
        }}
      >
        {available && playback.loading ? (
          <ActivityIndicator size="small" color="#5f9470" />
        ) : (
          <Volume2
            size={18}
            color={iconColor}
            fill={available && playback.playing ? iconColor : "transparent"}
          />
        )}
      </Pressable>

      {!available && showHint && anchor ? (
        <Modal visible transparent animationType="fade" onRequestClose={dismissHint}>
          <View className="flex-1">
            <Pressable className="absolute inset-0" onPress={dismissHint} accessible={false} />
            <View
              pointerEvents="box-none"
              style={{
                position: "absolute",
                top: tooltipTop,
                left: tooltipLeft,
                maxWidth: TOOLTIP_MAX_WIDTH,
              }}
            >
              <View className="rounded-xl border border-border bg-card px-3 py-2.5 shadow-lg">
                <Text className="font-sans text-xs leading-relaxed text-foreground">
                  {UNAVAILABLE_HINT}
                </Text>
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}
