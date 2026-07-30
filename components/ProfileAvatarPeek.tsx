import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  Text,
  View,
} from "react-native";
import { Camera } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const HOLD_THRESHOLD_MS = 180;
const PEEK_SIZE = 256;

interface ProfileAvatarPeekProps {
  avatarUrl?: string | null;
  avatarColor: string;
  displayName: string;
  size?: number;
  editable?: boolean;
  uploading?: boolean;
  disabled?: boolean;
  onPress?: () => void;
}

function AvatarImage({
  avatarUrl,
  avatarColor,
  displayName,
  className,
}: {
  avatarUrl?: string | null;
  avatarColor: string;
  displayName: string;
  className?: string;
}) {
  const initial = displayName.trim().charAt(0).toUpperCase() || "?";

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        className={className ?? "h-full w-full"}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      className={`items-center justify-center ${className ?? "h-full w-full"}`}
      style={{ backgroundColor: avatarColor }}
    >
      <Text className="font-serif-semibold text-2xl text-primary-foreground">{initial}</Text>
    </View>
  );
}

export function ProfileAvatarPeek({
  avatarUrl,
  avatarColor,
  displayName,
  size = 72,
  editable = false,
  uploading = false,
  disabled = false,
  onPress,
}: ProfileAvatarPeekProps) {
  const [peekVisible, setPeekVisible] = useState(false);
  const heldThisGestureRef = useRef(false);
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peekOpacity = useSharedValue(0);

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    peekOpacity.value = withTiming(peekVisible ? 1 : 0, { duration: peekVisible ? 120 : 90 });
  }, [peekVisible, peekOpacity]);

  useEffect(() => clearHoldTimer, [clearHoldTimer]);

  const peekBackdropStyle = useAnimatedStyle(() => ({
    opacity: peekOpacity.value,
  }));

  const peekImageStyle = useAnimatedStyle(() => ({
    opacity: peekOpacity.value,
    transform: [{ scale: 0.92 + peekOpacity.value * 0.08 }],
  }));

  const showPeek = useCallback(() => {
    heldThisGestureRef.current = true;
    setPeekVisible(true);
  }, []);

  const hidePeek = useCallback(() => {
    setPeekVisible(false);
  }, []);

  const handlePressIn = useCallback(() => {
    if (disabled || uploading) return;
    clearHoldTimer();
    heldThisGestureRef.current = false;
    holdTimerRef.current = setTimeout(showPeek, HOLD_THRESHOLD_MS);
  }, [clearHoldTimer, disabled, showPeek, uploading]);

  const handlePressOut = useCallback(() => {
    clearHoldTimer();
    hidePeek();
  }, [clearHoldTimer, hidePeek]);

  const handlePress = useCallback(() => {
    if (disabled || uploading || heldThisGestureRef.current) return;
    onPress?.();
  }, [disabled, onPress, uploading]);

  return (
    <>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress ? handlePress : undefined}
        disabled={disabled || uploading}
        className="relative shrink-0 active:opacity-95"
        style={{ width: size, height: size }}
        accessibilityLabel={editable ? "Profile photo. Tap to change, hold to preview." : "Profile photo. Hold to preview."}
      >
        <View
          className="h-full w-full overflow-hidden rounded-full border-[3px] border-background"
          style={{ backgroundColor: avatarColor }}
        >
          <AvatarImage
            avatarUrl={avatarUrl}
            avatarColor={avatarColor}
            displayName={displayName}
          />
          {uploading ? (
            <View className="absolute inset-0 items-center justify-center bg-black/45">
              <ActivityIndicator color="#f0ead6" />
            </View>
          ) : null}
        </View>
        {editable && !uploading ? (
          <View
            className="absolute -bottom-0.5 -right-0.5 z-10 h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-card shadow-sm"
            style={{ elevation: 4 }}
          >
            <Camera size={13} color="#8a9e82" />
          </View>
        ) : null}
      </Pressable>

      <Modal visible={peekVisible} transparent animationType="none" statusBarTranslucent>
        <View className="flex-1 items-center justify-center" pointerEvents="none">
          <Animated.View
            pointerEvents="none"
            className="absolute inset-0 bg-black/45"
            style={peekBackdropStyle}
          />
          <Animated.View
            pointerEvents="none"
            className="overflow-hidden rounded-full border-[4px] border-background shadow-2xl"
            style={[{ width: PEEK_SIZE, height: PEEK_SIZE }, peekImageStyle]}
          >
            <AvatarImage
              avatarUrl={avatarUrl}
              avatarColor={avatarColor}
              displayName={displayName}
              className="h-full w-full"
            />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
