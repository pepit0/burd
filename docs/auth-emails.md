# Burd-themed auth emails

Free-tier Supabase projects often **require custom SMTP** before you can edit auth email templates. Burd uses **Resend** for that.

## Resend domain: `burdapp.com`

Domain is already created in Resend (`us-east-1`). Add these DNS records at your DNS host (Cloudflare, etc.), then click **Verify** in Resend (or ask the agent to run verify).

| Type | Name / Host | Priority | Value |
|------|-------------|----------|-------|
| TXT | `resend._domainkey` | — | *(copy from Resend dashboard → Domains → burdapp.com — DKIM value)* |
| MX | `send` | `10` | `feedback-smtp.us-east-1.amazonses.com` |
| TXT | `send` | — | `v=spf1 include:amazonses.com ~all` |

Notes:

- On Cloudflare, set proxy status to **DNS only** (grey cloud) for these records.
- Name `send` means `send.burdapp.com`; `resend._domainkey` means `resend._domainkey.burdapp.com`.
- Prefer copying DKIM from the Resend dashboard so the full value is intact.

After DNS propagates (often a few minutes):

1. Resend → Domains → **burdapp.com** → **Verify**
2. Wait until status is **Verified**

## Supabase SMTP settings

In Supabase → **Authentication** → **Emails** → **SMTP Settings** (or the “Set up SMTP” prompt):

| Field | Value |
|-------|--------|
| Enable custom SMTP | On |
| Sender email | `noreply@burdapp.com` |
| Sender name | `Burd` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API key named **Supabase Auth SMTP** (starts with `re_…`) |

Create/copy the key in Resend → **API Keys** if you need it again (tokens are only shown once at creation).

Save SMTP, then unlock **Email Templates**.

## Paste Burd templates

| File | Dashboard template | Suggested subject |
|------|--------------------|-------------------|
| [`supabase/templates/confirmation.html`](../supabase/templates/confirmation.html) | Confirm signup | Confirm your Burd email |
| [`supabase/templates/recovery.html`](../supabase/templates/recovery.html) | Reset password | Reset your Burd password |
| [`supabase/templates/magic_link.html`](../supabase/templates/magic_link.html) | Magic link | Your Burd sign-in link |

Each template uses `{{ .ConfirmationURL }}`, Burd colors, and `https://burdapp.com/assets/favicon-96.png`.

Also under **Authentication → URL Configuration**:

- **Site URL:** `https://burdapp.com/app/`
- **Redirect URLs:** `https://burdapp.com/app/**`, `burd://**`

## App behavior

Register passes `emailRedirectTo: https://burdapp.com/app/` and shows **Check your email**. Login offers **Resend confirmation** when the email isn’t confirmed yet.
