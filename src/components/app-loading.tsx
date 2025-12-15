import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AppLoading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl py-12">
      <Card className="overflow-hidden">
        <CardHeader className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 animate-pulse rounded-xl bg-muted" />
            <div className="grid gap-2">
              <div className="h-4 w-44 animate-pulse rounded bg-muted" />
              <div className="h-3 w-64 animate-pulse rounded bg-muted" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="h-10 w-full animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-5/6 animate-pulse rounded-md bg-muted" />
          <div className="h-10 w-2/3 animate-pulse rounded-md bg-muted" />
          <p className="pt-2 text-sm text-muted-foreground">{label}</p>
        </CardContent>
      </Card>
    </div>
  );
}


