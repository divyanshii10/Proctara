// ============================================
// Proctara API Client
// Centralized HTTP client for all API calls
// ============================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Get the stored JWT token from localStorage.
 */
function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('proctara_token');
}

/**
 * Store the JWT token.
 */
export function setToken(token: string): void {
  localStorage.setItem('proctara_token', token);
}

/**
 * Clear the stored token (logout).
 */
export function clearToken(): void {
  localStorage.removeItem('proctara_token');
}

/**
 * Make an authenticated API request.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const json = await res.json();

  if (!res.ok) {
    throw new ApiError(json.error || 'Request failed', res.status, json);
  }

  return json;
}

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;

  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ---- Auth ----

export const authApi = {
  register: (data: { companyName: string; email: string; password: string; name: string }) =>
    request<{ token: string; user: Record<string, unknown>; company: Record<string, unknown> }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: Record<string, unknown>; company: Record<string, unknown> }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  googleLogin: (data: { googleId: string; email: string; name: string; avatarUrl?: string; companyName?: string }) =>
    request<{ token: string; user: Record<string, unknown>; company: Record<string, unknown> }>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  candidateLogin: (data: { loginId: string; password: string }) =>
    request<{ token: string; candidate: Record<string, unknown> }>('/api/auth/candidate/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  me: () =>
    request<{ userType: string; user?: Record<string, unknown>; candidate?: Record<string, unknown>; company?: Record<string, unknown> }>('/api/auth/me'),
};

// ---- Company Dashboard ----

export const companyApi = {
  analytics: () =>
    request<{ totalInterviews: number; completedInterviews: number; averageScore: number | null; activeRoles: number; completionRate: number }>(
      '/api/companies/analytics'
    ),

  // Job Roles
  createRole: (data: { title: string; description?: string; skills?: string[]; level?: string }) =>
    request('/api/companies/roles', { method: 'POST', body: JSON.stringify(data) }),

  listRoles: () =>
    request<Array<Record<string, unknown>>>('/api/companies/roles'),

  getRole: (id: string) =>
    request<Record<string, unknown>>(`/api/companies/roles/${id}`),

  // Templates
  createTemplate: (roleId: string, data: { name: string; durationMin?: number; config?: Record<string, unknown> }) =>
    request(`/api/companies/roles/${roleId}/templates`, { method: 'POST', body: JSON.stringify(data) }),
};

// ---- Candidates ----

export const candidateApi = {
  add: (data: { email: string; name: string; phone?: string }) =>
    request<{ candidate: Record<string, unknown>; credentials: { loginId: string; password: string; expiresAt: string } }>(
      '/api/candidates',
      { method: 'POST', body: JSON.stringify(data) }
    ),

  bulkAdd: (candidates: Array<{ email: string; name: string; phone?: string }>) =>
    request<{ total: number; created: number; skipped: number; candidates: Array<Record<string, unknown>> }>(
      '/api/candidates/bulk',
      { method: 'POST', body: JSON.stringify({ candidates }) }
    ),

  list: (page = 1, pageSize = 20, search?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (search) params.set('search', search);
    return request<Array<Record<string, unknown>>>(`/api/candidates?${params}`);
  },

  get: (id: string) =>
    request<Record<string, unknown>>(`/api/candidates/${id}`),

  remove: (id: string) =>
    request(`/api/candidates/${id}`, { method: 'DELETE' }),
};

// ---- Campaigns ----

export const campaignApi = {
  create: (data: { title: string; description?: string; jobRoleId: string; templateId: string; durationMin?: number }) =>
    request<Record<string, unknown>>('/api/campaigns', { method: 'POST', body: JSON.stringify(data) }),

  list: () =>
    request<Array<Record<string, unknown>>>('/api/campaigns'),

  get: (id: string) =>
    request<Record<string, unknown>>(`/api/campaigns/${id}`),

  invite: (campaignId: string, candidateIds: string[]) =>
    request<{ invited: number; skipped: number; sessions: Array<Record<string, unknown>> }>(
      `/api/campaigns/${campaignId}/invite`,
      { method: 'POST', body: JSON.stringify({ candidateIds }) }
    ),

  updateStatus: (id: string, status: string) =>
    request(`/api/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
};

// ---- Interviews ----

export const interviewApi = {
  create: (data: { candidateEmail: string; candidateName?: string; jobRoleId: string; templateId: string }) =>
    request<Record<string, unknown>>('/api/interviews', { method: 'POST', body: JSON.stringify(data) }),

  list: (page = 1, pageSize = 20, status?: string) => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (status) params.set('status', status);
    return request<Array<Record<string, unknown>>>(`/api/interviews?${params}`);
  },

  get: (id: string) =>
    request<Record<string, unknown>>(`/api/interviews/${id}`),

  join: (token: string) =>
    request<Record<string, unknown>>(`/api/interviews/join/${token}`),

  mySessions: () =>
    request<Array<Record<string, unknown>>>('/api/interviews/my/sessions'),
};
