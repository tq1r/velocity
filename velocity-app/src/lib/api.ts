const DEFAULT_API_BASE = 'https://velocity-api-production.up.railway.app';

function getApiBase(): string {
  return localStorage.getItem('velocity-api-base') || DEFAULT_API_BASE;
}

export function setApiBase(url: string) {
  localStorage.setItem('velocity-api-base', url);
}

let authToken: string | null = localStorage.getItem('velocity-auth-token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('velocity-auth-token', token);
  else localStorage.removeItem('velocity-auth-token');
}

export function getAuthToken() {
  return authToken;
}

async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${getApiBase()}${path}`, { ...options, headers: { ...headers, ...(options.headers as Record<string, string> || {}) } });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data as T;
}

export interface UserProfile {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  premium_tier: string | null;
  premium_expires_at: string | null;
}

export interface PremiumStatus {
  premium: boolean;
  tier: string | null;
  expires_at: string | null;
}

export function getAuthUrl(provider: 'github' | 'google'): string {
  return `${getApiBase()}/api/auth/${provider}`;
}

export function checkSession(): Promise<UserProfile> {
  return apiFetch<UserProfile>('/api/auth/me');
}

export function logout(): Promise<{ ok: boolean }> {
  return apiFetch('/api/auth/logout', { method: 'POST' });
}

export function getPremiumStatus(): Promise<PremiumStatus> {
  return apiFetch('/api/premium/status');
}

export interface OwnerInfo {
  owner_user_id: string | null;
}

export function getOwnerInfo(): Promise<OwnerInfo> {
  return apiFetch('/api/admin/owner');
}
