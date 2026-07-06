import Link from 'next/link'
import { CalendarClock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

export default function RecurringPaymentNotFound() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CalendarClock />
        </EmptyMedia>
        <EmptyTitle>Recurring payment not found</EmptyTitle>
        <EmptyDescription>
          This recurring payment doesn&apos;t exist or you don&apos;t have access
          to it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/recurring-payments">Back to recurring payments</Link>
        </Button>
      </EmptyContent>
    </Empty>
  )
}
