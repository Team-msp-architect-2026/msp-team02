'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

import { Spinner } from './Spinner';
import styles from './Button.module.css';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'tertiary' | 'secondary';
  isLoading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

export function Button({
  variant = 'primary',
  isLoading = false,
  fullWidth = false,
  children,
  className,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  const buttonClassName = [
    styles.button,
    styles[variant],
    fullWidth ? styles.fullWidth : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      {...props}
      className={buttonClassName}
      disabled={disabled || isLoading}
      type={type}
      aria-busy={isLoading || undefined}
    >
      {isLoading ? <Spinner label="처리 중" /> : null}
      <span>{isLoading ? '처리 중...' : children}</span>
    </button>
  );
}
