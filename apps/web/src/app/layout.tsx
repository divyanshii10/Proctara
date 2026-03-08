import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth-context';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Proctara — AI-Powered Technical Interviews',
  description:
    'Conduct adaptive AI interviews, live coding challenges, and detailed evaluations. Eliminate bias from your hiring pipeline.',
  metadataBase: new URL('http://localhost:3000'),
  themeColor: '#000000',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.variable}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
