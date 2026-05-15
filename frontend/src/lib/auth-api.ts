import type { AuthMeResponse } from '@/types/auth';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const AUTH_ME_TIMEOUT_MS = 15_000;

export class AuthApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'AuthApiError';
    this.status = status;
  }
}

export async function fetchAuthMe(idToken?: string): Promise<AuthMeResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), AUTH_ME_TIMEOUT_MS);
  const headers: HeadersInit = {};

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/auth/me`, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw await createAuthApiError(response);
    }

    return (await response.json()) as AuthMeResponse;
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AuthApiError(0, '인증 확인 응답 시간이 초과되었습니다.');
    }

    throw new AuthApiError(0, '인증 확인 서버에 연결할 수 없습니다.');
  } finally {
    clearTimeout(timeoutId);
  }
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

async function createAuthApiError(response: Response): Promise<AuthApiError> {
  let detail = '인증 상태를 확인할 수 없습니다.';

  try {
    const payload = (await response.json()) as { detail?: string };
    if (payload.detail) {
      detail = payload.detail;
    }
  } catch {
    // Keep the fallback message for non-JSON error responses.
  }

  if (response.status === 401) {
    return new AuthApiError(response.status, '로그인이 만료되었거나 인증 토큰이 유효하지 않습니다.');
  }

  return new AuthApiError(response.status, detail);
}
