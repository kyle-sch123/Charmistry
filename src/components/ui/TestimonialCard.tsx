"use client";

import { Testimonial } from "@/types";

interface TestimonialCardProps {
  testimonial: Testimonial;
}

export default function TestimonialCard({ testimonial }: TestimonialCardProps) {
  const fullStars = Math.floor(testimonial.rating);
  const hasHalf = testimonial.rating % 1 !== 0;

  return (
    <div className="flex flex-col gap-4 p-6 md:p-8 bg-charcoal/50 border border-graphite/50">
      <div className="flex gap-1">
        {Array.from({ length: fullStars }).map((_, i) => (
          <svg key={i} className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
        {hasHalf && (
          <svg className="w-4 h-4 text-gold" fill="currentColor" viewBox="0 0 20 20">
            <defs>
              <linearGradient id={`half-${testimonial.id}`}>
                <stop offset="50%" stopColor="currentColor" />
                <stop offset="50%" stopColor="transparent" />
              </linearGradient>
            </defs>
            <path fill={`url(#half-${testimonial.id})`} stroke="currentColor" strokeWidth="0.5" d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        )}
      </div>
      <blockquote className="font-display text-lg md:text-xl text-ivory/90 font-light italic leading-relaxed">
        &ldquo;{testimonial.text}&rdquo;
      </blockquote>
      <div className="mt-auto pt-4 border-t border-graphite/50">
        <p className="text-ivory font-body text-sm font-medium">{testimonial.customerName}</p>
        <div className="flex items-center gap-2 mt-1">
          {testimonial.verified && (
            <span className="text-gold text-xs font-body">Verified Purchase</span>
          )}
          {testimonial.productName && (
            <span className="text-smoke text-xs font-body">
              &middot; {testimonial.productName}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
