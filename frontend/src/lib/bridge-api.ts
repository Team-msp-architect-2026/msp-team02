import type { AnswerRequest, AnswerResponse } from '@/types/api';
import type { BridgeHandoffItem } from '@/types/bridge-handoff';
import type {
  BridgeRunResponse,
  CreateBridgeRunRequest,
  LawRef,
} from '@/types/bridge-api';

const DEFAULT_API_BASE_URL = 'http://localhost:8000';
const BRIDGE_RUN_TIMEOUT_MS = 30_000;
const BRIDGE_ANSWER_TIMEOUT_MS = 30_000;

export class BridgeApiError extends Error {
  status: number;
  retryable: boolean;

  constructor(status: number, message: string, retryable = true) {
    super(message);
    this.name = 'BridgeApiError';
    this.status = status;
    this.retryable = retryable;
  }
}

export async function createBridgeRun(input: {
  before_review_job_id: string;
  idToken: string;
}): Promise<BridgeRunResponse> {
  const idToken = optionalInlineText(input.idToken);
  const beforeReviewJobId = optionalInlineText(input.before_review_job_id);

  if (!idToken) {
    throw new BridgeApiError(
      401,
      'Bridge 연결에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (!beforeReviewJobId) {
    throw new BridgeApiError(
      422,
      'Before 검토 작업을 확인할 수 없습니다. 검토 완료 후 다시 시도해주세요.',
      false,
    );
  }

  const request: CreateBridgeRunRequest = {
    before_review_job_id: beforeReviewJobId,
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRIDGE_RUN_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiBaseUrl()}/api/v1/scn001/bridge-runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw createBridgeHttpError(response.status);
    }

    return await parseBridgeRunResponse(response);
  } catch (error) {
    if (error instanceof BridgeApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BridgeApiError(
        0,
        'Bridge 연결 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
        true,
      );
    }

    throw new BridgeApiError(
      0,
      'Bridge 연결 서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchBridgeAnswer(input: {
  bridge_run_id: string;
  idToken: string;
  request: AnswerRequest;
}): Promise<AnswerResponse> {
  const idToken = optionalInlineText(input.idToken);
  const bridgeRunId = optionalInlineText(input.bridge_run_id);

  if (!idToken) {
    throw new BridgeApiError(
      401,
      'Bridge 답변 생성에는 로그인이 필요합니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (!bridgeRunId) {
    throw new BridgeApiError(
      422,
      'Bridge 연결 정보를 확인할 수 없습니다. Before 검토에서 다시 연결해주세요.',
      false,
    );
  }

  const request: AnswerRequest = {
    query: input.request.query,
    top_k: input.request.top_k,
    ef_search: input.request.ef_search,
  };
  const encodedBridgeRunId = encodeURIComponent(bridgeRunId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), BRIDGE_ANSWER_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${getApiBaseUrl()}/api/v1/scn001/bridge-runs/${encodedBridgeRunId}/answer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      throw createBridgeAnswerHttpError(response.status);
    }

    return await parseBridgeAnswerResponse(response);
  } catch (error) {
    if (error instanceof BridgeApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BridgeApiError(
        0,
        'Bridge 답변 생성 요청 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
        true,
      );
    }

    throw new BridgeApiError(
      0,
      'Bridge 답변 생성 서버에 연결할 수 없습니다. 네트워크 상태를 확인해주세요.',
      true,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export function bridgeRunToHandoffItem(response: BridgeRunResponse): BridgeHandoffItem {
  return {
    bridge_run_id: response.bridge_run_id,
    scenario_id: 'SCN-001',
    user_visible_summary:
      optionalText(response.user_visible_summary) ?? 'Before 검토 요약이 제공되지 않았습니다.',
    issue_categories: normalizeStringArray(response.issue_categories),
    risk_tags: normalizeStringArray(response.risk_tags),
    law_refs: normalizeLawRefs(response.law_refs),
    recommended_next_actions: normalizeStringArray(response.recommended_next_actions),
    after_query_seed: optionalText(response.after_query_seed) ?? null,
    include_in_query: true,
  };
}

function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
}

async function parseBridgeRunResponse(response: Response): Promise<BridgeRunResponse> {
  try {
    return (await response.json()) as BridgeRunResponse;
  } catch {
    throw new BridgeApiError(
      502,
      '브리지 응답 형식을 해석할 수 없습니다. 잠시 후 다시 시도해주세요.',
      true,
    );
  }
}

async function parseBridgeAnswerResponse(response: Response): Promise<AnswerResponse> {
  try {
    return (await response.json()) as AnswerResponse;
  } catch {
    throw new BridgeApiError(
      502,
      'Bridge 답변 응답 형식을 해석할 수 없습니다. 잠시 후 다시 시도해주세요.',
      true,
    );
  }
}

function createBridgeHttpError(status: number): BridgeApiError {
  if (status === 401) {
    return new BridgeApiError(
      status,
      '로그인이 필요하거나 인증이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (status === 404) {
    return new BridgeApiError(
      status,
      '완료된 Before 검토 작업을 찾을 수 없거나 이 계정에서 접근할 수 없습니다.',
      false,
    );
  }

  if (status === 409) {
    return new BridgeApiError(
      status,
      'Before 검토가 아직 완료되지 않았습니다. 완료 후 다시 시도해주세요.',
      true,
    );
  }

  if (status === 422) {
    return new BridgeApiError(
      status,
      'Before 검토 결과를 After 연결 형식으로 변환할 수 없습니다. 검토 결과를 확인한 뒤 다시 시도해주세요.',
      false,
    );
  }

  if (status >= 500) {
    return new BridgeApiError(
      status,
      'Bridge 연결 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
      true,
    );
  }

  return new BridgeApiError(
    status,
    'Bridge 연결 요청을 처리할 수 없습니다. 입력 상태를 확인해주세요.',
    true,
  );
}

function createBridgeAnswerHttpError(status: number): BridgeApiError {
  if (status === 401) {
    return new BridgeApiError(
      status,
      '로그인이 필요하거나 인증이 만료되었습니다. 다시 로그인한 뒤 시도해주세요.',
      false,
    );
  }

  if (status === 404) {
    return new BridgeApiError(
      status,
      '연결된 Bridge 정보를 찾을 수 없거나 이 계정에서 접근할 수 없습니다.',
      false,
    );
  }

  if (status === 409) {
    return new BridgeApiError(
      status,
      'Bridge 연결 상태가 아직 답변 생성 준비가 되지 않았습니다. Before 검토를 확인한 뒤 다시 시도해주세요.',
      true,
    );
  }

  if (status === 422) {
    return new BridgeApiError(
      status,
      '질문 내용이나 Bridge 연결 상태를 답변 생성 형식으로 처리할 수 없습니다. 내용을 확인한 뒤 다시 시도해주세요.',
      false,
    );
  }

  if (status >= 500) {
    return new BridgeApiError(
      status,
      'Bridge 답변 생성 서버가 일시적으로 응답하지 않습니다. 잠시 후 다시 시도해주세요.',
      true,
    );
  }

  return new BridgeApiError(
    status,
    'Bridge 답변 생성 요청을 처리할 수 없습니다. 입력 상태를 확인해주세요.',
    true,
  );
}

function normalizeStringArray(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    const text = optionalInlineText(value);
    return text ? [text] : [];
  });
}

function normalizeLawRefs(values: LawRef[] | null | undefined): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.flatMap((value) => {
    const label = lawRefToLabel(value);
    return label ? [label] : [];
  });
}

function lawRefToLabel(value: LawRef): string | null {
  if (typeof value === 'string') {
    return optionalInlineText(value) ?? null;
  }

  return (
    optionalInlineText(value.label) ??
    optionalInlineText(value.article) ??
    optionalInlineText(value.citation) ??
    null
  );
}

function optionalText(value: string | null | undefined): string | undefined {
  const trimmed = value?.replace(/\r\n?/g, '\n').trim();
  return trimmed && trimmed.length > 0 ? trimmed : undefined;
}

function optionalInlineText(value: string | null | undefined): string | undefined {
  return optionalText(value)?.replace(/\s+/g, ' ');
}
