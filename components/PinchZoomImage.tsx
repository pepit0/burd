import { useMemo, type ReactNode } from "react";
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import {
  Gesture,
  GestureDetector,
  type GestureType,
} from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  clamp,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const RESET_MS = 180;

/**
 * Temporary pinch-to-zoom around the finger focal point.
 * RN scales around the view center, so we convert the focal point to a
 * center-relative anchor, then translate → scale → translate-back.
 */
function useTemporaryPinchZoom() {
  const scale = useSharedValue(1);
  const anchorX = useSharedValue(0);
  const anchorY = useSharedValue(0);
  const viewW = useSharedValue(0);
  const viewH = useSharedValue(0);

  const onLayout = (event: LayoutChangeEvent) => {
    viewW.value = event.nativeEvent.layout.width;
    viewH.value = event.nativeEvent.layout.height;
  };

  const pinch = useMemo(
    () =>
      Gesture.Pinch()
        .onBegin(() => {
          cancelAnimation(scale);
        })
        .onStart((event) => {
          scale.value = 1;
          // Lock zoom anchor to where the pinch began (center-relative).
          anchorX.value = event.focalX - viewW.value / 2;
          anchorY.value = event.focalY - viewH.value / 2;
        })
        .onUpdate((event) => {
          scale.value = clamp(event.scale, MIN_SCALE, MAX_SCALE);
        })
        .onEnd(() => {
          scale.value = withTiming(1, { duration: RESET_MS });
          anchorX.value = withTiming(0, { duration: RESET_MS });
          anchorY.value = withTiming(0, { duration: RESET_MS });
        }),
    [anchorX, anchorY, scale, viewH, viewW],
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: anchorX.value },
      { translateY: anchorY.value },
      { scale: scale.value },
      { translateX: -anchorX.value },
      { translateY: -anchorY.value },
    ],
  }));

  return { pinch, animatedStyle, onLayout };
}

interface PinchZoomContainerProps {
  children: ReactNode;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  className?: string;
  /** Optional 1-finger taps; Exclusive so pinch (2 fingers) always wins. */
  overlayGesture?: GestureType;
  /** Pinch-to-zoom; disable in scrollable feeds so vertical scroll is not blocked. */
  pinchEnabled?: boolean;
}

function PinchZoomContainer({
  children,
  width = "100%",
  height = "100%",
  style,
  className,
  overlayGesture,
  pinchEnabled = true,
}: PinchZoomContainerProps) {
  const { pinch, animatedStyle, onLayout } = useTemporaryPinchZoom();

  const gesture = useMemo(() => {
    if (!overlayGesture) return pinch;
    // Pinch first: 2-finger zoom fails taps; 1-finger taps still work.
    return Gesture.Exclusive(pinch, overlayGesture);
  }, [overlayGesture, pinch]);

  if (!pinchEnabled && !overlayGesture) {
    return (
      <View
        className={className}
        style={[{ width, height, overflow: "hidden" }, style]}
        collapsable={false}
      >
        {children}
      </View>
    );
  }

  return (
    <View
      className={className}
      style={[{ width, height, overflow: "hidden" }, style]}
      collapsable={false}
    >
      <GestureDetector gesture={gesture}>
        <Animated.View
          onLayout={onLayout}
          style={[StyleSheet.absoluteFillObject, animatedStyle]}
          collapsable={false}
        >
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface PinchZoomViewProps {
  children: ReactNode;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  className?: string;
  overlayGesture?: GestureType;
  pinchEnabled?: boolean;
}

/** Temporary pinch-to-zoom — snaps back when fingers lift. */
export function PinchZoomView(props: PinchZoomViewProps) {
  return <PinchZoomContainer {...props} />;
}

interface PinchZoomImageProps {
  uri: string;
  width?: number | `${number}%`;
  height?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  className?: string;
  contentFit?: ImageContentFit;
  recyclingKey?: string;
  overlayGesture?: GestureType;
  pinchEnabled?: boolean;
}

/** Temporary pinch-to-zoom photo — snaps back when fingers lift. */
export function PinchZoomImage({
  uri,
  contentFit = "cover",
  recyclingKey,
  overlayGesture,
  pinchEnabled = true,
  ...containerProps
}: PinchZoomImageProps) {
  return (
    <PinchZoomContainer
      overlayGesture={overlayGesture}
      pinchEnabled={pinchEnabled}
      {...containerProps}
    >
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        contentFit={contentFit}
        recyclingKey={recyclingKey ?? uri}
      />
    </PinchZoomContainer>
  );
}
