"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  addFriendToGroup,
  createInvite,
  getRecentFriends,
  searchFriendsForInvite,
} from "./actions";
import { initials } from "./types";

type Friend = {
  id: number;
  userId: string;
  name: string;
  email: string;
};

type InviteMemberDialogProps = {
  groupId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InviteMemberDialog({
  groupId,
  open,
  onOpenChange,
}: InviteMemberDialogProps) {
  const [inviteTab, setInviteTab] = useState("friends");
  const [error, setError] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [friendSearch, setFriendSearch] = useState("");
  const [recentFriends, setRecentFriends] = useState<Friend[]>([]);
  const [searchResults, setSearchResults] = useState<Friend[]>([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [searchingFriends, setSearchingFriends] = useState(false);
  const [addingFriendId, setAddingFriendId] = useState<string | null>(null);
  const router = useRouter();

  // Load recent friends when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setLoadingFriends(true);
    getRecentFriends(groupId)
      .then((result) => {
        if (result.success) {
          setRecentFriends(result.friends);
        }
      })
      .finally(() => setLoadingFriends(false));
  }, [open, groupId]);

  // Debounced friend search.
  useEffect(() => {
    if (!friendSearch.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearchingFriends(true);
      searchFriendsForInvite(groupId, friendSearch)
        .then((result) => {
          if (result.success) {
            setSearchResults(result.friends);
          }
        })
        .finally(() => setSearchingFriends(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [friendSearch, groupId]);

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setError("");
      setInviteEmail("");
      setFriendSearch("");
      setInviteTab("friends");
    }
  };

  const handleAddFriend = async (friend: Friend) => {
    setAddingFriendId(friend.userId);
    setError("");

    try {
      const result = await addFriendToGroup(groupId, friend.userId);

      if (!result.success) {
        setError(result.error || "Failed to add friend to group");
        toast.error(result.error || "Failed to add friend to group");
        return;
      }

      toast.success(`${friend.name || friend.email} added to the group`);
      handleOpenChange(false);
      router.refresh();
    } catch {
      setError("An error occurred while adding friend to group");
      toast.error("An error occurred while adding friend to group");
    } finally {
      setAddingFriendId(null);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    setError("");

    try {
      const result = await createInvite(groupId, inviteEmail);

      if (!result.success) {
        setError(result.error || "Failed to send invite");
        toast.error(result.error || "Failed to send invite");
        return;
      }

      toast.success(`Invite sent to ${inviteEmail}`);
      handleOpenChange(false);
      router.refresh();
    } catch {
      setError("An error occurred while sending the invite");
      toast.error("An error occurred while sending the invite");
    } finally {
      setInviting(false);
    }
  };

  const showingSearch = friendSearch.trim().length > 0;
  const friendsList = showingSearch ? searchResults : recentFriends;
  const friendsBusy = loadingFriends || searchingFriends;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite member</DialogTitle>
          <DialogDescription>
            Add a friend directly, or invite someone by email.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTitle>Invite failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Tabs value={inviteTab} onValueChange={setInviteTab}>
          <TabsList className="w-full">
            <TabsTrigger value="friends">Friends</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
          </TabsList>

          <TabsContent value="friends" className="space-y-4">
            <Command shouldFilter={false} className="rounded-md border">
              <CommandInput
                placeholder="Search friends by name or email…"
                value={friendSearch}
                onValueChange={setFriendSearch}
              />
              <CommandList className="max-h-64">
                {friendsBusy ? (
                  <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                    <Spinner />
                    {loadingFriends ? "Loading friends…" : "Searching…"}
                  </div>
                ) : (
                  <>
                    <CommandEmpty>
                      {showingSearch
                        ? "No friends found matching your search."
                        : "No friends available to add. Use the Email tab to invite by email."}
                    </CommandEmpty>
                    {friendsList.length > 0 && (
                      <CommandGroup
                        heading={
                          showingSearch ? "Search results" : "Recent friends"
                        }
                      >
                        {friendsList.map((friend) => (
                          <CommandItem
                            key={friend.userId}
                            value={friend.userId}
                            disabled={addingFriendId !== null}
                            onSelect={() => handleAddFriend(friend)}
                          >
                            <Avatar className="size-7">
                              <AvatarFallback className="text-xs">
                                {initials(friend.name || friend.email)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <div className="truncate text-sm font-medium">
                                {friend.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {friend.email}
                              </div>
                            </div>
                            {addingFriendId === friend.userId && (
                              <Spinner className="ml-auto" />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </>
                )}
              </CommandList>
            </Command>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="email">
            <form onSubmit={handleInvite} className="space-y-4">
              <Field>
                <FieldLabel htmlFor="inviteEmail">Email address</FieldLabel>
                <Input
                  id="inviteEmail"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="member@example.com"
                />
              </Field>
              <DialogFooter>
                <DialogClose asChild>
                  <Button type="button" variant="outline">
                    Cancel
                  </Button>
                </DialogClose>
                <Button type="submit" disabled={inviting}>
                  {inviting && <Spinner />}
                  Send invite
                </Button>
              </DialogFooter>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
