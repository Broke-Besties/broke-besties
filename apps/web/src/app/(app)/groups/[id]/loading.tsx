import { TablePageSkeleton } from "@/components/page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-4 w-48" />
      <TablePageSkeleton rows={6} />
    </div>
  );
}
