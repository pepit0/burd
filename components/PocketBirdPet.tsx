import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState, Pressable, View } from "react-native";
import { useIsFocused } from "expo-router";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import type { PocketBirdAnimationId } from "@/lib/pocketBird/animations";
import { playBirdChirp } from "@/lib/pocketBird/birdsong";
import { resolvePocketBirdDisplaySize } from "@/lib/pocketBird/displaySize";
import { NO_HAT_ID, type PocketBirdHatId } from "@/lib/pocketBird/hats";
import { usePocketBirdAnimation } from "@/lib/pocketBird/usePocketBirdAnimation";
import { usePocketBirdMovement } from "@/lib/pocketBird/usePocketBirdMovement";
import { PocketBirdRenderer } from "@/components/PocketBirdRenderer";

interface PocketBirdPetProps {
  speciesId: string;
  hatId?: PocketBirdHatId;
  size?: number;
  arenaHeight?: number;
  soundEnabled?: boolean;
  interactive?: boolean;
  paused?: boolean;
  /** Keep the bird on the arena floor; hops and flights arc upward from there. */
  grounded?: boolean;
}

export function PocketBirdPet({
  speciesId,
  hatId = NO_HAT_ID,
  size = 160,
  arenaHeight,
  soundEnabled = true,
  interactive = true,
  paused = false,
  grounded = false,
}: PocketBirdPetProps) {
  const { displaySize } = useMemo(
    () => resolvePocketBirdDisplaySize(size),
    [size],
  );
  const isFocused = useIsFocused();
  const [appActive, setAppActive] = useState(
    () => AppState.currentState === "active",
  );
  const [petting, setPetting] = useState(false);
  const [arenaWidth, setArenaWidth] = useState(0);
  const playAreaHeight = arenaHeight ?? displaySize;

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      setAppActive(next === "active");
    });
    return () => sub.remove();
  }, []);

  const effectivelyPaused = paused || !isFocused || !appActive;
  const arenaReady = arenaWidth > 0;

  const { posX, posY, facingScale, moveAnimation, touch } = usePocketBirdMovement(
    { width: arenaWidth, height: playAreaHeight, birdSize: displaySize, grounded },
    effectivelyPaused,
  );

  const animation: PocketBirdAnimationId = petting ? "HEART" : moveAnimation;

  const returnToIdle = useCallback(() => {
    setPetting(false);
  }, []);

  const pixels = usePocketBirdAnimation(
    speciesId,
    animation,
    petting ? returnToIdle : undefined,
    hatId,
    effectivelyPaused && !petting,
  );

  const half = displaySize / 2;
  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute" as const,
    width: displaySize,
    height: displaySize,
    transform: [
      { translateX: posX.value - half },
      { translateY: posY.value - half },
      { scaleX: facingScale.value },
    ],
  }));

  function onPet() {
    if (!interactive || petting || effectivelyPaused) return;
    touch();

    if (soundEnabled) {
      void playBirdChirp().catch((error) => {
        if (__DEV__) {
          console.warn("[PocketBirdPet] chirp playback failed", error);
        }
      });
    }

    setPetting(true);
  }

  const birdVisual = (
    <PocketBirdRenderer pixels={pixels} size={displaySize} />
  );

  return (
    <View
      className="w-full"
      pointerEvents="box-none"
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth !== arenaWidth) {
          setArenaWidth(nextWidth);
        }
      }}
    >
      <View
        style={{
          width: "100%",
          height: playAreaHeight,
          overflow: "hidden",
          opacity: arenaReady ? 1 : 0,
        }}
        pointerEvents="box-none"
      >
        <Animated.View style={animatedStyle} pointerEvents="box-none">
          {interactive ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Pet your bird"
              onPress={onPet}
              style={{ width: displaySize, height: displaySize }}
            >
              {birdVisual}
            </Pressable>
          ) : (
            birdVisual
          )}
        </Animated.View>
      </View>
    </View>
  );
}
