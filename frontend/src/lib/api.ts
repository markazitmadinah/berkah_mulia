/// <reference types="vite/client" />

const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000/api/v1';

export class ApiError extends Error {
  status: number;
  errorCode?: string;
  errors?: Record<string, string[]>;

  constructor(message: string, status: number, errorCode?: string, errors?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errorCode = errorCode;
    this.errors = errors;
  }
}

export const getToken = () => localStorage.getItem('bm_token');
export const setToken = (t: string) => localStorage.setItem('bm_token', t);
export const clearToken = () => localStorage.removeItem('bm_token');
export const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem('bm_user') || 'null');
  } catch {
    return null;
  }
};
export const setStoredUser = (u: unknown) => localStorage.setItem('bm_user', JSON.stringify(u));
export const dropStoredUser = () => localStorage.removeItem('bm_user');

export function notifyAuthExpired() {
  window.dispatchEvent(new Event('auth-expired'));
}

async function request<T = { data: unknown; message?: string; meta?: unknown }>(
  method: string,
  url: string,
  body?: unknown,
  isForm = false,
  timeoutMs?: number
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body !== undefined) {
    if (isForm || body instanceof FormData) {
      payload = body as BodyInit;
    } else {
      headers['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs ?? (isForm ? 120_000 : 30_000));
  try {
    const res = await fetch(`${API_URL}${url}`, { method, headers, body: payload, signal: controller.signal });

    if (res.status === 401 && !url.endsWith('/auth/login')) {
      clearToken();
      dropStoredUser();
      notifyAuthExpired();
      throw new ApiError('Sesi berakhir. Silakan login kembali.', 401, 'UNAUTHENTICATED');
    }

    const text = await res.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!res.ok) {
      const asAny = json as Record<string, unknown> | null;
      throw new ApiError(
        (asAny?.message as string) || res.statusText || 'Terjadi kesalahan',
        res.status,
        asAny?.error_code as string | undefined,
        asAny?.errors as Record<string, string[]> | undefined
      );
    }

    return json as T;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError('Waktu permintaan habis. Coba lagi.', 408, 'TIMEOUT');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export const api = {
  get: <T>(url: string) => request<ApiEnvelope<T>>('GET', url),
  post: <T>(url: string, body?: unknown) => request<ApiEnvelope<T>>('POST', url, body),
  postLong: <T>(url: string, body?: unknown) => request<ApiEnvelope<T>>('POST', url, body, false, 120_000),
  postForm: <T>(url: string, form: FormData) => request<ApiEnvelope<T>>('POST', url, form, true),
  put: <T>(url: string, body?: unknown) => request<ApiEnvelope<T>>('PUT', url, body),
  putForm: <T>(url: string, form: FormData) => request<ApiEnvelope<T>>('PUT', url, form, true),
  patch: <T>(url: string, body?: unknown) => request<ApiEnvelope<T>>('PATCH', url, body),
  del: <T>(url: string) => request<ApiEnvelope<T>>('DELETE', url),
};

export const unwrap = <T>(res: ApiEnvelope<T>): T => res.data;

export async function downloadFile(url: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(`${API_URL}${url}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    let message = 'Gagal mengunduh berkas';
    try {
      const json = await res.json();
      message = (json as Record<string, unknown>).message as string || message;
    } catch {
      // ignore, fallback to default message
    }
    throw new ApiError(message, res.status);
  }

  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

const FILE_URL_CACHE_MAX = 50;
const fileUrlCache = new Map<string, string>();

function evictFileUrlCache() {
  if (fileUrlCache.size > FILE_URL_CACHE_MAX) {
    const oldest = fileUrlCache.keys().next().value;
    if (oldest !== undefined) {
      const url = fileUrlCache.get(oldest);
      if (url) URL.revokeObjectURL(url);
      fileUrlCache.delete(oldest);
    }
  }
}

export async function authFileUrl(pathOrUrl: string): Promise<string> {
  const cached = fileUrlCache.get(pathOrUrl);
  if (cached) return cached;
  const abs = /^https?:\/\//.test(pathOrUrl) ? pathOrUrl : `${API_URL}${pathOrUrl}`;
  const token = getToken();
  const res = await fetch(abs, {
    headers: token ? { Authorization: `Bearer ${token}`, Accept: '*/*' } : { Accept: '*/*' },
  });
  if (!res.ok) throw new ApiError('Gagal memuat berkas', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  evictFileUrlCache();
  fileUrlCache.set(pathOrUrl, url);
  return url;
}