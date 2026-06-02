"use client";

import { AnimatePresence, motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Check, Play, RotateCcw } from "@/components/icons/hi";

type ZapNode = {
  id: string;
  n: number;
  app: string;
  action: string;
  color: string;
  letter: string;
  lane: "main" | "pathA" | "pathB";
};

type ForemanStep = {
  app: string;
  color: string;
  letter: string;
  label: string;
};

type TraceCall = {
  tool: string;
  args: string;
  result: string;
};

type Scene = {
  title: string;
  subtitle: string;
  foremanPrompt: string;
  workflowLabel: string;
  steps: ForemanStep[];
  trace: TraceCall[];
  nodes: ZapNode[];
};

const SCENES: Scene[] = [
  {
    title: "New subscriber",
    subtitle: "Form → Sheets → Mailchimp → branches",
    foremanPrompt:
      "When someone fills the form, add them to Sheets + Mailchimp, draft a welcome email, and ping me in Slack.",
    workflowLabel: "workflow · 4 steps",
    steps: [
      { app: "sheets", color: "#0f9d58", letter: "S", label: "sheets · add-row" },
      { app: "mailchimp", color: "#ffe01b", letter: "M", label: "mailchimp · add-subscriber" },
      { app: "gmail", color: "#ea4335", letter: "G", label: "gmail · create-draft" },
      { app: "slack", color: "#4a154b", letter: "#", label: "slack · send-message" },
    ],
    trace: [
      {
        tool: "list-connections",
        args: '"forms, sheets, mailchimp, gmail, slack"',
        result: "all 5 connected",
      },
      { tool: "search-actions", args: '"add row"', result: "sheets · create-spreadsheet-row" },
      { tool: "list-input-fields", args: "add-subscriber", result: "email · merge_fields · tags" },
      { tool: "search-actions", args: '"draft email"', result: "gmail · create-draft" },
      { tool: "search-history", args: '"#new-signups channel"', result: "slack · #new-signups" },
    ],
    nodes: [
      {
        id: "forms",
        n: 1,
        app: "Google Forms",
        action: "New Form Response",
        color: "#673ab7",
        letter: "F",
        lane: "main",
      },
      {
        id: "sheets",
        n: 2,
        app: "Google Sheets",
        action: "Create Spreadsheet Row",
        color: "#0f9d58",
        letter: "S",
        lane: "main",
      },
      {
        id: "draft",
        n: 3,
        app: "Gmail",
        action: "Create Draft",
        color: "#ea4335",
        letter: "M",
        lane: "main",
      },
      {
        id: "mc",
        n: 4,
        app: "Mailchimp",
        action: "Add/Update Subscriber",
        color: "#ffe01b",
        letter: "M",
        lane: "main",
      },
      {
        id: "paths",
        n: 5,
        app: "Paths",
        action: "Branch",
        color: "#0f172a",
        letter: "⎇",
        lane: "main",
      },
      {
        id: "rulesA",
        n: 6,
        app: "Path A rules",
        action: "Opted in → newsletter",
        color: "#ea4335",
        letter: "A",
        lane: "pathA",
      },
      {
        id: "slackA",
        n: 7,
        app: "Slack",
        action: "Send Channel Message",
        color: "#4a154b",
        letter: "S",
        lane: "pathA",
      },
      {
        id: "tableA",
        n: 8,
        app: "Zapier Tables",
        action: "Create Record",
        color: "#ff4a00",
        letter: "Z",
        lane: "pathA",
      },
      {
        id: "rulesB",
        n: 9,
        app: "Path B rules",
        action: "Else",
        color: "#ea4335",
        letter: "B",
        lane: "pathB",
      },
      {
        id: "slackB",
        n: 10,
        app: "Slack",
        action: "Send Channel Message",
        color: "#4a154b",
        letter: "S",
        lane: "pathB",
      },
      {
        id: "fmt",
        n: 11,
        app: "Formatter",
        action: "Text transform",
        color: "#ff4a00",
        letter: "ƒ",
        lane: "pathB",
      },
    ],
  },
  {
    title: "Lead routing",
    subtitle: "Airtable → enrich → split hot vs warm",
    foremanPrompt:
      "New Airtable lead — enrich with Clearbit, ping me in Slack, and route hot ones to Pipedrive, warm ones to a Mailchimp drip.",
    workflowLabel: "workflow · 5 steps",
    steps: [
      { app: "airtable", color: "#ffbc00", letter: "A", label: "airtable · find-record" },
      { app: "clearbit", color: "#0d79bc", letter: "C", label: "clearbit · enrich-person" },
      { app: "slack", color: "#4a154b", letter: "#", label: "slack · send-message" },
      { app: "pipedrive", color: "#1c2e40", letter: "P", label: "pipedrive · create-deal" },
      { app: "mailchimp", color: "#ffe01b", letter: "M", label: "mailchimp · add-to-campaign" },
    ],
    trace: [
      { tool: "search-actions", args: '"enrich person"', result: "clearbit · enrich-person" },
      { tool: "list-input-fields", args: "enrich-person", result: "email · company · score" },
      { tool: "search-actions", args: '"create deal"', result: "pipedrive · create-deal" },
      {
        tool: "list-input-field-choices",
        args: "pipeline",
        result: "Inbound · Outbound · Partner",
      },
      { tool: "search-actions", args: '"mailchimp drip"', result: "mailchimp · add-to-campaign" },
    ],
    nodes: [
      {
        id: "airt",
        n: 1,
        app: "Airtable",
        action: "New Record",
        color: "#ffbc00",
        letter: "A",
        lane: "main",
      },
      {
        id: "cb",
        n: 2,
        app: "Clearbit",
        action: "Enrich Person",
        color: "#0d79bc",
        letter: "C",
        lane: "main",
      },
      {
        id: "filt",
        n: 3,
        app: "Filter",
        action: "Only valid emails",
        color: "#ff4a00",
        letter: "ƒ",
        lane: "main",
      },
      {
        id: "slackL",
        n: 4,
        app: "Slack",
        action: "Send Channel Message",
        color: "#4a154b",
        letter: "S",
        lane: "main",
      },
      {
        id: "paths",
        n: 5,
        app: "Paths",
        action: "Branch",
        color: "#0f172a",
        letter: "⎇",
        lane: "main",
      },
      {
        id: "rulesA",
        n: 6,
        app: "Path A rules",
        action: "Score ≥ 80 (hot)",
        color: "#ea4335",
        letter: "A",
        lane: "pathA",
      },
      {
        id: "pd",
        n: 7,
        app: "Pipedrive",
        action: "Create Deal",
        color: "#1c2e40",
        letter: "P",
        lane: "pathA",
      },
      {
        id: "slackA",
        n: 8,
        app: "Slack",
        action: "DM account owner",
        color: "#4a154b",
        letter: "S",
        lane: "pathA",
      },
      {
        id: "rulesB",
        n: 9,
        app: "Path B rules",
        action: "Else",
        color: "#ea4335",
        letter: "B",
        lane: "pathB",
      },
      {
        id: "mc",
        n: 10,
        app: "Mailchimp",
        action: "Add to Warm Drip",
        color: "#ffe01b",
        letter: "M",
        lane: "pathB",
      },
      {
        id: "notion",
        n: 11,
        app: "Notion",
        action: "Append to Leads DB",
        color: "#0f172a",
        letter: "N",
        lane: "pathB",
      },
    ],
  },
  {
    title: "Bug triage",
    subtitle: "GitHub issue → Linear → page oncall",
    foremanPrompt:
      "New GitHub bug report? Create a Linear ticket, post it in #bugs, and if it's P0, also page oncall.",
    workflowLabel: "workflow · 4 steps",
    steps: [
      { app: "github", color: "#1f2328", letter: "G", label: "github · find-issue" },
      { app: "linear", color: "#5e6ad2", letter: "L", label: "linear · create-issue" },
      { app: "slack", color: "#4a154b", letter: "#", label: "slack · post-to-#bugs" },
      { app: "pd", color: "#06ac38", letter: "P", label: "pagerduty · create-incident" },
    ],
    trace: [
      { tool: "search-actions", args: '"github issue"', result: "github · find-issue" },
      { tool: "search-actions", args: '"linear create"', result: "linear · create-issue" },
      { tool: "list-input-field-choices", args: "linear.team", result: "Eng · Web · Mobile" },
      { tool: "search-history", args: '"#bugs slack channel"', result: "slack · #bugs" },
      {
        tool: "list-input-fields",
        args: "pagerduty.create-incident",
        result: "service · urgency · title",
      },
    ],
    nodes: [
      {
        id: "gh",
        n: 1,
        app: "GitHub",
        action: "New Issue",
        color: "#1f2328",
        letter: "G",
        lane: "main",
      },
      {
        id: "filtL",
        n: 2,
        app: "Filter",
        action: "Label: bug",
        color: "#ff4a00",
        letter: "ƒ",
        lane: "main",
      },
      {
        id: "lin",
        n: 3,
        app: "Linear",
        action: "Create Issue",
        color: "#5e6ad2",
        letter: "L",
        lane: "main",
      },
      {
        id: "slackT",
        n: 4,
        app: "Slack",
        action: "Post to #bugs",
        color: "#4a154b",
        letter: "S",
        lane: "main",
      },
      {
        id: "paths",
        n: 5,
        app: "Paths",
        action: "Branch",
        color: "#0f172a",
        letter: "⎇",
        lane: "main",
      },
      {
        id: "rulesA",
        n: 6,
        app: "Path A rules",
        action: "Priority = P0",
        color: "#ea4335",
        letter: "A",
        lane: "pathA",
      },
      {
        id: "slackA",
        n: 7,
        app: "Slack",
        action: "DM oncall",
        color: "#4a154b",
        letter: "S",
        lane: "pathA",
      },
      {
        id: "pg",
        n: 8,
        app: "PagerDuty",
        action: "Create Incident",
        color: "#06ac38",
        letter: "P",
        lane: "pathA",
      },
      {
        id: "rulesB",
        n: 9,
        app: "Path B rules",
        action: "Else",
        color: "#ea4335",
        letter: "B",
        lane: "pathB",
      },
      {
        id: "jira",
        n: 10,
        app: "Jira",
        action: "Add to backlog",
        color: "#0052cc",
        letter: "J",
        lane: "pathB",
      },
      {
        id: "mail",
        n: 11,
        app: "Gmail",
        action: "Notify team lead",
        color: "#ea4335",
        letter: "G",
        lane: "pathB",
      },
    ],
  },
];

// Timing within a single scene
const BUILD_STEP_MS = 580; // per-node build delay
const BUILD_END_PAUSE_MS = 700; // pause after build
const RUN_STEP_MS = 320; // per-node run tick
const RUN_END_LINGER_MS = 2000; // hold complete state before advancing
const SCENE_GAP_MS = 700; // gap between scenes

type Phase = "building" | "running" | "complete";

export function ZapVsForemanRace() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });
  const [sceneIdx, setSceneIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>("building");
  const [built, setBuilt] = useState(0);
  const [ran, setRan] = useState(0);
  const [runKey, setRunKey] = useState(0);

  const scene = SCENES[sceneIdx];
  const nodeCount = scene.nodes.length;

  const BUILD_MS = nodeCount * BUILD_STEP_MS;
  const RUN_MS = nodeCount * RUN_STEP_MS;

  useEffect(() => {
    if (!inView) return;

    setPhase("building");
    setBuilt(0);
    setRan(0);

    const timers: ReturnType<typeof setTimeout>[] = [];

    // Build phase: nodes appear one by one
    for (let i = 1; i <= nodeCount; i++) {
      timers.push(setTimeout(() => setBuilt(i), i * BUILD_STEP_MS));
    }

    // Transition to running
    timers.push(setTimeout(() => setPhase("running"), BUILD_MS + BUILD_END_PAUSE_MS));

    // Run phase: green tick per node
    for (let i = 1; i <= nodeCount; i++) {
      timers.push(setTimeout(() => setRan(i), BUILD_MS + BUILD_END_PAUSE_MS + i * RUN_STEP_MS));
    }

    // Transition to complete
    timers.push(setTimeout(() => setPhase("complete"), BUILD_MS + BUILD_END_PAUSE_MS + RUN_MS));

    // Advance to next scene
    timers.push(
      setTimeout(
        () => setSceneIdx((i) => (i + 1) % SCENES.length),
        BUILD_MS + BUILD_END_PAUSE_MS + RUN_MS + RUN_END_LINGER_MS + SCENE_GAP_MS,
      ),
    );

    return () => timers.forEach(clearTimeout);
  }, [inView, sceneIdx, runKey, nodeCount, BUILD_MS, RUN_MS]);

  // Foreman timeline (parallel to Zap build phase):
  //   0.0s  prompt appears
  //   0.4s  trace call 1
  //   0.8s  trace call 2
  //   1.2s  trace call 3
  //   1.6s  trace call 4
  //   2.0s  trace call 5
  //   2.4s  workflow draft appears
  //   2.7s  awaiting approval banner
  const sceneElapsedMs =
    phase === "building" ? Math.min(built * BUILD_STEP_MS, BUILD_MS) : BUILD_MS;
  const FOREMAN_MS = 3000;
  const promptVisible = sceneElapsedMs >= 100;
  const traceShown = Math.max(
    0,
    Math.min(scene.trace.length, Math.floor((sceneElapsedMs - 400) / 400)),
  );
  const draftVisible = sceneElapsedMs >= 400 + scene.trace.length * 400 + 200;
  const approvalVisible = sceneElapsedMs >= 400 + scene.trace.length * 400 + 600;

  const zapElapsedTotal =
    phase === "building"
      ? built * BUILD_STEP_MS
      : phase === "running"
        ? BUILD_MS + BUILD_END_PAUSE_MS + ran * RUN_STEP_MS
        : BUILD_MS + BUILD_END_PAUSE_MS + RUN_MS;
  const zapTotalMs = BUILD_MS + BUILD_END_PAUSE_MS + RUN_MS;
  const zapProgress = Math.min((zapElapsedTotal / zapTotalMs) * 100, 100);
  const foremanProgress = Math.min((Math.min(sceneElapsedMs, FOREMAN_MS) / FOREMAN_MS) * 100, 100);

  return (
    <div ref={ref} className="space-y-3">
      <div className="grid md:grid-cols-2 gap-3 sm:gap-4">
        {/* Left: Zap canvas */}
        <div className="relative rounded-xl border border-border bg-surface overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 py-3 border-b border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div
                className={`h-2 w-2 rounded-full shrink-0 ${
                  phase === "running"
                    ? "bg-green-500 animate-pulse"
                    : phase === "complete"
                      ? "bg-green-500"
                      : "bg-muted/60"
                }`}
              />
              <span className="text-xs font-semibold truncate">
                {phase === "building"
                  ? "Building a Zap"
                  : phase === "running"
                    ? "Test run"
                    : "Complete"}
              </span>
              <AnimatePresence mode="wait">
                <motion.span
                  key={`${sceneIdx}-sub`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.25 }}
                  className="text-[10px] font-mono text-muted-foreground truncate"
                >
                  · {scene.subtitle}
                </motion.span>
              </AnimatePresence>
            </div>
            <PhasePill phase={phase} />
          </div>
          <div className="p-3 sm:p-4 flex-1 min-h-[500px] bg-[radial-gradient(circle_at_1px_1px,rgba(0,0,0,0.08)_1px,transparent_0)] [background-size:14px_14px] dark:bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)]">
            <AnimatePresence mode="wait">
              <motion.div
                key={`canvas-${sceneIdx}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ZapCanvas nodes={scene.nodes} built={built} ran={ran} phase={phase} />
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="h-1 bg-border/50 relative">
            <motion.div
              className={`absolute inset-y-0 left-0 ${phase === "complete" ? "bg-green-500" : "bg-muted"}`}
              animate={{ width: `${zapProgress}%` }}
              transition={{ ease: "linear", duration: 0.05 }}
            />
          </div>
        </div>

        {/* Right: Foreman */}
        <div className="relative rounded-xl border-2 border-accent/30 bg-accent/5 overflow-hidden flex flex-col">
          <div className="px-4 sm:px-5 py-3 border-b border-accent/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-accent" />
              <span className="text-xs font-semibold">Foreman</span>
              <span className="text-[10px] font-mono text-muted-foreground">One prompt</span>
            </div>
            <span className="text-[10px] font-mono text-accent tabular-nums">
              {(Math.min(sceneElapsedMs, FOREMAN_MS) / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="p-4 sm:p-5 flex-1 min-h-[500px] flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {promptVisible && (
                <motion.div
                  key={`msg-${sceneIdx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-end"
                >
                  <div className="max-w-[90%] rounded-2xl rounded-br-sm bg-foreground text-background px-4 py-2 text-sm leading-relaxed">
                    {scene.foremanPrompt}
                  </div>
                </motion.div>
              )}

              {traceShown > 0 && (
                <motion.div
                  key={`trace-${sceneIdx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl bg-background/70 border border-border/60 overflow-hidden"
                >
                  <div className="px-3 py-1.5 border-b border-border/50 flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    <span className="text-[10px] font-mono text-muted-foreground">reasoning</span>
                  </div>
                  <div className="px-3 py-2 text-[10px] font-mono space-y-1.5">
                    {scene.trace.slice(0, traceShown).map((c, i) => (
                      <motion.div
                        key={`${sceneIdx}-${i}`}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.25 }}
                        className="flex items-start gap-1.5"
                      >
                        <Check className="h-2.5 w-2.5 text-green-600 dark:text-green-400 mt-[2px] shrink-0" />
                        <div className="min-w-0 flex-1">
                          <span className="text-accent">{c.tool}</span>
                          <span className="text-muted-foreground">
                            <span className="opacity-60">(</span>
                            {c.args}
                            <span className="opacity-60">)</span>
                            <span className="mx-1 opacity-50">→</span>
                          </span>
                          <span className="text-green-600 dark:text-green-400">{c.result}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {draftVisible && (
                <motion.div
                  key={`draft-${sceneIdx}`}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: 0.1 }}
                  className="rounded-xl bg-background border border-accent/30 overflow-hidden"
                >
                  <div className="px-3 py-2 border-b border-accent/10 flex items-center justify-between">
                    <span className="text-[11px] font-medium">{scene.workflowLabel}</span>
                    <span className="text-[9px] uppercase tracking-wider text-accent">draft</span>
                  </div>
                  <div className="px-3 py-2 text-[11px] font-mono space-y-1">
                    {scene.steps.map((s, i) => (
                      <motion.div
                        key={s.app}
                        initial={{ opacity: 0, x: -4 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.08 }}
                        className="flex items-center gap-2"
                      >
                        <AppDot color={s.color} letter={s.letter} />
                        <span>{s.label}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {approvalVisible && (
                <motion.div
                  key={`done-${sceneIdx}`}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-auto flex items-center gap-2 rounded-lg bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20 px-3 py-2 text-sm"
                >
                  <Check className="h-4 w-4" />
                  <span>Ready to run — awaiting approval</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="h-1 bg-accent/10 relative">
            <motion.div
              className="absolute inset-y-0 left-0 bg-accent"
              animate={{ width: `${foremanProgress}%` }}
              transition={{ ease: "linear", duration: 0.05 }}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {phase === "complete" ? (
            <span className="text-accent font-medium">
              Foreman proposed + waited for approval while the Zap was still being built.
            </span>
          ) : phase === "running" ? (
            "Zap is now running. Foreman already has its proposal."
          ) : (
            "Watch a Zap get built vs. Foreman just doing it."
          )}
        </span>
        <div className="flex items-center gap-2">
          {SCENES.map((_, i) => (
            <span
              key={i}
              className={`h-1 w-4 rounded-full transition-colors ${
                i === sceneIdx ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
          <button
            type="button"
            onClick={() => setRunKey((k) => k + 1)}
            className="flex items-center gap-1.5 hover:text-foreground transition-colors ml-2"
            aria-label="Replay"
          >
            <RotateCcw className="h-3 w-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PhasePill({ phase }: { phase: Phase }) {
  if (phase === "building") {
    return (
      <span className="text-[9px] uppercase tracking-widest font-medium text-muted-foreground/80 border border-border rounded px-1.5 py-0.5">
        editing
      </span>
    );
  }
  if (phase === "running") {
    return (
      <span className="text-[9px] uppercase tracking-widest font-medium text-accent border border-accent/30 rounded px-1.5 py-0.5 flex items-center gap-1">
        <Play className="h-2.5 w-2.5" /> running
      </span>
    );
  }
  return (
    <span className="text-[9px] uppercase tracking-widest font-medium text-green-600 dark:text-green-400 border border-green-500/30 rounded px-1.5 py-0.5 flex items-center gap-1">
      <Check className="h-2.5 w-2.5" /> passed
    </span>
  );
}

function ZapCanvas({
  nodes,
  built,
  ran,
  phase,
}: {
  nodes: ZapNode[];
  built: number;
  ran: number;
  phase: Phase;
}) {
  const mainNodes = nodes.filter((n) => n.lane === "main");
  const pathANodes = nodes.filter((n) => n.lane === "pathA");
  const pathBNodes = nodes.filter((n) => n.lane === "pathB");

  const nodeState = (n: number): "empty" | "built" | "running" | "done" => {
    if (built < n) return "empty";
    if (phase === "building") return "built";
    if (ran >= n) return "done";
    if (ran === n - 1 && phase === "running") return "running";
    return "built";
  };

  return (
    <div className="flex flex-col items-center gap-1.5 scale-[0.78] sm:scale-[0.88] origin-top">
      {mainNodes.map((node, i) => (
        <div key={node.id} className="flex flex-col items-center gap-1.5">
          <ZapNodeCard node={node} state={nodeState(node.n)} />
          {i < mainNodes.length - 1 && (
            <Connector active={nodeState(mainNodes[i + 1].n) !== "empty"} />
          )}
        </div>
      ))}

      <div className="grid grid-cols-2 gap-4 sm:gap-8 pt-1">
        <div className="flex flex-col items-center gap-1.5 relative">
          <div className="absolute -top-2 left-1/2 w-px h-2 bg-border" />
          <span className="text-[9px] font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-full border border-border">
            Path A
          </span>
          {pathANodes.map((node, i) => (
            <div key={node.id} className="flex flex-col items-center gap-1.5">
              <ZapNodeCard node={node} state={nodeState(node.n)} compact />
              {i < pathANodes.length - 1 && (
                <Connector active={nodeState(pathANodes[i + 1].n) !== "empty"} />
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1.5 relative">
          <div className="absolute -top-2 left-1/2 w-px h-2 bg-border" />
          <span className="text-[9px] font-mono text-muted-foreground bg-background/80 px-1.5 py-0.5 rounded-full border border-border">
            Path B
          </span>
          {pathBNodes.map((node, i) => (
            <div key={node.id} className="flex flex-col items-center gap-1.5">
              <ZapNodeCard node={node} state={nodeState(node.n)} compact />
              {i < pathBNodes.length - 1 && (
                <Connector active={nodeState(pathBNodes[i + 1].n) !== "empty"} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return <div className={`w-px h-3 transition-colors ${active ? "bg-border" : "bg-border/40"}`} />;
}

function ZapNodeCard({
  node,
  state,
  compact = false,
}: {
  node: ZapNode;
  state: "empty" | "built" | "running" | "done";
  compact?: boolean;
}) {
  const showContent = state !== "empty";
  const isRunning = state === "running";
  const isDone = state === "done";

  return (
    <motion.div
      animate={{
        opacity: state === "empty" ? 0.25 : 1,
        scale: state === "empty" ? 0.98 : 1,
      }}
      transition={{ duration: 0.25 }}
      className={`relative flex items-center gap-2 rounded-lg bg-background border shadow-sm ${
        isRunning
          ? "border-accent/60 shadow-accent/20"
          : isDone
            ? "border-green-500/40"
            : showContent
              ? "border-border"
              : "border-border/40"
      } ${compact ? "px-2 py-1.5 min-w-[140px]" : "px-2.5 py-2 min-w-[180px]"}`}
    >
      {isRunning && (
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-lg border border-accent/40 pointer-events-none"
          animate={{ boxShadow: ["0 0 0 0 rgba(255,74,0,0.25)", "0 0 0 4px rgba(255,74,0,0)"] }}
          transition={{ duration: 0.9, repeat: Infinity }}
        />
      )}
      <span className="text-[9px] font-mono text-muted-foreground tabular-nums w-4 shrink-0">{node.n}.</span>
      <AppDot color={node.color} letter={node.letter} />
      <div className="flex-1 min-w-0 leading-tight">
        <div className={`font-medium truncate ${compact ? "text-[10px]" : "text-[11px]"}`}>
          {node.action}
        </div>
        <div className={`text-muted-foreground truncate ${compact ? "text-[8px]" : "text-[9px]"}`}>
          {node.app}
        </div>
      </div>
      {isDone && (
        <span className="h-3.5 w-3.5 rounded-full bg-green-500/90 text-white flex items-center justify-center shrink-0">
          <Check className="h-2.5 w-2.5" />
        </span>
      )}
      {isRunning && (
        <motion.span
          className="h-2 w-2 rounded-full bg-accent shrink-0"
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
}

function AppDot({ color, letter }: { color: string; letter: string }) {
  return (
    <span
      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-white text-[8px] font-bold"
      style={{ backgroundColor: color }}
    >
      {letter}
    </span>
  );
}
