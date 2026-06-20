"use client";

import type { UISuggestion } from "@/lib/editor/suggestions";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { SparklesIcon } from "./icons";

export const SuggestionDialog = ({
  suggestion,
  onApply,
  onClose,
}: {
  suggestion: UISuggestion;
  onApply: () => void;
  onClose: () => void;
}) => {
  return (
    <Dialog
      key={suggestion.id}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
      open
    >
      <DialogContent className="w-[min(20rem,calc(100%-2rem))] gap-3 font-sans">
        <DialogHeader className="flex-row items-center gap-2 space-y-0">
          <div className="flex size-5 items-center justify-center rounded-md bg-muted/60 text-muted-foreground ring-1 ring-border/50">
            <SparklesIcon size={10} />
          </div>
          <DialogTitle>Suggestion</DialogTitle>
        </DialogHeader>
        <DialogDescription className="leading-relaxed">{suggestion.description}</DialogDescription>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button className="w-fit rounded-full px-3 py-1.5" onClick={onApply} variant="outline">
            Apply
          </Button>
          <Button className="w-fit rounded-full px-3 py-1.5" onClick={onClose} variant="ghost">
            Dismiss
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
