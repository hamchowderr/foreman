"use client";

import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

interface CopyButtonProps {
  /** The text written to the clipboard when clicked. */
  value: string;
  /** Label shown in the idle state (defaults to "Copy"). */
  label?: string;
  size?: React.ComponentProps<typeof Button>["size"];
  variant?: React.ComponentProps<typeof Button>["variant"];
}

/**
 * Shared copy-to-clipboard button. Writes `value` to the clipboard and shows a
 * transient "Copied!" confirmation that resets after 2s.
 */
export function CopyButton({
  value,
  label = "Copy",
  size = "xs",
  variant = "secondary",
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value]);

  return (
    <Button type="button" size={size} variant={variant} onClick={copy}>
      {copied ? "Copied!" : label}
    </Button>
  );
}
