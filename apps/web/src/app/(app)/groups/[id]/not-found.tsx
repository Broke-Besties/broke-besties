import Link from "next/link";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function GroupNotFound() {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Users />
        </EmptyMedia>
        <EmptyTitle>Group not found</EmptyTitle>
        <EmptyDescription>
          This group doesn&apos;t exist or you&apos;re not a member of it.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/groups">Back to groups</Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
