import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 p-4">
      <Link
        href="/"
        className="flex items-center gap-2 font-semibold tracking-tight"
      >
        <Image
          src="/mascot/waving.png"
          alt=""
          width={28}
          height={28}
          className="rounded"
        />
        Broke Besties
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
