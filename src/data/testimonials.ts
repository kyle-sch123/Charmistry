/**
 * Hardcoded customer testimonials shown on the home page.
 * Hand-curated — not pulled from a review system. Edit this file when
 * adding/removing testimonials; the marquee duplicates the array so the
 * infinite scroll has enough content to fill the viewport.
 */

import { Testimonial } from "@/types";

export const testimonials: Testimonial[] = [
  {
    id: "001",
    customerName: "Emily",
    rating: 5,
    text: "Thank you so much! The necklace is honestly so cute, I'm obsessed 💖",
    productName: "Raye necklace",
    date: "2025-12-15",
    verified: true,
  },
  {
    id: "002",
    customerName: "Bernice",
    rating: 5,
    text: "Hi! I got my bracelet and I am absolutelt OBSESSED! Thank you so much💕",
    productName: "Mila bracelet",
    date: "2026-01-08",
    verified: true,
  },
  {
    id: "003",
    customerName: "Zibusiso",
    rating: 5,
    text: "Obsessed with everything 😍 the Mila bracelet is even prettier in person",
    productName: "Mila bracelet",
    date: "2026-02-20",
    verified: true,
  },
  {
    id: "004",
    customerName: "Caitlin",
    rating: 5,
    text: "Hi! I just received my parcel! I am absolutely inlove with everything, I will definitely make an order with you again!💝",
    productName: "Charmistry collection",
    date: "2026-03-05",
    verified: true,
  },
];
