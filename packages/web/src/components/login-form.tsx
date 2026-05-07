'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import Link from 'next/link'

import { createClient } from '@/lib/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/onboarding')
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-7">
      <div className="text-center">
        <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
        <p className="text-muted-foreground mt-1.5 text-sm">Sign in to your Foreman account</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10 rounded-md"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-sm font-medium">Password</Label>
            <Link
              href="/auth/forgot-password"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10 rounded-md"
          />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-500/5 border border-red-500/20 rounded-md px-3 py-2">
            {error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full h-10 bg-[#ff4a00] hover:bg-[#e64400] text-white rounded-md font-medium"
          disabled={isLoading}
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/auth/sign-up" className="text-foreground font-medium underline underline-offset-4">
          Sign up
        </Link>
      </p>
    </div>
  )
}
