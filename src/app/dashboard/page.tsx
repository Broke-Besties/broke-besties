'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

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
  group: {
    id: number
    name: string
  } | null
}

type User = {
  id: string
  email: string
}

export default function DashboardPage() {
  const [debts, setDebts] = useState<Debt[]>([])
  const [currentUser, setCurrentUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    borrowerEmail: '',
  })
  const router = useRouter()

  useEffect(() => {
    fetchDebts()
    fetchCurrentUser()
  }, [])

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
      const response = await fetch('/api/debts')
      const data = await response.json()

      if (!response.ok) {
        if (response.status === 401) {
          router.push('/login')
          return
        }
        setError(data.error || 'Failed to load debts')
        return
      }

      setDebts(data.debts)
    } catch (err) {
      setError('An error occurred while loading debts')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setError('')

    try {
      // First, find the user by email
      const userResponse = await fetch(`/api/users/search?email=${encodeURIComponent(formData.borrowerEmail)}`)
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
          amount: parseFloat(formData.amount),
          description: formData.description || null,
          borrowerId: userData.user.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to create debt')
        return
      }

      setShowCreateModal(false)
      setFormData({ amount: '', description: '', borrowerEmail: '' })
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

  const lendingDebts = debts.filter((debt) => debt.lender.id === currentUser?.id)
  const borrowingDebts = debts.filter((debt) => debt.borrower.id === currentUser?.id)

  const calculateTotal = (debtList: Debt[]) => {
    return debtList.reduce((sum, debt) => sum + debt.amount, 0)
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
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-gray-600 mt-2">Manage your debts and loans</p>
          </div>
          <div className="space-x-4">
            <button
              onClick={() => router.push('/groups')}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
            >
              View Groups
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Debt
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">You are Lending</h2>
              <span className="text-2xl font-bold text-green-600">
                ${calculateTotal(lendingDebts).toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Money owed to you</p>
            <div className="space-y-3">
              {lendingDebts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No lending records</p>
              ) : (
                lendingDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="p-4 bg-gray-50 rounded border-l-4 border-green-500"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{debt.borrower.email}</p>
                        {debt.description && (
                          <p className="text-sm text-gray-600">{debt.description}</p>
                        )}
                        {debt.group && (
                          <p className="text-xs text-blue-600 mt-1">
                            Group: {debt.group.name}
                          </p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-green-600">
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
                ))
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">You are Borrowing</h2>
              <span className="text-2xl font-bold text-red-600">
                ${calculateTotal(borrowingDebts).toFixed(2)}
              </span>
            </div>
            <p className="text-sm text-gray-600 mb-4">Money you owe</p>
            <div className="space-y-3">
              {borrowingDebts.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No borrowing records</p>
              ) : (
                borrowingDebts.map((debt) => (
                  <div
                    key={debt.id}
                    className="p-4 bg-gray-50 rounded border-l-4 border-red-500"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">{debt.lender.email}</p>
                        {debt.description && (
                          <p className="text-sm text-gray-600">{debt.description}</p>
                        )}
                        {debt.group && (
                          <p className="text-xs text-blue-600 mt-1">
                            Group: {debt.group.name}
                          </p>
                        )}
                      </div>
                      <span className="text-lg font-bold text-red-600">
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
                ))
              )}
            </div>
          </div>
        </div>

        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Create New Debt</h2>
              <form onSubmit={handleCreateDebt}>
                <div className="mb-4">
                  <label htmlFor="borrowerEmail" className="block text-sm font-medium text-gray-700 mb-2">
                    Borrower Email
                  </label>
                  <input
                    id="borrowerEmail"
                    type="email"
                    required
                    value={formData.borrowerEmail}
                    onChange={(e) => setFormData({ ...formData, borrowerEmail: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="borrower@example.com"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount ($)
                  </label>
                  <input
                    id="amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.00"
                  />
                </div>
                <div className="mb-4">
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description (optional)
                  </label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                    placeholder="What is this debt for?"
                  />
                </div>
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false)
                      setFormData({ amount: '', description: '', borrowerEmail: '' })
                      setError('')
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
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
