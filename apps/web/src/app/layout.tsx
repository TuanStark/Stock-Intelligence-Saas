import type { Metadata } from 'next';
import './globals.css';
import SessionProviderWrapper from '@/components/SessionProviderWrapper';
import { I18nProvider } from '@/lib/i18n/i18n-context';

export const metadata: Metadata = {
  title: 'Stock Intelligence SaaS — Decision-First Equity Analysis',
  description: 'AI-Powered real-time Vietnamese equity insight and decision terminal.',
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

