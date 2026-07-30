# App Store review guide (Burd iOS)

Use this document when preparing a resubmission after Guideline **2.3.6** (Age Assurance metadata) and **1.2** (user-generated content safety) rejections.

## Pre-submit checklist

- [ ] **Age Assurance → None** in App Store Connect → App Information → Age Rating (2.3.6 fix — no in-app parental controls required)
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

1. App Store Connect → your app → **App Information** → **Age Rating**
2. Set **Age Assurance** → **None**
3. Save and resubmit

No in-app parental-control feature is required unless you build one later.

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
Sign in: Tap "Sign in with Apple" on the login screen.

Terms & Privacy: Required checkboxes on login and register must be accepted before sign-in.

UGC safety demo (Guideline 1.2):
1. Home feed → open any post → ⋯ → Report post (pick a reason)
2. Home feed → open a post by another user → ⋯ → Block user → confirm → their posts disappear from feed
3. User profile → Follow area → ⋯ → Block user (alternate path)

Account deletion (5.1.1): Profile (gear) → Preferences → Account → Delete account

Admin moderation: Admin accounts can open /admin to review reported posts, users, and comments. Reports are reviewed within 24 hours.

Age Assurance: This app does not include Parental Controls or Age Assurance features. Age Assurance is set to None in App Store Connect.
```

Attach your screen recording to this notes field.

## Reviewer demo script (screen recording)

Record on a **physical iPhone** (~2–3 minutes):

1. **Login consent** — Open app → Login → show Terms + Privacy checkboxes → Sign in with Apple
2. **Report post** — Feed → post → ⋯ → Report → choose reason → confirm success
3. **Block user** — Feed → post by another user → ⋯ → Block → confirm → scroll feed to show their content is gone
4. *(Optional)* Profile → ⋯ → Block user
5. *(Optional)* Profile (gear) → Preferences → Account → show Delete account screen (do not delete reviewer account)

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
