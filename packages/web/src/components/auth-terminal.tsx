'use client'

import { useEffect, useState, useRef } from 'react'
import { CheckCircle, Clock, Zap, Search, ChevronDown, ChevronRight, ShieldAlert, Check, X } from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type ChatItem =
  | { kind: 'user'; text: string }
  | { kind: 'thinking' }
  | { kind: 'tool-call'; icon: 'search' | 'zap'; name: string; params: Record<string, string>; result?: string }
  | { kind: 'approval'; action: string; app: string; fields: Record<string, string> }
  | { kind: 'approved' }
  | { kind: 'result'; text: string }

type Scenario = {
  label: string
  script: { item: ChatItem; delay: number }[]
}

// ─── Scenarios ────────────────────────────────────────────────────────────────

const SCENARIOS: Scenario[] = [
  {
    label: 'Add sales data',
    script: [
      { item: { kind: 'user', text: "Add yesterday's sales to my Q2 tracker sheet" }, delay: 700 },
      { item: { kind: 'thinking' }, delay: 850 },
      {
        item: {
          kind: 'tool-call', icon: 'search', name: 'search-tables',
          params: { query: 'Q2 tracker', limit: '5' },
          result: 'Found: "Q2 Sales Tracker" (id: tbl_8x2k)',
        }, delay: 950,
      },
      {
        item: {
          kind: 'tool-call', icon: 'zap', name: 'create-record',
          params: { table: 'Q2 Sales Tracker', date: 'Apr 26 2026', revenue: '$4,821', orders: '38' },
        }, delay: 400,
      },
      {
        item: {
          kind: 'approval', action: 'create-record', app: 'Zapier Tables',
          fields: { Table: 'Q2 Sales Tracker', Date: 'Apr 26 2026', Revenue: '$4,821', Orders: '38' },
        }, delay: 1600,
      },
      { item: { kind: 'approved' }, delay: 600 },
      { item: { kind: 'result', text: 'Row added to "Q2 Sales Tracker" — 39 total records.' }, delay: 0 },
    ],
  },
  {
    label: 'Run weekly digest',
    script: [
      { item: { kind: 'user', text: 'Run my weekly email digest workflow' }, delay: 700 },
      { item: { kind: 'thinking' }, delay: 800 },
      {
        item: {
          kind: 'tool-call', icon: 'search', name: 'search-workflows',
          params: { query: 'weekly email digest' },
          result: 'Found: "Weekly Digest" (3 steps)',
        }, delay: 900,
      },
      {
        item: {
          kind: 'tool-call', icon: 'zap', name: 'run-workflow',
          params: { workflow: 'Weekly Digest', trigger: 'manual' },
        }, delay: 400,
      },
      {
        item: {
          kind: 'approval', action: 'run-workflow', app: 'Zapier Workflows',
          fields: { Workflow: 'Weekly Digest', Steps: 'Sheets → Gmail → Slack', Trigger: 'Manual' },
        }, delay: 1600,
      },
      { item: { kind: 'approved' }, delay: 600 },
      { item: { kind: 'result', text: 'Workflow complete — digest sent to 12 subscribers.' }, delay: 0 },
    ],
  },
  {
    label: 'List connections',
    script: [
      { item: { kind: 'user', text: 'What apps am I connected to in Zapier?' }, delay: 700 },
      { item: { kind: 'thinking' }, delay: 750 },
      {
        item: {
          kind: 'tool-call', icon: 'search', name: 'list-connections',
          params: { limit: '20' },
          result: '14 connections found',
        }, delay: 900,
      },
      {
        item: {
          kind: 'result',
          text: 'Gmail · Slack · Notion · HubSpot · Airtable · Sheets · Stripe · Jira +6 more',
        }, delay: 0,
      },
    ],
  },
]

// ─── Main component ───────────────────────────────────────────────────────────

export function AuthTerminal() {
  const [scenarioIdx, setScenarioIdx] = useState(0)
  const [items, setItems] = useState<ChatItem[]>([])
  const [typedText, setTypedText] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [items, typedText])

  useEffect(() => {
    let cancelled = false

    async function run(idx: number) {
      const { script } = SCENARIOS[idx]

      for (const { item, delay: d } of script) {
        if (cancelled) return

        if (item.kind === 'user') {
          setIsTyping(true)
          for (let c = 0; c <= item.text.length; c++) {
            if (cancelled) return
            setTypedText(item.text.slice(0, c))
            await sleep(34)
          }
          setIsTyping(false)
          setItems((v) => [...v, item])
          setTypedText('')
        } else {
          setItems((v) => [...v, item])
        }

        if (d > 0) await sleep(d)
      }

      await sleep(3000)
      if (cancelled) return

      setItems([])
      setTypedText('')
      await sleep(500)
      if (!cancelled) setScenarioIdx((i) => (i + 1) % SCENARIOS.length)
    }

    run(scenarioIdx)
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenarioIdx])

  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/50 backdrop-blur-sm overflow-hidden font-mono text-sm flex flex-col">
      {/* Chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/[0.05] bg-white/[0.015] shrink-0">
        <div className="h-2 w-2 rounded-full bg-[#ff4a00]/50" />
        <div className="h-2 w-2 rounded-full bg-yellow-500/30" />
        <div className="h-2 w-2 rounded-full bg-emerald-500/30" />
        <span className="ml-2 text-[10px] text-white/20 tracking-widest uppercase">foreman chat</span>
        <div className="ml-auto flex items-center gap-1">
          {SCENARIOS.map((s, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-400 ${
                i === scenarioIdx ? 'w-5 bg-[#ff4a00]/50' : 'w-1 bg-white/10'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Scrollable messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2.5 min-h-[220px] max-h-[260px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {items.map((item, i) => (
          <ChatBubble key={`${scenarioIdx}-${i}`} item={item} />
        ))}

        {/* Live typing */}
        {(isTyping || typedText) && (
          <div className="flex justify-end animate-fade-in">
            <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#ff4a00]/15 border border-[#ff4a00]/20 px-3.5 py-2 text-white/80 text-xs leading-relaxed">
              {typedText}
              <span className="animate-pulse text-[#ff4a00]">▋</span>
            </div>
          </div>
        )}

        {!isTyping && !typedText && items.length === 0 && (
          <div className="flex items-center gap-2 text-white/15 pt-1">
            <span className="text-[#ff4a00]/40">›</span>
            <span className="animate-pulse">▋</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Bubble renderer ──────────────────────────────────────────────────────────

function ChatBubble({ item }: { item: ChatItem }) {
  const [expanded, setExpanded] = useState(false)

  if (item.kind === 'user') {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-[#ff4a00]/15 border border-[#ff4a00]/20 px-3.5 py-2 text-white/80 text-xs leading-relaxed">
          {item.text}
        </div>
      </div>
    )
  }

  if (item.kind === 'thinking') {
    return (
      <div className="flex items-center gap-2 animate-fade-in">
        <div className="h-5 w-5 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
          <Clock className="h-2.5 w-2.5 text-white/30" />
        </div>
        <div className="flex gap-1 items-center">
          <span className="h-1.5 w-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="h-1.5 w-1.5 rounded-full bg-white/20 animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    )
  }

  if (item.kind === 'tool-call') {
    const Icon = item.icon === 'search' ? Search : Zap
    const hasResult = !!item.result
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="w-full text-left rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 hover:bg-white/[0.05] transition-colors"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-3 w-3 text-[#ff4a00]/70 shrink-0" />
            <span className="text-[#ff4a00]/70 text-xs font-medium flex-1">{item.name}</span>
            {hasResult && (
              <span className="text-emerald-400/50 text-[10px]">✓</span>
            )}
            {expanded
              ? <ChevronDown className="h-3 w-3 text-white/20" />
              : <ChevronRight className="h-3 w-3 text-white/20" />
            }
          </div>

          {expanded && (
            <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
              {Object.entries(item.params).map(([k, v]) => (
                <div key={k} className="flex gap-2 text-[10px]">
                  <span className="text-white/25 shrink-0">{k}:</span>
                  <span className="text-white/50 font-medium">{v}</span>
                </div>
              ))}
              {item.result && (
                <div className="mt-1.5 pt-1.5 border-t border-white/5 text-[10px] text-emerald-400/60">
                  → {item.result}
                </div>
              )}
            </div>
          )}
        </button>
      </div>
    )
  }

  if (item.kind === 'approval') {
    return (
      <div className="animate-fade-in rounded-xl border border-[#ff4a00]/30 bg-[#ff4a00]/[0.04] overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-[#ff4a00]/15 bg-[#ff4a00]/[0.06]">
          <ShieldAlert className="h-3.5 w-3.5 text-[#ff4a00]" />
          <span className="text-[#ff4a00] text-[11px] font-semibold tracking-wide uppercase">Approval Required</span>
        </div>
        <div className="px-3 py-2.5 space-y-1.5">
          <div className="text-[10px] text-white/30 uppercase tracking-wide">{item.app} · {item.action}</div>
          <div className="space-y-1">
            {Object.entries(item.fields).map(([k, v]) => (
              <div key={k} className="flex items-baseline gap-2 text-xs">
                <span className="text-white/30 w-16 shrink-0">{k}</span>
                <span className="text-white/70 font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 pt-1">
            <div className="flex items-center gap-1 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[10px] text-emerald-400 font-medium">
              <Check className="h-2.5 w-2.5" /> Approve
            </div>
            <div className="flex items-center gap-1 rounded-md bg-white/5 border border-white/10 px-2.5 py-1 text-[10px] text-white/30">
              <X className="h-2.5 w-2.5" /> Decline
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (item.kind === 'approved') {
    return (
      <div className="flex items-center gap-2 animate-fade-in">
        <Check className="h-3 w-3 text-emerald-400/60 shrink-0" />
        <span className="text-emerald-400/60 text-xs">Approved — executing...</span>
      </div>
    )
  }

  if (item.kind === 'result') {
    return (
      <div className="flex items-start gap-2.5 animate-fade-in">
        <div className="h-5 w-5 rounded-full bg-[#ff4a00]/10 border border-[#ff4a00]/20 flex items-center justify-center shrink-0 mt-px">
          <span className="text-[#ff4a00] text-[9px] font-bold">F</span>
        </div>
        <div className="rounded-2xl rounded-tl-sm bg-white/[0.05] border border-white/[0.07] px-3.5 py-2 text-white/70 text-xs leading-relaxed max-w-[80%]">
          {item.text}
        </div>
      </div>
    )
  }

  return null
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
