import Constants from 'expo-constants';
import { ApiResponse } from './types';

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
  private authToken: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
  }

  setAuthToken(token: string | null) {
    this.authToken = token;
  }

  getAuthToken(): string | null {
    return this.authToken;
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

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
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

  async getMe() {
    return this.request<{ id: string; email: string; name?: string }>('/api/auth/me');
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

  async getGroupDebts(groupId: number) {
    // Web API supports group filtering via /api/debts?groupId=...
    const response = await this.request<{ debts: any[] }>(`/api/debts?groupId=${groupId}`);
    return response.debts;
  }

  // Debts endpoints
  async getDebts() {
    const response = await this.request<{ debts: any[] }>('/api/debts');
    return response.debts;
  }

  async getDebt(id: number) {
    return this.request<any>(`/api/debts/${id}`);
  }

  async createDebt(data: {
    lenderId?: string;
    borrowerId?: string;
    borrowerEmail?: string;
    amount: number;
    description?: string;
    groupId?: number;
  }) {
    return this.request<any>('/api/debts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDebtStatus(id: number, status: string) {
    return this.request<ApiResponse<any>>(`/api/debts/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
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
    return this.request<any>('/api/invites/accept', {
      method: 'POST',
      body: JSON.stringify({ inviteId: id }),
    });
  }

  // Receipts endpoints
  async getReceipts(groupId: number) {
    return this.request<any[]>(`/api/receipts?groupId=${groupId}`);
  }

  async uploadReceipt(formData: FormData) {
    const url = `${this.baseURL}/api/receipts/upload`;
    const headers: Record<string, string> = {};

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new ApiError(
        data.error || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        data
      );
    }

    return data;
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
