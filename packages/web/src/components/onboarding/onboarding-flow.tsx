'use client'

import { useState } from 'react'
import { StepWelcome } from './step-welcome'
import { StepConnect } from './step-connect'
import { StepTry } from './step-try'
import { StepDone } from './step-done'

const STEPS = 4

interface Props {
  initialStep: number
  initialUses: string
  zapierJustConnected: boolean
}

export function OnboardingFlow({ initialStep, initialUses, zapierJustConnected }: Props) {
  const [step, setStep] = useState(initialStep)
  const [uses, setUses] = useState<string[]>(
    initialUses ? initialUses.split(',').filter(Boolean) : []
  )

  const goNext = () => setStep((s) => Math.min(s + 1, STEPS - 1))
  const goTo = (s: number) => setStep(s)

  return (
    <div className="min-h-svh flex flex-col" style={{ backgroundColor: '#FFFDF9' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid #FFF3E6' }}>
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md text-white text-sm font-bold" style={{ backgroundColor: '#FF4F00' }}>
            F
          </span>
          <span className="text-sm font-semibold tracking-tight" style={{ color: '#201515' }}>Foreman</span>
        </div>

        {/* Step dots */}
        <div className="flex items-center gap-2">
          {Array.from({ length: STEPS }).map((_, i) => (
            <div
              key={i}
              className="rounded-full transition-all duration-300"
              style={{
                width: i === step ? 20 : 6,
                height: 6,
                backgroundColor: i === step ? '#FF4F00' : i < step ? '#FFBF6E' : '#FFF3E6',
                border: `1.5px solid ${i <= step ? '#FF4F00' : '#FFBF6E'}`,
              }}
            />
          ))}
        </div>

        <span className="text-xs font-mono" style={{ color: '#FFBF6E' }}>
          {step + 1} / {STEPS}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {step === 0 && (
            <StepWelcome
              selected={uses}
              onSelect={setUses}
              onNext={goNext}
            />
          )}
          {step === 1 && (
            <StepConnect
              uses={uses}
              zapierJustConnected={zapierJustConnected}
              onNext={goNext}
            />
          )}
          {step === 2 && (
            <StepTry uses={uses} onNext={goNext} />
          )}
          {step === 3 && (
            <StepDone />
          )}
        </div>
      </div>
    </div>
  )
}
