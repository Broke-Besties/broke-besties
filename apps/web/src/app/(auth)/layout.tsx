import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";
import { ThemeProvider } from "@/components/theme-provider";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-background text-foreground">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <div className="min-h-screen w-full">
            <Suspense fallback={<AppLoading />}>{children}</Suspense>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
