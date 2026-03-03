// Shared API base URL - set EXPO_PUBLIC_API_URL in .env (e.g. http://localhost:3000/api)
import { Platform } from 'react-native';

function getApiUrl(): string {
  try {
    const envUrl =
      typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL
        ? process.env.EXPO_PUBLIC_API_URL
        : null;
    if (envUrl && typeof envUrl === 'string') return envUrl.replace(/\/$/, '');
  } catch (_) {}
  // Backend/.env uses PORT=3002 by default; use 3000 only if you run backend without .env
  return 'http://localhost:3002/api';
}

export const API_BASE_URL = getApiUrl();
export const API_ROOT = API_BASE_URL.replace(/\/api\/?$/, '') || 'http://localhost:3002';
export const SOCKET_BASE_URL = API_ROOT;

const FETCH_TIMEOUT_MS = 15000;

export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = FETCH_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal }).finally(() =>
    clearTimeout(timeout)
  );
}

export async function checkBackendConnection(): Promise<{ ok: boolean; message: string }> {
  const url = `${API_ROOT}/health`;
  try {
    const res = await fetchWithTimeout(url, { method: 'GET' }, 8000);
    if (res.ok) return { ok: true, message: 'Connected' };
    return { ok: false, message: `Backend returned ${res.status}` };
  } catch (e: any) {
    const msg =
      e?.name === 'AbortError' ? 'Request timed out' : e?.message || String(e);
    return { ok: false, message: msg };
  }
}
