import { getUser } from "@/lib/supabase";
import { alertService } from "@/services/alert.service";
import { redirect } from "next/navigation";
import AlertsPageClient from "./alerts-client";

export default async function AlertsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const [lenderAlerts, borrowerAlerts] = await Promise.all([
    alertService.getActiveAlertsForLender(user.id),
    alertService.getActiveAlertsForBorrower(user.id),
  ]);

  return (
    <AlertsPageClient
      lenderAlerts={lenderAlerts}
      borrowerAlerts={borrowerAlerts}
      currentUserId={user.id}
    />
  );
}
