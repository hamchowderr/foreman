"use client";

import { useState, useRef, useCallback, useEffect } from "react";

const AGENT_SERVER_URL =
  process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

const MAX_RECORDING_MS = 30_000;

interface VoiceButtonProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscription, disabled }: VoiceButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.stop();
      }
    };
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setRecording(false);

        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) return;

        setTranscribing(true);
        try {
          const form = new FormData();
          form.append(
            "audio",
            blob,
            `recording.${mimeType === "audio/webm" ? "webm" : "mp4"}`
          );

          const res = await fetch(
            `${AGENT_SERVER_URL}/api/voice/transcribe`,
            { method: "POST", body: form }
          );
          if (!res.ok) throw new Error(`Transcription failed: ${res.status}`);
          const data = await res.json();
          if (data.text) onTranscription(data.text);
        } catch (err) {
          console.error("Transcription error:", err);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);

      timerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_RECORDING_MS);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [onTranscription, stopRecording]);

  const handleClick = useCallback(() => {
    if (recording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [recording, stopRecording, startRecording]);

  const isDisabled = disabled || transcribing;

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isDisabled}
      aria-label={recording ? "Stop recording" : "Start voice input"}
      className={`p-3 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
        recording
          ? "bg-red-500 text-white animate-pulse"
          : "bg-[#f0f0f0] dark:bg-[#1a1a1a] text-foreground hover:opacity-80"
      }`}
    >
      {transcribing ? (
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          className="animate-spin"
        >
          <circle
            cx="10"
            cy="10"
            r="8"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray="40"
            strokeDashoffset="10"
            strokeLinecap="round"
          />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" />
          <path
            d="M5 11a7 7 0 0 0 14 0"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="12"
            y1="18"
            x2="12"
            y2="22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="8"
            y1="22"
            x2="16"
            y2="22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </button>
  );
}

export async function speakResponse(text: string): Promise<void> {
  try {
    const res = await fetch(`${AGENT_SERVER_URL}/api/voice/synthesize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Synthesis failed: ${res.status}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.onended = () => URL.revokeObjectURL(url);
    await audio.play();
  } catch (err) {
    console.error("Speech synthesis error:", err);
  }
}

export function SpeakButton({ text }: { text: string }) {
  const [playing, setPlaying] = useState(false);

  const handleClick = useCallback(async () => {
    setPlaying(true);
    try {
      await speakResponse(text);
    } finally {
      setPlaying(false);
    }
  }, [text]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={playing}
      aria-label="Listen to response"
      className="ml-2 p-1 rounded opacity-40 hover:opacity-80 transition-opacity disabled:opacity-20"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path
          d="M3 9v6h4l5 5V4L7 9H3z"
          fill="currentColor"
        />
        <path
          d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"
          fill="currentColor"
        />
        {!playing && (
          <path
            d="M19.07 4.93a10 10 0 0 1 0 14.14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        )}
      </svg>
    </button>
  );
}
