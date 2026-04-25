import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap'
});

export const metadata: Metadata = {
  title: 'UMAttend',
  description: 'UMAttend on the latest events in the campus'
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          <Suspense fallback={null}>{children}</Suspense>
          <Toaster richColors position="top-right" />
        </Providers>
      </body>
    </html>
  );
}
