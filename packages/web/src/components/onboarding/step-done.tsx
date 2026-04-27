'use client'

import { useRouter } from 'next/navigation'
import { CheckCircle, Zap, MessageSquare, ShieldCheck } from 'lucide-react'

const FEATURES = [
  { icon: Zap, label: 'Zapier connected', color: '#FF4F00' },
  { icon: MessageSquare, label: 'Chat with Foreman', color: '#2B2358' },
  { icon: ShieldCheck, label: 'Approval before every action', color: '#4A7C2F' },
]

export function StepDone() {
  const router = useRouter()

  return (
    <div className="space-y-10 text-center">
      <div className="space-y-4">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FFBF6E' }}>
          Step 4 of 4
        </p>
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: '#FFF3E6', border: '2px solid #FF4F00' }}
        >
          <CheckCircle className="h-8 w-8" style={{ color: '#FF4F00' }} />
        </div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#201515' }}>
          You&apos;re ready to go
        </h1>
        <p className="text-base mx-auto max-w-sm" style={{ color: '#6B5050' }}>
          Foreman is connected to your Zapier account. Tell it what to do in plain English.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 text-left">
        {FEATURES.map(({ icon: Icon, label, color }) => (
          <div
            key={label}
            className="flex flex-col gap-3 rounded-xl p-4"
            style={{ backgroundColor: '#FFF3E6', border: '1px solid #F0E8E0' }}
          >
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ backgroundColor: color + '18' }}
            >
              <Icon className="h-4 w-4" style={{ color }} />
            </div>
            <p className="text-xs font-semibold leading-tight" style={{ color: '#201515' }}>{label}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() => router.push('/chat')}
        className="inline-flex items-center gap-2.5 rounded-xl px-8 py-3.5 text-sm font-bold text-white transition-all"
        style={{ backgroundColor: '#FF4F00' }}
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
          F
        </span>
        Enter Foreman
      </button>
    </div>
  )
}
