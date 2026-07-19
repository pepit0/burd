import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { getUserFacingMessage } from "@/lib/errors";
import { isAppleSignInAvailable, signInWithApple } from "@/lib/appleAuth";

interface SocialAuthButtonsProps {
  onError?: (message: string) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/** Apple (iOS) + Google (coming soon) under email/password forms. */
export function SocialAuthButtons({
  onError,
  className,
  style,
}: SocialAuthButtonsProps) {
  const [appleLoading, setAppleLoading] = useState(false);
  const showApple = isAppleSignInAvailable() && Platform.OS === "ios";

  return (
    <View className={className} style={style}>
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="font-sans text-xs text-muted-foreground">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      {showApple ? (
        appleLoading ? (
          <View className="mb-3 h-11 items-center justify-center rounded-xl bg-card">
            <ActivityIndicator color="#eee8d4" />
          </View>
        ) : (
          <View className="mb-3">
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={12}
              style={{ width: "100%", height: 44 }}
              onPress={() => {
                if (appleLoading) return;
                void (async () => {
                  setAppleLoading(true);
                  try {
                    const result = await signInWithApple();
                    if (result.cancelled) return;
                  } catch (e) {
                    onError?.(
                      getUserFacingMessage(
                        e,
                        "Could not sign in with Apple. Please try again.",
                      ),
                    );
                  } finally {
                    setAppleLoading(false);
                  }
                })();
              }}
            />
          </View>
        )
      ) : null}

      <Pressable
        accessibilityState={{ disabled: true }}
        className="h-11 flex-row items-center justify-center gap-2 rounded-xl border border-border/60 bg-card/50 opacity-50"
        disabled
      >
        <Text className="font-sans-medium text-base text-muted-foreground">
          Continue with Google
        </Text>
        <Text className="font-sans text-xs text-muted-foreground">
          Coming soon
        </Text>
      </Pressable>
    </View>
  );
}
