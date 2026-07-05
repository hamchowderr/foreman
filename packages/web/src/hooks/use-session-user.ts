"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/client";

export type SessionUserSnapshot = { email: string; image: string | null };

/**
 * Minimal client-side snapshot of the signed-in user (email + avatar URL),
 * fetched once on mount. Used where a client component needs the current
 * user's identity for avatars but isn't handed it via props (e.g. chat
 * messages — foreman-3f1v). Returns null until resolved.
 */
export function useSessionUser(): SessionUserSnapshot | null {
  const [user, setUser] = useState<SessionUserSnapshot | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: { user } }) => {
        if (user) {
          setUser({
            email: user.email ?? "",
            image: (user.user_metadata?.avatar_url as string | undefined) ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  return user;
}
