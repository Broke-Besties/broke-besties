"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createClient } from "@/lib/supabase-client";
import { ChevronRight, Mail, Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { PageHeader } from "@/components/page-header";
import { createGroup } from "@/app/(app)/groups/actions";

type Member = {
  id: number;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
};

type Group = {
  id: number;
  name: string;
  createdAt: Date | string;
  members: Member[];
  _count: {
    members: number;
  };
};

type GroupsPageClientProps = {
  initialGroups: Group[];
  pendingInviteCount: number;
  autoOpenCreate?: boolean;
};

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

export default function GroupsPageClient({
  initialGroups,
  pendingInviteCount,
  autoOpenCreate = false,
}: GroupsPageClientProps) {
  // Use the prop directly so router.refresh()'s new data renders.
  const groups = initialGroups;
  const [showCreateModal, setShowCreateModal] = useState(autoOpenCreate);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  // Live-refresh the list when group membership changes. The server component
  // re-fetches (scoped to this user), so realtime is only a "refetch now" nudge.
  // ponytail: no postgres_changes filter — Supabase Realtime's filter parser
  // doesn't match Prisma's camelCase "userId" column, so we refresh on any
  // GroupMember change. Fine at this scale. To scope it (and stop broadcasting
  // membership to every client), enable RLS on GroupMember with a self-scoped
  // policy; Realtime then only delivers rows this user can see.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("groups-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "GroupMember" },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const result = await createGroup(newGroupName);
      if (!result.success) {
        toast.error(result.error || "Failed to create group");
        return;
      }
      toast.success(`Group "${newGroupName}" created`);
      setShowCreateModal(false);
      setNewGroupName("");
      router.refresh();
    } catch {
      toast.error("An error occurred while creating the group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Groups"
        description="Split expenses with the people you share costs with."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/invites">
                <Mail />
                Invites
                {pendingInviteCount > 0 && (
                  <Badge variant="secondary">{pendingInviteCount}</Badge>
                )}
              </Link>
            </Button>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus />
              Create group
            </Button>
          </>
        }
      />

      {groups.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Users />
            </EmptyMedia>
            <EmptyTitle>No groups yet</EmptyTitle>
            <EmptyDescription>
              You haven&apos;t joined any groups. Create one to get started.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setShowCreateModal(true)}>
              <Plus />
              Create your first group
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link
              key={group.id}
              href={`/groups/${group.id}`}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Card className="h-full transition hover:bg-accent/40">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-10">
                      <AvatarFallback>{initials(group.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <CardTitle className="truncate text-base">
                        {group.name}
                      </CardTitle>
                      <CardDescription>
                        {group._count.members}{" "}
                        {group._count.members === 1 ? "member" : "members"}
                      </CardDescription>
                    </div>
                    <ChevronRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {group.members.slice(0, 3).map((member) => (
                        <Avatar
                          key={member.id}
                          className="size-7 border-2 border-background"
                        >
                          <AvatarFallback className="text-xs">
                            {initials(member.user.name || member.user.email)}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                    {group._count.members > 3 && (
                      <span className="text-xs text-muted-foreground">
                        +{group._count.members - 3} more
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Dialog
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (!open) setNewGroupName("");
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create new group</DialogTitle>
            <DialogDescription>
              Name your group, then invite friends to split costs.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGroup} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="groupName">Group name</FieldLabel>
              <Input
                id="groupName"
                type="text"
                required
                autoFocus
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Roommates"
              />
            </Field>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={creating}>
                {creating && <Spinner />}
                Create group
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
