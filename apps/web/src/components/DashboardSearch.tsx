'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  X,
  Loader2,
  Receipt,
  ShoppingCart,
  Building,
  Boxes,
  CreditCard,
  ArrowUpRight,
  Printer,
  Calendar,
  Phone,
  FileText,
  Tag,
  AlertCircle,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { api, Invoice, Purchase, Vendor, Item, Voucher, SearchResults, formatCurrency } from '@/lib/api';

interface DashboardSearchProps {
  onSelectInvoice?: (invoice: Invoice) => void;
  onSelectPurchase?: (purchase: Purchase) => void;
  onSelectVendor?: (vendor: Vendor) => void;
}

type TabType = 'all' | 'invoices' | 'purchases' | 'vendors' | 'items' | 'vouchers';

export default function DashboardSearch({
  onSelectInvoice,
  onSelectPurchase,
  onSelectVendor,
}: DashboardSearchProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Ctrl + K or '/' to focus search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey && e.key.toLowerCase() === 'k') || (e.key === '/' && document.activeElement !== inputRef.current && (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA'))) {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    };
    const handleCustomFocus = () => {
      inputRef.current?.focus();
      inputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('focus-dashboard-search', handleCustomFocus);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('focus-dashboard-search', handleCustomFocus);
    };
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults(null);
      setLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await api.search(query.trim(), activeTab);
        setSearchResults(data);
      } catch (err: any) {
        console.error('Search error:', err);
        setError('Failed to fetch search results');
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query, activeTab]);

  const clearSearch = () => {
    setQuery('');
    setSearchResults(null);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestedText: string) => {
    setQuery(suggestedText);
    inputRef.current?.focus();
  };

  const counts = searchResults?.counts || {
    all: 0,
    invoices: 0,
    purchases: 0,
    vendors: 0,
    items: 0,
    vouchers: 0,
  };

  const hasAnyResults = counts.all > 0;

  return (
    <div className="glass-card rounded-2xl border border-brand-500/25 p-5 shadow-xl bg-gradient-to-b from-tally-card/95 via-tally-card/85 to-tally-bg/90 backdrop-blur-md">
      {/* Header & Title */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-brand-500/20 border border-brand-500/30 flex items-center justify-center text-brand-400 shadow-sm shadow-brand-500/20">
            <Search className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-wide">
                Universal Business Finder & Ledger Search
              </h3>
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20">
                <Sparkles className="w-3 h-3 text-brand-400" />
                Live Index
              </span>
            </div>
            <p className="text-xs text-tally-textMuted">
              Search any sales invoice, vendor name, purchase bill, stock item, or voucher instantly
            </p>
          </div>
        </div>

        {/* Keyboard shortcut badge */}
        <div className="hidden sm:flex items-center gap-1.5 text-xs text-tally-textMuted font-mono">
          <span className="px-2 py-1 rounded-md bg-tally-bg border border-tally-border text-gray-300 font-semibold shadow-inner text-[11px]">
            Ctrl + K
          </span>
          <span>or</span>
          <span className="px-1.5 py-1 rounded-md bg-tally-bg border border-tally-border text-gray-300 font-semibold shadow-inner text-[11px]">
            /
          </span>
          <span>to search</span>
        </div>
      </div>

      {/* Main Search Input Bar */}
      <div className="relative">
        <div
          className={`relative flex items-center rounded-xl bg-tally-bg/90 border transition-all duration-200 ${
            isFocused
              ? 'border-brand-500 ring-2 ring-brand-500/20 shadow-lg shadow-brand-500/10'
              : 'border-tally-border hover:border-tally-border/80'
          }`}
        >
          <div className="pl-4 text-tally-textMuted">
            {loading ? (
              <Loader2 className="w-5 h-5 text-brand-400 animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-gray-400" />
            )}
          </div>

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Search by Invoice No. (e.g. 26-27/001), Vendor / Customer name, Purchase bill, SKU, or Phone..."
            className="w-full py-3.5 pl-3 pr-10 bg-transparent text-white placeholder-tally-textMuted text-sm font-medium focus:outline-none"
          />

          {query && (
            <button
              onClick={clearSearch}
              className="absolute right-3 p-1 rounded-lg hover:bg-tally-card text-tally-textMuted hover:text-white transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Category Tabs (Active when query exists or counts available) */}
      <div className="flex items-center gap-1.5 mt-3.5 overflow-x-auto pb-1 scrollbar-none">
        {[
          { id: 'all', label: 'All Records', icon: Sparkles, count: counts.all, color: 'brand' },
          { id: 'invoices', label: 'Sales Invoices', icon: Receipt, count: counts.invoices, color: 'emerald' },
          { id: 'purchases', label: 'Purchases', icon: ShoppingCart, count: counts.purchases, color: 'blue' },
          { id: 'vendors', label: 'Vendors', icon: Building, count: counts.vendors, color: 'purple' },
          { id: 'items', label: 'Inventory Items', icon: Boxes, count: counts.items, color: 'amber' },
          { id: 'vouchers', label: 'Vouchers & Bank', icon: CreditCard, count: counts.vouchers, color: 'indigo' },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                  : 'bg-tally-bg/60 hover:bg-tally-card border border-tally-border/60 text-tally-textMuted hover:text-gray-200'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
              {query && (
                <span
                  className={`ml-1 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold ${
                    isActive ? 'bg-brand-500/30 text-white' : 'bg-tally-border/40 text-gray-400'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Default State: Quick Suggestions & Guide when no query is typed */}
      {!query && (
        <div className="mt-4 pt-4 border-t border-tally-border/60 flex flex-wrap items-center justify-between gap-3 text-xs text-tally-textMuted">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-semibold text-gray-400">Quick Searches:</span>
            {['26-27/', 'PUR/', 'Walk-in', 'Cash', 'Credit'].map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                className="px-2.5 py-1 rounded-md bg-tally-bg border border-tally-border/70 hover:border-brand-500/40 hover:text-brand-300 transition-colors font-mono text-[11px]"
              >
                {suggestion}
              </button>
            ))}
          </div>
          <div className="text-[11px] text-gray-400">
            Searches across all historical & current financial entries
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Results View */}
      {query && !loading && (
        <div className="mt-5 space-y-4 pt-4 border-t border-tally-border/70 max-h-[520px] overflow-y-auto pr-1">
          {!hasAnyResults ? (
            <div className="py-8 text-center bg-tally-bg/40 rounded-xl border border-dashed border-tally-border">
              <Search className="w-8 h-8 text-tally-textMuted mx-auto mb-2 opacity-50" />
              <p className="text-sm font-semibold text-gray-300">
                No matching records found for "{query}"
              </p>
              <p className="text-xs text-tally-textMuted mt-1">
                Try searching by exact Invoice number, Vendor name, Customer phone, or SKU code.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 1. SALES INVOICES (Sell Entries) */}
              {(activeTab === 'all' || activeTab === 'invoices') &&
                searchResults?.results.invoices &&
                searchResults.results.invoices.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-emerald-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                          Sales Invoices / Sell Entries ({searchResults.results.invoices.length})
                        </h4>
                      </div>
                      <Link
                        href="/billing"
                        className="text-[11px] text-brand-400 hover:underline flex items-center gap-1"
                      >
                        POS Billing <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.results.invoices.map((inv) => (
                        <div
                          key={inv.id}
                          className="p-3.5 rounded-xl bg-tally-bg/70 hover:bg-tally-card border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  {inv.invoiceNumber}
                                </span>
                                <span className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-tally-card border border-tally-border text-gray-300">
                                  {inv.paymentMode}
                                </span>
                              </div>
                              <div className="text-right font-mono font-bold text-sm text-white">
                                {formatCurrency(inv.totalAmount)}
                              </div>
                            </div>

                            <div className="mt-2">
                              <div className="text-xs font-bold text-white">
                                {inv.customerName || 'Walk-in Customer'}
                              </div>
                              {inv.customerPhone && (
                                <div className="text-[11px] text-tally-textMuted flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />
                                  <span>{inv.customerPhone}</span>
                                  {inv.customerGstin && <span>• GST: {inv.customerGstin}</span>}
                                </div>
                              )}
                            </div>

                            {/* Item preview */}
                            {inv.items && inv.items.length > 0 && (
                              <div className="mt-2 text-[11px] text-gray-400 flex flex-wrap gap-1">
                                <span className="text-tally-textMuted">Items:</span>
                                {inv.items.slice(0, 3).map((itemLine, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded bg-tally-card text-[10px] text-gray-300 border border-tally-border/60"
                                  >
                                    {itemLine.item?.name || 'Item'} (x{itemLine.quantity})
                                  </span>
                                ))}
                                {inv.items.length > 3 && (
                                  <span className="text-[10px] text-tally-textMuted">
                                    +{inv.items.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-tally-border/40 flex items-center justify-between text-[11px] text-tally-textMuted">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3" />
                              {new Date(inv.createdAt).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>

                            <div className="flex items-center gap-2">
                              {onSelectInvoice && (
                                <button
                                  onClick={() => onSelectInvoice(inv)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 font-semibold text-xs transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                  <span>View & Print</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 2. PURCHASES (Purchase Entries) */}
              {(activeTab === 'all' || activeTab === 'purchases') &&
                searchResults?.results.purchases &&
                searchResults.results.purchases.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <ShoppingCart className="w-4 h-4 text-blue-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-blue-400">
                          Purchase Entries ({searchResults.results.purchases.length})
                        </h4>
                      </div>
                      <Link
                        href="/purchases"
                        className="text-[11px] text-brand-400 hover:underline flex items-center gap-1"
                      >
                        All Purchases <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.results.purchases.map((pur) => (
                        <div
                          key={pur.id}
                          className="p-3.5 rounded-xl bg-tally-bg/70 hover:bg-tally-card border border-blue-500/20 hover:border-blue-500/40 transition-all flex flex-col justify-between group"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="font-mono font-bold text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                                  Bill: {pur.invoiceNumber}
                                </span>
                              </div>
                              <div className="text-right font-mono font-bold text-sm text-white">
                                {formatCurrency(pur.totalAmount)}
                              </div>
                            </div>

                            <div className="mt-2">
                              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                                <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                <span>{pur.vendor?.name || 'Registered Vendor'}</span>
                              </div>
                              {pur.vendor?.phone && (
                                <div className="text-[11px] text-tally-textMuted flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3" />
                                  <span>{pur.vendor.phone}</span>
                                  {pur.vendor.gstin && <span>• GST: {pur.vendor.gstin}</span>}
                                </div>
                              )}
                            </div>

                            {/* Items preview */}
                            {pur.items && pur.items.length > 0 && (
                              <div className="mt-2 text-[11px] text-gray-400 flex flex-wrap gap-1">
                                <span className="text-tally-textMuted">Purchased:</span>
                                {pur.items.slice(0, 3).map((itemLine, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 rounded bg-tally-card text-[10px] text-gray-300 border border-tally-border/60"
                                  >
                                    {itemLine.item?.name || 'Stock Item'} (x{itemLine.quantity})
                                  </span>
                                ))}
                                {pur.items.length > 3 && (
                                  <span className="text-[10px] text-tally-textMuted">
                                    +{pur.items.length - 3} more
                                  </span>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-tally-border/40 flex items-center justify-between text-[11px] text-tally-textMuted">
                            <span className="flex items-center gap-1 font-mono">
                              <Calendar className="w-3 h-3" />
                              {new Date(pur.purchaseDate || pur.createdAt || Date.now()).toLocaleDateString('en-IN', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </span>

                            <div className="flex items-center gap-2">
                              {onSelectPurchase && (
                                <button
                                  onClick={() => onSelectPurchase(pur)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-500/15 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 font-semibold text-xs transition-colors"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>View & Edit</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 3. VENDORS */}
              {(activeTab === 'all' || activeTab === 'vendors') &&
                searchResults?.results.vendors &&
                searchResults.results.vendors.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Building className="w-4 h-4 text-purple-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400">
                          Vendors / Suppliers ({searchResults.results.vendors.length})
                        </h4>
                      </div>
                      <Link
                        href="/vendors"
                        className="text-[11px] text-brand-400 hover:underline flex items-center gap-1"
                      >
                        All Vendors <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.results.vendors.map((ven) => (
                        <div
                          key={ven.id}
                          className="p-3.5 rounded-xl bg-tally-bg/70 hover:bg-tally-card border border-purple-500/20 hover:border-purple-500/40 transition-all flex items-center justify-between"
                        >
                          <div>
                            <div className="font-bold text-white text-xs flex items-center gap-1.5">
                              <span>{ven.name}</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/30">
                                {ven._count?.purchases || 0} Bills
                              </span>
                            </div>
                            <div className="text-[11px] text-tally-textMuted mt-1">
                              Phone: {ven.phone || 'N/A'} • GST: {ven.gstin || 'Unregistered'}
                            </div>
                            {ven.address && (
                              <div className="text-[10px] text-gray-400 mt-0.5 truncate max-w-[280px]">
                                {ven.address}
                              </div>
                            )}
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-mono font-bold text-xs text-white">
                              Balance: {formatCurrency(ven.balance)}
                            </div>
                            {onSelectVendor && (
                              <button
                                onClick={() => onSelectVendor(ven)}
                                className="mt-1.5 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 font-semibold text-xs transition-colors"
                              >
                                <span>View Ledger</span>
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {/* 4. INVENTORY ITEMS */}
              {(activeTab === 'all' || activeTab === 'items') &&
                searchResults?.results.items &&
                searchResults.results.items.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Boxes className="w-4 h-4 text-amber-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400">
                          Inventory Items / Products ({searchResults.results.items.length})
                        </h4>
                      </div>
                      <Link
                        href="/inventory"
                        className="text-[11px] text-brand-400 hover:underline flex items-center gap-1"
                      >
                        Inventory Manager <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.results.items.map((item) => {
                        const currentQty = item.stock ? Number(item.stock.currentQuantity) : 0;
                        const isLow = currentQty <= item.minStockLevel;
                        return (
                          <div
                            key={item.id}
                            className="p-3.5 rounded-xl bg-tally-bg/70 hover:bg-tally-card border border-amber-500/20 hover:border-amber-500/40 transition-all flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-white text-xs">{item.name}</div>
                              <div className="text-[11px] font-mono text-tally-textMuted mt-0.5">
                                SKU: {item.sku} • Category: {item.category || 'General'}
                              </div>
                              <div className="text-[11px] text-gray-300 mt-1">
                                Sell Price: <span className="font-bold text-white">{formatCurrency(item.sellingPrice)}</span> • Buy: {formatCurrency(item.purchasePrice)}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div
                                className={`text-xs font-mono font-bold px-2 py-1 rounded-lg border ${
                                  isLow
                                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-400'
                                    : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                                }`}
                              >
                                {currentQty} {item.unit}
                              </div>
                              <span className="text-[10px] text-tally-textMuted block mt-1">
                                {isLow ? 'Low Stock' : 'In Stock'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

              {/* 5. VOUCHERS */}
              {(activeTab === 'all' || activeTab === 'vouchers') &&
                searchResults?.results.vouchers &&
                searchResults.results.vouchers.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                          Vouchers & Banking Entries ({searchResults.results.vouchers.length})
                        </h4>
                      </div>
                      <Link
                        href="/banking"
                        className="text-[11px] text-brand-400 hover:underline flex items-center gap-1"
                      >
                        Banking Hub <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {searchResults.results.vouchers.map((vouch) => (
                        <div
                          key={vouch.id}
                          className="p-3.5 rounded-xl bg-tally-bg/70 hover:bg-tally-card border border-indigo-500/20 hover:border-indigo-500/40 transition-all flex items-center justify-between"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-xs text-indigo-400">
                                {vouch.voucherNumber}
                              </span>
                              <span className="text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                                {vouch.voucherType}
                              </span>
                            </div>
                            <div className="text-[11px] text-gray-300 mt-1">
                              {vouch.narration || 'No narration provided'}
                            </div>
                            <div className="text-[10px] text-tally-textMuted mt-0.5 font-mono">
                              Date: {new Date(vouch.date).toLocaleDateString('en-IN')}
                              {vouch.referenceNumber && ` • Ref: ${vouch.referenceNumber}`}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="font-mono font-bold text-sm text-white">
                              {formatCurrency(vouch.amount)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
