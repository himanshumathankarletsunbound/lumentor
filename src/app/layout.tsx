import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { RootProvider } from '../components/providers/RootProvider';
import { db } from '../lib/db/store';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Apex Operations, Scheduling & Payroll - Classcard Integrated',
  description: 'Enterprise operational scheduling, multi-model mentor payroll calculation, attendance verification, and Classcard synchronization management system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const snapshot = db.getSnapshot();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-slate-50 text-slate-800"
        suppressHydrationWarning
      >
        <RootProvider initialSnapshot={snapshot}>{children}</RootProvider>
      </body>
    </html>
  );
}
