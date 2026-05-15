import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/context/AuthContext';
import { FlowProvider } from '@/context/FlowContext';

import './globals.css';

export const metadata: Metadata = {
  title: '법대로',
  description: '계약서 분석과 노동법 대응을 잇는 통합 AI',
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>
          <FlowProvider>{children}</FlowProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
