import { memo } from "react";
import { initialArtifactData, useArtifact } from "@/hooks/use-artifact";
import { Button } from "../ui/button";
import { CrossIcon } from "./icons";

function PureArtifactCloseButton() {
  const { setArtifact } = useArtifact();

  return (
    <Button
      className="group rounded-lg border-transparent text-muted-foreground hover:border-border active:scale-95"
      data-testid="artifact-close-button"
      onClick={() => {
        setArtifact((currentArtifact) =>
          currentArtifact.status === "streaming"
            ? {
                ...currentArtifact,
                isVisible: false,
              }
            : { ...initialArtifactData, status: "idle" },
        );
      }}
      size="icon-sm"
      type="button"
      variant="ghost"
    >
      <CrossIcon size={16} />
    </Button>
  );
}

export const ArtifactCloseButton = memo(PureArtifactCloseButton, () => true);
