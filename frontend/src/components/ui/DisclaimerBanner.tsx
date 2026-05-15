import type { ReactNode } from 'react';

import styles from './DisclaimerBanner.module.css';

interface DisclaimerBannerProps {
  children?: ReactNode;
}

export function DisclaimerBanner({ children }: DisclaimerBannerProps) {
  return (
    <aside className={styles.banner} role="note">
      {children ?? (
        <p>
          이 서비스는 법률 판단을 확정하지 않습니다. 제출 전 전문가 또는 담당 기관의
          검토를 받으세요.
        </p>
      )}
    </aside>
  );
}
