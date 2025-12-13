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

type Debt = {
  id: number
  amount: number
  description: string | null
  status: string
  createdAt: string
  lender: {
    id: string
    email: string
  }
  borrower: {
    id: string
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

type User = {
  id: string
  email: string
}

export default function GroupDetailPage() {
  const [group, setGroup] = useState<Group | null>(null)
  const [debts, setDebts] = useState<Debt[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [showDebtModal, setShowDebtModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviting, setInviting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [debtFormData, setDebtFormData] = useState({
    amount: '',
    description: '',
    borrowerEmail: '',
  })
  const router = useRouter()
  const params = useParams()

  useEffect(() => {
    if (params.id) {
      fetchGroup()
      fetchDebts()
      fetchCurrentUser()
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

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/user')
      const data = await response.json()

      if (response.ok) {
        setCurrentUser(data.user)
      }
    } catch (err) {
      console.error('Error fetching user:', err)
    }
  }

  const fetchDebts = async () => {
    try {
      const response = await fetch(`/api/debts?groupId=${params.id}`)
      const data = await response.json()

      if (response.ok) {
        setDebts(data.debts)
      }
    } catch (err) {
      console.error('Error fetching debts:', err)
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

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      // First, find the user by email
      const userResponse = await fetch(`/api/users/search?email=${encodeURIComponent(debtFormData.borrowerEmail)}`)
      const userData = await userResponse.json()

      if (!userResponse.ok) {
        setError(userData.error || 'User not found')
        setCreating(false)
        return
      }

      const response = await fetch('/api/debts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(debtFormData.amount),
          description: debtFormData.description || null,
          borrowerId: userData.user.id,
          groupId: parseInt(params.id as string),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create debt')
        return
      }

      setShowDebtModal(false)
      setDebtFormData({ amount: '', description: '', borrowerEmail: '' })
      fetchDebts()
    } catch (err) {
      setError('An error occurred while creating the debt')
    } finally {
      setCreating(false)
    }
  }

  const handleUpdateStatus = async (debtId: number, newStatus: string) => {
    try {
      const response = await fetch(`/api/debts/${debtId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to update status')
        return
      }

      // Refresh debts list
      fetchDebts()
    } catch (err) {
      setError('An error occurred while updating the status')
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
            <div className="space-x-3">
              <button
                onClick={() => setShowDebtModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Create Debt
              </button>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Invite Member
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
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

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">
            Group Debts ({debts.length})
          </h2>
          {debts.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No debts in this group yet</p>
          ) : (
            <div className="space-y-3">
              {debts.map((debt) => {
                const isLender = currentUser?.id === debt.lender.id
                return (
                  <div
                    key={debt.id}
                    className={`p-4 bg-gray-50 rounded border-l-4 ${
                      isLender ? 'border-green-500' : 'border-red-500'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          {isLender ? (
                            <span>
                              <span className="text-green-600">You lent to</span> {debt.borrower.email}
                            </span>
                          ) : (
                            <span>
                              <span className="text-red-600">You borrowed from</span> {debt.lender.email}
                            </span>
                          )}
                        </p>
                        {debt.description && (
                          <p className="text-sm text-gray-600 mt-1">{debt.description}</p>
                        )}
                      </div>
                      <span className={`text-lg font-bold ${
                        isLender ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${debt.amount.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-500">{new Date(debt.createdAt).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={debt.status}
                          onChange={(e) => handleUpdateStatus(debt.id, e.target.value)}
                          className={`px-2 py-1 rounded text-xs border cursor-pointer ${
                            debt.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800 border-yellow-300'
                              : debt.status === 'paid'
                              ? 'bg-green-100 text-green-800 border-green-300'
                              : 'bg-red-100 text-red-800 border-red-300'
                          }`}
                        >
                          <option value="pending">Pending</option>
                          <option value="paid">Paid</option>
                          <option value="not_paying">Not Paying</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {showInviteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
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

        {showDebtModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Create New Debt</h2>
              <form onSubmit={handleCreateDebt}>
                <div className="mb-4">
                  <label htmlFor="borrowerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Borrower Email (must be a group member)
                  </label>
                  <input
                    id="borrowerEmail"
                    type="email"
                    required
                    value={debtFormData.borrowerEmail}
                    onChange={(e) => setDebtFormData({ ...debtFormData, borrowerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="borrower@example.com"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="debtAmount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ($)
                  </label>
                  <input
                    id="debtAmount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={debtFormData.amount}
                    onChange={(e) => setDebtFormData({ ...debtFormData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="debtDescription" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    id="debtDescription"
                    value={debtFormData.description}
                    onChange={(e) => setDebtFormData({ ...debtFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="What is this debt for?"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDebtModal(false)
                      setDebtFormData({ amount: '', description: '', borrowerEmail: '' })
                      setError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {creating ? 'Creating...' : 'Create Debt'}
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
