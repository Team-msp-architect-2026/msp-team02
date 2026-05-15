import styles from './Spinner.module.css';

interface SpinnerProps {
  size?: 'inline' | 'section';
  label?: string;
}

export function Spinner({ size = 'inline', label = '로딩 중' }: SpinnerProps) {
  return (
    <span
      className={`${styles.spinner} ${styles[size]}`}
      role="status"
      aria-label={label}
    />
  );
}
