# Sign in with Apple (iOS)

Burd uses native Sign in with Apple on iOS via `expo-apple-authentication` and Supabase `signInWithIdToken`. It does **not** work in Expo Go — use a development build or EAS build.

## App code (already shipped)

- Login / Register show the official Apple button on iOS only (Google is shown disabled as “Coming soon”)
- [`lib/appleAuth.ts`](../lib/appleAuth.ts) exchanges the Apple identity token with Supabase (SHA-256 nonce)
- First-time Apple users without a chosen username are sent to **Choose a username**
- [`app.json`](../app.json) sets `ios.usesAppleSignIn` and the `expo-apple-authentication` plugin

## 1. Apple Developer

1. Open [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list).
2. Select (or create) the App ID for **`com.burd.app`**.
3. Enable capability **Sign in with Apple**.
4. For Supabase’s Apple provider (required for token validation), also create:
   - A **Services ID** (e.g. `com.burd.app.auth`) with Sign in with Apple enabled  
     - Configure domains/return URLs as Supabase’s dashboard instructs for your project
   - A **Sign in with Apple** key (`.p8`) — note **Key ID**, download once
5. Note your **Team ID** (Membership details).

## 2. Supabase Dashboard

1. Go to **Authentication → Providers → Apple** and enable it.
2. **Client IDs**: add at least:
   - `com.burd.app` (native App ID — required for `signInWithIdToken`)
   - Your Services ID if you also use web OAuth later  
   - For Expo Go testing only: `host.exp.Exponent` (not needed once you use a custom build)
3. Paste **Team ID**, **Key ID**, and the `.p8` private key secret as prompted.
4. Save.

Official reference: [Login with Apple (React Native)](https://supabase.com/docs/guides/auth/social-login/auth-apple?platform=react-native).

## 3. Rebuild the app

Native Apple auth requires a binary that includes the capability:

```bash
# Development client
npx eas build --profile development --platform ios

# Or production / TestFlight
npx eas build --profile production --platform ios
```

Install the build on a device, then tap **Sign in with Apple** on the login or register screen.

## 4. Smoke test

1. Sign in with Apple on a physical iPhone (simulator works if signed into an Apple ID that supports it).
2. Confirm a new row appears under **Authentication → Users** with provider `apple`.
3. Confirm you land on **Choose a username**, then the main tabs after saving.
4. Sign out and Sign in with Apple again — should skip username setup.

## Troubleshooting

| Symptom | Likely fix |
|---------|------------|
| Button missing | Only shown on iOS; Android/web hide it by design |
| “Not available” / no sheet | Need a custom build with `usesAppleSignIn`, not Expo Go |
| EAS: provisioning profile doesn’t support Sign in with Apple | Enable **Sign in with Apple** on App ID `com.burd.app`, then regenerate the EAS App Store profile (see below) |
| Supabase rejects token | Add `com.burd.app` to Apple provider Client IDs |
| No email on user | Expected when user hides email; Apple provides a private relay address on first auth |
| Name missing later | Apple only sends full name on the **first** authorization |

### EAS build fails: profile missing `applesignin`

`usesAppleSignIn` adds the `com.apple.developer.applesignin` entitlement. Expo’s existing App Store profile (often named `*[expo] com.burd.app AppStore …`) was created **before** that capability existed, so archive fails.

1. [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list) → **`com.burd.app`** → enable **Sign in with Apple** → Save.
2. Regenerate the Expo-managed profile so it picks up the new capability:
   ```bash
   npx eas credentials -p ios
   ```
   Choose the **production** (App Store) profile → remove / regenerate the **Provisioning Profile** (keep the distribution cert unless you need a full reset).
3. Rebuild:
   ```bash
   npx eas build --profile production --platform ios
   ```

You can also delete the iOS App Store provisioning profile in the [Expo dashboard → Credentials](https://expo.dev) for the project; the next EAS build will create a fresh one.
