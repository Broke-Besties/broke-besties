import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { MarketingHeader } from "@/components/marketing-header";
import { getUser } from "@/lib/supabase";
import { prisma } from "@/lib/prisma";

export default async function LandingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getUser();

  const dbUser = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      })
    : null;
  const userName = dbUser?.name ?? "";

  return (
    <div className="flex flex-col h-[100dvh] overflow-hidden">
      <MarketingHeader user={user} userName={userName} />
      <main className="flex-1 overflow-y-auto overscroll-none">
        <Suspense fallback={<AppLoading />}>{children}</Suspense>
      </main>
    </div>
  );
}
