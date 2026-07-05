import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending: "secondary",
  paid: "outline",
  approved: "outline",
  rejected: "destructive",
  cancelled: "outline",
  active: "default",
  inactive: "outline",
  lending: "default",
  borrowing: "secondary",
};

/**
 * One Badge treatment for entity statuses across the app. Variant mapping
 * only — no bespoke colors.
 */
export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const variant = STATUS_VARIANTS[status.toLowerCase()] ?? "secondary";
  return (
    <Badge variant={variant} className={cn("capitalize", className)}>
      {label ?? status}
    </Badge>
  );
}
