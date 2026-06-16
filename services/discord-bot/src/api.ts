const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3456';
const API_KEY = process.env.API_KEY || '';

async function apiCall(method: string, path: string, body?: unknown) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `API error ${res.status}`);
  return data;
}

export async function upgradeUser(userId: string, tier: 'monthly' | 'lifetime') {
  return apiCall('POST', '/api/premium/upgrade', { user_id: userId, tier });
}

export async function revokePremium(userId: string) {
  return apiCall('POST', '/api/premium/revoke', { user_id: userId });
}

export async function checkPremium(userId: string) {
  return apiCall('GET', `/api/premium/check/${encodeURIComponent(userId)}`);
}

export async function getStats() {
  return apiCall('GET', '/api/premium/stats');
}
