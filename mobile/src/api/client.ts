import { API_BASE_URL } from '@config';

const DEFAULT_API_TIMEOUT_MS = 20000;

type ApiRequestInit = RequestInit & {
  timeoutMs?: number;
};

export async function api<T>(
  path: string,
  options?: ApiRequestInit,
): Promise<T> {
  const { timeoutMs, ...fetchOptions } = options || {};
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string> || {}),
  };
  const controller = fetchOptions.signal ? null : new AbortController();
  const timeout = controller
    ? setTimeout(
        () => controller.abort(),
        timeoutMs ?? DEFAULT_API_TIMEOUT_MS,
      )
    : null;

  let response: Response;

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...fetchOptions,
      headers,
      signal: fetchOptions.signal || controller?.signal,
    });
  } catch (error) {
    if (controller?.signal.aborted) {
      throw new Error('Request timed out. Please try again.');
    }

    throw error;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }

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
