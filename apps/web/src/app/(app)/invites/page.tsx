import { getUser } from '@/lib/supabase'
import { inviteService } from '@/services/invite.service'
import { redirect } from 'next/navigation'
import InvitesPageClient from './invites-client'

export default async function InvitesPage() {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const invites = await inviteService.getUserInvites(user.email!)

  return <InvitesPageClient initialInvites={invites} />
}
