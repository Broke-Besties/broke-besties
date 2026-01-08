import { getUser } from "@/lib/supabase";
import { groupService } from "@/services/group.service";
import { debtService } from "@/services/debt.service";
import { redirect } from "next/navigation";
import GroupDetailPageClient from "./group-detail-client";
import { Suspense } from "react";
import { AppLoading } from "@/components/app-loading";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const groupId = parseInt(id);

  if (isNaN(groupId)) {
    redirect("/groups");
  }

  const user = await getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  try {
    const [group, debts] = await Promise.all([
      groupService.getGroupById(groupId, user.id),
      debtService.getUserDebts(user.id, { groupId }),
    ]);

    return (
      <Suspense fallback={<AppLoading label="Loading group…" />}>
        <GroupDetailPageClient
          initialGroup={group}
          initialDebts={debts}
          currentUser={user}
          groupId={groupId}
        />
      </Suspense>
    );
  } catch (error) {
    console.error("Group detail error:", error);
    redirect("/groups");
  }
}
