"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  initialGroups: any[];
};

export default function GroupsPageClient({ initialGroups }: GroupsPageClientProps) {
  const [groups] = useState<Group[]>(initialGroups);
  const [error, setError] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const router = useRouter();

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError("");

    try {
      const result = await createGroup(newGroupName);

      if (!result.success) {
        setError(result.error || "Failed to create group");
        return;
      }

      setShowCreateModal(false);
      setNewGroupName("");
      router.refresh();
    } catch (err) {
      setError("An error occurred while creating the group");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">My groups</h1>
          <p className="text-sm text-muted-foreground">
            Manage your groups and invitations.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => router.push("/dashboard")}>
            Dashboard
          </Button>
          <Button variant="secondary" onClick={() => router.push("/invites")}>
            Invites
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>Create group</Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {groups.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No groups yet</CardTitle>
            <CardDescription>
              You haven&apos;t joined any groups. Create one to get started.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setShowCreateModal(true)}>
              Create your first group
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Card
              key={group.id}
              className="cursor-pointer transition hover:-translate-y-0.5 hover:shadow-md"
              onClick={() => router.push(`/groups/${group.id}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{group.name}</CardTitle>
                <CardDescription>
                  {group._count.members}{" "}
                  {group._count.members === 1 ? "member" : "members"}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                Created {new Date(group.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric' })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 z-50">
          <DialogOverlay />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new group</DialogTitle>
            </DialogHeader>
            <div className="px-6 pb-6">
              <form onSubmit={handleCreateGroup} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="groupName">Group name</Label>
                  <Input
                    id="groupName"
                    type="text"
                    required
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="e.g. Roommates"
                  />
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewGroupName("");
                      setError("");
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={creating}>
                    {creating ? "Creating…" : "Create group"}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          </DialogContent>
        </div>
      )}
    </div>
  );
}
