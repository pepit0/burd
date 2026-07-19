import { useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { getUserFacingMessage } from "@/lib/errors";
import { isAppleSignInAvailable, signInWithApple } from "@/lib/appleAuth";

interface AppleSignInButtonProps {
  onError?: (message: string) => void;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

/** Official Apple button — iOS only; renders nothing on Android/web. */
export function AppleSignInButton({
  onError,
  className,
  style,
}: AppleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  if (!isAppleSignInAvailable() || Platform.OS !== "ios") {
    return null;
  }

  return (
    <View className={className} style={style}>
      <View className="mb-3 flex-row items-center gap-3">
        <View className="h-px flex-1 bg-border" />
        <Text className="font-sans text-xs text-muted-foreground">or</Text>
        <View className="h-px flex-1 bg-border" />
      </View>

      {loading ? (
        <View className="h-11 items-center justify-center rounded-xl bg-card">
          <ActivityIndicator color="#eee8d4" />
        </View>
      ) : (
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
            void (async () => {
              setLoading(true);
              try {
                const result = await signInWithApple();
                if (result.cancelled) return;
                // Session change is handled by useAuth + root layout.
              } catch (e) {
                onError?.(
                  getUserFacingMessage(
                    e,
                    "Could not sign in with Apple. Please try again.",
                  ),
                );
              } finally {
                setLoading(false);
              }
            })();
          }}
        />
      )}
    </View>
  );
}
