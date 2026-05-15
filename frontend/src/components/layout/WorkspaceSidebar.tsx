'use client';

import { FileSearch, FolderClock, Home, MessageSquare, Plus } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import styles from './WorkspaceSidebar.module.css';

export type WorkspaceNavItem = 'home' | 'before' | 'after' | 'history';

interface WorkspaceSidebarProps {
  activeItem: WorkspaceNavItem;
  actionLabel?: string;
  actionDescription?: string;
  actionDisabled?: boolean;
  onAction?: () => void;
  onNavItemClick?: (item: WorkspaceNavItem) => void;
  reserveActionSlot?: boolean;
  summary?: ReactNode;
  ariaLabel?: string;
}

const navItems: Array<{
  key: WorkspaceNavItem;
  href: string;
  label: string;
  icon: typeof Home;
}> = [
  { key: 'home', href: '/', label: '홈', icon: Home },
  { key: 'before', href: '/before', label: '계약서 검토', icon: FileSearch },
  { key: 'after', href: '/after', label: 'AI 법률 상담', icon: MessageSquare },
  { key: 'history', href: '/history', label: '사건 기록', icon: FolderClock },
];

export function WorkspaceSidebar({
  activeItem,
  actionLabel,
  actionDescription,
  actionDisabled = false,
  onAction,
  onNavItemClick,
  reserveActionSlot = false,
  summary,
  ariaLabel = '작업 메뉴',
}: WorkspaceSidebarProps) {
  return (
    <aside className={styles.sidebar} aria-label={ariaLabel}>
      <div className={styles.sidebarBrand}>
        <span className={styles.sidebarBrandMark}>법</span>
        <div>
          <strong>법대로 AI</strong>
          <span>Legal workspace</span>
        </div>
      </div>

      {actionLabel && onAction ? (
        <button
          type="button"
          className={styles.sidebarNewButton}
          onClick={onAction}
          disabled={actionDisabled}
          aria-label={actionDescription ?? actionLabel}
        >
          <Plus size={15} aria-hidden="true" />
          {actionLabel}
        </button>
      ) : reserveActionSlot ? (
        <div className={styles.sidebarActionSpacer} aria-hidden="true" />
      ) : null}

      <nav className={styles.sidebarNav} aria-label={ariaLabel}>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem === item.key;
          const className = isActive
            ? `${styles.sidebarItem} ${styles.sidebarItemActive}`
            : styles.sidebarItem;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={className}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => onNavItemClick?.(item.key)}
            >
              <Icon size={16} aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {summary ? <div className={styles.sidebarSummary}>{summary}</div> : null}
    </aside>
  );
}
