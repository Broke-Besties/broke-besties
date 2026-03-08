import { TestimonialCarousel } from "./testimonial-carousel";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full bg-background text-foreground flex flex-col md:flex-row">
      {/* Left: Form */}
      <div className="w-full md:w-1/2 flex flex-col items-center justify-center p-6 md:p-12 md:min-h-screen">
        <div className="w-full max-w-sm">{children}</div>
      </div>

      {/* Right: Testimonial Carousel (hidden on mobile) */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-muted to-muted/50 border-l border-border md:min-h-screen">
        <TestimonialCarousel />
      </div>

      {/* Mobile: Testimonial below form */}
      <div className="md:hidden w-full">
        <TestimonialCarousel />
      </div>
    </div>
  );
}
