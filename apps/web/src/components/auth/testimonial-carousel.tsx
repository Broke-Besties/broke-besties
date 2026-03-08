"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const testimonials = [
  {
    id: 1,
    quote: "Finally, an app that actually understands group expenses. No more awkward conversations about who owes what.",
    author: "Sarah M.",
    handle: "@sarahm",
    initials: "SM",
  },
  {
    id: 2,
    quote: "Broke Besties saved my trip planning. Everyone knew exactly how much they owed before we even got home.",
    author: "James T.",
    handle: "@jamest",
    initials: "JT",
  },
  {
    id: 3,
    quote: "The recurring payments feature is a lifesaver. Netflix, utilities, rent splits itself now.",
    author: "Alex P.",
    handle: "@alexp",
    initials: "AP",
  },
  {
    id: 4,
    quote: "No more lost money. We've recovered $400+ that people actually owed us using this app.",
    author: "Jordan K.",
    handle: "@jordank",
    initials: "JK",
  },
];

export function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 6000);

    return () => clearInterval(interval);
  }, []);

  const testimonial = testimonials[current];

  return (
    <div className="relative w-full h-full flex flex-col justify-center px-12 py-16">
      <AnimatePresence mode="wait">
        <motion.div
          key={testimonial.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-6"
        >
          {/* Large decorative quote mark */}
          <div className="text-[120px] leading-none text-white/10 font-serif select-none -mb-8">
            &ldquo;
          </div>

          {/* Quote text */}
          <p className="text-2xl font-medium text-foreground leading-snug">
            {testimonial.quote}
          </p>

          {/* Author */}
          <div className="flex items-center gap-3 mt-2">
            <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
              {testimonial.initials}
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{testimonial.author}</p>
              <p className="text-xs text-muted-foreground">{testimonial.handle}</p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Carousel indicators */}
      <div className="mt-12 flex gap-2">
        {testimonials.map((_, index) => (
          <motion.div
            key={index}
            className={`h-1.5 rounded-full cursor-pointer transition-all ${
              index === current
                ? "bg-primary w-8"
                : "bg-white/20 w-2"
            }`}
            onClick={() => setCurrent(index)}
          />
        ))}
      </div>
    </div>
  );
}
