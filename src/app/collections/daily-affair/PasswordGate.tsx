/**
 * The door. Shown instead of the collection while it's password-protected.
 *
 * Deliberately in the site's own paper/ink/gold system rather than a bare form
 * — this is the first thing a customer sees when someone shares the preview
 * link, so it should read as "the room isn't open yet", not as an error page.
 *
 * Server component: the password is checked in the action, never here, and
 * nothing about the collection's contents is rendered until it's unlocked.
 */

import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import {
  IMG,
  affairFallbackSrc,
  affairSrcSet,
} from "@/lib/daily-affair";
import { unlockDailyAffair } from "./unlock";

export default function PasswordGate({ wrong = false }: { wrong?: boolean }) {
  return (
    <>
      <Navbar />

      <main className="flex-1 bg-paper text-ink">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 pb-16 pt-28 md:grid-cols-2 md:gap-14 md:px-10 md:pb-20 md:pt-32 lg:px-16">
          {/*
            A glimpse of what's behind the door, heavily softened.

            The height is capped so the whole gate fits one screen — a 3:4 box
            across half of max-w-7xl is ~800px tall, which pushed the password
            field below the fold. The subtraction covers the fixed header
            (121px) plus this section's own vertical padding; object-cover
            absorbs the difference by cropping rather than distorting.
          */}
          <div className="relative aspect-[4/5] overflow-hidden bg-stone md:aspect-[3/4] md:max-h-[calc(100svh-19rem)]">
            {/* eslint-disable-next-line @next/next/no-img-element -- srcset ladder; see AffairImage */}
            <img
              src={affairFallbackSrc(IMG.campaignWide)}
              srcSet={affairSrcSet(IMG.campaignWide)}
              sizes="(max-width: 767px) 100vw, 45vw"
              alt=""
              aria-hidden
              width={IMG.campaignWide.w}
              height={IMG.campaignWide.h}
              loading="eager"
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover object-[center_25%] blur-[6px] brightness-[.9] saturate-[.75]"
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-paper/35"
            />
          </div>

          <div>
            <div className="mb-5 flex items-center gap-4">
              <span className="h-px w-10 bg-gold" aria-hidden />
              <p
                className="uppercase text-ink/45"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.35em",
                }}
              >
                Not open yet
              </p>
            </div>

            <h1
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2.4rem, 7vw, 4.2rem)",
                lineHeight: 0.95,
                letterSpacing: "0.01em",
              }}
            >
              The Daily{" "}
              <em className="text-gold-dark" style={{ fontStyle: "italic" }}>
                Affair
              </em>
            </h1>

            <p
              className="mt-6 max-w-[36ch] text-ink/65"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "14px",
                lineHeight: 1.85,
              }}
            >
              The evening edit is finished but not yet public. If you were given
              a password, this is where it goes.
            </p>

            <form action={unlockDailyAffair} className="mt-8 max-w-sm">
              <label
                htmlFor="da-password"
                className="block uppercase text-ink/45"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.28em",
                }}
              >
                Password
              </label>

              <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row">
                <input
                  id="da-password"
                  name="password"
                  type="password"
                  required
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  aria-describedby={wrong ? "da-error" : undefined}
                  aria-invalid={wrong || undefined}
                  placeholder="Enter password"
                  className={`min-h-12 w-full flex-1 border bg-paper px-4 py-3 font-body text-[15px] text-ink placeholder:text-ink/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${
                    wrong ? "border-red-700" : "border-ink/20"
                  }`}
                />
                <button
                  type="submit"
                  className="min-h-12 cursor-pointer bg-ink px-7 uppercase text-paper transition-colors duration-300 hover:bg-ink-secondary focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    letterSpacing: "0.24em",
                  }}
                >
                  Enter
                </button>
              </div>

              {wrong && (
                <p
                  id="da-error"
                  role="alert"
                  className="mt-3 text-red-700"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "12px",
                    letterSpacing: "0.03em",
                  }}
                >
                  That password isn&rsquo;t right. Try again.
                </p>
              )}
            </form>

            <a
              href="/collections"
              className="group mt-10 inline-flex min-h-11 items-center gap-2 uppercase text-ink/50 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-[3px] focus-visible:outline-ink"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "10px",
                letterSpacing: "0.28em",
              }}
            >
              <span
                className="h-px w-6 bg-current transition-all duration-300 group-hover:w-9"
                aria-hidden
              />
              Back to all collections
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
