"use client";

import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { ChatShell } from "@/components/chat-shell";

export default function Home() {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    authClient.getSession().then((res) => {
      if (!res.data?.user) {
        window.location.href = "/sign-up";
      } else {
        setAuthed(true);
        setChecking(false);
      }
    }).catch(() => {
      window.location.href = "/sign-up";
    });
  }, []);

  if (checking || !authed) {
    return (
      <div className="flex items-center justify-center h-screen text-foreground/40 text-sm">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen">
      <ChatShell />
    </div>
  );
}
