import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { buildWanderPath } from "@/lib/colonyBirdWander";
import type { FieldGuideEntry } from "@/lib/fieldGuide";
import { ColonyPixelBird } from "@/components/ColonyPixelBird";

export interface ColonyBounds {
  width: number;
  height: number;
}

interface ColonyBirdSpriteProps {
  entry: FieldGuideEntry;
  index: number;
  bounds: ColonyBounds;
}

const SPRITE_SIZE = 128;
const AREA_INSET = 10;
const WALK_CYCLE_MS = 460;

export function ColonyBirdSprite({ entry, index, bounds }: ColonyBirdSpriteProps) {
  const wander = useMemo(
    () => buildWanderPath(entry.id || entry.scientific_name, bounds, SPRITE_SIZE, AREA_INSET),
    [bounds.height, bounds.width, entry.id, entry.scientific_name],
  );

  const x = useSharedValue(wander.start.x);
  const y = useSharedValue(wander.start.y);
  const walkPhase = useSharedValue(0);
  const scaleX = useSharedValue(wander.segments[0]?.faceRight ? 1 : -1);
  const [legPhase, setLegPhase] = useState(0);
  const [zIndex, setZIndex] = useState(Math.floor(wander.start.y));

  useAnimatedReaction(
    () => Math.floor(walkPhase.value * 4),
    (step, prev) => {
      if (step !== prev) {
        runOnJS(setLegPhase)(step / 4);
      }
    },
  );

  useAnimatedReaction(
    () => Math.floor(y.value),
    (layer, prev) => {
      if (layer !== prev) {
        runOnJS(setZIndex)(layer);
      }
    },
  );

  const bob = useDerivedValue(
    () => Math.sin(walkPhase.value * Math.PI * 2) * 2.5,
  );

  useEffect(() => {
    const delay = (index % 7) * 220;
    x.value = wander.start.x;
    y.value = wander.start.y;

    const xSteps = wander.segments.map((segment) =>
      withTiming(segment.to.x, { duration: segment.duration, easing: Easing.linear }),
    );
    const ySteps = wander.segments.map((segment) =>
      withTiming(segment.to.y, { duration: segment.duration, easing: Easing.linear }),
    );
    const scaleSteps = wander.segments.flatMap((segment) => [
      withTiming(segment.faceRight ? 1 : -1, { duration: 0 }),
      withTiming(segment.faceRight ? 1 : -1, {
        duration: Math.max(segment.duration - 1, 1),
      }),
    ]);

    x.value = withDelay(delay, withRepeat(withSequence(...xSteps), -1, false));
    y.value = withDelay(delay, withRepeat(withSequence(...ySteps), -1, false));
    scaleX.value = withDelay(
      delay,
      withRepeat(withSequence(...scaleSteps), -1, false),
    );
    walkPhase.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, { duration: WALK_CYCLE_MS, easing: Easing.linear }),
        -1,
        false,
      ),
    );
  }, [index, scaleX, wander, walkPhase, x, y]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value + bob.value },
      { scaleX: scaleX.value },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          top: 0,
          left: 0,
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          zIndex,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          width: SPRITE_SIZE,
          height: SPRITE_SIZE,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <ColonyPixelBird
          entry={entry}
          size={SPRITE_SIZE}
          walkPhase={legPhase}
        />
      </View>
    </Animated.View>
  );
}
