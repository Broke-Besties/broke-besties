import { TestimonialCarousel } from "./testimonial-carousel";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      {/* Left: Form */}
      <div className="flex flex-1 flex-col items-center justify-center p-6 md:p-10 md:max-w-[50%]">
        <div className="w-full max-w-xs">{children}</div>
      </div>

      {/* Right: Testimonial Carousel (hidden on mobile) */}
      <div className="hidden md:flex md:flex-1 bg-muted border-l border-border">
        <TestimonialCarousel />
      </div>
    </div>
  );
}
