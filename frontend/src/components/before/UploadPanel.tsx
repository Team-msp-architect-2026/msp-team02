'use client';

import { useState, type ChangeEvent } from 'react';

import type { BeforeMockScenario } from '@/types/before';

import styles from './UploadPanel.module.css';

interface UploadPanelProps {
  files: File[];
  isSubmitting: boolean;
  errorMessage: string | null;
  authNoticeMessage?: string | null;
  showAuthSignInAction?: boolean;
  isAuthActionDisabled?: boolean;
  onFilesChange: (files: File[]) => void;
  onAnalyze: () => void;
  onSignIn?: () => void;
  onLoadMock: (scenario: BeforeMockScenario) => void;
}

const infoTiles = [
  {
    title: 'PDF 단일 업로드',
    description: 'PDF는 1개만 업로드할 수 있고, 파일당 최대 10MB까지 허용됩니다.',
  },
  {
    title: '다중 이미지 업로드',
    description: '이미지는 최대 5장까지 올릴 수 있고, 전체 업로드 용량은 20MB를 넘길 수 없습니다.',
  },
  {
    title: '진행 상태 확인',
    description: '분석을 시작하면 OCR과 항목 검토 진행 상태가 같은 화면에서 이어집니다.',
  },
];

const caseGuides: Array<{
  scenario: BeforeMockScenario;
  label: string;
  description: string;
}> = [
  {
    scenario: 'sen0',
    label: '외국인 근로자',
    description:
      '표준근로계약서 여부와 계약 언어, 임금·근로시간·숙소 조건, 숙소비 공제나 여권 보관 조항을 확인합니다.',
  },
  {
    scenario: 'sen1',
    label: '아르바이트',
    description:
      '시급, 근로시간, 휴게시간, 주휴수당과 수습·공제·연장·야간·휴일근로 수당 조건을 확인합니다.',
  },
  {
    scenario: 'sen2',
    label: '장애인 근로자',
    description:
      '직무, 근로시간, 임금 조건과 필요한 편의 제공·안전한 근무환경·의사소통 지원이 빠져 있지 않은지 확인합니다.',
  },
];

export function UploadPanel({
  files,
  isSubmitting,
  errorMessage,
  authNoticeMessage = null,
  showAuthSignInAction = false,
  isAuthActionDisabled = false,
  onFilesChange,
  onAnalyze,
  onSignIn,
  onLoadMock,
}: UploadPanelProps) {
  const [selectedGuide, setSelectedGuide] = useState<BeforeMockScenario>('sen0');
  const activeGuide =
    caseGuides.find((guide) => guide.scenario === selectedGuide) ?? caseGuides[0];

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    if (!nextFiles.length) {
      return;
    }

    onFilesChange([...files, ...nextFiles]);
    event.target.value = '';
  }

  function removeFile(index: number) {
    onFilesChange(files.filter((_, currentIndex) => currentIndex !== index));
  }

  function handleGuideClick(scenario: BeforeMockScenario) {
    setSelectedGuide(scenario);
    onLoadMock(scenario);
  }

  return (
    <div className={styles.grid}>
      <section className={styles.primaryCard} aria-labelledby="before-upload-title">
        <div className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Upload contract</p>
            <h2 id="before-upload-title" className={styles.title}>
              계약서 파일을 올리고 분석을 시작하세요
            </h2>
            <p className={styles.description}>
              `jpg`, `png`, `pdf`를 지원합니다. 이미지 여러 장은 같은 계약서의 페이지
              순서대로 유지해 주세요. 이미지는 최대 5장, PDF는 1개만 업로드할 수 있으며
              파일당 최대 10MB, 전체 최대 20MB까지 허용됩니다.
            </p>
          </div>
        </div>

        <label className={styles.dropzone}>
          <div className={styles.dropIcon}>+</div>
          <h3 className={styles.dropTitle}>파일을 드래그하거나 클릭해서 추가</h3>
          <p className={styles.dropDescription}>
            업로드 후 분석 시작을 누르면 진행 상태와 결과 화면을 확인할 수 있습니다. 이미지 5장
            이하 또는 PDF 1개만 선택해 주세요.
          </p>
          <input
            type="file"
            multiple
            accept=".jpg,.jpeg,.png,.pdf"
            className={styles.hiddenInput}
            onChange={handleInput}
          />
        </label>

        <div className={styles.fileSection}>
          <div className={styles.fileHeader}>
            <h3 className={styles.fileTitle}>Selected files</h3>
            <span className={styles.fileCount}>{files.length}개 선택됨</span>
          </div>

          <div className={styles.fileList}>
            {files.length ? (
              files.map((file, index) => (
                <div key={`${file.name}-${index}`} className={styles.fileRow}>
                  <div className={styles.fileMeta}>
                    <p className={styles.fileName}>{file.name}</p>
                    <p className={styles.fileSize}>
                      {Math.max(1, Math.round(file.size / 1024))} KB
                    </p>
                  </div>
                  <button
                    type="button"
                    className={styles.removeButton}
                    onClick={() => removeFile(index)}
                    disabled={isSubmitting}
                    aria-label={`${file.name} 삭제`}
                  >
                    x
                  </button>
                </div>
              ))
            ) : (
              <div className={styles.emptyState}>아직 선택된 파일이 없습니다.</div>
            )}
          </div>
        </div>

        {errorMessage ? <div className={styles.errorBox}>{errorMessage}</div> : null}

        {authNoticeMessage ? (
          <div className={styles.authNotice} role="alert">
            <p className={styles.authNoticeText}>{authNoticeMessage}</p>
            {showAuthSignInAction && onSignIn ? (
              <button
                type="button"
                className={styles.authNoticeAction}
                onClick={onSignIn}
                disabled={isAuthActionDisabled}
              >
                Google 로그인
              </button>
            ) : null}
          </div>
        ) : null}

        <div className={styles.actionBar}>
          <button
            type="button"
            onClick={onAnalyze}
            disabled={isSubmitting}
            className={styles.primaryAction}
          >
            {isSubmitting ? '분석 진행 중' : '분석 시작'}
          </button>
        </div>

        <div className={styles.infoGrid}>
          {infoTiles.map((tile) => (
            <article key={tile.title} className={styles.infoTile}>
              <h3 className={styles.infoTitle}>{tile.title}</h3>
              <p className={styles.infoDescription}>{tile.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.caseGuide} aria-labelledby="before-case-guide-title">
        <div className={styles.caseGuideHeader}>
          <p className={styles.caseGuideEyebrow}>Example scenarios</p>
          <h3 id="before-case-guide-title" className={styles.caseGuideTitle}>
            계약서 유형별 확인 포인트
          </h3>
        </div>

        <div className={styles.caseTabs} role="group" aria-label="계약서 사례 선택">
          {caseGuides.map((guide) => {
            const isSelected = guide.scenario === selectedGuide;

            return (
              <button
                key={guide.scenario}
                type="button"
                onClick={() => handleGuideClick(guide.scenario)}
                disabled={isSubmitting}
                className={`${styles.caseTab} ${isSelected ? styles.caseTabSelected : ''}`}
                aria-pressed={isSelected}
              >
                {guide.label}
              </button>
            );
          })}
        </div>

        <p className={styles.caseDescription}>{activeGuide.description}</p>
      </section>
    </div>
  );
}
