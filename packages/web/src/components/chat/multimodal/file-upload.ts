"use client";

import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
} from "react";
import { toast } from "sonner";
import type { Attachment } from "@/lib/types";

// Attachments are sent to the model inline as AI SDK v6 `file` parts (data URLs)
// — no upload endpoint or storage service required (same pattern as storycraft /
// myrp-build). `submitForm` in multimodal-input.tsx maps these into file parts.
const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB — keeps base64 payloads sane.

function fileToAttachment(file: File): Promise<Attachment | undefined> {
  return new Promise((resolve) => {
    if (file.size > MAX_FILE_BYTES) {
      toast.error(`${file.name} is too large (max 10MB).`);
      resolve(undefined);
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      resolve({ url: reader.result as string, name: file.name, contentType: file.type });
    reader.onerror = () => {
      toast.error(`Failed to read ${file.name}.`);
      resolve(undefined);
    };
    reader.readAsDataURL(file);
  });
}

export function useFileUpload({
  setAttachments,
  setUploadQueue,
  textareaRef,
}: {
  setAttachments: Dispatch<SetStateAction<Attachment[]>>;
  setUploadQueue: Dispatch<SetStateAction<string[]>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  // Shared path used by the file picker, paste, and (later) drag-and-drop.
  const addFiles = useCallback(
    async (files: File[], queueLabels?: string[]) => {
      if (files.length === 0) {
        return;
      }
      setUploadQueue(queueLabels ?? files.map((file) => file.name));
      try {
        const converted = await Promise.all(files.map(fileToAttachment));
        const attachments = converted.filter((a): a is Attachment => a !== undefined);
        if (attachments.length > 0) {
          setAttachments((current) => [...current, ...attachments]);
        }
      } finally {
        setUploadQueue([]);
      }
    },
    [setAttachments, setUploadQueue],
  );

  const handleFileChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      await addFiles(files);
      // Reset so selecting the same file again still fires onChange.
      event.target.value = "";
    },
    [addFiles],
  );

  const handlePaste = useCallback(
    async (event: ClipboardEvent) => {
      const items = event.clipboardData?.items;
      if (!items) {
        return;
      }
      const imageFiles = Array.from(items)
        .filter((item) => item.type.startsWith("image/"))
        .map((item) => item.getAsFile())
        .filter((file): file is File => file !== null);

      if (imageFiles.length === 0) {
        return;
      }
      event.preventDefault();
      await addFiles(
        imageFiles,
        imageFiles.map(() => "Pasted image"),
      );
    },
    [addFiles],
  );

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    textarea.addEventListener("paste", handlePaste);
    return () => textarea.removeEventListener("paste", handlePaste);
  }, [handlePaste, textareaRef]);

  return { addFiles, handleFileChange };
}
