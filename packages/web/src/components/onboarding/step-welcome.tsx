"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/client";

const USE_CASES = [
  { id: "sales", label: "Sales tracking", emoji: "📊" },
  { id: "email", label: "Email digests", emoji: "📧" },
  { id: "crm", label: "CRM updates", emoji: "🤝" },
  { id: "slack", label: "Slack alerts", emoji: "💬" },
  { id: "data", label: "Data entry", emoji: "📋" },
  { id: "reports", label: "Weekly reports", emoji: "📈" },
  { id: "invoices", label: "Invoice processing", emoji: "🧾" },
  { id: "leads", label: "Lead management", emoji: "🎯" },
  { id: "calendar", label: "Calendar sync", emoji: "📅" },
];

interface Props {
  selected: string[];
  onSelect: (uses: string[]) => void;
  onNext: () => void;
}

export function StepWelcome({ selected, onSelect, onNext }: Props) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (id: string) => {
    onSelect(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  // Persist the display name (used by the chat greeting) before advancing. The
  // name is optional — an empty value just skips the update.
  const handleContinue = async () => {
    const trimmed = name.trim();
    if (trimmed) {
      setSaving(true);
      try {
        await createClient().auth.updateUser({ data: { full_name: trimmed } });
      } catch {
        // Non-fatal: the user can still set their name later in Settings.
      }
      setSaving(false);
    }
    onNext();
  };

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#FFBF6E" }}>
          Step 1 of 4
        </p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#201515" }}>
          Welcome to Foreman
        </h1>
        <p className="text-base" style={{ color: "#6B5050" }}>
          Let's get you set up — it only takes a minute.
        </p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <label
          htmlFor="onboarding-name"
          className="block text-sm font-semibold"
          style={{ color: "#201515" }}
        >
          What should we call you?
        </label>
        <input
          id="onboarding-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          autoComplete="given-name"
          className="w-full max-w-sm rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#FF4F00]"
          style={{ backgroundColor: "#FFFFFF", border: "2px solid #F0E8E0", color: "#201515" }}
        />
      </div>

      {/* Use cases */}
      <div className="space-y-3">
        <p className="text-sm font-semibold" style={{ color: "#201515" }}>
          What do you want to automate? Pick everything that applies.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {USE_CASES.map((uc) => {
            const isSelected = selected.includes(uc.id);
            return (
              <button
                type="button"
                key={uc.id}
                onClick={() => toggle(uc.id)}
                aria-pressed={isSelected}
                className="flex flex-col items-center gap-2.5 rounded-xl px-4 py-5 text-left transition-all duration-150"
                style={{
                  backgroundColor: isSelected ? "#FFF3E6" : "#FFFFFF",
                  border: `2px solid ${isSelected ? "#FF4F00" : "#F0E8E0"}`,
                  color: "#201515",
                }}
              >
                <span className="text-2xl">{uc.emoji}</span>
                <span className="text-xs font-semibold text-center leading-tight">{uc.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm" style={{ color: "#FFBF6E" }}>
          {selected.length === 0
            ? "Select at least one to continue"
            : `${selected.length} selected`}
        </p>
        <button
          type="button"
          onClick={handleContinue}
          disabled={selected.length === 0 || saving}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all"
          style={{
            backgroundColor: selected.length === 0 ? "#FFBF6E" : "#FF4F00",
            cursor: selected.length === 0 || saving ? "not-allowed" : "pointer",
          }}
        >
          {saving ? "Saving…" : "Continue"}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
