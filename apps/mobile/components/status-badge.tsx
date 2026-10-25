import React from 'react';
import { Badge } from '@/components/ui/badge';

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline';

// Same mapping as the web's StatusBadge.
const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: 'secondary',
  paid: 'outline',
  approved: 'outline',
  rejected: 'destructive',
  cancelled: 'outline',
  not_paying: 'destructive',
  active: 'default',
  inactive: 'outline',
};

export function StatusBadge({ status }: { status: string }) {
  const label = status.replace(/_/g, ' ');
  return (
    <Badge variant={STATUS_VARIANTS[status.toLowerCase()] ?? 'secondary'}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </Badge>
  );
}
