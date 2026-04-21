"use client";

import { useAuth } from "@clerk/nextjs";

const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

export function useApiClient() {
  const { getToken } = useAuth();

  async function apiFetch(path: string, options?: RequestInit) {
    const token = await getToken();
    const res = await fetch(`${AGENT_SERVER_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...options?.headers,
      },
    });
    if (!res.ok) throw new Error(`Agent server error: ${res.status}`);
    return res;
  }

  return { apiFetch, getToken };
}
