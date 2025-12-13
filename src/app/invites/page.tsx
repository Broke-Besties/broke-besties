'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

type Invite = {
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
    email: string
  }
  createdAt: string
}

export default function InvitesPage() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [processingId, setProcessingId] = useState<number | null>(null)
  const router = useRouter()

  useEffect(() => {
    fetchInvites()
  }, [])

  const fetchInvites = async () => {
    try {
      const response = await fetch('/api/invites')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(data.error || 'Failed to load invites')
        return
      }

      setInvites(data.invites)
    } catch (err) {
      setError('An error occurred while loading invites')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (inviteId: number) => {
    setProcessingId(inviteId)
    setError('')

    try {
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inviteId }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to accept invite')
        return
      }

      fetchInvites()
      router.push(`/groups/${data.group.id}`)
    } catch (err) {
      setError('An error occurred while accepting the invite')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-6">
          <button
            onClick={() => router.push('/groups')}
            className="text-blue-600 hover:text-blue-700 mb-4"
          >
            ← Back to Groups
          </button>
          <h1 className="text-3xl font-bold">Pending Invitations</h1>
          <p className="text-gray-600 mt-2">
            You have {invites.length} pending {invites.length === 1 ? 'invitation' : 'invitations'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
          </div>
        )}

        {invites.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">You don't have any pending invitations.</p>
            <button
              onClick={() => router.push('/groups')}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              View My Groups
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {invites.map((invite) => (
              <div
                key={invite.id}
                className="bg-white rounded-lg shadow p-6"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">
                      {invite.group.name}
                    </h3>
                    <p className="text-gray-600 mb-2">
                      Invited by <span className="font-medium">{invite.sender.email}</span>
                    </p>
                    <p className="text-sm text-gray-500">
                      {invite.group.members.length} {invite.group.members.length === 1 ? 'member' : 'members'}
                    </p>
                    <p className="text-sm text-gray-500">
                      Invited {new Date(invite.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => handleAccept(invite.id)}
                      disabled={processingId === invite.id}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {processingId === invite.id ? 'Accepting...' : 'Accept Invite'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
