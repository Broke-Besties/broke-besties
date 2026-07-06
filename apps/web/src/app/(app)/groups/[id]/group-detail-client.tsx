"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronDown,
  CircleDollarSign,
  Plus,
  ReceiptText,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { updateDebtStatus } from "./actions";
import { CreateDebtsSheet } from "./create-debts-sheet";
import { GroupDebtChart } from "./group-debt-chart";
import { GroupDebtsList } from "./group-debts-list";
import { GroupMembers } from "./group-members";
import { GroupSpendingChart } from "./group-spending-chart";
import { InviteMemberDialog } from "./invite-member-dialog";
import type { Debt, Group } from "./types";

type GroupDetailPageClientProps = {
  initialGroup: Group;
  initialDebts: Debt[];
  currentUser: User | null;
  groupId: number;
};

export default function GroupDetailPageClient({
  initialGroup,
  initialDebts,
  currentUser,
  groupId,
}: GroupDetailPageClientProps) {
  // Use the prop directly so router.refresh()'s new data renders.
  const group = initialGroup;
  const [debts, setDebts] = useState<Debt[]>(initialDebts);
  const [activeTab, setActiveTab] = useState("overview");
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [showDebtSheet, setShowDebtSheet] = useState(false);
  const router = useRouter();

  // Sync debts state with initialDebts when it changes (after refresh)
  useEffect(() => {
    setDebts(initialDebts);
  }, [initialDebts]);

  const stats = useMemo(() => {
    const pending = debts.filter((d) => d.status === "pending");
    const youOwe = pending
      .filter((d) => d.borrower.id === currentUser?.id)
      .reduce((sum, d) => sum + d.amount, 0);
    const youAreOwed = pending
      .filter((d) => d.lender.id === currentUser?.id)
      .reduce((sum, d) => sum + d.amount, 0);
    const outstanding = pending.reduce((sum, d) => sum + d.amount, 0);
    return { youOwe, youAreOwed, outstanding };
  }, [debts, currentUser?.id]);

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    // Store the old status in case we need to revert
    const oldStatus = debts.find((d) => d.id === debtId)?.status;

    // Optimistically update the UI
    setDebts((prevDebts) =>
      prevDebts.map((debt) =>
        debt.id === debtId ? { ...debt, status: newStatus } : debt
      )
    );

    const revert = () => {
      if (oldStatus) {
        setDebts((prevDebts) =>
          prevDebts.map((debt) =>
            debt.id === debtId ? { ...debt, status: oldStatus } : debt
          )
        );
      }
    };

    try {
      const result = await updateDebtStatus(debtId, newStatus);

      if (!result.success) {
        toast.error(result.error || "Failed to update status");
        revert();
        return;
      }

      toast.success(`Debt marked as ${newStatus}`);
      router.refresh();
    } catch {
      toast.error("An error occurred while updating the status");
      revert();
    }
  };

  const createdDate = new Date(group.createdAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbs={[
          { label: "Groups", href: "/groups" },
          { label: group.name },
        ]}
        title={group.name}
        description={`Created ${createdDate} · ${group.members.length} ${
          group.members.length === 1 ? "member" : "members"
        }`}
        actions={
          <>
            <Button onClick={() => setShowDebtSheet(true)}>
              <Plus />
              Add debt
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  More
                  <ChevronDown />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/ai?group=${groupId}`}>
                    <Sparkles />
                    Create with AI
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setShowInviteDialog(true)}>
                  <UserPlus />
                  Invite member
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="You owe"
          value={`$${stats.youOwe.toFixed(2)}`}
          icon={ArrowUpRight}
        />
        <StatCard
          label="You're owed"
          value={`$${stats.youAreOwed.toFixed(2)}`}
          icon={ArrowDownLeft}
        />
        <StatCard
          label="Outstanding"
          value={`$${stats.outstanding.toFixed(2)}`}
          icon={CircleDollarSign}
          hint="All pending debts in this group"
        />
        <StatCard
          label="Members"
          value={group.members.length}
          icon={Users}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {debts.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <ReceiptText />
                </EmptyMedia>
                <EmptyTitle>No debts yet</EmptyTitle>
                <EmptyDescription>
                  Track who owes who by adding the first debt to this group.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={() => setShowDebtSheet(true)}>
                  <Plus />
                  Add the first debt
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
              <div className="space-y-6">
                <GroupDebtChart
                  members={group.members}
                  debts={debts}
                  currentUserId={currentUser?.id}
                />
                <GroupSpendingChart debts={debts} />
              </div>
              <GroupDebtsList
                debts={debts}
                currentUser={currentUser}
                onUpdateStatus={handleUpdateStatus}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="members">
          <GroupMembers
            groupId={groupId}
            members={group.members}
            invites={group.invites}
            currentUserId={currentUser?.id}
            onInviteMember={() => setShowInviteDialog(true)}
          />
        </TabsContent>
      </Tabs>

      <InviteMemberDialog
        groupId={groupId}
        open={showInviteDialog}
        onOpenChange={setShowInviteDialog}
      />

      <CreateDebtsSheet
        groupId={groupId}
        members={group.members}
        currentUserId={currentUser?.id}
        open={showDebtSheet}
        onOpenChange={setShowDebtSheet}
      />
    </div>
  );
}
