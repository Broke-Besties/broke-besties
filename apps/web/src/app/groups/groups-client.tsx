"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Users } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogOverlay,
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
import { createGroup } from "@/app/groups/actions";

type Group = {
  id: number;
  name: string;
  createdAt: Date | string;
  _count: {
    members: number;
  };
};

type GroupsPageClientProps = {
  initialGroups: Group[];
};

function initials(value: string): string {
  const parts = value.split(/[\s._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || value.slice(0, 2)).toUpperCase();
}

export default function GroupsPageClient({ initialGroups }: GroupsPageClientProps) {
  const [groups] = useState<Group[]>(initialGroups);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const result = await createGroup(newGroupName);
      if (!result.success) {
        toast.error(result.error || "Failed to create group");
        return;
      }
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            My groups
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage your groups and invitations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => router.push("/invites")}>
            Invites
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus />
            Create group
          </Button>
        </div>
      </div>

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
            <Card
              key={group.id}
              role="button"
              tabIndex={0}
              className="cursor-pointer transition hover:bg-accent/40"
              onClick={() => router.push(`/groups/${group.id}`)}
              onKeyDown={(e) =>
                e.key === "Enter" && router.push(`/groups/${group.id}`)
              }
            >
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback>{initials(group.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {group.name}
                    </CardTitle>
                    <CardDescription>
                      {group._count.members}{" "}
                      {group._count.members === 1 ? "member" : "members"}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Created{" "}
                {new Date(group.createdAt).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "numeric",
                  day: "numeric",
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay
            onClick={() => {
              setShowCreateModal(false);
              setNewGroupName("");
            }}
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new group</DialogTitle>
              <DialogDescription>
                Name your group, then invite friends to split costs.
              </DialogDescription>
            </DialogHeader>
            <form
              onSubmit={handleCreateGroup}
              className="space-y-4 px-6 pb-6"
            >
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
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewGroupName("");
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating ? "Creating…" : "Create group"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </div>
      )}
    </div>
  );
}
