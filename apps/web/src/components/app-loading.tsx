import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AppLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-8">
      {/* Welcome Section Skeleton */}
      <div
        className="flex items-center gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        style={{ animationDelay: "0ms", animationFillMode: "both" }}
      >
        <div className="h-[100px] w-[100px] shrink-0 animate-pulse rounded-xl bg-muted" />
        <div className="space-y-2">
          <div className="h-8 w-64 animate-pulse rounded bg-muted" />
          <div className="h-4 w-80 animate-pulse rounded bg-muted" />
        </div>
      </div>

      {/* Four Summary Cards Skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[100, 150, 200, 250].map((delay, i) => (
          <div
            key={i}
            className="relative rounded-xl p-4 border bg-card/50 animate-in fade-in slide-in-from-bottom-4 duration-500"
            style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
          >
            <div className="absolute top-4 right-4 h-5 w-5 animate-pulse rounded bg-muted" />
            <div className="h-3 w-16 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Doughnut Chart & Upcoming Payments Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          <CardHeader className="pb-2">
            <div className="h-5 w-28 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full animate-pulse rounded-full bg-muted mx-auto max-w-[192px]" />
          </CardContent>
        </Card>

        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "350ms", animationFillMode: "both" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-5 w-36 animate-pulse rounded bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-2">
                  <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Groups & Tabs Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "400ms", animationFillMode: "both" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-5 w-24 animate-pulse rounded bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card
          className="animate-in fade-in slide-in-from-bottom-4 duration-500"
          style={{ animationDelay: "450ms", animationFillMode: "both" }}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="h-5 w-20 animate-pulse rounded bg-muted" />
            <div className="h-8 w-20 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-14 animate-pulse rounded bg-muted" />
                  <div className="h-8 w-12 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <p className="text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
