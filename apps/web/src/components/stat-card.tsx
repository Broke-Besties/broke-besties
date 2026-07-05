import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Informational stat card (dashboard-01 SectionCards shape). Stat cards are
 * always static — filters and toggles belong in Tabs/ToggleGroup, never here.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: LucideIcon;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardDescription>{label}</CardDescription>
        {Icon && <Icon className="size-4 text-muted-foreground" aria-hidden />}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-semibold tabular-nums")}>{value}</div>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
