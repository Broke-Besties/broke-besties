"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MailPlus, UserPlus } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { StatusBadge } from "@/components/status-badge";
import { cancelInvite } from "./actions";
import { initials, type Invite, type Member } from "./types";

type GroupMembersProps = {
  groupId: number;
  members: Member[];
  invites: Invite[];
  currentUserId: string | undefined;
  onInviteMember: () => void;
};

export function GroupMembers({
  groupId,
  members,
  invites,
  currentUserId,
  onInviteMember,
}: GroupMembersProps) {
  const [cancellingInviteId, setCancellingInviteId] = useState<number | null>(
    null
  );
  const router = useRouter();

  const handleCancelInvite = async (invite: Invite) => {
    setCancellingInviteId(invite.id);

    try {
      const result = await cancelInvite(groupId, invite.id);

      if (!result.success) {
        toast.error(result.error || "Failed to cancel invite");
        return;
      }

      toast.success(`Invite to ${invite.invitedEmail} cancelled`);
      router.refresh();
    } catch {
      toast.error("An error occurred while cancelling the invite");
    } finally {
      setCancellingInviteId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <CardDescription>
            {members.length} {members.length === 1 ? "member" : "members"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="gap-2">
            {members.map((member) => (
              <Item key={member.id} variant="outline" size="sm">
                <ItemMedia>
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {initials(member.user.name || member.user.email)}
                    </AvatarFallback>
                  </Avatar>
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>
                    {member.user.name}
                    {member.user.id === currentUserId && (
                      <span className="text-muted-foreground"> (you)</span>
                    )}
                  </ItemTitle>
                  <ItemDescription>{member.user.email}</ItemDescription>
                </ItemContent>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending invites</CardTitle>
          <CardDescription>
            {invites.length} outstanding
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invites.length === 0 ? (
            <Empty className="border border-dashed">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <MailPlus />
                </EmptyMedia>
                <EmptyTitle>No pending invites</EmptyTitle>
                <EmptyDescription>
                  Everyone you&apos;ve invited has joined. Grow the group by
                  inviting more people.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button variant="outline" onClick={onInviteMember}>
                  <UserPlus />
                  Invite member
                </Button>
              </EmptyContent>
            </Empty>
          ) : (
            <ItemGroup className="gap-2">
              {invites.map((invite) => (
                <Item key={invite.id} variant="outline" size="sm">
                  <ItemMedia>
                    <Avatar className="size-8">
                      <AvatarFallback className="text-xs">
                        {initials(invite.invitedEmail)}
                      </AvatarFallback>
                    </Avatar>
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>{invite.invitedEmail}</ItemTitle>
                    <ItemDescription>
                      Invited by {invite.sender.email}
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <StatusBadge status={invite.status} />
                    {currentUserId === invite.invitedBy && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancellingInviteId === invite.id}
                          >
                            {cancellingInviteId === invite.id && <Spinner />}
                            Cancel
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>
                              Cancel this invite?
                            </AlertDialogTitle>
                            <AlertDialogDescription>
                              {invite.invitedEmail} will no longer be able to
                              join this group with this invite.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep invite</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleCancelInvite(invite)}
                            >
                              Cancel invite
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
