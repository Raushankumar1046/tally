import type { Metadata } from 'next';
import './globals.css';
import Sidebar from '@/components/Sidebar';

export const metadata: Metadata = {
  title: 'Tally Solutions - Billing & Inventory Management System',
  description: 'Fast POS billing, vendor management, stock ledger, and accounting summary.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-tally-bg text-white min-h-screen flex antialiased">
        {/* Sidebar Navigation */}
        <Sidebar />

        {/* Main Content View */}
        <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
