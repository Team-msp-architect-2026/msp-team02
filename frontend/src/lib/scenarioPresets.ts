import type { AnswerResponse } from '@/types/api';

import scenarioPresetAnswers from './scenarioPresetAnswers.json';

export type ScenarioPresetId = 'SCN-001-BRIDGE-DEMO' | 'SCN-004-DEMO-FREEZE';
export type ScenarioPresetScenarioId = 'SCN-001' | 'SCN-004';

export interface ScenarioPreset {
  id: ScenarioPresetId;
  scenarioId: ScenarioPresetScenarioId;
  label: string;
  query: string;
  recommendedTopK: number;
  supportsDraft: boolean;
  fixedAnswer: AnswerResponse;
}

const fixedAnswers = scenarioPresetAnswers as Record<ScenarioPresetId, AnswerResponse>;

export const SCENARIO_PRESETS: readonly ScenarioPreset[] = [
  {
    id: 'SCN-001-BRIDGE-DEMO',
    scenarioId: 'SCN-001',
    label: 'SCN-001 · 사업장 변경 사유 상담 데모',
    query:
      '계약서 분석에서 표준근로계약서 미사용, 기숙사 정보 누락, 숙소비 공제 위험이 있다고 나왔습니다. 실제로 일해보니 기숙사 환경이 열악하고 월급에서 숙소비가 많이 공제됐으며 외국인이라는 이유로 폭언과 차별도 받았습니다. 이런 경우 회사 잘못을 이유로 사업장 변경을 신청할 수 있나요?',
    recommendedTopK: 10,
    supportsDraft: false,
    fixedAnswer: fixedAnswers['SCN-001-BRIDGE-DEMO'],
  },
  {
    id: 'SCN-004-DEMO-FREEZE',
    scenarioId: 'SCN-004',
    label: 'SCN-004 · 임금체불·부당해고 문서 데모',
    query:
      '해고를 당했는데 서면통지는 없고 30일 전에 예고도 못 받았습니다. 퇴사 후 마지막 임금과 퇴직금도 14일 넘게 지급받지 못했습니다.',
    recommendedTopK: 10,
    supportsDraft: true,
    fixedAnswer: fixedAnswers['SCN-004-DEMO-FREEZE'],
  },
];

export function getScenarioPreset(
  presetId: ScenarioPresetId | null | undefined,
): ScenarioPreset | null {
  if (!presetId) {
    return null;
  }

  return SCENARIO_PRESETS.find((preset) => preset.id === presetId) ?? null;
}
