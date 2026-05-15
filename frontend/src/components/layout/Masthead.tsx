'use client';

import Link from 'next/link';

import styles from './Masthead.module.css';

interface MastheadProps {
  isLoading?: boolean;
}

export function Masthead({ isLoading = false }: MastheadProps) {
  return (
    <header className={styles.masthead}>
      <div className={styles.inner}>
        <Link className={styles.brand} href="/">
          <span className={styles.mark} aria-hidden="true">
            법
          </span>
          <span className={styles.brandText}>법대로 AI</span>
        </Link>
      </div>
      <div
        className={isLoading ? styles.progress : styles.progressHidden}
        aria-hidden={!isLoading}
      />
    </header>
  );
}
