import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="relative">
      <div className="grid gap-10 md:grid-cols-2 md:items-center">
        <div className="space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            REST-first • Groups • Invites • Debts
          </div>

          <h1 className="text-balance text-4xl font-semibold tracking-tight md:text-5xl">
            Split expenses with your groups, without the chaos.
          </h1>
          <p className="text-pretty text-base text-muted-foreground md:text-lg">
            Create groups, invite members, and track who owes what in a clean, modern dashboard.
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button asChild size="lg">
              <Link href="/signup">Create account</Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <Card className="bg-gradient-to-br from-card to-muted/30">
            <CardHeader>
              <CardTitle>Fast group setup</CardTitle>
              <CardDescription>Create a group in seconds and start tracking debts immediately.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                <span className="text-muted-foreground">Weekend trip</span>
                <span className="font-medium">$128.40</span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                <span className="text-muted-foreground">Roommates</span>
                <span className="font-medium">$42.00</span>
              </div>
              <div className="flex items-center justify-between rounded-md border bg-background/60 p-3">
                <span className="text-muted-foreground">Dinner club</span>
                <span className="font-medium">$96.75</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Clear status tracking</CardTitle>
              <CardDescription>Mark items as pending, paid, or not paying.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Everything stays readable—no more gray-on-gray boxes.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
