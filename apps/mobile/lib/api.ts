import Constants from 'expo-constants';
import { sessionCookie } from './session-cookie';
import { supabase } from './supabase';
import { DashboardData, DebtDetail } from './types';

const API_BASE_URL = Constants.expoConfig?.extra?.apiBaseUrl || 'http://localhost:3000';

export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private baseURL: string;
  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseURL}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      headers['Cookie'] = sessionCookie(process.env.EXPO_PUBLIC_SUPABASE_URL!, session);
    }

    try {
      // 'omit' keeps iOS from swapping our Cookie header for its own cookie jar
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'omit',
      });

      const rawText = await response.text();
      let data: any = undefined;
      try {
        data = rawText ? JSON.parse(rawText) : undefined;
      } catch {
        data = rawText;
      }

      if (!response.ok) {
        const message =
          typeof data === 'object' && data && 'error' in data
            ? (data as any).error
            : `HTTP ${response.status}: ${response.statusText}`;
        throw new ApiError(
          message,
          response.status,
          data
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(
        error instanceof Error ? error.message : 'Network request failed'
      );
    }
  }

  // Auth endpoints
  async login(email: string, password: string) {
    return this.request<{ email: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signup(email: string, password: string) {
    return this.request<{ email: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  // Everything the home screen shows, from the website's existing endpoints
  async getDashboard(): Promise<DashboardData> {
    const [user, { debts }, groups, { recurringPayments }, { alerts }, { transactions }] = await Promise.all([
      this.getUser(),
      this.request<{ debts: any[] }>('/api/debts?status=pending'),
      this.getGroups(),
      this.request<{ recurringPayments: any[] }>('/api/recurring-payments?status=active'),
      this.request<{ alerts: any[] }>('/api/alerts'),
      this.request<{ transactions: any[] }>('/api/debt-transactions'),
    ]);
    return {
      user,
      debts,
      groups,
      recurringPayments,
      alerts,
      // Requests waiting on the user's approval as the lender
      pendingApprovals: transactions.filter((t) => t.debt.lenderId === user.id && !t.lenderApproved),
    };
  }

  async getUser() {
    const response = await this.request<{ user: { id: string; email: string; name: string | null; createdAt: string; updatedAt: string } }>('/api/user');
    return response.user;
  }

  async updateProfile(name: string) {
    return this.request<{ user: { id: string; email: string; name: string } }>('/api/user', {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  }

  // Groups endpoints
  async getGroups() {
    const response = await this.request<{ groups: any[] }>('/api/groups');
    return response.groups;
  }

  async getGroup(id: number) {
    const response = await this.request<{ group: any }>(`/api/groups/${id}`);
    return response.group;
  }

  async createGroup(name: string) {
    return this.request<any>('/api/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  }

  // shortcut: only the group's debts the user lends or borrows in; the website's API has no whole-group list
  async getGroupDebts(groupId: number) {
    return (await this.getDebts()).filter((debt) => debt.groupId === groupId);
  }

  // Debts endpoints
  async getDebts() {
    const response = await this.request<{ debts: any[] }>('/api/debts');
    return response.debts;
  }

  // The website's API has no transaction history or receipt images per debt: show its pending requests only
  async getDebt(id: number): Promise<DebtDetail> {
    const [{ debt }, { transactions }] = await Promise.all([
      this.request<{ debt: DebtDetail['debt'] }>(`/api/debts/${id}`),
      this.request<{ transactions: any[] }>('/api/debt-transactions'),
    ]);
    return { debt, transactions: transactions.filter((t) => t.debtId === id), receiptImageUrls: [] };
  }

  async createDebt(data: {
    borrowerId: string;
    amount: number;
    description?: string;
    groupId?: number;
  }) {
    return this.request<any>('/api/debts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Invites endpoints
  async getInvites() {
    const response = await this.request<{ invites: any[] }>('/api/invites');
    return response.invites;
  }

  async createInvite(groupId: number, email: string) {
    return this.request<any>('/api/invites', {
      method: 'POST',
      body: JSON.stringify({ groupId, invitedEmail: email }),
    });
  }

  async acceptInvite(id: number) {
    return this.request<{ group: { id: number } }>('/api/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ inviteId: id }),
    });
  }

  // AI Agent endpoint
  async sendAgentMessage(messages: any[], groupId: number) {
    return this.request<any>('/api/agent', {
      method: 'POST',
      body: JSON.stringify({ messages, groupId }),
    });
  }
}

// Export a singleton instance
export const apiClient = new ApiClient();
