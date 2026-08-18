"use client";

import { useEffect, useState } from "react";

/**
 * Mirrors GUARDRAIL_DEFAULTS.maxBulkItems in the agent server. Used until the
 * workspace's own value arrives, and permanently if the fetch fails — the
 * threshold only decides how loudly the approval prompt states the size, so a
 * stale default degrades emphasis, never the gate itself.
 */
const DEFAULT_MAX_BULK_ITEMS = 5;

/**
 * The workspace's "this counts as bulk" threshold (foreman-nz8b).
 *
 * Fetched once per page load and shared across every approval prompt — the
 * value is workspace configuration that changes on an admin's timescale, not a
 * per-message fact, so refetching per tool call would be pure noise.
 */
let cached: number | null = null;
let inFlight: Promise<number> | null = null;

async function fetchThreshold(): Promise<number> {
  if (cached !== null) return cached;
  inFlight ??= fetch("/api/guardrails/status")
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      const value = body?.config?.maxBulkItems;
      cached = typeof value === "number" && value > 0 ? value : DEFAULT_MAX_BULK_ITEMS;
      return cached;
    })
    .catch(() => DEFAULT_MAX_BULK_ITEMS)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

export function useBulkThreshold(): number {
  const [threshold, setThreshold] = useState(cached ?? DEFAULT_MAX_BULK_ITEMS);

  useEffect(() => {
    let active = true;
    fetchThreshold().then((value) => {
      if (active) setThreshold(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return threshold;
}
