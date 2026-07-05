import { MarketingHeader } from "@/components/marketing-header";

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
