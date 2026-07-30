# Sign in with Google

Burd uses Supabase OAuth + an in-app browser (`expo-web-browser`) for Google.

## App code

- Login and Sign up show **Continue with Google** on iOS, Android, and web
- [`lib/googleAuth.ts`](../lib/googleAuth.ts) opens Supabase’s Google OAuth URL and stores the session
- New Google users are sent to **Choose a username** (`username_chosen: false`)

## Dashboard setup (Burd production project: `ldluootquzvmfvhpmcfx`)

### 1. Google Cloud Console

1. [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services** → **Credentials**
2. **Create credentials** → **OAuth client ID** → type **Web application**
3. Under **Authorized redirect URIs**, add **only** this Supabase callback (not `burd://…`):

   ```
   https://ldluootquzvmfvhpmcfx.supabase.co/auth/v1/callback
   ```

4. Copy the **Client ID** and **Client secret**

### 2. Supabase → Authentication → Providers → Google

1. Open [Supabase Burd project](https://supabase.com/dashboard/project/ldluootquzvmfvhpmcfx/auth/providers)
2. Enable **Google**
3. Paste **Client ID** and **Client Secret** → **Save**

If either field is empty, Google sign-in fails with a Supabase **400** page:

```json
{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: missing OAuth secret"}
```

### 3. Supabase → Authentication → URL Configuration

**Site URL:** `https://burdapp.com/app/`

**Redirect URLs** (add each line):

```
burd://auth/callback
burd://**
https://burdapp.com/app/auth/callback
http://localhost:8081/app/auth/callback
```

Save, then reload the app and try **Continue with Google** again.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Supabase 400 `missing OAuth secret` | Enable Google provider and save Client ID **and** Secret in Supabase |
| Google `redirect_uri_mismatch` | In Google Cloud, redirect URI must be `https://ldluootquzvmfvhpmcfx.supabase.co/auth/v1/callback` only |
| Supabase `redirect URL not allowed` | Add your app callback (`burd://auth/callback` or `https://burdapp.com/app/auth/callback`) under URL Configuration |
| Works on web but not iPhone | Confirm `burd://auth/callback` is in Supabase redirect URLs; use a dev/production build (not Expo Go unless `exp://…` is allowlisted) |

Then rebuild or reload the app and tap **Continue with Google**.
