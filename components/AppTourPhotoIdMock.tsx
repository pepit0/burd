import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Sparkles } from "lucide-react-native";
import { CardUnlockOverlay } from "@/components/CardUnlockProvider";
import {
  buildTourDemoCard,
  TOUR_DEMO_PHOTO,
  tourDemoLiveId,
} from "@/lib/appTourDemo";
import { triggerBadgeUnlockHaptic, triggerCameraShutterHaptic } from "@/lib/haptics";
import { playUnlockTweet } from "@/lib/pocketBird/birdsong";

const PRIMARY = "#5f9470";
const ACCENT = "#c8893a";
const CREAM = "#f0ead6";

type MockStage = "scanning" | "found" | "unlock";

export function AppTourPhotoIdMock({
  onComplete,
  onBack,
}: {
  onComplete: () => void;
  onBack: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<MockStage>("scanning");
  const [canDismissCard, setCanDismissCard] = useState(false);
  const [unlockKey, setUnlockKey] = useState(1);
  const birdOpacity = useRef(new Animated.Value(0)).current;
  const birdScale = useRef(new Animated.Value(1.08)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const demoCard = buildTourDemoCard();
  const liveId = tourDemoLiveId();

  useEffect(() => {
    const appear = setTimeout(() => {
      Animated.parallel([
        Animated.timing(birdOpacity, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(birdScale, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setStage("found");
      });
    }, 1100);
    return () => clearTimeout(appear);
  }, [birdOpacity, birdScale]);

  const capture = () => {
    if (stage !== "found") return;
    void triggerCameraShutterHaptic();
    Animated.sequence([
      Animated.timing(flash, { toValue: 1, duration: 70, useNativeDriver: true }),
      Animated.timing(flash, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (!finished) return;
      setUnlockKey((key) => key + 1);
      setCanDismissCard(false);
      setStage("unlock");
      void triggerBadgeUnlockHaptic();
      void playUnlockTweet().catch(() => undefined);
    });
  };

  const topPad = insets.top + 12;
  const bottomPad = insets.bottom + 28;
  const reticleTop = topPad + 56;
  const reticleBottom = bottomPad + 108;
  const spotted = stage === "found" || stage === "unlock";

  if (stage === "unlock") {
    return (
      <CardUnlockOverlay
        card={demoCard}
        unlockKey={unlockKey}
        canDismiss={canDismissCard}
        tour
        onIntroComplete={() => setCanDismissCard(true)}
        onDone={onComplete}
        onViewCollection={onComplete}
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.viewfinder}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: birdOpacity, transform: [{ scale: birdScale }] },
          ]}
        >
          <Image
            source={TOUR_DEMO_PHOTO}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            contentPosition="top"
          />
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[styles.flash, { opacity: flash }]}
        />
      </View>

      <View
        pointerEvents="none"
        style={[styles.reticle, { top: reticleTop, bottom: reticleBottom }]}
      >
        {(["tl", "tr", "bl", "br"] as const).map((corner) => (
          <View
            key={corner}
            style={[
              styles.corner,
              corner === "tl" && styles.cornerTl,
              corner === "tr" && styles.cornerTr,
              corner === "bl" && styles.cornerBl,
              corner === "br" && styles.cornerBr,
              { borderColor: spotted ? ACCENT : PRIMARY },
            ]}
          />
        ))}
      </View>

      <View style={[styles.topCopy, { top: topPad }]} pointerEvents="box-none">
        {stage === "scanning" ? (
          <View style={styles.scanPill}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={styles.scanLabel}>Hold your phone up</Text>
          </View>
        ) : (
          <View style={styles.liveCard}>
            <Image
              source={TOUR_DEMO_PHOTO}
              style={styles.liveThumb}
              contentFit="cover"
            />
            <View style={styles.liveText}>
              <View style={styles.liveKickerRow}>
                <Sparkles size={12} color={ACCENT} />
                <Text style={styles.liveKicker}>Live ID</Text>
              </View>
              <Text style={styles.liveTitle} numberOfLines={1}>
                {liveId.species}
              </Text>
              <Text style={styles.liveScientific} numberOfLines={1}>
                {liveId.scientificName}
              </Text>
            </View>
            <View style={styles.liveMatch}>
              <Text style={styles.livePct}>{Math.round(liveId.confidence * 100)}%</Text>
              <Text style={styles.liveMatchLabel}>match</Text>
            </View>
          </View>
        )}
        {stage === "found" ? (
          <Text style={styles.hint}>Tap the shutter to save this bird</Text>
        ) : null}
      </View>

      <View style={[styles.bottom, { bottom: bottomPad }]}>
        <Pressable onPress={onBack} style={styles.backHit} accessibilityLabel="Back">
          <Text style={styles.backLabel}>Back</Text>
        </Pressable>
        <Pressable
          onPress={capture}
          disabled={stage !== "found"}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          style={[styles.shutter, stage !== "found" && styles.shutterDisabled]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={styles.backHit} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0a0f08",
  },
  viewfinder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#12180f",
  },
  flash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#ffffff",
  },
  reticle: {
    position: "absolute",
    left: "6%",
    right: "6%",
  },
  corner: {
    position: "absolute",
    width: 36,
    height: 36,
  },
  cornerTl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBr: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  topCopy: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 10,
    alignItems: "center",
    gap: 12,
  },
  scanPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    backgroundColor: "rgba(24, 30, 22, 0.72)",
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  scanLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 13,
    color: CREAM,
  },
  liveCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    backgroundColor: "rgba(10, 15, 8, 0.62)",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  liveThumb: {
    width: 56,
    height: 56,
    borderRadius: 12,
  },
  liveText: {
    flex: 1,
    minWidth: 0,
  },
  liveKickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveKicker: {
    fontFamily: "DMSans_500Medium",
    fontSize: 10,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: ACCENT,
  },
  liveTitle: {
    fontFamily: "Lora_600SemiBold",
    fontSize: 18,
    color: CREAM,
  },
  liveScientific: {
    fontFamily: "Lora_400Regular_Italic",
    fontSize: 12,
    color: PRIMARY,
  },
  liveMatch: {
    alignItems: "flex-end",
  },
  livePct: {
    fontFamily: "JetBrainsMono_500Medium",
    fontSize: 14,
    color: PRIMARY,
  },
  liveMatchLabel: {
    fontFamily: "DMSans_400Regular",
    fontSize: 10,
    color: CREAM,
    opacity: 0.6,
  },
  hint: {
    textAlign: "center",
    fontFamily: "DMSans_400Regular",
    fontSize: 14,
    color: CREAM,
  },
  bottom: {
    position: "absolute",
    left: 24,
    right: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backHit: {
    width: 64,
    alignItems: "center",
  },
  backLabel: {
    fontFamily: "DMSans_500Medium",
    fontSize: 14,
    color: CREAM,
    opacity: 0.8,
  },
  shutter: {
    height: 78,
    width: 78,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 39,
    borderWidth: 4,
    borderColor: PRIMARY,
    backgroundColor: "rgba(24, 30, 22, 0.4)",
  },
  shutterDisabled: {
    opacity: 0.4,
  },
  shutterInner: {
    height: 58,
    width: 58,
    borderRadius: 29,
    backgroundColor: CREAM,
  },
});
