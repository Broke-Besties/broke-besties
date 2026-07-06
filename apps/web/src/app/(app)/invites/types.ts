export type Invite = {
  id: number
  group: {
    id: number
    name: string
    members: {
      user: {
        email: string
      }
    }[]
  }
  sender: {
    name: string
    email: string
  }
  createdAt: Date | string
}

export type PendingInviteAction = {
  id: number
  action: 'accept' | 'reject'
}
