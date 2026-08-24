/**
 * AsSeenOnYou — the latest four posts from @charmistry_za, rendered as an
 * editorial photo strip. Server component: posts arrive via getInstagramPosts
 * (cached 1h, see lib/instagram.ts) and the section degrades to elegant
 * placeholder tiles linking to the profile when no feed source is configured
 * — the layout stays reviewable and the page never breaks over a social API.
 *
 * Home page only — a full marketing section between the home page's dividers.
 * It used to have a compact "product" variant under the PDP StackBuilder; the
 * PDP is long enough without it.
 */

import Image from "next/image";
import {
  getInstagramPosts,
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  type InstagramPost,
} from "@/lib/instagram";

function InstagramGlyph({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function Tile({ post, index }: { post: InstagramPost | null; index: number }) {
  const inner = post ? (
    <>
      {/* Instagram CDN images are remote + short-lived; next/image is
          unoptimized on this host so this is a straight passthrough. */}
      <Image
        src={post.image}
        alt={post.caption?.slice(0, 80) ?? `@${INSTAGRAM_HANDLE} post`}
        fill
        className="object-cover transition-transform duration-[900ms] ease-out group-hover/tile:scale-105"
        sizes="(max-width: 768px) 50vw, 25vw"
      />
      <div className="absolute inset-0 flex items-center justify-center bg-ink/0 transition-colors duration-300 group-hover/tile:bg-ink/45">
        <InstagramGlyph className="h-6 w-6 text-paper opacity-0 transition-opacity duration-300 group-hover/tile:opacity-100" />
      </div>
    </>
  ) : (
    // Placeholder tile — shown until an Instagram feed source is configured.
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-stone">
      <InstagramGlyph className="h-6 w-6 text-ink/20" />
      <span className="font-body text-[9px] tracking-[0.28em] uppercase text-ink/30">
        @{INSTAGRAM_HANDLE}
      </span>
    </div>
  );

  return (
    <a
      href={post?.permalink ?? INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="group/tile relative block aspect-square overflow-hidden bg-stone"
      aria-label={
        post
          ? `View post ${index + 1} by @${INSTAGRAM_HANDLE} on Instagram`
          : `Visit @${INSTAGRAM_HANDLE} on Instagram`
      }
    >
      {inner}
    </a>
  );
}

export default async function AsSeenOnYou() {
  const posts = await getInstagramPosts(4);
  // Always render four tiles — real posts first, placeholders for the rest.
  const tiles: (InstagramPost | null)[] = Array.from(
    { length: 4 },
    (_, i) => posts[i] ?? null,
  );

  const grid = (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      {tiles.map((post, i) => (
        <Tile key={post?.id ?? `placeholder-${i}`} post={post} index={i} />
      ))}
    </div>
  );

  const followLink = (
    <a
      href={INSTAGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-[10px] tracking-[0.22em] uppercase font-body text-ink/55 hover:text-ink transition-colors"
    >
      <InstagramGlyph className="h-3.5 w-3.5" />
      Follow @{INSTAGRAM_HANDLE}
    </a>
  );

  return (
    <section aria-label="As seen on you" className="bg-paper defer-paint">
      <div className="mx-auto max-w-7xl px-6 md:px-10 lg:px-16">
        <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="mb-6 flex items-center gap-4">
              <div className="h-px w-10 bg-ink/30" />
              <span
                className="uppercase text-ink/50"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "10px",
                  letterSpacing: "0.25em",
                }}
              >
                @{INSTAGRAM_HANDLE}
              </span>
            </div>
            <h2
              className="uppercase leading-[1.05] text-ink"
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: "clamp(2rem, 4vw, 3.6rem)",
                letterSpacing: "0.02em",
              }}
            >
              As Seen <em style={{ fontStyle: "italic" }}>On You</em>
            </h2>
          </div>
          {followLink}
        </div>
        {grid}
      </div>
    </section>
  );
}
