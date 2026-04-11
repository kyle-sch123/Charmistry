import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";

export default function ProductNotFound() {
  return (
    <>
      <Navbar />
      <main className="flex-1 bg-paper text-ink flex items-center justify-center pt-32 pb-32">
        <div className="text-center max-w-md px-6">
          <p className="text-[11px] tracking-[0.25em] uppercase text-ink/55 font-body mb-4">
            404 — Not found
          </p>
          <h1 className="font-display text-4xl md:text-5xl font-light mb-5">
            This piece has vanished
          </h1>
          <p className="text-ink/60 mb-10">
            The product you&apos;re looking for isn&apos;t here. It may have been
            archived or moved.
          </p>
          <Link
            href="/shop"
            className="inline-block px-8 py-3 bg-ink text-paper text-xs tracking-[0.2em] uppercase font-body hover:bg-ink-secondary transition-colors"
          >
            Browse the Collection
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
