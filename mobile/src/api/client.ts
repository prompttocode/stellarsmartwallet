import { API_BASE_URL } from '@config';

export async function api<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string> || {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });
  const text = await response.text();
  let body: any = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    throw new Error(
      body?.error?.message ||
        body?.error ||
        body?.message ||
        `HTTP error ${response.status}`,
    );
  }

  return body as T;
}
