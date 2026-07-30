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
import { GoogleLogo } from "@/components/GoogleLogo";
import { getUserFacingMessage } from "@/lib/errors";
import { isAppleSignInAvailable, signInWithApple } from "@/lib/appleAuth";
import { signInWithGoogle } from "@/lib/googleAuth";

const SOCIAL_BUTTON_HEIGHT = 44;
const SOCIAL_BUTTON_RADIUS = 12;

interface SocialAuthButtonsProps {
  onError?: (message: string) => void;
  /** When true, social sign-in is blocked (e.g. pending signup consent). */
  disabled?: boolean;
  /** When true, record Terms/Privacy + age consent on the auth user after OAuth. */
  recordConsent?: boolean;
  /** Show an "or" divider below the social buttons. */
  showDivider?: boolean;
  className?: string;
  style?: StyleProp<ViewStyle>;
}

function SocialButtonLoading({ className }: { className?: string }) {
  return (
    <View
      className={`items-center justify-center rounded-xl bg-white ${className ?? ""}`}
      style={{ height: SOCIAL_BUTTON_HEIGHT, borderRadius: SOCIAL_BUTTON_RADIUS }}
    >
      <ActivityIndicator color="#5f9470" />
    </View>
  );
}

/** Apple (iOS) + Google on login / sign-up screens. */
export function SocialAuthButtons({
  onError,
  disabled = false,
  recordConsent = false,
  showDivider = false,
  className,
  style,
}: SocialAuthButtonsProps) {
  const [appleLoading, setAppleLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const showApple = isAppleSignInAvailable() && Platform.OS === "ios";

  return (
    <View className={className} style={style}>
      {showApple ? (
        appleLoading ? (
          <SocialButtonLoading className="mb-3" />
        ) : (
          <View
            className={`mb-3 ${disabled ? "opacity-40" : ""}`}
            pointerEvents={disabled ? "none" : "auto"}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={
                AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
              }
              buttonStyle={
                AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              }
              cornerRadius={SOCIAL_BUTTON_RADIUS}
              style={{ width: "100%", height: SOCIAL_BUTTON_HEIGHT }}
              onPress={() => {
                if (disabled || appleLoading || googleLoading) return;
                void (async () => {
                  setAppleLoading(true);
                  try {
                    const result = await signInWithApple({ recordConsent });
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

      {googleLoading ? (
        <SocialButtonLoading />
      ) : (
        <Pressable
          className={`flex-row items-center justify-center gap-2.5 rounded-xl border border-[#dadce0] bg-white active:opacity-90 ${
            disabled ? "opacity-40" : ""
          }`}
          style={{ height: SOCIAL_BUTTON_HEIGHT, borderRadius: SOCIAL_BUTTON_RADIUS }}
          disabled={disabled || appleLoading || googleLoading}
          onPress={() => {
            if (disabled || appleLoading || googleLoading) return;
            void (async () => {
              setGoogleLoading(true);
              try {
                const result = await signInWithGoogle({ recordConsent });
                if (result.cancelled) return;
              } catch (e) {
                onError?.(
                  getUserFacingMessage(
                    e,
                    "Could not sign in with Google. Please try again.",
                  ),
                );
              } finally {
                setGoogleLoading(false);
              }
            })();
          }}
        >
          <GoogleLogo size={18} />
          <Text className="font-sans-medium text-[15px] text-[#1f1f1f]">
            Continue with Google
          </Text>
        </Pressable>
      )}

      {showDivider ? (
        <View className="mt-6 flex-row items-center gap-3">
          <View className="h-px flex-1 bg-border" />
          <Text className="font-sans text-xs text-muted-foreground">or</Text>
          <View className="h-px flex-1 bg-border" />
        </View>
      ) : null}
    </View>
  );
}
