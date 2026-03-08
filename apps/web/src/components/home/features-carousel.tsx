"use client";

import { motion } from "motion/react";
import { Users, RefreshCw, Bell, TrendingUp, Share2, Lock } from "lucide-react";

const features = [
  {
    id: 1,
    icon: Users,
    title: "Groups",
    description: "Track expenses with roommates, trips, dinner clubs, and more.",
  },
  {
    id: 2,
    icon: RefreshCw,
    title: "Recurring Payments",
    description: "Never miss a shared subscription. Netflix, utilities, rent.",
  },
  {
    id: 3,
    icon: Bell,
    title: "Smart Reminders",
    description: "Stay on top of who owes what without awkward texts.",
  },
  {
    id: 4,
    icon: TrendingUp,
    title: "Balance Tracking",
    description: "See exactly who owes you at a glance.",
  },
  {
    id: 5,
    icon: Share2,
    title: "Easy Sharing",
    description: "Invite friends and split expenses instantly.",
  },
  {
    id: 6,
    icon: Lock,
    title: "Secure & Private",
    description: "Your financial data is safe with us.",
  },
];

// Duplicate the features array for infinite scroll effect
const duplicatedFeatures = [...features, ...features];

export function FeaturesCarousel() {
  return (
    <div className="relative w-full overflow-hidden py-12 md:py-16">
      {/* Gradient overlays */}
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

      {/* Scrolling container */}
      <motion.div
        className="flex gap-6 px-8"
        animate={{ x: [0, -1000] }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear",
        }}
      >
        {duplicatedFeatures.map((feature, idx) => {
          const Icon = feature.icon;
          return (
            <div
              key={`${feature.id}-${idx}`}
              className="flex-shrink-0 w-80 p-6 rounded-xl border border-primary/20 bg-gradient-to-br from-card to-card/50 hover:border-primary/40 transition-colors"
            >
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{feature.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
