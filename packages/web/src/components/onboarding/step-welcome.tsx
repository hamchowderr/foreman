"use client";

import { ArrowRight } from "lucide-react";

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
  const toggle = (id: string) => {
    onSelect(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
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
          What do you want to automate? Pick everything that applies.
        </p>
      </div>

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

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm" style={{ color: "#FFBF6E" }}>
          {selected.length === 0
            ? "Select at least one to continue"
            : `${selected.length} selected`}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={selected.length === 0}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all"
          style={{
            backgroundColor: selected.length === 0 ? "#FFBF6E" : "#FF4F00",
            cursor: selected.length === 0 ? "not-allowed" : "pointer",
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
