# Sign in with Google

Burd uses Supabase OAuth + an in-app browser (`expo-web-browser`) for Google.

## App code

- Login and Sign up show **Continue with Google**
- [`lib/googleAuth.ts`](../lib/googleAuth.ts) opens Supabase’s Google OAuth URL and stores the session
- New Google users are sent to **Choose a username** (`username_chosen: false`)

## Dashboard setup

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials  
2. Create an **OAuth 2.0 Client ID** (Web application is fine for Supabase-hosted OAuth)  
3. Authorized redirect URI:  
   `https://<YOUR_PROJECT_REF>.supabase.co/auth/v1/callback`  
4. Supabase → **Authentication → Providers → Google** → Enable  
5. Paste Client ID + Client Secret → Save  
6. Under **Authentication → URL Configuration**, add redirect URLs:  
   - `burd://**`  
   - `burd://auth/callback`  
   - your Expo / EAS redirect if different  

Then rebuild or reload the app and tap **Continue with Google**.
