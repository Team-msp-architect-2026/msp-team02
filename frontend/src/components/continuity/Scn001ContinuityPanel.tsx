import {
  SCN001_CONTINUITY_BOUNDARY,
  SCN001_CONTINUITY_GROUPS,
} from '@/lib/scn001ContinuityPanel';

import styles from './Scn001ContinuityPanel.module.css';

interface Scn001ContinuityPanelProps {
  titleId?: string;
}

export function Scn001ContinuityPanel({
  titleId = 'scn001-continuity-title',
}: Scn001ContinuityPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <p className={styles.eyebrow}>연결된 검토 결과</p>
      <h2 id={titleId} className={styles.title}>
        이전 계약서 검토와 이어지는 내용
      </h2>
      <p className={styles.description}>
        이전 계약서 검토 내용은 사건 배경과 흐름을 이해하기 위한 보조 설명입니다.
        현재 답변과 초안의 법적 근거는 화면에 표시된 근거 조문과 출처 컨텍스트에
        한정됩니다.
      </p>

      <div className={styles.groupGrid}>
        {SCN001_CONTINUITY_GROUPS.map((group) => (
          <div key={group.title} className={styles.group}>
            <h3 className={styles.groupTitle}>{group.title}</h3>
            <ul className={styles.list}>
              {group.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className={styles.boundary}>{SCN001_CONTINUITY_BOUNDARY}</p>
    </section>
  );
}
