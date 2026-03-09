import { Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface MutualsBadgeProps {
  count: number
  variant?: "default" | "compact"
  showIcon?: boolean
}

export function MutualsBadge({ count, variant = "default", showIcon = true }: MutualsBadgeProps) {
  const label = count === 1 ? "mutual friend" : "mutual friends"

  if (variant === "compact") {
    return (
      <Badge
        variant="secondary"
        className="text-[10px] px-2 py-0.5 border border-border/40 bg-muted/40 text-muted-foreground font-medium rounded-full flex items-center gap-1.5 w-fit"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-money-positive inline-block shrink-0" />
        {count} {label}
      </Badge>
    )
  }

  return (
    <Badge
      variant="secondary"
      className="text-[10px] px-2 py-0.5 border border-border/40 bg-muted/40 text-muted-foreground font-medium rounded-full flex items-center gap-1 w-fit"
    >
      {showIcon && <Users className="h-2.5 w-2.5 text-money-positive" />}
      <span>{count} {label}</span>
    </Badge>
  )
}
