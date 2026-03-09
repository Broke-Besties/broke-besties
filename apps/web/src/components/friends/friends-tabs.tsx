"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { BestiesList } from "./besties-list"
import { RequestsList } from "./requests-list"
import { DiscoverGrid } from "./discover-grid"
import type { FriendWithUser, PendingRequest, SuggestedUser } from "./types"

interface FriendsTabsProps {
  activeTab: string
  onTabChange: (tab: string) => void
  friends: FriendWithUser[]
  pendingRequests: PendingRequest[]
  sentRequests: PendingRequest[]
  suggestions: SuggestedUser[]
}

export function FriendsTabs({
  activeTab,
  onTabChange,
  friends,
  pendingRequests,
  sentRequests,
  suggestions,
}: FriendsTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      <TabsList className="w-full h-9 bg-secondary border border-border/40 p-0.5 rounded-lg gap-0">
        <TabsTrigger
          value="besties"
          className="flex-1 h-8 text-[12px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground rounded-md transition-all"
        >
          My Besties
        </TabsTrigger>
        <TabsTrigger
          value="requests"
          className="flex-1 h-8 text-[12px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground rounded-md transition-all"
        >
          <span>Requests</span>
          {pendingRequests.length > 0 && (
            <Badge
              variant="secondary"
              className="ml-1.5 h-4 min-w-4 px-1 text-[10px] bg-destructive/80 text-white border-0 rounded-full"
            >
              {pendingRequests.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="discover"
          className="flex-1 h-8 text-[12px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=inactive]:text-muted-foreground rounded-md transition-all"
        >
          Discover
        </TabsTrigger>
      </TabsList>

      <TabsContent value="besties" className="mt-4">
        <BestiesList friends={friends} />
      </TabsContent>
      <TabsContent value="requests" className="mt-4">
        <RequestsList pendingRequests={pendingRequests} />
      </TabsContent>
      <TabsContent value="discover" className="mt-4">
        <DiscoverGrid suggestions={suggestions} />
      </TabsContent>
    </Tabs>
  )
}
