import type {
  BeforeAccessibilityRecommendation,
  BeforeDisabilityType,
  BeforeMockScenario,
  BeforeReviewJob,
  BeforeReviewResult,
} from '@/types/before';
import beforeMockReviewSen0 from '@/lib/fixtures/beforeMockReviewSen0.json';
import beforeMockReviewSen1 from '@/lib/fixtures/beforeMockReviewSen1.json';
import beforeMockReviewSen2 from '@/lib/fixtures/beforeMockReviewSen2.json';

const DEFAULT_BEFORE_API_BASE_URL = 'http://localhost:8000';
const REVIEW_TIMEOUT_MS = 45_000;
const POLLING_TIMEOUT_MS = 15_000;
const ACCESSIBILITY_TIMEOUT_MS = 15_000;
const REVIEW_DELAY_MS = 1100;
const ACCESSIBILITY_DELAY_MS = 450;

type BeforeApiReviewStatus = 'PASS' | 'WARNING' | 'VIOLATION';
type BeforeApiSeverity = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

interface BeforeApiExplanationPoint {
  title: string;
  status: BeforeApiReviewStatus;
  severity: BeforeApiSeverity;
  law_ref: string;
  description: string;
}

interface BeforeApiExplanationEvidence {
  title: string;
  excerpt: string;
}

interface BeforeApiUserExplanation {
  headline: string;
  plain_language_summary: string;
  overall_assessment: string[];
  important_points: BeforeApiExplanationPoint[];
  recommended_actions: string[];
  evidence: BeforeApiExplanationEvidence[];
}

interface BeforeApiContractInfo {
  type: string;
  employer: string;
  employee: string;
  start_date: string;
}

interface BeforeApiReviewResult {
  review_id: string;
  reviewed_at: string;
  run_directory?: string;
  uploaded_files?: Array<{
    name: string;
    url: string;
  }>;
  contract_info: BeforeApiContractInfo;
  overall_result: BeforeApiReviewStatus;
  overall_severity: BeforeApiSeverity;
  summary: string;
  rule_check?: Record<
    string,
    {
      status: BeforeApiReviewStatus;
      severity: BeforeApiSeverity;
      law_ref?: string;
      message?: string;
      [key: string]: unknown;
    }
  >;
  ocr_warnings?: Array<{
    field: string;
    structured: unknown;
    corrected: unknown;
    note: string;
  }>;
  user_explanation: BeforeApiUserExplanation;
}

interface BeforeApiReviewJobResponse {
  job_id: string;
  status: BeforeReviewJob['status'];
  created_at: string;
  updated_at: string;
  run_directory?: string | null;
  steps: BeforeReviewJob['steps'];
  error?: string | null;
  result?: BeforeApiReviewResult | null;
}

const mockReviewResults: Record<BeforeMockScenario, BeforeReviewResult> = {
  sen0: {
    ...mapReviewResult(beforeMockReviewSen0 as BeforeApiReviewResult),
  },
  sen1: mapReviewResult(beforeMockReviewSen1 as BeforeApiReviewResult),
  sen2: mapReviewResult(beforeMockReviewSen2 as BeforeApiReviewResult),
};

const accessibilityCatalog: Record<BeforeDisabilityType, BeforeAccessibilityRecommendation> = {
  visual: {
    disability_type: 'visual',
    disability_label: '시각',
    overview:
      '계약 내용을 음성, 점자, 확대 텍스트 등 접근 가능한 형식으로 다시 확인할 수 있는지가 중요합니다.',
    cards: [
      {
        id: 'visual-1',
        kind: 'support',
        title: '읽기 가능한 형식 요청',
        description: '계약서를 텍스트 파일, 확대 문서, 스크린리더 호환 문서로 다시 요청할 수 있습니다.',
        law_refs: ['장애인차별금지법 제21조'],
        action_hint: '원문 PDF만 받은 경우 텍스트본이나 확대본 제공 가능 여부를 먼저 요청하세요.',
      },
      {
        id: 'visual-2',
        kind: 'right',
        title: '핵심 조항 음성 설명 요청',
        description:
          '임금, 휴게시간, 해고 조항처럼 중요한 부분은 구두 또는 음성 방식으로 다시 설명받을 수 있습니다.',
        law_refs: ['장애인차별금지법 제20조'],
      },
      {
        id: 'visual-3',
        kind: 'question',
        title: '확인해야 할 질문',
        description:
          '계약 내용을 스스로 확인 가능한 형식으로 받았는지, 추후 변경도 같은 방식으로 받을 수 있는지 점검하세요.',
        law_refs: ['장애인차별금지법 제21조'],
      },
    ],
    legal_basis: ['장애인차별금지법 제21조'],
  },
  hearing: {
    disability_type: 'hearing',
    disability_label: '청각',
    overview:
      '구두 안내 대신 문자, 메신저, 이메일처럼 기록 가능한 방식으로 계약 설명을 요청하는 것이 중요합니다.',
    cards: [
      {
        id: 'hearing-1',
        kind: 'right',
        title: '서면 설명 요청',
        description: '중요한 계약 설명과 변경 사항을 서면 또는 문자로 받도록 요청할 수 있습니다.',
        law_refs: ['장애인차별금지법 제20조'],
      },
      {
        id: 'hearing-2',
        kind: 'support',
        title: '기록 가능한 연락 방식 확보',
        description:
          '전화 안내보다 문자, 이메일, 메신저처럼 나중에 다시 볼 수 있는 안내 방식을 확보하는 것이 좋습니다.',
        law_refs: ['장애인차별금지법 제20조'],
      },
      {
        id: 'hearing-3',
        kind: 'question',
        title: '확인해야 할 질문',
        description: '계약 변경, 출근 스케줄, 임금 안내가 모두 기록 가능한 방식으로 남는지 확인하세요.',
        law_refs: ['근로기준법 제17조'],
      },
    ],
    legal_basis: ['장애인차별금지법 제20조'],
  },
  mobility: {
    disability_type: 'mobility',
    disability_label: '지체',
    overview: '근무 장소, 동선, 설비 접근성 같은 현실 조건을 계약 설명과 함께 검토해야 합니다.',
    cards: [
      {
        id: 'mobility-1',
        kind: 'support',
        title: '근무환경 조정 요청',
        description: '업무 수행에 필요한 좌석, 동선, 설비 조정을 협의할 수 있습니다.',
        law_refs: ['장애인고용촉진법 제5조의2'],
      },
      {
        id: 'mobility-2',
        kind: 'right',
        title: '이동·접근 조건 사전 확인',
        description:
          '출입구, 계단, 화장실, 작업대 높이처럼 실제 근무 지속에 필요한 조건을 계약 설명 단계에서 확인할 수 있습니다.',
        law_refs: ['장애인차별금지법 제4조'],
      },
      {
        id: 'mobility-3',
        kind: 'law',
        title: '환경 조정 관련 근거',
        description: '합리적 편의제공은 업무 수행 자체를 가능하게 하는 범위까지 포함될 수 있습니다.',
        law_refs: ['장애인차별금지법 제11조'],
      },
    ],
    legal_basis: ['장애인고용촉진법 제5조의2'],
  },
  cognitive: {
    disability_type: 'cognitive',
    disability_label: '인지',
    overview: '복잡한 계약 문구는 쉬운 설명과 단계별 안내로 다시 확인하는 것이 좋습니다.',
    cards: [
      {
        id: 'cognitive-1',
        kind: 'question',
        title: '쉬운 설명 재요청',
        description: '핵심 조항을 쉬운 문장으로 다시 설명해 달라고 요청할 수 있습니다.',
        law_refs: ['장애인차별금지법 제20조'],
      },
      {
        id: 'cognitive-2',
        kind: 'support',
        title: '단계별 확인 방식 요청',
        description:
          '한 번에 전체 계약을 설명받기보다 항목별로 나누어 설명받는 방식이 도움이 될 수 있습니다.',
        law_refs: ['장애인차별금지법 제20조'],
      },
      {
        id: 'cognitive-3',
        kind: 'question',
        title: '확인해야 할 질문',
        description:
          '본인이 이해한 내용과 실제 계약 조항이 같은지, 중요한 조건을 다시 말해볼 수 있는지 확인하세요.',
        law_refs: ['근로기준법 제17조'],
      },
    ],
    legal_basis: ['장애인차별금지법 제20조'],
  },
  mental: {
    disability_type: 'mental',
    disability_label: '정신',
    overview: '압박 상황에서 즉시 서명하지 않고 충분한 검토 시간을 확보하는 것이 중요합니다.',
    cards: [
      {
        id: 'mental-1',
        kind: 'question',
        title: '검토 시간 확보',
        description: '즉시 서명 대신 검토 시간을 요청하고, 신뢰할 수 있는 사람과 함께 확인할 수 있습니다.',
        law_refs: ['근로기준법 제17조'],
        action_hint: '압박을 느끼는 상황이라면 즉시 동의 대신 검토 후 답변하겠다고 남겨 두는 것이 좋습니다.',
      },
      {
        id: 'mental-2',
        kind: 'support',
        title: '동반 확인 요청',
        description:
          '계약 확인 시 가족, 활동지원인, 조력자와 함께 내용을 확인하는 방식을 요청할 수 있습니다.',
        law_refs: ['장애인차별금지법 제20조'],
      },
      {
        id: 'mental-3',
        kind: 'law',
        title: '중요 조항 재설명 근거',
        description: '이해하기 어려운 설명 방식만으로 계약 내용을 확정하는 것은 분쟁 위험을 높일 수 있습니다.',
        law_refs: ['근로기준법 제17조'],
      },
    ],
    legal_basis: ['근로기준법 제17조'],
  },
  complex: {
    disability_type: 'complex',
    disability_label: '중복',
    overview: '접근 가능한 형식, 설명 방식, 환경 조정을 함께 요청하는 복합 접근이 필요할 수 있습니다.',
    cards: [
      {
        id: 'complex-1',
        kind: 'support',
        title: '복합 지원 요청',
        description: '읽기 형식, 설명 방식, 근무환경 조정을 함께 요청할 수 있습니다.',
        law_refs: ['장애인차별금지법 제20조', '장애인차별금지법 제21조'],
      },
      {
        id: 'complex-2',
        kind: 'right',
        title: '지원 방식 병행 요청',
        description:
          '문서 형식, 설명 전달, 근무환경 조정을 하나씩 분리하지 않고 함께 요청하는 방식이 더 적절할 수 있습니다.',
        law_refs: ['장애인차별금지법 제11조'],
      },
      {
        id: 'complex-3',
        kind: 'question',
        title: '확인해야 할 질문',
        description:
          '현재 필요한 지원이 무엇인지 스스로 정리하기 어렵다면, 우선 불편한 지점을 사례로 설명하는 것부터 시작하세요.',
        law_refs: ['장애인차별금지법 제20조', '장애인차별금지법 제21조'],
      },
    ],
    legal_basis: ['장애인차별금지법 제20조', '장애인차별금지법 제21조'],
  },
};

class BeforeApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'BeforeApiError';
    this.status = status;
  }
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function getBeforeApiBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BEFORE_API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    DEFAULT_BEFORE_API_BASE_URL;
  return raw.replace(/\/$/, '');
}

async function parseJsonResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    let detail = fallbackMessage;
    try {
      const payload = (await response.json()) as { detail?: string };
      if (payload?.detail) {
        detail = payload.detail;
      }
    } catch {
      // ignore JSON parse failures on error responses
    }
    throw new BeforeApiError(response.status, detail);
  }

  return (await response.json()) as T;
}

function createAbortSignal(timeoutMs: number): { controller: AbortController; timeoutId: number } {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timeoutId };
}

function mapReviewResult(review: BeforeApiReviewResult): BeforeReviewResult {
  return {
    review_id: review.review_id,
    reviewed_at: review.reviewed_at,
    run_directory: review.run_directory,
    uploaded_files: review.uploaded_files ?? [],
    contract_info: review.contract_info,
    overall_result: review.overall_result,
    overall_severity: review.overall_severity,
    headline: review.user_explanation.headline,
    plain_language_summary: review.user_explanation.plain_language_summary,
    summary: review.summary,
    rule_check: review.rule_check ?? {},
    ocr_warnings: review.ocr_warnings ?? [],
    overall_assessment: review.user_explanation.overall_assessment,
    important_points: review.user_explanation.important_points,
    recommended_actions: review.user_explanation.recommended_actions,
    evidence: review.user_explanation.evidence,
  };
}

function mapReviewJob(job: BeforeApiReviewJobResponse): BeforeReviewJob {
  return {
    job_id: job.job_id,
    status: job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
    run_directory: job.run_directory ?? null,
    steps: job.steps,
    error: job.error ?? null,
    result: job.result ? mapReviewResult(job.result) : null,
  };
}

async function postFormData<T>(
  path: string,
  files: File[],
  timeoutMs: number,
  fallbackMessage: string,
  idToken?: string | null,
): Promise<T> {
  const formData = new FormData();
  if (files.length === 1) {
    formData.append('image', files[0]);
  } else {
    files.forEach((file) => formData.append('images', file));
  }

  const { controller, timeoutId } = createAbortSignal(timeoutMs);
  const headers = createBearerHeaders(idToken);

  try {
    const response = await fetch(`${getBeforeApiBaseUrl()}${path}`, {
      method: 'POST',
      ...(headers ? { headers } : {}),
      body: formData,
      signal: controller.signal,
    });
    return await parseJsonResponse<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof BeforeApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BeforeApiError(0, 'before API 응답 시간이 초과되었습니다.');
    }

    throw new BeforeApiError(0, fallbackMessage);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function createBearerHeaders(idToken: string | null | undefined): HeadersInit | undefined {
  const token = idToken?.trim();
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

async function getJson<T>(path: string, timeoutMs: number, fallbackMessage: string): Promise<T> {
  const { controller, timeoutId } = createAbortSignal(timeoutMs);

  try {
    const response = await fetch(`${getBeforeApiBaseUrl()}${path}`, {
      method: 'GET',
      signal: controller.signal,
    });
    return await parseJsonResponse<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof BeforeApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BeforeApiError(0, 'before API 상태 조회 시간이 초과되었습니다.');
    }

    throw new BeforeApiError(0, fallbackMessage);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function postJson<TRequest, TResponse>(
  path: string,
  body: TRequest,
  timeoutMs: number,
  fallbackMessage: string,
): Promise<TResponse> {
  const { controller, timeoutId } = createAbortSignal(timeoutMs);

  try {
    const response = await fetch(`${getBeforeApiBaseUrl()}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return await parseJsonResponse<TResponse>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof BeforeApiError) {
      throw error;
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new BeforeApiError(0, 'before API 응답 시간이 초과되었습니다.');
    }

    throw new BeforeApiError(0, fallbackMessage);
  } finally {
    window.clearTimeout(timeoutId);
  }
}

export async function startBeforeReviewJob(
  files: File[],
  idToken?: string | null,
): Promise<BeforeReviewJob> {
  const response = await postFormData<BeforeApiReviewJobResponse>(
    '/api/v1/before/review/jobs',
    files,
    REVIEW_TIMEOUT_MS,
    '계약서 분석 작업 생성에 실패했습니다.',
    idToken,
  );
  return mapReviewJob(response);
}

export async function getBeforeReviewJob(jobId: string): Promise<BeforeReviewJob> {
  const response = await getJson<BeforeApiReviewJobResponse>(
    `/api/v1/before/review/jobs/${jobId}`,
    POLLING_TIMEOUT_MS,
    '계약서 분석 상태 조회에 실패했습니다.',
  );
  return mapReviewJob(response);
}

export async function fetchBeforeAccessibility(
  disabilityType: BeforeDisabilityType,
  jobTraits: string[] = [],
): Promise<BeforeAccessibilityRecommendation> {
  return postJson<
    { disability_type: BeforeDisabilityType; job_traits: string[] },
    BeforeAccessibilityRecommendation
  >(
    '/api/v1/before/accessibility/recommendations',
    {
      disability_type: disabilityType,
      job_traits: jobTraits,
    },
    ACCESSIBILITY_TIMEOUT_MS,
    '장애 특화 안내를 불러오지 못했습니다.',
  );
}

export async function loadBeforeMockReview(
  scenario: BeforeMockScenario = 'sen0',
): Promise<BeforeReviewResult> {
  await delay(REVIEW_DELAY_MS);
  return {
    ...mockReviewResults[scenario],
    uploaded_files: [],
  };
}

export async function loadBeforeMockAccessibility(
  disabilityType: BeforeDisabilityType,
): Promise<BeforeAccessibilityRecommendation> {
  await delay(ACCESSIBILITY_DELAY_MS);
  return accessibilityCatalog[disabilityType];
}

export function resolveBeforeArtifactUrl(path: string): string {
  if (!path) {
    return path;
  }
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('/before-mock/')) {
    return path;
  }
  return `${getBeforeApiBaseUrl()}${path}`;
}

export { BeforeApiError };
