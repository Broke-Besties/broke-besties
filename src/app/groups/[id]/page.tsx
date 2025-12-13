'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'

type Member = {
  id: number
  user: {
    id: string
    email: string
  }
}

type Invite = {
  id: number
  invitedEmail: string
  status: string
  sender: {
    email: string
  }
}

type Group = {
  id: number
  name: string
  createdAt: string
  members: Member[]
  invites: Invite[]
}

export default function GroupDetailPage() {
  const [group, setGroup] = useState<Group | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    if (params.id) {
      fetchGroup()
    }
  }, [params.id])

  const fetchGroup = async () => {
    try {
      const response = await fetch(`/api/groups/${params.id}`)
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(data.error || 'Failed to load group')
        return
      }

      setGroup(data.group)
    } catch (err) {
      setError('An error occurred while loading the group')
    } finally {
      setLoading(false)
    }
  }

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setInviting(true)
    setError('')

    try {
      const response = await fetch('/api/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          groupId: parseInt(params.id as string),
          invitedEmail: inviteEmail,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send invite')
        return
      }

      setShowInviteModal(false)
      setInviteEmail('')
      fetchGroup()
    } catch (err) {
      setError('An error occurred while sending the invite')
    } finally {
      setInviting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600">Group not found</div>
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold">{group.name}</h1>
              <p className="text-gray-600 mt-2">
                Created {new Date(group.createdAt).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Invite Member
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Members ({group.members.length})
            </h2>
            <div className="space-y-3">
              {group.members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded"
                >
                  <div>
                    <p className="font-medium">{member.user.email}</p>
                    <p className="text-sm text-gray-500">Member</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">
              Pending Invites ({group.invites.length})
            </h2>
            {group.invites.length === 0 ? (
              <p className="text-gray-500">No pending invites</p>
            ) : (
              <div className="space-y-3">
                {group.invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded"
                  >
                    <div>
                      <p className="font-medium">{invite.invitedEmail}</p>
                      <p className="text-sm text-gray-500">
                        Invited by {invite.sender.email}
                      </p>
                    </div>
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Invite Member</h2>
              <form onSubmit={handleInvite}>
                <div className="mb-4">
                  <label htmlFor="inviteEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  <input
                    id="inviteEmail"
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowInviteModal(false)
                      setInviteEmail('')
                      setError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                  >
                    {inviting ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
