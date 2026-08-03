# App Store review guide (Burd iOS)

Use this document when preparing a resubmission after Guideline **2.3.6** (Age Assurance metadata) and **1.2** (user-generated content safety) rejections.

## Guideline 2.3.6 — social apps and Age Assurance

For apps with **Social Media** capabilities, App Store Connect **requires Age Assurance** in the questionnaire — you cannot set it to None. Apple then expects a real in-app mechanism, not just a checkbox.

| Mechanism | Meets Apple Age Assurance? |
|-----------|------------------------------|
| “I am 13+” checkbox at sign-up | **No** (supplement only) |
| **Apple Declared Age Range API** (`expo-age-range`) | **Yes** |
| Government ID / age-estimation vendors | **Yes** |

Burd implements the **Declared Age Range API** on iOS via `expo-age-range` and the `com.apple.developer.declared-age-range` entitlement. After sign-in and username setup, new users see **Confirm your age** → **Verify age with Apple** before the social feed unlocks.

**App Store Connect:** Keep **Social Media** and **Age Assurance** as declared. Set **Parental Controls → None** unless you build parental dashboards. Capabilities should stay accurate (UGC, social feed, messaging, etc.).

## Pre-submit checklist

- [ ] **Age Assurance** remains enabled in App Store Connect (required for social apps)
- [ ] **Parental Controls → None** unless you ship parental tools
- [ ] iOS build includes `expo-age-range` + declared-age-range entitlement (see `app.json`)
- [ ] Test on a **physical iPhone** signed into an Apple Account (simulators may not show the age sheet)
- [ ] **Metadata URLs** in App Store Connect:
  - Privacy: `https://burdapp.com/privacy.html`
  - Terms: `https://burdapp.com/terms.html`
  - Support: `https://burdapp.com/support.html`
- [ ] **Age rating questionnaire** flags: user-generated content, social networking, 13+
- [ ] **Privacy Nutrition Labels** aligned with [`website/privacy.html`](../website/privacy.html) (PostHog analytics, location, photos/audio, push tokens, AI ID features)
- [ ] Migration **`0043_user_blocks_and_ugc_reports.sql`** applied to production Supabase
- [ ] Edge Function **`delete-account`** deployed and smoke-tested
- [ ] New iOS build uploaded with UGC + legal updates
- [ ] **Screen recording** (~2–3 min on a physical device) attached to App Review Notes

## App Store Connect — Age Assurance (2.3.6)

Social media apps must declare **Age Assurance**. Burd satisfies this with the in-app Declared Age Range flow (`app/(auth)/age-assurance.tsx`, `lib/ageAssurance.ts`).

1. App Store Connect → your app → **App Information** → **Age Rating**
2. Confirm **Social Media** and **Age Assurance** are enabled (expected for Burd)
3. Set **Parental Controls → None**
4. Save and upload a new iOS build that includes the age verification screen

## In-app Age Assurance (2.3.6)

| Piece | Location |
|-------|----------|
| Declared Age Range API call | `lib/ageAssurance.ts` → `verifyAgeForSocialMedia()` |
| Pre-feed age gate screen | `app/(auth)/age-assurance.tsx` |
| Route gate (after username) | `app/_layout.tsx` |
| iOS entitlement | `app.json` → `com.apple.developer.declared-age-range` |
| Fallback self-declaration | Same screen, if Apple sheet unavailable/declined |
| Policy info | Preferences → About → Age rating |

**Local testing:** Expo Go does not include the `ExpoAgeRange` native module. Use the manual age confirmation on the age-assurance screen in Expo Go, or run a **development build** (`eas build --profile development`) to test the real Apple age sheet.

## App Store Connect — Privacy Nutrition Labels (summary)

Declare collection that matches the live app:

| Category | Examples in Burd |
|----------|------------------|
| Contact info | Email (account) |
| User content | Photos, audio, posts, comments, profile |
| Location | Coarse/precise when user grants permission |
| Identifiers | User ID, device push token |
| Usage data | PostHog product analytics (screens, events) |
| Other | Moderation reports, blocks |

Link the privacy policy URL above. Mismatch with in-app behavior is a common **5.1.2** follow-up rejection.

## App Review Notes (paste template)

```
Sign in: Create account → Sign in with Apple → choose @username → Confirm your age screen.

Age Assurance (Guideline 2.3.6): After username setup, the app shows "Confirm your age" with a "Verify age with Apple" button. This invokes Apple's Declared Age Range API (system sheet). Social feed access is blocked until verification succeeds. Info: Profile (gear) → Preferences → About → Age rating.

UGC safety demo (Guideline 1.2):
1. Home feed → open any post → ⋯ → Report post (pick a reason)
2. Home feed → open a post by another user → ⋯ → Block user → confirm → their posts disappear from feed
3. User profile → Follow area → ⋯ → Block user (alternate path)

Account deletion (5.1.1): Profile (gear) → Preferences → Account → Delete account

Admin moderation: Admin accounts can open /admin to review reported posts, users, and comments. Reports are reviewed within 24 hours.
```

Attach your screen recording to this notes field.

## Reviewer demo script (screen recording)

Record on a **physical iPhone** signed into an Apple Account (~3–4 minutes):

1. **Age Assurance** — Create account → Sign in with Apple → set username → **Confirm your age** → tap **Verify age with Apple** → complete system sheet → land on home feed
2. **Sign-up consent** — (email path) Register → Terms/Privacy + 13+ checkboxes
3. **Report post** — Feed → post → ⋯ → Report → choose reason
4. **Block user** — Feed → post by another user → ⋯ → Block → confirm → feed updates
5. *(Optional)* Profile (gear) → Preferences → Account → Delete account (do not delete reviewer account)

## Backend deploy

From the `burd` directory with production Supabase linked:

```bash
npx supabase db push
supabase functions deploy delete-account
```

### Smoke tests (production build)

- Block a test user → their posts vanish from feed immediately
- Report a post → succeeds (no duplicate / RPC error)
- Report a comment → appears in Admin → Reported comments
- Profile → Preferences → Account → Delete account → completes without error

## In-app UGC features (1.2)

| Requirement | Where |
|-------------|--------|
| Terms before login/register | `app/(auth)/login.tsx`, `register.tsx`, `SignupConsent.tsx` |
| Report posts | `PostOptionsMenu.tsx` |
| Report comments | `PostComments.tsx` |
| Report / block users | `UserOptionsMenu.tsx`, post menus |
| Block → feed filter | Migration 0043, `hooks/useFeed.ts`, `lib/blocks.ts` |
| Admin queues | `app/admin/index.tsx` — posts, users, comments |
| 24h moderation commitment | `website/terms.html`, `website/support.html` |

## Moderation SLA

Feath AI commits to reviewing user reports within **24 hours**, removing violating content, and suspending or banning accounts as needed. Blocking a user creates a `user_reports` row with `source: block` so moderators are notified.

## Support contact

- Email: info@feath.xyz
- Support page: https://burdapp.com/support.html
