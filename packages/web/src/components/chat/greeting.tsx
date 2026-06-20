"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";

function timeGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Welcome back";
}

function firstNameFrom(metadata: Record<string, unknown> | undefined): string | null {
  const candidate =
    metadata?.full_name ?? metadata?.name ?? metadata?.given_name ?? metadata?.first_name;
  if (typeof candidate !== "string") return null;
  const first = candidate.trim().split(/\s+/)[0];
  return first || null;
}

export const Greeting = () => {
  // Computed client-side (local time + session) to avoid SSR/timezone hydration
  // mismatch; starts neutral, then fills in on mount.
  const [greeting, setGreeting] = useState("Welcome back");
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    setGreeting(timeGreeting(new Date().getHours()));
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) setFirstName(firstNameFrom(user.user_metadata));
      })
      .catch(() => {});
  }, []);

  const heading = firstName ? `${greeting}, ${firstName}` : greeting;

  return (
    <div className="flex flex-col items-center px-4" key="overview">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center font-semibold text-2xl tracking-tight text-foreground md:text-3xl"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.35, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        {heading}
      </motion.div>
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="mt-3 text-center text-muted-foreground/80 text-sm"
        initial={{ opacity: 0, y: 10 }}
        transition={{ delay: 0.5, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        What can I help with?
      </motion.div>
    </div>
  );
};
