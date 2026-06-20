"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowRight, ChevronDown, ChevronRight, Search, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { MessageResponse } from "@/components/ai-elements/message";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { createClient } from "@/lib/client";
import { sanitizeText } from "@/lib/utils";

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || "http://localhost:4111";

// The demo runs on haiku — cheap + fast, and reliable now that the table tools
// coerce the stringified row data weak models emit (zapier-sdk-tools SCHEMA_OVERRIDES).
const DEMO_MODEL = "anthropic/claude-haiku-4-5-20251001";

// Per use-case demo: the table Foreman builds + the natural-language instruction
// that drives it (showcasing NL → real action). The agent creates the table and
// seeds it with the sample rows; columns come from the row field names.
type Demo = { table: string; prompt: string };

const USE_DEMOS: Record<string, Demo> = {
  leads: {
    table: "Leads",
    prompt:
      'Create a Zapier Table called "Leads", then add these three example rows so I can see it working: ' +
      '(1) Name "Ava Chen", Email "ava@acme.com", Company "Acme Inc", Status "New", Source "Website"; ' +
      '(2) Name "Ben Ortiz", Email "ben@beta.io", Company "Beta LLC", Status "Contacted", Source "Referral"; ' +
      '(3) Name "Cara Singh", Email "cara@gamma.co", Company "Gamma Co", Status "Qualified", Source "LinkedIn".',
  },
  sales: {
    table: "Deals",
    prompt:
      'Create a Zapier Table called "Deals", then add three example rows: ' +
      '(1) Deal "Acme renewal", Company "Acme Inc", Value "$12,000", Stage "Negotiation", "Close Date" "2026-07-15"; ' +
      '(2) Deal "Beta upsell", Company "Beta LLC", Value "$4,500", Stage "Proposal", "Close Date" "2026-07-30"; ' +
      '(3) Deal "Gamma expansion", Company "Gamma Co", Value "$20,000", Stage "Discovery", "Close Date" "2026-08-10".',
  },
  crm: {
    table: "Contacts",
    prompt:
      'Create a Zapier Table called "Contacts", then add three example rows: ' +
      '(1) Name "Ava Chen", Email "ava@acme.com", Company "Acme Inc", Status "Active", "Last Contact" "2026-06-12"; ' +
      '(2) Name "Ben Ortiz", Email "ben@beta.io", Company "Beta LLC", Status "Follow up", "Last Contact" "2026-06-15"; ' +
      '(3) Name "Cara Singh", Email "cara@gamma.co", Company "Gamma Co", Status "New", "Last Contact" "2026-06-18".',
  },
  invoices: {
    table: "Invoices",
    prompt:
      'Create a Zapier Table called "Invoices", then add three example rows: ' +
      '(1) "Invoice #" "INV-001", Client "Acme Inc", Amount "$2,400", "Due Date" "2026-07-01", Status "Sent"; ' +
      '(2) "Invoice #" "INV-002", Client "Beta LLC", Amount "$980", "Due Date" "2026-07-05", Status "Paid"; ' +
      '(3) "Invoice #" "INV-003", Client "Gamma Co", Amount "$5,200", "Due Date" "2026-07-10", Status "Overdue".',
  },
  data: {
    table: "Records",
    prompt:
      'Create a Zapier Table called "Records", then add three example rows: ' +
      '(1) Name "Item A", Category "Hardware", Value "120", Date "2026-06-10"; ' +
      '(2) Name "Item B", Category "Software", Value "75", Date "2026-06-12"; ' +
      '(3) Name "Item C", Category "Service", Value "300", Date "2026-06-14".',
  },
  reports: {
    table: "Metrics",
    prompt:
      'Create a Zapier Table called "Metrics", then add three example rows: ' +
      '(1) Metric "Signups", Value "142", Change "+12%", Week "Jun 9"; ' +
      '(2) Metric "Revenue", Value "$8,400", Change "+5%", Week "Jun 9"; ' +
      '(3) Metric "Churn", Value "1.8%", Change "-0.3%", Week "Jun 9".',
  },
  email: {
    table: "Subscribers",
    prompt:
      'Create a Zapier Table called "Subscribers", then add three example rows: ' +
      '(1) Name "Ava Chen", Email "ava@acme.com", Status "Active", Joined "2026-05-01"; ' +
      '(2) Name "Ben Ortiz", Email "ben@beta.io", Status "Active", Joined "2026-05-18"; ' +
      '(3) Name "Cara Singh", Email "cara@gamma.co", Status "Unsubscribed", Joined "2026-04-22".',
  },
  slack: {
    table: "Alerts",
    prompt:
      'Create a Zapier Table called "Alerts", then add three example rows: ' +
      '(1) Message "Deploy succeeded", Channel "#ops", Priority "Low", Status "Sent"; ' +
      '(2) Message "Payment failed", Channel "#billing", Priority "High", Status "Sent"; ' +
      '(3) Message "New signup", Channel "#growth", Priority "Medium", Status "Sent".',
  },
  calendar: {
    table: "Events",
    prompt:
      'Create a Zapier Table called "Events", then add three example rows: ' +
      '(1) Event "Standup", Date "2026-06-20", Time "9:00 AM", Attendees "Team"; ' +
      '(2) Event "Client call", Date "2026-06-20", Time "2:00 PM", Attendees "Acme"; ' +
      '(3) Event "Review", Date "2026-06-21", Time "11:00 AM", Attendees "Eng".',
  },
};

const DEFAULT_DEMO: Demo = USE_DEMOS.leads;

// Nudge the model to batch the inserts. Without this, weaker models (haiku) split
// the three rows into one create-table-records call each — all succeed, but it's
// slower and reads as three approvals' worth of work. The records array already
// takes multiple rows, so one call is correct.
const SINGLE_CALL_HINT =
  " Add all the rows in a single create-table-records call — the records array takes multiple rows at once.";

function withHint(demo: Demo): Demo {
  return { ...demo, prompt: demo.prompt + SINGLE_CALL_HINT };
}

function getDemo(uses: string[]): Demo {
  for (const u of uses) {
    if (USE_DEMOS[u]) return withHint(USE_DEMOS[u]);
  }
  return withHint(DEFAULT_DEMO);
}

const HIDDEN_TOOLS = new Set(["updateWorkingMemory", "recall"]);

// Tiny Zapier brand avatar for assistant messages (replaces the old "F").
function BotAvatar() {
  return (
    // biome-ignore lint/performance/noImgElement: small static brand asset
    <img
      alt="Foreman"
      className="h-5 w-5 shrink-0 object-contain"
      height={20}
      src="/zapier.svg"
      width={20}
    />
  );
}

type ApprovalResponder = ReturnType<typeof useChat>["addToolApprovalResponse"];

function ToolCallBubble({
  part,
  addToolApprovalResponse,
  autoApprove,
  onApproveFirst,
}: {
  part: any;
  addToolApprovalResponse: ApprovalResponder;
  autoApprove: boolean;
  onApproveFirst: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  // AI SDK v6: type is "tool-<toolName>", name extracted from type
  const toolName = part.type?.startsWith("tool-")
    ? part.type.replace(/^tool-/, "")
    : part.toolName || "tool";
  const isSearch = toolName.includes("search") || toolName.includes("list");
  const Icon = isSearch ? Search : Zap;
  const hasOutput = part.state === "output-available" || part.output != null;
  const approvalId: string | undefined = part.approval?.id;
  const needsApproval = part.state === "approval-requested" && !!approvalId;

  return (
    <Collapsible
      open={expanded || needsApproval}
      onOpenChange={setExpanded}
      className="rounded-lg px-3 py-2 text-sm"
      style={{
        backgroundColor: needsApproval ? "#FFF7ED" : "#FFF3E6",
        border: `1px solid ${needsApproval ? "#FF4F00" : "#FFBF6E"}`,
      }}
    >
      <CollapsibleTrigger className="w-full text-left transition-colors">
        <div className="flex items-center gap-2">
          <Icon className="h-3 w-3 shrink-0" style={{ color: "#FF4F00" }} />
          <span className="flex-1 font-medium text-xs" style={{ color: "#FF4F00" }}>
            {toolName}
          </span>
          {hasOutput && (
            <span className="text-[10px]" style={{ color: "#4A7C2F" }}>
              ✓
            </span>
          )}
          {expanded || needsApproval ? (
            <ChevronDown className="h-3 w-3" style={{ color: "#FFBF6E" }} />
          ) : (
            <ChevronRight className="h-3 w-3" style={{ color: "#FFBF6E" }} />
          )}
        </div>
      </CollapsibleTrigger>
      {part.input && (
        <CollapsibleContent>
          <div className="mt-2 pt-2 space-y-1" style={{ borderTop: "1px solid #FFBF6E" }}>
            {Object.entries(part.input as Record<string, unknown>).map(([k, v]) => (
              <div key={k} className="flex gap-2 text-[10px]">
                <span style={{ color: "#FFBF6E" }}>{k}:</span>
                <span className="font-medium" style={{ color: "#201515" }}>
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </span>
              </div>
            ))}
            {hasOutput && part.output && (
              <div
                className="mt-1.5 pt-1.5 text-[10px]"
                style={{ borderTop: "1px solid #FFBF6E", color: "#4A7C2F" }}
              >
                →{" "}
                {typeof part.output === "string"
                  ? part.output
                  : JSON.stringify(part.output).slice(0, 120)}
              </div>
            )}
          </div>
        </CollapsibleContent>
      )}
      {needsApproval && approvalId && (
        <div
          className="mt-2 flex items-center gap-2 pt-2"
          style={{ borderTop: "1px solid #FFBF6E" }}
        >
          {autoApprove ? (
            <span className="flex-1 text-[11px] italic" style={{ color: "#FFBF6E" }}>
              Approving…
            </span>
          ) : (
            <>
              <span className="flex-1 text-[11px]" style={{ color: "#6B5050" }}>
                Foreman needs your OK to create this.
              </span>
              <button
                type="button"
                onClick={() =>
                  addToolApprovalResponse({
                    id: approvalId,
                    approved: false,
                    reason: "Declined in demo",
                  })
                }
                className="rounded-md px-2.5 py-1 text-[11px] font-medium"
                style={{ color: "#6B5050", border: "1px solid #F0E8E0" }}
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => {
                  onApproveFirst();
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }}
                className="rounded-md px-3 py-1 text-[11px] font-semibold text-white"
                style={{ backgroundColor: "#FF4F00" }}
              >
                Approve
              </button>
            </>
          )}
        </div>
      )}
    </Collapsible>
  );
}

interface Props {
  uses: string[];
  onNext: () => void;
}

export function StepTry({ uses, onNext }: Props) {
  const demo = getDemo(uses);
  const [chatId] = useState(() => crypto.randomUUID());
  const [userId, setUserId] = useState<string>("");
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [done, setDone] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);

  useEffect(() => {
    createClient()
      .auth.getSession()
      .then(({ data: { session } }) => {
        if (session?.user?.id) setUserId(session.user.id);
      });
  }, []);

  const userIdRef = useRef(userId);
  useEffect(() => {
    userIdRef.current = userId;
  }, [userId]);

  const { messages, sendMessage, status, addToolApprovalResponse } = useChat({
    id: chatId,
    // Auto-fire the request when the user approves/declines a tool (mirrors the
    // main chat) — otherwise the approval response is recorded but never sent.
    sendAutomaticallyWhen: ({ messages: current }: any) => {
      const last = current.at(-1);
      return (
        last?.parts?.some(
          (p: any) =>
            "state" in p && p.state === "approval-responded" && p.approval?.approved != null,
        ) ?? false
      );
    },
    transport: new DefaultChatTransport({
      api: `${AGENT_URL}/chat/foreman`,
      fetch: async (input, init) => {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        return fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
        });
      },
      prepareSendMessagesRequest(request) {
        // Tool approval/decline response → resume the run on the backend.
        const approvalPart = request.messages
          .flatMap((m) => m.parts ?? [])
          .find(
            (p: any) =>
              "state" in p && p.state === "approval-responded" && p.approval?.approved != null,
          ) as { approval: { id: string; approved: boolean; reason?: string } } | undefined;

        if (approvalPart) {
          return {
            body: {
              approveRunId: approvalPart.approval.id,
              approved: approvalPart.approval.approved,
              reason: approvalPart.approval.reason,
              threadId: request.id,
              resourceId: userIdRef.current,
            },
          };
        }

        const lastMsg = request.messages.at(-1) as any;
        const text: string =
          (typeof lastMsg?.content === "string" && lastMsg.content) ||
          lastMsg?.parts
            ?.filter((p: any) => p.type === "text")
            .map((p: any) => p.text as string)
            .join("") ||
          demo.prompt;
        return {
          body: {
            messages: [{ role: "user", content: text }],
            threadId: request.id,
            resourceId: userIdRef.current,
            model: DEMO_MODEL,
          },
        };
      },
    }),
  } as any);

  const handleStart = () => {
    if (!started && userId) {
      setStarted(true);
      sendMessage({ role: "user", content: demo.prompt } as any);
    }
  };

  // Scroll to bottom on any DOM change (fires during streaming, not just on new messages)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const observer = new MutationObserver(() => {
      el.scrollTop = el.scrollHeight;
    });
    observer.observe(el, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);

  // "done" requires rows to have actually been written (a create-table-records
  // tool with output) — not just any "ready" gap between tool steps, which used
  // to latch done too early (Continue lit up before the table was built).
  const hasPendingApproval = messages.some((m) =>
    ((m as any).parts ?? []).some((p: any) => p?.state === "approval-requested" && p.approval?.id),
  );
  const recordsAdded = messages.some((m) =>
    ((m as any).parts ?? []).some(
      (p: any) =>
        typeof p?.type === "string" &&
        p.type.includes("create-table-records") &&
        (p.state === "output-available" || p.output != null),
    ),
  );

  useEffect(() => {
    if (status === "ready" && !hasPendingApproval && recordsAdded) {
      setDone(true);
    }
  }, [status, hasPendingApproval, recordsAdded]);

  // One teaching approval: after the user approves the first action, auto-approve
  // the follow-up steps of the same build (fields, records) so it completes
  // smoothly instead of prompting three times.
  const autoApprovedKeys = useRef(new Set<string>());
  useEffect(() => {
    if (!autoApprove) return;
    for (const m of messages) {
      for (const p of (m as any).parts ?? []) {
        const id = p?.approval?.id;
        // Dedup by toolCallId (unique per call). approval.id is the *run* id —
        // shared across every approval step of one run — so deduping on it would
        // approve only the first follow-up tool and stall the rest.
        const key: string | undefined = p?.toolCallId ?? id;
        if (p?.state === "approval-requested" && id && key && !autoApprovedKeys.current.has(key)) {
          autoApprovedKeys.current.add(key);
          addToolApprovalResponse({ id, approved: true });
        }
      }
    }
  }, [autoApprove, messages, addToolApprovalResponse]);

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#FFBF6E" }}>
          Step 3 of 4
        </p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#201515" }}>
          Watch Foreman build for you
        </h1>
        <p className="text-base" style={{ color: "#6B5050" }}>
          Foreman will create a <strong>{demo.table}</strong> table in your Zapier account — approve
          it and watch it happen.
        </p>
      </div>

      {/* Mini chat */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: "1px solid #F0E8E0", backgroundColor: "#FFFFFF" }}
      >
        {/* Chrome bar */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ backgroundColor: "#201515", borderBottom: "1px solid #3A2525" }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FF4F00", opacity: 0.6 }}
          />
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "#FFBF6E", opacity: 0.4 }}
          />
          <div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: "#CDE4E1", opacity: 0.4 }}
          />
          <span
            className="ml-2 text-[10px] uppercase tracking-widest"
            style={{ color: "#FFBF6E", opacity: 0.6 }}
          >
            Foreman
          </span>
          {status === "streaming" && (
            <span
              className="ml-auto text-[10px] font-mono animate-pulse"
              style={{ color: "#FF4F00" }}
            >
              thinking…
            </span>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="p-4 space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden"
          style={{ minHeight: 200, maxHeight: 340 }}
        >
          {/* Pre-start: show the build action as a clickable button */}
          {!started && (
            <div className="flex h-full flex-col items-center justify-center gap-4 py-4">
              <p className="text-xs text-center" style={{ color: "#FFBF6E" }}>
                Press the button to see Foreman build your first table
              </p>
              <Button
                type="button"
                onClick={handleStart}
                disabled={!userId}
                className="gap-2 rounded-xl px-4 py-2.5 text-xs font-medium"
                style={{
                  backgroundColor: "#FFF3E6",
                  border: "1px solid #FFBF6E",
                  color: "#201515",
                  opacity: userId ? 1 : 0.5,
                  cursor: userId ? "pointer" : "wait",
                }}
              >
                <span>Build my {demo.table} table</span>
                <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "#FF4F00" }} />
              </Button>
            </div>
          )}

          {messages.map((msg) => {
            if (msg.role === "user") {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className="max-w-[80%] rounded-2xl rounded-br-sm px-3.5 py-2 text-xs leading-relaxed"
                    style={{
                      backgroundColor: "#FFF3E6",
                      border: "1px solid #FFBF6E",
                      color: "#201515",
                    }}
                  >
                    Build my {demo.table} table
                  </div>
                </div>
              );
            }

            const parts: any[] = (msg as any).parts || [];
            return (
              <div key={msg.id} className="space-y-2">
                {parts.map((part: any, i: number) => {
                  if (part.type?.startsWith("tool-")) {
                    const tn = part.type.replace(/^tool-/, "");
                    if (HIDDEN_TOOLS.has(tn)) return null;
                    return (
                      <ToolCallBubble
                        // biome-ignore lint/suspicious/noArrayIndexKey: parts order is stable within a message
                        key={i}
                        addToolApprovalResponse={addToolApprovalResponse}
                        autoApprove={autoApprove}
                        onApproveFirst={() => setAutoApprove(true)}
                        part={part}
                      />
                    );
                  }
                  if (part.type === "text" && part.text) {
                    return (
                      // biome-ignore lint/suspicious/noArrayIndexKey: parts order is stable within a message
                      <div key={i} className="flex items-start gap-2.5">
                        <BotAvatar />
                        <div
                          className="rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs leading-relaxed max-w-[80%]"
                          style={{
                            backgroundColor: "#FFFDF9",
                            border: "1px solid #F0E8E0",
                            color: "#201515",
                          }}
                        >
                          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })}
                {parts.length === 0 &&
                  (() => {
                    const fallbackText = (msg as any).text || "";
                    return fallbackText ? (
                      <div className="flex items-start gap-2.5">
                        <BotAvatar />
                        <div
                          className="rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs leading-relaxed max-w-[80%]"
                          style={{
                            backgroundColor: "#FFFDF9",
                            border: "1px solid #F0E8E0",
                            color: "#201515",
                          }}
                        >
                          <MessageResponse>{sanitizeText(fallbackText)}</MessageResponse>
                        </div>
                      </div>
                    ) : null;
                  })()}
              </div>
            );
          })}

          {status === "streaming" && messages.length <= 1 && (
            <div className="flex items-center gap-2">
              <BotAvatar />
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: "#FFBF6E", animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p
          className="text-sm"
          style={{ color: done ? "#4A7C2F" : started ? "#FFBF6E" : "#6B5050" }}
        >
          {done
            ? `Your ${demo.table} table is ready.`
            : started
              ? hasPendingApproval
                ? "Approve the action above to continue…"
                : "Working…"
              : "Click the button above to start"}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!done}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all"
          style={{
            backgroundColor: done ? "#FF4F00" : "#FFBF6E",
            cursor: done ? "pointer" : "not-allowed",
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
