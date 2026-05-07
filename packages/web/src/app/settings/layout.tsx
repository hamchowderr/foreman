import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server'
import { SettingsShell } from '@/components/settings/settings-shell'

async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')
  return <SettingsShell>{children}</SettingsShell>
}

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<SettingsShell>{children}</SettingsShell>}>
      <AuthedLayout>{children}</AuthedLayout>
    </Suspense>
  )
}
