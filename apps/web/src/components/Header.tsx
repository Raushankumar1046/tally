'use client';

import React from 'react';
import Link from 'next/link';
import { Zap, RefreshCw, Search } from 'lucide-react';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onRefresh?: () => void;
  actionButton?: React.ReactNode;
}

export default function Header({ title, subtitle, onRefresh, actionButton }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 bg-tally-bg/80 backdrop-blur-md border-b border-tally-border px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs text-tally-textMuted mt-0.5">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="p-2 rounded-lg bg-tally-card border border-tally-border hover:bg-tally-cardHover text-gray-300 hover:text-white transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent('focus-dashboard-search'));
            const el = document.querySelector('input[placeholder*="Search by Invoice"]') as HTMLInputElement;
            if (el) {
              el.focus();
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else {
              window.location.href = '/';
            }
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-tally-card border border-tally-border hover:border-brand-500/40 text-gray-300 hover:text-white text-xs font-medium transition-colors"
          title="Universal Search (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-brand-400" />
          <span className="hidden md:inline">Universal Search</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-tally-bg border border-tally-border text-gray-400">
            Ctrl+K
          </span>
        </button>

        {actionButton}

        <Link
          href="/billing"
          className="flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-tally-bg font-bold py-2 px-4 rounded-lg text-sm transition-all shadow-md shadow-brand-500/20"
        >
          <Zap className="w-4 h-4 fill-tally-bg" />
          <span>POS Checkout</span>
        </Link>
      </div>
    </header>
  );
}
