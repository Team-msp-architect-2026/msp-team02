'use client';

import { AlertTriangle, Check, Circle, LoaderCircle } from 'lucide-react';

import type { BeforeReviewJob, BeforeReviewJobStep } from '@/types/before';

import styles from './LoadingPanel.module.css';

interface LoadingPanelProps {
  fileCount: number;
  job: BeforeReviewJob | null;
}

type ProgressStageStatus = 'pending' | 'running' | 'completed' | 'failed';

interface ProgressStage {
  key: string;
  title: string;
  description: string;
  status: ProgressStageStatus;
}

const OCR_GUIDANCE = 'OCR 단계는 문서 이미지 품질과 분량에 따라 1~2분 정도 걸릴 수 있습니다.';

const REVIEW_STEP_MATCHERS = [
  /section/i,
  /compare/i,
  /rule/i,
  /validation/i,
  /explanation/i,
  /review/i,
  /result/i,
  /조항/,
  /검토/,
  /결과/,
  /설명/,
];

function getStepIndicator(status: ProgressStageStatus) {
  if (status === 'completed') {
    return <Check size={16} strokeWidth={2.5} />;
  }

  if (status === 'failed') {
    return <AlertTriangle size={16} strokeWidth={2.4} />;
  }

  if (status === 'running') {
    return <LoaderCircle size={17} strokeWidth={2.4} className={styles.spinner} />;
  }

  return <Circle size={15} strokeWidth={2.2} />;
}

export function LoadingPanel({ fileCount, job }: LoadingPanelProps) {
  const stages = buildProgressStages(job);
  const activeStage = stages.find((stage) => stage.status === 'running') ?? null;
  const currentStatus = getCurrentStatusText(job, activeStage);

  return (
    <section className={styles.panel} aria-labelledby="before-loading-title" aria-busy="true">
      <div className={styles.grid}>
        <div className={styles.mainColumn}>
          <div className={styles.header}>
            <span className={styles.badge}>Analysis in progress</span>
            <h2 id="before-loading-title" className={styles.title}>
              계약서를 읽고 분석 결과를 준비하고 있습니다.
            </h2>
            <p className={styles.description}>
              업로드된 파일 {fileCount}개를 기준으로 텍스트 추출과 조항 검토를 진행하고 있습니다.
              브라우저를 닫지 말고 잠시 기다려 주세요.
            </p>
          </div>

          <div className={styles.statusBox} aria-live="polite">
            <div className={styles.statusPulse} aria-hidden="true" />
            <div>
              <p className={styles.statusTitle}>{currentStatus}</p>
              <p className={styles.statusText}>{OCR_GUIDANCE}</p>
            </div>
          </div>

          <ol className={styles.stepList} aria-label="분석 진행 단계">
            {stages.map((stage, index) => (
              <li key={stage.key} className={styles.stepRow}>
                <div
                  className={[
                    styles.stepIndicator,
                    stage.status === 'running' ? styles.stepIndicatorRunning : '',
                    stage.status === 'completed' ? styles.stepIndicatorCompleted : '',
                    stage.status === 'failed' ? styles.stepIndicatorFailed : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-hidden="true"
                >
                  {getStepIndicator(stage.status)}
                </div>
                <div className={styles.stepBody}>
                  <p className={styles.stepLabel}>Step {index + 1}</p>
                  <p className={styles.stepTitle}>{stage.title}</p>
                  <p className={styles.stepMessage}>{stage.description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <aside className={styles.sideColumn} aria-label="분석 흐름 안내">
          <p className={styles.sideEyebrow}>Wait guidance</p>
          <h3 className={styles.sideTitle}>OCR 단계에서 시간이 걸릴 수 있습니다</h3>
          <p className={styles.sideText}>{OCR_GUIDANCE}</p>
          <p className={styles.sideText}>
            문서가 흐리거나 페이지가 많으면 더 오래 걸릴 수 있습니다. 화면이 멈춘 것이 아니므로
            이 페이지를 유지해 주세요.
          </p>
        </aside>
      </div>
    </section>
  );
}

function buildProgressStages(job: BeforeReviewJob | null): ProgressStage[] {
  const uploadStatus = getUploadStatus(job);
  const ocrStatus = getStepGroupStatus(job?.steps ?? [], isOcrStep);
  const reviewStatus = getStepGroupStatus(job?.steps ?? [], isReviewStep);
  const prepareStatus = getPrepareStatus(job, ocrStatus, reviewStatus);

  return [
    {
      key: 'upload',
      title: uploadStatus === 'completed' ? '파일 업로드 완료' : '파일 업로드 확인 중',
      description:
        uploadStatus === 'completed'
          ? '선택한 파일을 분석 작업에 연결했습니다.'
          : '선택한 파일을 분석 작업에 연결하고 있습니다.',
      status: uploadStatus,
    },
    {
      key: 'ocr',
      title: 'OCR로 계약서 텍스트 추출 중',
      description: '계약서 이미지나 PDF에서 읽을 수 있는 텍스트를 추출합니다.',
      status: ocrStatus,
    },
    {
      key: 'review',
      title: '조항 검토 및 결과 정리 중',
      description: '추출된 내용을 바탕으로 주요 계약 항목과 위험 신호를 검토합니다.',
      status: reviewStatus,
    },
    {
      key: 'prepare',
      title: '결과 준비 중',
      description: '확인된 내용을 사용자가 읽기 쉬운 결과 카드로 정리합니다.',
      status: prepareStatus,
    },
  ];
}

function getUploadStatus(job: BeforeReviewJob | null): ProgressStageStatus {
  if (!job) {
    return 'running';
  }

  const uploadStatus = getStepGroupStatus(job.steps, isUploadStep);
  if (uploadStatus !== 'pending') {
    return uploadStatus;
  }

  return job.status === 'failed' ? 'failed' : 'completed';
}

function getPrepareStatus(
  job: BeforeReviewJob | null,
  ocrStatus: ProgressStageStatus,
  reviewStatus: ProgressStageStatus,
): ProgressStageStatus {
  if (!job) {
    return 'pending';
  }

  if (job.status === 'failed') {
    return 'failed';
  }

  if (job.status === 'completed') {
    return 'completed';
  }

  if (reviewStatus === 'completed' || (!hasRunningStep(job.steps) && ocrStatus === 'completed')) {
    return 'running';
  }

  return 'pending';
}

function getStepGroupStatus(
  steps: BeforeReviewJobStep[],
  matcher: (step: BeforeReviewJobStep) => boolean,
): ProgressStageStatus {
  const matchedSteps = steps.filter(matcher);

  if (!matchedSteps.length) {
    return 'pending';
  }

  if (matchedSteps.some((step) => step.status === 'failed')) {
    return 'failed';
  }

  if (matchedSteps.some((step) => step.status === 'running')) {
    return 'running';
  }

  if (matchedSteps.every((step) => step.status === 'completed')) {
    return 'completed';
  }

  if (matchedSteps.some((step) => step.status === 'completed')) {
    return 'running';
  }

  return 'pending';
}

function getCurrentStatusText(
  job: BeforeReviewJob | null,
  activeStage: ProgressStage | null,
): string {
  if (activeStage) {
    return activeStage.title;
  }

  if (!job) {
    return '분석 작업을 시작하는 중입니다.';
  }

  if (job.status === 'queued' || job.status === 'running') {
    return '분석 진행 중';
  }

  if (job.status === 'completed') {
    return '결과 준비 중';
  }

  return '분석 진행 중';
}

function hasRunningStep(steps: BeforeReviewJobStep[]): boolean {
  return steps.some((step) => step.status === 'running');
}

function isUploadStep(step: BeforeReviewJobStep): boolean {
  const haystack = `${step.key} ${step.label}`.toLowerCase();
  return /file|upload|파일|업로드|형식/.test(haystack);
}

function isOcrStep(step: BeforeReviewJobStep): boolean {
  const haystack = `${step.key} ${step.label}`.toLowerCase();
  return haystack.includes('ocr') || haystack.includes('텍스트') || haystack.includes('추출');
}

function isReviewStep(step: BeforeReviewJobStep): boolean {
  if (isUploadStep(step) || isOcrStep(step)) {
    return false;
  }

  const haystack = `${step.key} ${step.label}`;
  return REVIEW_STEP_MATCHERS.some((matcher) => matcher.test(haystack));
}
