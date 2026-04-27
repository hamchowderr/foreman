'use client'

import { useEffect, useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { ArrowRight, Search, Zap, ChevronRight, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/client'
import { MessageResponse } from '@/components/ai-elements/message'
import { sanitizeText } from '@/lib/utils'

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://localhost:4111'

const USE_MESSAGES: Record<string, string> = {
  sales: 'What Zapier tables do I have set up?',
  email: 'What Zapier workflows do I have for email?',
  crm: 'What CRM-related Zapier connections do I have?',
  slack: 'What apps am I connected to in Zapier?',
  data: 'What Zapier tables are available for data entry?',
  reports: 'What automation workflows do I have in Zapier?',
  invoices: 'What apps am I connected to in Zapier?',
  leads: 'What apps am I connected to in Zapier?',
  calendar: 'What apps am I connected to in Zapier?',
}

function getPrompt(uses: string[]): string {
  for (const u of uses) {
    if (USE_MESSAGES[u]) return USE_MESSAGES[u]
  }
  return 'What apps am I connected to in Zapier?'
}

function ToolCallBubble({ part }: { part: any }) {
  const [expanded, setExpanded] = useState(false)
  // AI SDK v6: type is "tool-<toolName>", name extracted from type
  const toolName = part.type?.startsWith('tool-') ? part.type.replace(/^tool-/, '') : (part.toolName || 'tool')
  const isSearch = toolName.includes('search') || toolName.includes('list')
  const Icon = isSearch ? Search : Zap
  const hasOutput = part.state === 'output-available' || part.output != null

  return (
    <button
      onClick={() => setExpanded((e) => !e)}
      className="w-full text-left rounded-lg px-3 py-2 transition-colors text-sm"
      style={{
        backgroundColor: '#FFF3E6',
        border: '1px solid #FFBF6E',
      }}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3 w-3 shrink-0" style={{ color: '#FF4F00' }} />
        <span className="flex-1 font-medium text-xs" style={{ color: '#FF4F00' }}>{toolName}</span>
        {hasOutput && <span className="text-[10px]" style={{ color: '#4A7C2F' }}>✓</span>}
        {expanded
          ? <ChevronDown className="h-3 w-3" style={{ color: '#FFBF6E' }} />
          : <ChevronRight className="h-3 w-3" style={{ color: '#FFBF6E' }} />
        }
      </div>
      {expanded && part.input && (
        <div className="mt-2 pt-2 space-y-1" style={{ borderTop: '1px solid #FFBF6E' }}>
          {Object.entries(part.input as Record<string, unknown>).map(([k, v]) => (
            <div key={k} className="flex gap-2 text-[10px]">
              <span style={{ color: '#FFBF6E' }}>{k}:</span>
              <span className="font-medium" style={{ color: '#201515' }}>{String(v)}</span>
            </div>
          ))}
          {hasOutput && part.output && (
            <div className="mt-1.5 pt-1.5 text-[10px]" style={{ borderTop: '1px solid #FFBF6E', color: '#4A7C2F' }}>
              → {typeof part.output === 'string' ? part.output : JSON.stringify(part.output).slice(0, 120)}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

interface Props {
  uses: string[]
  onNext: () => void
}

export function StepTry({ uses, onNext }: Props) {
  const prompt = getPrompt(uses)
  const chatId = useRef(crypto.randomUUID()).current
  const hasSent = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [done, setDone] = useState(false)

  const { messages, sendMessage, status } = useChat({
    id: chatId,
    transport: new DefaultChatTransport({
      api: `${AGENT_URL}/chat/foreman`,
      fetch: async (input, init) => {
        const supabase = createClient()
        const { data: { session } } = await supabase.auth.getSession()
        return fetch(input, {
          ...init,
          headers: {
            ...init?.headers,
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
        })
      },
    }),
  } as any)

  useEffect(() => {
    if (!hasSent.current) {
      hasSent.current = true
      sendMessage({ role: 'user', content: prompt } as any)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  useEffect(() => {
    if (status === 'ready' && messages.length > 1) setDone(true)
  }, [status, messages.length])

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FFBF6E' }}>
          Step 3 of 4
        </p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#201515' }}>
          Try it out
        </h1>
        <p className="text-base" style={{ color: '#6B5050' }}>
          Watch Foreman query your Zapier account in real time.
        </p>
      </div>

      {/* Mini chat */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ border: '1px solid #F0E8E0', backgroundColor: '#FFFFFF' }}
      >
        {/* Chrome bar */}
        <div
          className="flex items-center gap-1.5 px-4 py-2.5"
          style={{ backgroundColor: '#201515', borderBottom: '1px solid #3A2525' }}
        >
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#FF4F00', opacity: 0.6 }} />
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#FFBF6E', opacity: 0.4 }} />
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#CDE4E1', opacity: 0.4 }} />
          <span className="ml-2 text-[10px] uppercase tracking-widest" style={{ color: '#FFBF6E', opacity: 0.6 }}>
            foreman chat
          </span>
          {status === 'streaming' && (
            <span className="ml-auto text-[10px] font-mono animate-pulse" style={{ color: '#FF4F00' }}>
              thinking…
            </span>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="p-4 space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden"
          style={{ minHeight: 200, maxHeight: 320 }}
        >
          {messages.map((msg) => {
            if (msg.role === 'user') {
              return (
                <div key={msg.id} className="flex justify-end">
                  <div
                    className="max-w-[75%] rounded-2xl rounded-br-sm px-3.5 py-2 text-xs leading-relaxed"
                    style={{ backgroundColor: '#FFF3E6', border: '1px solid #FFBF6E', color: '#201515' }}
                  >
                    {(msg.parts as any[])?.find((p: any) => p.type === 'text')?.text || prompt}
                  </div>
                </div>
              )
            }

            // Assistant message — render parts (AI SDK v6: tool parts are "tool-<toolName>")
            const parts: any[] = (msg as any).parts || []
            return (
              <div key={msg.id} className="space-y-2">
                {parts.map((part: any, i: number) => {
                  if (part.type?.startsWith('tool-')) {
                    return <ToolCallBubble key={i} part={part} />
                  }
                  if (part.type === 'text' && part.text) {
                    return (
                      <div key={i} className="flex items-start gap-2.5">
                        <div
                          className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-px text-[9px] font-bold text-white"
                          style={{ backgroundColor: '#FF4F00' }}
                        >
                          F
                        </div>
                        <div
                          className="rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs leading-relaxed max-w-[80%]"
                          style={{ backgroundColor: '#FFFDF9', border: '1px solid #F0E8E0', color: '#201515' }}
                        >
                          <MessageResponse>{sanitizeText(part.text)}</MessageResponse>
                        </div>
                      </div>
                    )
                  }
                  return null
                })}
                {/* Fallback: assistant message with no structured parts */}
                {parts.length === 0 && (() => {
                  const fallbackText = (msg as any).text || ''
                  return fallbackText ? (
                    <div className="flex items-start gap-2.5">
                      <div
                        className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 mt-px text-[9px] font-bold text-white"
                        style={{ backgroundColor: '#FF4F00' }}
                      >
                        F
                      </div>
                      <div
                        className="rounded-2xl rounded-tl-sm px-3.5 py-2 text-xs leading-relaxed max-w-[80%]"
                        style={{ backgroundColor: '#FFFDF9', border: '1px solid #F0E8E0', color: '#201515' }}
                      >
                        <MessageResponse>{sanitizeText(fallbackText)}</MessageResponse>
                      </div>
                    </div>
                  ) : null
                })()}
              </div>
            )
          })}

          {status === 'streaming' && messages.length <= 1 && (
            <div className="flex items-center gap-2">
              <div
                className="h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
                style={{ backgroundColor: '#FF4F00' }}
              >
                F
              </div>
              <div className="flex gap-1">
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="h-1.5 w-1.5 rounded-full animate-bounce"
                    style={{ backgroundColor: '#FFBF6E', animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-2">
        <p className="text-sm" style={{ color: done ? '#4A7C2F' : '#FFBF6E' }}>
          {done ? 'Foreman is working.' : 'Waiting for response…'}
        </p>
        <button
          onClick={onNext}
          disabled={!done}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all"
          style={{
            backgroundColor: done ? '#FF4F00' : '#FFBF6E',
            cursor: done ? 'pointer' : 'not-allowed',
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
