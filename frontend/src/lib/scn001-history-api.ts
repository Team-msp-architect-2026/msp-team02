import type {
  BeforeReviewJobHistoryDetail,
  BeforeReviewJobHistoryListResponse,
  BridgeRunHistoryListResponse,
} from '@/types/scn001-history';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const SCN001_HISTORY_TIMEOUT_MS = 15_000;
const DEFAULT_HISTORY_LIMIT = 20;
const MIN_HISTORY_LIMIT = 1;
const MAX_HISTORY_LIMIT = 50;

export class Scn001HistoryApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(status: number, message: string, retryable = true) {
    super(message);
    this.name = 'Scn001HistoryApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

export async function fetchBeforeReviewHistory(input: {
  idToken: string;
  limit?: number;
}): Promise<BeforeReviewJobHistoryListResponse> {
  const idToken = optionalInlineText(input.idToken);

  if (!idToken) {
    throw new Scn001HistoryApiError(
      401,
      'SCN-001 기록 조회에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  const limit = normalizeHistoryLimit(input.limit);
  return fetchProtectedHistoryJson<BeforeReviewJobHistoryListResponse>(
    `/api/v1/scn001/before-review-jobs?limit=${limit}`,
    idToken,
  );
}

export async function fetchBeforeReviewHistoryDetail(input: {
  idToken: string;
  beforeReviewJobId: string;
}): Promise<BeforeReviewJobHistoryDetail> {
  const idToken = optionalInlineText(input.idToken);
  const beforeReviewJobId = optionalInlineText(input.beforeReviewJobId);

  if (!idToken) {
    throw new Scn001HistoryApiError(
      401,
      'SCN-001 기록 상세 조회에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (!beforeReviewJobId) {
    throw new Scn001HistoryApiError(
      422,
      'Before 검토 기록을 확인할 수 없습니다. 기록을 다시 선택해주세요.',
      false,
    );
  }

  const encodedBeforeReviewJobId = encodeURIComponent(beforeReviewJobId);
  return fetchProtectedHistoryJson<BeforeReviewJobHistoryDetail>(
    `/api/v1/scn001/before-review-jobs/${encodedBeforeReviewJobId}`,
    idToken,
  );
}

export async function deleteBeforeReviewJobHistory(input: {
  idToken: string;
  beforeReviewJobId: string;
}): Promise<void> {
  const idToken = optionalInlineText(input.idToken);
  const beforeReviewJobId = optionalInlineText(input.beforeReviewJobId);

  if (!idToken) {
    throw new Scn001HistoryApiError(
      401,
      'Before 검토 기록 삭제에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (!beforeReviewJobId) {
    throw new Scn001HistoryApiError(
      422,
      '삭제할 Before 검토 기록을 확인할 수 없습니다. 기록을 다시 선택해주세요.',
      false,
    );
  }

  const encodedBeforeReviewJobId = encodeURIComponent(beforeReviewJobId);
  await fetchProtectedHistoryNoContent(
    `/api/v1/scn001/before-review-jobs/${encodedBeforeReviewJobId}`,
    idToken,
  );
}

export async function fetchBridgeRunHistory(input: {
  idToken: string;
  limit?: number;
}): Promise<BridgeRunHistoryListResponse> {
  const idToken = optionalInlineText(input.idToken);

  if (!idToken) {
    throw new Scn001HistoryApiError(
      401,
      'Bridge 기록 조회에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  const limit = normalizeHistoryLimit(input.limit);
  return fetchProtectedHistoryJson<BridgeRunHistoryListResponse>(
    `/api/v1/scn001/bridge-runs?limit=${limit}`,
    idToken,
  );
}

export async function deleteBridgeRunHistory(input: {
  idToken: string;
  bridgeRunId: string;
}): Promise<void> {
  const idToken = optionalInlineText(input.idToken);
  const bridgeRunId = optionalInlineText(input.bridgeRunId);

  if (!idToken) {
    throw new Scn001HistoryApiError(
      401,
      'Bridge 기록 삭제에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (!bridgeRunId) {
    throw new Scn001HistoryApiError(
      422,
      '삭제할 Bridge 기록을 확인할 수 없습니다. 기록을 다시 선택해주세요.',
      false,
    );
  }

  const encodedBridgeRunId = encodeURIComponent(bridgeRunId);
  await fetchProtectedHistoryNoContent(
    `/api/v1/scn001/bridge-runs/${encodedBridgeRunId}`,
    idToken,
  );
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

async function fetchProtectedHistoryJson<T>(path: string, idToken: string): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCN001_HISTORY_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createHistoryHttpError(response.status);
    }

    return await parseHistoryJson<T>(response);
  } catch (error) {
    if (error instanceof Scn001HistoryApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Scn001HistoryApiError(
        0,
        'SCN-001 기록 조회 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
        true,
      );
    }

    throw new Scn001HistoryApiError(
      0,
      'SCN-001 기록 서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchProtectedHistoryNoContent(path: string, idToken: string): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SCN001_HISTORY_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      signal: controller.signal,
    });

    if (response.status === 404) {
      return;
    }

    if (!response.ok) {
      throw createHistoryHttpError(response.status, 'delete');
    }
  } catch (error) {
    if (error instanceof Scn001HistoryApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Scn001HistoryApiError(
        0,
        'SCN-001 기록 삭제 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
        true,
      );
    }

    throw new Scn001HistoryApiError(
      0,
      'SCN-001 기록 삭제 서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

async function parseHistoryJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new Scn001HistoryApiError(
      502,
      'SCN-001 기록 응답 형식을 해석할 수 없습니다. 잠시 후 다시 시도해주세요.',
      true,
    );
  }
}

function createHistoryHttpError(
  status: number,
  operation: 'read' | 'delete' = 'read',
): Scn001HistoryApiError {
  if (status === 401) {
    return new Scn001HistoryApiError(
      status,
      '로그인이 필요하거나 인증이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (status === 404) {
    return new Scn001HistoryApiError(
      status,
      '기록을 찾을 수 없거나 이 계정에서 접근할 수 없습니다.',
      false,
    );
  }

  if (status === 422) {
    return new Scn001HistoryApiError(
      status,
      operation === 'delete'
        ? 'SCN-001 기록 삭제 요청 값을 확인해주세요.'
        : 'SCN-001 기록 요청 값을 확인해주세요.',
      false,
    );
  }

  if (status >= 500) {
    return new Scn001HistoryApiError(
      status,
      'SCN-001 기록 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
      true,
    );
  }

  return new Scn001HistoryApiError(
    status,
    operation === 'delete'
      ? 'SCN-001 기록 삭제 요청을 처리할 수 없습니다. 잠시 후 다시 시도해주세요.'
      : 'SCN-001 기록 요청을 처리할 수 없습니다. 입력 상태를 확인해주세요.',
    true,
  );
}

function normalizeHistoryLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isFinite(limit)) {
    return DEFAULT_HISTORY_LIMIT;
  }

  return Math.min(MAX_HISTORY_LIMIT, Math.max(MIN_HISTORY_LIMIT, Math.trunc(limit)));
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\r\n?/g, '\n').trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function optionalInlineText(value: string | null | undefined): string | undefined {
  return optionalText(value)?.replace(/\s+/g, ' ');
}
