import { getInvitesAction } from '@/actions/invite.actions'
import { redirect } from 'next/navigation'
import InvitesPageClient from './invites-client'

export default async function InvitesPage() {
  const result = await getInvitesAction()

  if (!result.success) {
    redirect('/login')
  }

  return <InvitesPageClient initialInvites={result.invites || []} />
}
