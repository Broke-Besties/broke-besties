import { Fragment } from "react";
import {
  Item,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
} from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div
      className="flex flex-col gap-6"
      aria-label="Loading friends"
      aria-busy="true"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-56 max-w-full" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-10 w-52" />
      <ItemGroup className="overflow-hidden rounded-lg border">
        {Array.from({ length: 6 }, (_, index) => (
          <Fragment key={index}>
            {index > 0 && <ItemSeparator />}
            <Item size="sm" role="listitem" className="flex-nowrap">
              <ItemMedia>
                <Skeleton className="size-10 rounded-full" />
              </ItemMedia>
              <ItemContent className="min-w-0">
                <Skeleton className="h-4 w-28 max-w-full" />
                <Skeleton className="h-4 w-48 max-w-full" />
              </ItemContent>
              <Skeleton className="size-8 shrink-0" />
            </Item>
          </Fragment>
        ))}
      </ItemGroup>
    </div>
  );
}
