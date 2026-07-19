/**
 * Sign-in flow (client).
 *
 * Two entry methods, one state machine:
 *   - Google: signInWithOAuth → full-page redirect → /auth/callback?code=…
 *   - Email:  signInWithOtp sends a CODE_LENGTH-digit code (plus a fallback link in the
 *     same email). The code verifies right here via verifyOtp — that also
 *     covers cross-device sign-in, where the emailed PKCE link can't work.
 *
 * `providers` is data, not markup, so adding Apple later is a one-line entry.
 * After a client-side verify the session cookies are already set; we
 * router.replace(next) + refresh() and the /account layout takes care of
 * profile bootstrap + guest-order claiming.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAuthBrowserClient } from "@/lib/auth/client";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN_S = 60;
// Length of the emailed OTP. MUST equal Supabase Auth → Providers → Email →
// "OTP length" (currently 8); a mismatch means valid codes never auto-submit.
const CODE_LENGTH = 8;

type OAuthProviderId = "google";

const providers: Array<{ id: OAuthProviderId; label: string }> = [
  { id: "google", label: "Continue with Google" },
];

interface LoginClientProps {
  next: string;
  initialError: string | null;
}

export default function LoginClient({ next, initialError }: LoginClientProps) {
  const router = useRouter();

  const [view, setView] = useState<"start" | "code">("start");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<"oauth" | "send" | "verify" | null>(null);
  const [error, setError] = useState<string | null>(
    initialError === "auth"
      ? "That sign-in link didn't work — it may have expired. Enter your email below for a fresh code."
      : null,
  );
  const [resendIn, setResendIn] = useState(0);
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setInterval(() => setResendIn((s) => s - 1), 1000);
    return () => clearInterval(t);
  }, [resendIn]);

  async function signInWithProvider(provider: OAuthProviderId) {
    if (busy) return;
    setBusy("oauth");
    setError(null);
    const supabase = getAuthBrowserClient();
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    // On success the browser navigates away; we only get here on failure.
    if (err) {
      setError("Could not start Google sign-in. Please try again.");
      setBusy(null);
    }
  }

  async function sendCode() {
    const target = email.trim().toLowerCase();
    if (!EMAIL_RE.test(target)) {
      setError("Enter a valid email address.");
      return;
    }
    if (busy) return;
    setBusy("send");
    setError(null);
    const supabase = getAuthBrowserClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email: target,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(null);
    if (err) {
      setError(
        err.status === 429
          ? "Too many attempts — please wait a minute and try again."
          : "Could not send the code. Please try again.",
      );
      return;
    }
    setEmail(target);
    setCode("");
    setView("code");
    setResendIn(RESEND_COOLDOWN_S);
  }

  async function verifyCode(token: string) {
    if (busy || token.length !== CODE_LENGTH) return;
    setBusy("verify");
    setError(null);
    const supabase = getAuthBrowserClient();
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token,
      type: "email",
    });
    if (err) {
      setBusy(null);
      setError("That code isn't right or has expired. Try again or resend.");
      codeInputRef.current?.select();
      return;
    }
    // Session cookies are set — a server render will now see the user.
    router.replace(next);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {view === "start" ? (
        <>
          <div className="space-y-3">
            {providers.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => signInWithProvider(p.id)}
                disabled={busy !== null}
                className="w-full flex items-center justify-center gap-3 border border-ink/20 bg-paper px-4 py-4 text-xs tracking-[0.2em] uppercase font-body hover:border-ink transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <GoogleMark />
                {busy === "oauth" ? "Redirecting…" : p.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4" aria-hidden>
            <span className="h-px flex-1 bg-ink/10" />
            <span className="text-[10px] tracking-[0.3em] uppercase text-ink/40 font-body">
              or
            </span>
            <span className="h-px flex-1 bg-ink/10" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
            noValidate
            className="space-y-4"
          >
            <label className="block">
              <span className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5">
                Email
              </span>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full border border-ink/15 bg-paper px-4 py-3 text-sm font-body focus:outline-none focus:border-ink transition-colors"
              />
            </label>
            <button
              type="submit"
              disabled={busy !== null}
              className="w-full py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {busy === "send" ? "Sending…" : "Continue with Email"}
            </button>
            <p className="text-[11px] text-ink/45 text-center leading-relaxed">
              No password needed — we&apos;ll email you a {CODE_LENGTH}-digit code.
            </p>
          </form>
        </>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verifyCode(code);
          }}
          noValidate
          className="space-y-6"
        >
          <p className="text-sm text-ink/60 text-center leading-relaxed">
            We&apos;ve sent a {CODE_LENGTH}-digit code to{" "}
            <span className="text-ink">{email}</span>. The email also contains
            a sign-in link if you&apos;d rather click.
          </p>

          <label className="block">
            <span className="block text-[10px] tracking-[0.2em] uppercase text-ink/55 font-body mb-1.5 text-center">
              Verification code
            </span>
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={CODE_LENGTH}
              value={code}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
                setCode(digits);
                if (error) setError(null);
                if (digits.length === CODE_LENGTH) verifyCode(digits);
              }}
              placeholder={"•".repeat(CODE_LENGTH)}
              className="w-full border border-ink/15 bg-paper px-4 py-4 text-center text-2xl font-body tracking-[0.5em] focus:outline-none focus:border-ink transition-colors"
              autoFocus
            />
          </label>

          <button
            type="submit"
            disabled={busy !== null || code.length !== CODE_LENGTH}
            className="w-full py-4 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {busy === "verify" ? "Verifying…" : "Sign In"}
          </button>

          <div className="flex items-center justify-between text-[11px] tracking-[0.15em] uppercase font-body">
            <button
              type="button"
              onClick={() => {
                setView("start");
                setCode("");
                setError(null);
              }}
              className="text-ink/55 hover:text-ink transition-colors cursor-pointer"
            >
              Different email
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy !== null || resendIn > 0}
              className="text-ink/55 hover:text-ink transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="border border-red-900/30 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      )}

      <p className="text-[11px] text-ink/45 text-center leading-relaxed">
        Prefer not to sign in? You can always{" "}
        <span className="text-ink/70">check out as a guest</span> — an account
        just keeps your orders and details in one place.
      </p>
    </div>
  );
}

/** Official multi-colour Google "G" — required branding for the OAuth button. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
