import styles from './CitationPill.module.css';

interface CitationPillProps {
  label: string;
}

export function CitationPill({ label }: CitationPillProps) {
  return <span className={styles.pill}>{label}</span>;
}
