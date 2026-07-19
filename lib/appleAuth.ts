import { Platform } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { getUserFacingMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase";

export function isAppleSignInAvailable(): boolean {
  return Platform.OS === "ios";
}

function formatAppleFullName(
  fullName: AppleAuthentication.AppleAuthenticationFullName | null,
): string | null {
  if (!fullName) return null;
  const parts = [
    fullName.givenName,
    fullName.middleName,
    fullName.familyName,
  ].filter((part): part is string => Boolean(part && part.trim()));
  const joined = parts.join(" ").trim();
  return joined || null;
}

async function createAppleNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID().replace(/-/g, "");
  const hashed = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    raw,
  );
  return { raw, hashed };
}

/**
 * Native Sign in with Apple → Supabase session via identity token.
 * Returns `{ cancelled: true }` if the user dismissed the Apple sheet.
 */
export async function signInWithApple(): Promise<{ cancelled: boolean }> {
  if (Platform.OS !== "ios") {
    throw new Error("Sign in with Apple is only available on iOS.");
  }

  const available = await AppleAuthentication.isAvailableAsync();
  if (!available) {
    throw new Error(
      "Sign in with Apple needs a development or production build — it is not available in Expo Go.",
    );
  }

  try {
    const { raw: nonce, hashed: hashedNonce } = await createAppleNonce();

    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });

    if (!credential.identityToken) {
      throw new Error("Apple did not return an identity token.");
    }

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce,
    });

    if (error) {
      throw new Error(getUserFacingMessage(error, error.message));
    }

    // Defer metadata / profile writes so they don't race the auth lock.
    const fullName = formatAppleFullName(credential.fullName);
    void (async () => {
      try {
        if (fullName) {
          await supabase.auth.updateUser({
            data: {
              full_name: fullName,
              given_name: credential.fullName?.givenName ?? undefined,
              family_name: credential.fullName?.familyName ?? undefined,
            },
          });

          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user?.id) {
            await supabase
              .from("profiles")
              .update({ full_name: fullName })
              .eq("id", user.id);
          }
        }

        const {
          data: { user: signedIn },
        } = await supabase.auth.getUser();
        if (
          signedIn &&
          signedIn.user_metadata?.username_chosen !== true &&
          !(
            typeof signedIn.user_metadata?.username === "string" &&
            signedIn.user_metadata.username.trim().length >= 3
          )
        ) {
          await supabase.auth.updateUser({
            data: { username_chosen: false },
          });
        }
      } catch (metaErr) {
        console.warn("Apple post-sign-in sync skipped:", metaErr);
      }
    })();

    return { cancelled: false };
  } catch (e) {
    if (
      e &&
      typeof e === "object" &&
      "code" in e &&
      (e as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return { cancelled: true };
    }
    throw e;
  }
}
