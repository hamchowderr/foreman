"use client";

import { useCallback, useMemo } from "react";
import useSWR from "swr";

/**
 * Global store for the knowledge-document side panel (foreman-aqjx).
 *
 * Mirrors use-preview-panel exactly (SWR-as-store, no provider) so a knowledge
 * document opens in the same resizable side panel as the live preview — "see it
 * like the web preview". The panel shows whichever is open, with knowledge taking
 * the slot when present (see shell.tsx).
 */
export type KnowledgePanelState = {
  /** Workspace-relative path, e.g. documents/q3-plan.md. */
  path: string;
  title: string;
  isOpen: boolean;
};

export const initialKnowledgePanel: KnowledgePanelState = {
  path: "",
  title: "Document",
  isOpen: false,
};

const KEY = "knowledge-panel";

export function useKnowledgePanelSelector<Selected>(
  selector: (state: KnowledgePanelState) => Selected,
) {
  const { data } = useSWR<KnowledgePanelState>(KEY, null, {
    fallbackData: initialKnowledgePanel,
  });
  return useMemo(() => selector(data ?? initialKnowledgePanel), [data, selector]);
}

export function useKnowledgePanel() {
  const { data, mutate } = useSWR<KnowledgePanelState>(KEY, null, {
    fallbackData: initialKnowledgePanel,
  });
  const state = data ?? initialKnowledgePanel;

  const open = useCallback(
    (next: { path: string; title?: string }) => {
      mutate({ path: next.path, title: next.title ?? "Document", isOpen: true }, false);
    },
    [mutate],
  );

  const close = useCallback(() => {
    mutate((s) => ({ ...(s ?? initialKnowledgePanel), isOpen: false }), false);
  }, [mutate]);

  const reset = useCallback(() => {
    mutate(initialKnowledgePanel, false);
  }, [mutate]);

  return useMemo(() => ({ ...state, open, close, reset }), [state, open, close, reset]);
}
