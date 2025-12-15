'use client'

import { Button } from "@/components/ui/button"
import { logoutAction } from "./actions"

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <Button type="submit" variant="ghost" size="sm">
        Log out
      </Button>
    </form>
  )
}
