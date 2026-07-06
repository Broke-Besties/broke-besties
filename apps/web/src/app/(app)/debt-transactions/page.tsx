import { redirect } from 'next/navigation'

// This route duplicated the requests inbox. Old links and notifications may
// still point here, so keep it as a permanent redirect to the single inbox.
export default function DebtTransactionsPage() {
  redirect('/debts/requests')
}
