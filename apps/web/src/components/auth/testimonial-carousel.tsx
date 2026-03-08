"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const testimonials = [
  {
    id: 1,
    quote: "Finally, an app that actually understands group expenses. No more awkward conversations about who owes what.",
    author: "Sarah M.",
    role: "Roommate of 3 years",
  },
  {
    id: 2,
    quote: "Broke Besties saved my trip planning. Everyone knew exactly how much they owed before we even got home.",
    author: "James T.",
    role: "Travel enthusiast",
  },
  {
    id: 3,
    quote: "The recurring payments feature is a lifesaver. Netflix, utilities, rent splits itself now.",
    author: "Alex P.",
    role: "Shared apartment dweller",
  },
  {
    id: 4,
    quote: "No more lost money. We've recovered $400+ that people actually owed us using this app.",
    author: "Jordan K.",
    role: "Friend group organizer",
  },
];

export function TestimonialCarousel() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % testimonials.length);
    }, 6000); // Rotate every 6 seconds

    return () => clearInterval(interval);
  }, []);

  const testimonial = testimonials[current];

  return (
    <div className="relative w-full h-full flex flex-col justify-center items-center px-6 py-12">
      <AnimatePresence mode="wait">
        <motion.div
          key={testimonial.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.5 }}
          className="space-y-6 text-center"
        >
          {/* Quote */}
          <div className="space-y-4">
            <p className="text-lg md:text-xl text-foreground leading-relaxed italic">
              "{testimonial.quote}"
            </p>
          </div>

          {/* Author */}
          <div className="space-y-1">
            <p className="font-semibold text-foreground">{testimonial.author}</p>
            <p className="text-sm text-primary">{testimonial.role}</p>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Carousel indicators */}
      <div className="mt-8 flex gap-2 justify-center">
        {testimonials.map((_, index) => (
          <motion.div
            key={index}
            className={`h-2 rounded-full cursor-pointer transition-all ${
              index === current
                ? "bg-primary w-8"
                : "bg-primary/30 w-2"
            }`}
            onClick={() => setCurrent(index)}
            layoutId="carousel-indicator"
          />
        ))}
      </div>
    </div>
  );
}
