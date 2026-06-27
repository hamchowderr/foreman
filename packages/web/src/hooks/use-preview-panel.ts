"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";

/**
 * Lightweight global store for the live-preview side panel (foreman-q4kf).
 *
 * Mirrors the SWR-as-store pattern of use-artifact.ts so there's no new
 * dependency and no provider to thread. The preview is transient (a sandbox URL,
 * not a DB-backed document), so it deliberately does NOT use the heavier
 * document-centric artifact framework — just open/close + the current URL.
 */
export type PreviewPanelState = {
  url: string;
  title: string;
  /** The generated component source (Code tab). */
  source: string;
  /** The build log with ANSI (Terminal tab). */
  log: string;
  isOpen: boolean;
};

export const initialPreviewPanel: PreviewPanelState = {
  url: "",
  title: "Preview",
  source: "",
  log: "",
  isOpen: false,
};

const KEY = "preview-panel";

export function usePreviewPanelSelector<Selected>(
  selector: (state: PreviewPanelState) => Selected,
) {
  const { data } = useSWR<PreviewPanelState>(KEY, null, {
    fallbackData: initialPreviewPanel,
  });
  return useMemo(() => selector(data ?? initialPreviewPanel), [data, selector]);
}

export function usePreviewPanel() {
  const { data, mutate } = useSWR<PreviewPanelState>(KEY, null, {
    fallbackData: initialPreviewPanel,
  });
  const state = data ?? initialPreviewPanel;

  const open = useCallback(
    (next: { url: string; title?: string; source?: string; log?: string }) => {
      mutate(
        {
          url: next.url,
          title: next.title ?? "Preview",
          source: next.source ?? "",
          log: next.log ?? "",
          isOpen: true,
        },
        false,
      );
    },
    [mutate],
  );

  const close = useCallback(() => {
    mutate((s) => ({ ...(s ?? initialPreviewPanel), isOpen: false }), false);
  }, [mutate]);

  const reset = useCallback(() => {
    mutate(initialPreviewPanel, false);
  }, [mutate]);

  return useMemo(() => ({ ...state, open, close, reset }), [state, open, close, reset]);
}
