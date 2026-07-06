import { getUser } from "@/lib/supabase";
import { groupService } from "@/services/group.service";
import { debtService } from "@/services/debt.service";
import { notFound, redirect } from "next/navigation";
import GroupDetailPageClient from "./group-detail-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function GroupDetailPage({ params }: PageProps) {
  const { id } = await params;
  const groupId = parseInt(id);

  if (isNaN(groupId)) {
    notFound();
  }

  const user = await getUser();

  if (!user || !user.email) {
    redirect("/login");
  }

  let group: Awaited<ReturnType<typeof groupService.getGroupById>>;
  let debts: Awaited<ReturnType<typeof debtService.getGroupDebts>>;

  try {
    [group, debts] = await Promise.all([
      groupService.getGroupById(groupId, user.id),
      debtService.getGroupDebts(groupId, user.id),
    ]);
  } catch (error) {
    console.error("Group detail error:", error);
    notFound();
  }

  return (
    <GroupDetailPageClient
      initialGroup={group}
      initialDebts={debts}
      currentUser={user}
      groupId={groupId}
    />
  );
}
