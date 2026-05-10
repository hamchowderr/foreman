"use client";

import { MicIcon, MicOffIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "../../ui/button";

interface MicButtonProps {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecognition = any;

function getSR(): (new () => AnyRecognition) | undefined {
  if (typeof window === "undefined") return undefined;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export function MicButton({ onTranscript, disabled }: MicButtonProps) {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<AnyRecognition>(null);

  const isSupported = !!getSR();

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const start = useCallback(() => {
    const SR = getSR();
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsRecording(true);

    recognition.onresult = (event: AnyRecognition) => {
      const transcript = (event.results[0][0].transcript as string).trim();
      if (transcript) onTranscript(transcript);
    };

    recognition.onerror = (event: AnyRecognition) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        toast.error(`Mic error: ${event.error}`);
      }
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [onTranscript]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  if (!isSupported) return null;

  return (
    <Button
      className={cn(
        "h-7 w-7 rounded-lg border border-border/40 p-1 transition-colors",
        isRecording
          ? "border-red-500/40 bg-red-500/10 text-red-500 animate-pulse hover:bg-red-500/20"
          : "text-muted-foreground/50 hover:border-border hover:text-foreground",
      )}
      disabled={disabled}
      onClick={isRecording ? stop : start}
      title={isRecording ? "Stop recording" : "Voice input"}
      type="button"
      variant="ghost"
    >
      {isRecording ? (
        <MicOffIcon style={{ width: 14, height: 14 }} />
      ) : (
        <MicIcon style={{ width: 14, height: 14 }} />
      )}
    </Button>
  );
}
