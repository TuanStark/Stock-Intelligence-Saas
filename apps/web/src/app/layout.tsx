import type { Metadata } from 'next';
import './globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import { I18nProvider } from '@/lib/i18n/i18n-context';

export const metadata: Metadata = {
  title: 'Chứng Khoán AI',
  description: 'Nền tảng AI hỗ trợ phân tích cổ phiếu và ra quyết định đầu tư tại Việt Nam.',
  icons: {
    icon: '/logo-new.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <SessionProviderWrapper>
          <I18nProvider>
            {children}
          </I18nProvider>
        </SessionProviderWrapper>
      </body>
    </html>
  );
}

