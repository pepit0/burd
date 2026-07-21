# TestFlight / EAS iOS builds

Expo needs `eas.json` in the repo root (this file). If the Expo website says
`Failed to read "/eas.json"`, merge or pull a branch that includes it.

## 1. Environment variables (Expo dashboard)

Open https://expo.dev → **tempt-technologies** → **burd** → **Environment variables**.

Add for **production** (and **preview** if you use that profile):

| Name | Value |
|------|--------|
| `EXPO_PUBLIC_INFERENCE_URL` | `https://burd-inference.fly.dev` |
| `EXPO_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |

Optional:

| Name | Value |
|------|--------|
| `EXPO_PUBLIC_SOUND_DEBUG` | `true` (only while diagnosing sound ID) |

Deploy the account-deletion Edge Function before App Store submission:

```bash
supabase functions deploy delete-account
```

`EXPO_PUBLIC_*` values are baked in at **build** time. Changing them requires a new build.

## App icon (iOS / TestFlight)

iOS requires a **1024×1024 opaque PNG** with **no alpha channel**. Icons with
transparency show up as a **blank white square** on TestFlight and the home screen.

`app.json` points at `./assets/icon.png` (and `ios.icon`). Regenerate from the logo:

```bash
npm ci --prefix website/scripts
npm run generate:app-icons
npm run verify:app-icons
```

Commit `assets/icon.png` and `assets/adaptive-icon.png` before building. EAS runs
`verify:app-icons` automatically after install (`eas-build-post-install`).

## 2. Build from Expo website

1. https://expo.dev → **burd** → **Builds** → **Create a build**
2. Platform: **iOS**
3. Profile: **production** (TestFlight / App Store)
4. Git branch: **main** (must include `eas.json`)
5. Wait for the build (~15–25 min), then **Submit to App Store** / TestFlight

## 3. Build from laptop (optional)

```bash
npm install
npx eas-cli login
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

On Windows, if PowerShell blocks `npm`, use **Command Prompt** or `npm.cmd`.

## 4. Apple credentials

First iOS build: Expo prompts for Apple Developer login or API key in the dashboard.
Use the same Apple team as bundle ID `com.burd.app`.
