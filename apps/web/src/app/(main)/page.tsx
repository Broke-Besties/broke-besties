import { getUser } from "@/lib/supabase";
import { LandingPageClient } from "./landing-client";

export default async function Home() {
  const user = await getUser();

  return <LandingPageClient />;
}
