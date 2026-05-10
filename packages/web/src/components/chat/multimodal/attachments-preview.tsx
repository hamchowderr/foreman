"use client";

import type { Dispatch, SetStateAction } from "react";
import type { Attachment } from "@/lib/types";
import { PreviewAttachment } from "../preview-attachment";

export function AttachmentsPreview({
  attachments,
  uploadQueue,
  setAttachments,
  fileInputRef,
}: {
  attachments: Attachment[];
  uploadQueue: string[];
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
}) {
  if (attachments.length === 0 && uploadQueue.length === 0) {
    return null;
  }
  return (
    <div
      className="flex w-full self-start flex-row gap-2 overflow-x-auto px-3 pt-3 no-scrollbar"
      data-testid="attachments-preview"
    >
      {attachments.map((attachment) => (
        <PreviewAttachment
          attachment={attachment}
          key={attachment.url}
          onRemove={() => {
            setAttachments((currentAttachments) =>
              currentAttachments.filter((a) => a.url !== attachment.url),
            );
            if (fileInputRef.current) {
              fileInputRef.current.value = "";
            }
          }}
        />
      ))}

      {uploadQueue.map((filename) => (
        <PreviewAttachment
          attachment={{
            url: "",
            name: filename,
            contentType: "",
          }}
          isUploading={true}
          key={filename}
        />
      ))}
    </div>
  );
}
