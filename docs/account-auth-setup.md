# Account / Auth — one-time dashboard setup

The code for customer accounts (Google OAuth + email OTP) is fully wired, but
sign-in will not work until these dashboard steps are done. No new env vars
are needed anywhere — the existing Supabase URL / anon key / service-role key
cover everything, and the Google credentials live inside Supabase.

Do the steps in order. ~20 minutes total.

---

## 1. Google Cloud — OAuth client (~10 min)

At https://console.cloud.google.com (any Google account; create a project
called e.g. "Charmistry" if you don't have one):

1. **APIs & Services → OAuth consent screen**
   - User type: **External** → Create.
   - App name `Charmistry`, support email = your email.
   - Authorized domain: `charmistry.co.za`.
   - Scopes: leave defaults (email/profile are automatic). Save through the
     steps, then press **Publish app** (otherwise only test users can sign in).
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**
   - Application type: **Web application**, name `Charmistry Web`.
   - Authorized JavaScript origins:
     - `https://charmistry.co.za`
     - `http://localhost:3000`
   - Authorized redirect URIs (exactly this one — it's Supabase's callback,
     not the site's):
     - `https://qkgakhluqruqoifknprg.supabase.co/auth/v1/callback`
   - Create, then copy the **Client ID** and **Client secret**.

## 2. Supabase — enable the Google provider (~2 min)

Dashboard → project `qkgakhluqruqoifknprg` → **Authentication → Sign In / Providers**:

- **Google**: toggle on, paste the Client ID + Client secret from step 1. Save.
- **Email**: leave enabled. No password settings matter — the site only uses
  one-time codes / magic links.

## 3. Supabase — URL configuration (~2 min)

**Authentication → URL Configuration**:

- Site URL: `https://charmistry.co.za`
- Redirect URLs (add both):
  - `https://charmistry.co.za/**`
  - `http://localhost:3000/**`

## 4. Supabase — custom SMTP via Resend (~3 min) — REQUIRED

Without this, Supabase's built-in mailer is rate-limited to a couple of
emails per hour (OTP testing becomes impossible) and the free tier blocks
email-template editing.

**Authentication → Emails → SMTP Settings** (enable custom SMTP):

- Host: `smtp.resend.com`
- Port: `465`
- Username: `resend`
- Password: your Resend API key (`re_…`, same one as in `.env`)
- Sender email: `orders@charmistry.co.za`
- Sender name: `Charmistry`

## 5. Supabase — Magic Link email template (~3 min)

**Authentication → Emails → Templates → Magic Link**. The login page shows a
numeric code input that auto-submits at a fixed length, so the template **must**
render `{{ .Token }}`, and the code length **must match** `CODE_LENGTH` in
`src/app/login/LoginClient.tsx` — currently **8**, which is the Supabase **OTP
length** setting (Auth → Providers → Email). Keep the one-click link fallback:
it targets `/auth/confirm` (token-hash) and works on **any** device, unlike the
default `{{ .ConfirmationURL }}` PKCE link which only works in the same browser.

Subject: `Your Charmistry sign-in code`

Branded body — matches the Charmistry transactional emails in
`src/lib/email-templates.ts` (Gilda Display wordmark, paper/ink palette, serif
code block). Custom fonts don't load in most email clients, so the wordmark and
code fall back to Georgia serif, exactly like the order/welcome emails. Paste
as-is:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="format-detection" content="telephone=no" />
  <title>Your Charmistry sign-in code</title>
</head>
<body style="margin:0;padding:0;background:#FAFAF8;font-family:'Outfit',sans-serif;color:#0A0A0A;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#FAFAF8;">
    <tr>
      <td align="center" style="padding:48px 16px;">
        <table width="560" cellpadding="0" cellspacing="0" role="presentation" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid #E0DDD8;">

          <!-- Header -->
          <tr>
            <td style="padding:40px 48px 32px;border-bottom:1px solid #E0DDD8;text-align:center;">
              <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:22px;letter-spacing:0.15em;text-transform:uppercase;color:#0A0A0A;">
                Charmistry
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:48px 48px 40px;">
              <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:28px;line-height:1.2;color:#0A0A0A;">
                Your sign-in code
              </p>
              <p style="margin:20px 0 0;font-size:13px;line-height:1.8;color:#6B6B6B;letter-spacing:0.05em;">
                Enter the code below on the sign-in page to access your Charmistry
                account. For your security it expires in one hour and can be used
                only once.
              </p>

              <!-- Code -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="margin:32px 0;">
                <tr>
                  <td style="border:1px solid #0A0A0A;padding:24px 16px;text-align:center;">
                    <p style="margin:0 0 10px;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;color:#6B6B6B;">
                      Verification code
                    </p>
                    <p style="margin:0;font-family:'Gilda Display','Georgia',serif;font-size:30px;letter-spacing:0.28em;color:#0A0A0A;white-space:nowrap;">
                      {{ .Token }}
                    </p>
                  </td>
                </tr>
              </table>

              <!-- One-click fallback (works on any device) -->
              <p style="margin:0;font-size:12px;line-height:1.7;color:#6B6B6B;letter-spacing:0.05em;text-align:center;">
                Prefer one click?
                <a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/account" style="color:#0A0A0A;text-decoration:underline;">Sign in directly</a>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 48px;border-top:1px solid #E0DDD8;text-align:center;">
              <p style="margin:0;font-size:11px;color:#B8B5B0;letter-spacing:0.05em;line-height:1.8;">
                This code was requested for {{ .Email }}.<br/>
                If it wasn't you, you can safely ignore this email — no changes
                will be made to your account.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```

> Note: until this template is saved, Supabase sends its default
> `{{ .ConfirmationURL }}` link only — no PIN — which is exactly the "link opens
> a new tab and signs me in" behaviour you'll see before this step.

## 6. Optional hardening (~1 min)

- **Authentication → Sign In / Providers → Email**: OTP expiry `3600`s is fine.
- The security advisor suggests enabling **Leaked password protection**
  (Auth → Providers → Passwords). We don't use passwords, but toggling it on
  is harmless and silences the advisor.

---

## Local dev notes

- `npm run dev` and sign in at `http://localhost:3000/login`. Google works
  because `localhost:3000` is in both the Google origins and the Supabase
  redirect allowlist.
- Magic-link **clicks** from the email go to the production `Site URL` — use
  the emailed code when testing locally.

## How it fits together (for future reference)

- `/login` — Google button + email OTP. `/auth/callback` (OAuth + emailed
  PKCE links), `/auth/confirm` (token_hash links).
- `middleware.ts` guards `/account/**` and `/login` only — the PayFast ITN
  and the rest of the site are never touched by auth middleware.
- On every sign-in / account visit, past guest orders with the same verified
  email are linked to the account (`src/lib/account.ts`).
- Checkout stays guest-first; signed-in users get prefill and their orders
  stamped with `user_id` server-side.
- Deleting an account keeps order rows (accounting) but detaches them.
