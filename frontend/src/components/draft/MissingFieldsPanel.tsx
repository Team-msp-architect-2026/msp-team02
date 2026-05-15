import styles from './MissingFieldsPanel.module.css';

interface MissingFieldsPanelProps {
  missingFields: string[];
}

export function MissingFieldsPanel({ missingFields }: MissingFieldsPanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="missing-fields-title">
      <h2 id="missing-fields-title" className={styles.title}>
        확인이 필요한 항목
      </h2>
      {missingFields.length > 0 ? (
        <ul className={styles.list}>
          {missingFields.map((field) => (
            <li key={field}>{field}</li>
          ))}
        </ul>
      ) : (
        <p className={styles.emptyText}>추가로 표시된 확인 항목이 없습니다.</p>
      )}
    </section>
  );
}
