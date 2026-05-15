'use client';

import type { ReactNode } from 'react';

import styles from './Notification.module.css';

interface NotificationProps {
  variant?: 'info' | 'warning' | 'error' | 'success';
  title?: string;
  children: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  onClose?: () => void;
  closeLabel?: string;
}

const variantLabels = {
  info: '안내',
  warning: '주의',
  error: '오류',
  success: '완료',
} as const;

export function Notification({
  variant = 'info',
  title,
  children,
  actionLabel,
  onAction,
  onClose,
  closeLabel = '알림 닫기',
}: NotificationProps) {
  const isAlert = variant === 'error' || variant === 'warning';
  const content = (
    <>
      <div className={styles.content}>
        <p className={styles.title}>{title ?? variantLabels[variant]}</p>
        <div className={styles.message}>{children}</div>
      </div>
      {actionLabel && onAction ? (
        <div className={styles.actions}>
          <button className={styles.action} type="button" onClick={onAction}>
            {actionLabel}
          </button>
          {onClose ? (
            <button
              className={styles.close}
              type="button"
              aria-label={closeLabel}
              onClick={onClose}
            >
              ×
            </button>
          ) : null}
        </div>
      ) : onClose ? (
        <button
          className={styles.close}
          type="button"
          aria-label={closeLabel}
          onClick={onClose}
        >
          ×
        </button>
      ) : null}
    </>
  );

  if (isAlert) {
    return (
      <section className={`${styles.notification} ${styles[variant]}`} role="alert">
        {content}
      </section>
    );
  }

  return (
    <section className={`${styles.notification} ${styles[variant]}`} role="status">
      {content}
    </section>
  );
}
