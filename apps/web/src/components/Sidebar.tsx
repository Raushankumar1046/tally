'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Users,
  Receipt,
  FileText,
  BookOpen,
  Landmark,
  Settings,
  Zap,
  Database,
  Trash2,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Quick Billing (POS)', href: '/billing', icon: Zap, highlight: true },
  { name: 'Banking & Cash', href: '/banking', icon: Landmark },
  { name: 'Inventory & Stock', href: '/inventory', icon: Boxes },
  { name: 'Vendor Directory', href: '/vendors', icon: Users },
  { name: 'Purchase Entry', href: '/purchases', icon: ShoppingCart },
  { name: 'GST Tax Reports', href: '/reports/gst', icon: FileText },
  { name: 'Journal Vouchers', href: '/journal', icon: BookOpen },
  { name: 'Backup & Data Safety', href: '/backup', icon: Database },
  { name: 'Recycle Bin', href: '/recycle-bin', icon: Trash2 },
  { name: 'Company Settings', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-tally-card border-r border-tally-border flex flex-col h-screen sticky top-0 z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-tally-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center shadow-lg shadow-brand-500/20">
          <Receipt className="w-6 h-6 text-tally-bg font-bold" />
        </div>
        <div>
          <h1 className="font-bold text-lg text-white tracking-wide flex items-center gap-1.5">
            TALLY<span className="text-brand-400 font-mono text-xs px-1.5 py-0.5 rounded bg-brand-900/60 border border-brand-500/30">V3</span>
          </h1>
          <p className="text-xs text-tally-textMuted">Enterprise Banking Suite</p>
        </div>
      </div>

      {/* Quick Action POS Button */}
      <div className="px-4 py-3">
        <Link
          href="/billing"
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-md shadow-brand-500/10 hover:shadow-brand-500/20 transition-all duration-200 group"
        >
          <Zap className="w-4 h-4 fill-white group-hover:scale-110 transition-transform" />
          <span>New Billing POS</span>
        </Link>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto py-2">
        <div className="px-3 pb-1 text-[10px] font-semibold text-tally-textMuted uppercase tracking-wider">
          Enterprise Modules
        </div>

        {navigation.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2 rounded-lg font-medium text-xs transition-all duration-150 ${
                isActive
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30 shadow-inner'
                  : 'text-gray-300 hover:bg-tally-cardHover hover:text-white'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  isActive ? 'text-brand-400' : 'text-gray-400 group-hover:text-white'
                }`}
              />
              <span>{item.name}</span>
              {item.highlight && !isActive && (
                <span className="ml-auto px-1.5 py-0.5 text-[9px] bg-brand-500/20 text-brand-400 rounded-full font-mono font-semibold">
                  FAST
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer System Status */}
      <div className="p-3 border-t border-tally-border bg-tally-bg/50">
        <div className="flex items-center justify-between text-xs text-tally-textMuted">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>API Online</span>
          </div>
          <span className="font-mono text-[10px] text-gray-500">v3.0.0-PROD</span>
        </div>
      </div>
    </aside>
  );
}
