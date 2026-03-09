"use client"

import { useState } from "react"
import { FriendsHeader } from "./friends-header"
import { FriendsTabs } from "./friends-tabs"
import type { FriendsPageProps } from "./types"

export function FriendsPage({
  friends,
  pendingRequests,
  sentRequests,
  groupCount,
  suggestions,
}: FriendsPageProps) {
  const [activeTab, setActiveTab] = useState("besties")

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <FriendsHeader />
        <FriendsTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          friends={friends}
          pendingRequests={pendingRequests}
          sentRequests={sentRequests}
          suggestions={suggestions}
        />
      </div>
    </main>
  )
}
