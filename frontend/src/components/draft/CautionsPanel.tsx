import styles from './CautionsPanel.module.css';

interface CautionsPanelProps {
  cautions: string[];
}

export function CautionsPanel({ cautions }: CautionsPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="cautions-title">
      <h2 id="cautions-title" className={styles.title}>
        주의사항
      </h2>
      {cautions.length > 0 ? (
        <ul className={styles.list}>
          {cautions.map((caution) => (
            <li key={caution}>{caution}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyText}>추가 주의사항이 없습니다.</p>
      )}
    </section>
  );
}
