'use client'

import { useState, useEffect } from 'react'
import { ArrowRight, CheckCircle, Zap, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/client'

const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_SERVER_URL || 'http://localhost:4111'

interface Props {
  uses: string[]
  zapierJustConnected: boolean
  onNext: () => void
}

export function StepConnect({ uses, zapierJustConnected, onNext }: Props) {
  const [connected, setConnected] = useState(zapierJustConnected)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // If we returned from OAuth, show connected state automatically
  useEffect(() => {
    if (zapierJustConnected) setConnected(true)
  }, [zapierJustConnected])

  const handleConnect = async () => {
    setConnecting(true)
    setError(null)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const res = await fetch(`${AGENT_URL}/zapier/web-connect`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error('Failed to initiate connection')

      const { authorizeUrl } = await res.json()
      // Preserve use case selections in URL before leaving
      const returnUrl = new URL(window.location.href)
      returnUrl.searchParams.set('step', '1')
      returnUrl.searchParams.set('uses', uses.join(','))
      window.location.href = authorizeUrl
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setConnecting(false)
    }
  }

  return (
    <div className="space-y-10">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: '#FFBF6E' }}>
          Step 2 of 4
        </p>
        <h1 className="text-3xl font-bold tracking-tight" style={{ color: '#201515' }}>
          Connect your Zapier account
        </h1>
        <p className="text-base" style={{ color: '#6B5050' }}>
          Foreman needs access to your Zapier account to run automations on your behalf.
        </p>
      </div>

      {connected ? (
        <div
          className="flex items-start gap-4 rounded-2xl p-6"
          style={{ backgroundColor: '#F6FFDB', border: '2px solid #C8E89A' }}
        >
          <CheckCircle className="h-6 w-6 mt-0.5 shrink-0" style={{ color: '#4A7C2F' }} />
          <div>
            <p className="font-semibold" style={{ color: '#2B4A1A' }}>Zapier connected</p>
            <p className="text-sm mt-0.5" style={{ color: '#4A7C2F' }}>
              Your Zapier account is linked to Foreman. You&apos;re ready for the next step.
            </p>
          </div>
        </div>
      ) : (
        <div
          className="rounded-2xl p-8 space-y-6"
          style={{ backgroundColor: '#201515', border: '1px solid #3A2525' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 items-center justify-center rounded-xl"
              style={{ backgroundColor: '#FF4F00' }}
            >
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-semibold text-white">Zapier</p>
              <p className="text-xs" style={{ color: '#FFBF6E' }}>6,000+ app integrations</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {['Read your workflows and connections', 'Run actions on your behalf', 'Access your Zapier Tables'].map((item) => (
              <div key={item} className="flex items-center gap-2.5 text-sm" style={{ color: '#CDE4E1' }}>
                <div className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: '#FF4F00' }} />
                {item}
              </div>
            ))}
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2" style={{ backgroundColor: '#3A2020', color: '#FF8080' }}>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white transition-all"
            style={{ backgroundColor: connecting ? '#CC3F00' : '#FF4F00' }}
          >
            <Zap className="h-4 w-4" />
            {connecting ? 'Redirecting to Zapier…' : 'Connect Zapier'}
          </button>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          onClick={onNext}
          disabled={!connected}
          className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all"
          style={{
            backgroundColor: connected ? '#FF4F00' : '#FFBF6E',
            cursor: connected ? 'pointer' : 'not-allowed',
          }}
        >
          Continue
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
