import { useCallback, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle } from "react-native-reanimated";

import type { PocketBirdAnimationId } from "@/lib/pocketBird/animations";
import { playBirdChirp } from "@/lib/pocketBird/birdsong";
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
  const [petting, setPetting] = useState(false);
  const [arenaWidth, setArenaWidth] = useState(0);
  const playAreaHeight = arenaHeight ?? size;

  const arenaReady = arenaWidth > 0;

  const { posX, posY, facingScale, moveAnimation, touch } = usePocketBirdMovement(
    { width: arenaWidth, height: playAreaHeight, birdSize: size, grounded },
    paused,
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
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: posX.value - size / 2,
    top: posY.value - size / 2,
    width: size,
    height: size,
    transform: [{ scaleX: facingScale.value }],
  }));

  function onPet() {
    if (!interactive || petting || paused) return;
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

  const layoutProps = {
    className: "w-full" as const,
    onLayout: (event: { nativeEvent: { layout: { width: number } } }) => {
      const nextWidth = event.nativeEvent.layout.width;
      if (nextWidth !== arenaWidth) {
        setArenaWidth(nextWidth);
      }
    },
  };

  const birdVisual = (
    <PocketBirdRenderer pixels={pixels} size={size} />
  );

  const bird = (
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
            style={{ width: size, height: size }}
          >
            {birdVisual}
          </Pressable>
        ) : (
          birdVisual
        )}
      </Animated.View>
    </View>
  );

  return (
    <View {...layoutProps} pointerEvents="box-none">
      {bird}
    </View>
  );
}
