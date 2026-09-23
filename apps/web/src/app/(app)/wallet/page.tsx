import { getUser } from '@/lib/supabase'
import { walletService } from '@/services/wallet.service'
import { redirect } from 'next/navigation'
import WalletPageClient from './wallet-client'

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ deposit?: string; session_id?: string }>
}) {
  const user = await getUser()

  if (!user) {
    redirect('/login')
  }

  const params = await searchParams

  if (params.deposit === 'success' && params.session_id) {
    await walletService.syncDeposit(params.session_id)
  }

  const { wallet, transactions } = await walletService.getWalletWithTransactions(
    user.id
  )

  return (
    <WalletPageClient
      wallet={wallet}
      transactions={transactions}
      depositStatus={params.deposit ?? null}
    />
  )
}
