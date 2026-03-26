const BASE_URL = '';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function getHealth() {
  return request<{ status: string }>('/api/health');
}

export async function getSettings() {
  return request<Record<string, unknown>>('/api/settings');
}

export async function updateSettings(settings: Record<string, unknown>) {
  return request<Record<string, unknown>>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}
