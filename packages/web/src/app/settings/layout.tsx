import { redirect } from 'next/navigation'
import { createClient } from '@/lib/server'
import { SettingsShell } from '@/components/settings/settings-shell'

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  return <SettingsShell>{children}</SettingsShell>
}
