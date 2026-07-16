import Link from "next/link";
import type { Metadata } from "next";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "Collections | Charmistry",
  description:
    "Curated thematic edits — seasonal and story-driven collections of Charmistry jewellery.",
};

const COLLECTIONS = [
  {
    slug: "everyday",
    name: "Everyday Edit Collection",
    season: "Year round",
    description:
      "Timeless pieces designed to be worn on repeat, from Monday mornings to Sunday afternoons.",
    gradient: "from-[#d4a96a] via-[#e8c99a] to-[#f5e4c3]",
    textDark: true,
    comingSoon: true,
  },
];

export default function CollectionsPage() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink">
        <div className="max-w-7xl mx-auto px-6 md:px-10 lg:px-16 pt-32 pb-24">
          {/* Header */}
          <header>
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8 border-b border-ink/10">
              <div>
                <p
                  className="text-ink/40 uppercase mb-3"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "10px",
                    letterSpacing: "0.35em",
                  }}
                >
                  Curated Edits
                </p>
                <h1
                  className="text-ink uppercase leading-[0.92]"
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "clamp(3rem, 7vw, 6rem)",
                    letterSpacing: "0.02em",
                  }}
                >
                  <em style={{ fontStyle: "italic" }}>All</em> Collections
                </h1>
              </div>

              <p
                className="text-ink/50 max-w-xs lg:text-right pb-1"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  lineHeight: 1.7,
                }}
              >
                Story-driven edits, each built around a season, a mood, or a
                moment — pieces that belong together.
              </p>
            </div>
          </header>

          {/* Collection cards */}
          <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {COLLECTIONS.map((col) => (
              <div
                key={col.slug}
                className={`relative overflow-hidden group h-[420px] md:h-[500px] bg-gradient-to-br ${col.gradient}`}
              >
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/10 group-hover:bg-black/20 transition-colors duration-500" />

                {/* Coming soon badge */}
                {col.comingSoon && (
                  <div className="absolute top-6 right-6 z-10">
                    <span
                      className="px-3 py-1.5 bg-paper/80 backdrop-blur-sm text-ink/70 uppercase"
                      style={{
                        fontFamily: "var(--font-body)",
                        fontSize: "9px",
                        letterSpacing: "0.25em",
                      }}
                    >
                      Coming Soon
                    </span>
                  </div>
                )}

                {/* Content */}
                <div className="absolute bottom-0 left-0 right-0 p-8">
                  <p
                    className="mb-2 text-ink/60 uppercase"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "9px",
                      letterSpacing: "0.3em",
                    }}
                  >
                    {col.season}
                  </p>
                  <h2
                    className="text-ink uppercase mb-3 leading-[0.95]"
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                      letterSpacing: "0.02em",
                    }}
                  >
                    {col.name}
                  </h2>
                  <p
                    className="text-ink/60 max-w-sm"
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "11.5px",
                      letterSpacing: "0.06em",
                      lineHeight: 1.75,
                    }}
                  >
                    {col.description}
                  </p>
                </div>
              </div>
            ))}

            {/* More coming placeholder */}
            <div className="h-[420px] md:h-[500px] border border-dashed border-ink/15 flex flex-col items-center justify-center gap-4 text-center px-8">
              <p
                className="text-ink/25 uppercase"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "9px",
                  letterSpacing: "0.35em",
                }}
              >
                More Collections
              </p>
              <p
                className="text-ink/35"
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "12px",
                  letterSpacing: "0.06em",
                  lineHeight: 1.7,
                }}
              >
                New thematic edits are on their way.
                <br />
                Check back soon.
              </p>
            </div>
          </div>

          {/* CTA to shop */}
          <div className="mt-16 flex justify-center">
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2.5 border border-ink text-ink px-8 py-3.5 text-[10px] tracking-[0.25em] uppercase font-body hover:bg-ink hover:text-paper transition-colors cursor-pointer"
            >
              Browse All Pieces
              <svg
                className="w-3.5 h-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 8l4 4m0 0l-4 4m4-4H3"
                />
              </svg>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
