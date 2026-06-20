"use client";

import { isAfter } from "date-fns";
import { motion } from "framer-motion";
import { ChevronLeftIcon, ChevronRightIcon, DiffIcon } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";
import { useSWRConfig } from "swr";
import { useArtifact } from "@/hooks/use-artifact";
import type { Document } from "@/lib/db/schema";
import { cn, getDocumentTimestampByIndex } from "@/lib/utils";
import { Button } from "../ui/button";
import { LoaderIcon } from "./icons";

type VersionFooterProps = {
  handleVersionChange: (type: "next" | "prev" | "toggle" | "latest") => void;
  documents: Document[] | undefined;
  currentVersionIndex: number;
  mode: "edit" | "diff";
  setMode: Dispatch<SetStateAction<"edit" | "diff">>;
};

export const VersionFooter = ({
  handleVersionChange,
  documents,
  currentVersionIndex,
  mode,
  setMode,
}: VersionFooterProps) => {
  const { artifact } = useArtifact();

  const { mutate } = useSWRConfig();
  const [isMutating, setIsMutating] = useState(false);

  if (!documents) {
    return;
  }

  const isFirst = currentVersionIndex === 0;
  const isLast = currentVersionIndex === documents.length - 1;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="z-50 flex w-full shrink-0 items-center justify-between gap-3 border-t border-border/50 bg-background px-4 py-3"
      exit={{ opacity: 0, transition: { duration: 0 } }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            disabled={isFirst}
            onClick={() => handleVersionChange("prev")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="min-w-[4rem] text-center text-xs tabular-nums text-muted-foreground">
            {currentVersionIndex + 1} of {documents.length}
          </span>
          <Button
            disabled={isLast}
            onClick={() => handleVersionChange("next")}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>

        <Button
          className={cn(mode === "diff" && "bg-muted text-foreground")}
          onClick={() => setMode(mode === "diff" ? "edit" : "diff")}
          size="icon-sm"
          title="Show changes"
          type="button"
          variant="ghost"
        >
          <DiffIcon className="size-4" />
        </Button>
      </div>

      <div className="flex flex-row gap-2">
        <Button
          disabled={isMutating}
          onClick={async () => {
            setIsMutating(true);

            try {
              await mutate(
                `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}`,
                await fetch(
                  `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/api/document?id=${artifact.documentId}&timestamp=${getDocumentTimestampByIndex(
                    documents,
                    currentVersionIndex,
                  )}`,
                  {
                    method: "DELETE",
                  },
                ),
                {
                  optimisticData: documents
                    ? [
                        ...documents.filter((document) =>
                          isAfter(
                            new Date(document.createdAt),
                            new Date(getDocumentTimestampByIndex(documents, currentVersionIndex)),
                          ),
                        ),
                      ]
                    : [],
                },
              );
            } finally {
              setIsMutating(false);
            }
          }}
          type="button"
          variant="default"
        >
          Restore
          {isMutating && (
            <div className="animate-spin">
              <LoaderIcon size={14} />
            </div>
          )}
        </Button>
        <Button
          onClick={() => {
            setMode("edit");
            handleVersionChange("latest");
          }}
          type="button"
          variant="outline"
        >
          Latest
        </Button>
      </div>
    </motion.div>
  );
};
