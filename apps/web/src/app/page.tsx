'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import DashboardSearch from '@/components/DashboardSearch';
import ThermalInvoiceModal from '@/components/ThermalInvoiceModal';
import EditPurchaseModal from '@/components/EditPurchaseModal';
import VendorPurchaseHistoryModal from '@/components/VendorPurchaseHistoryModal';
import { api, DashboardMetrics, Invoice, Purchase, Vendor, Item, formatCurrency } from '@/lib/api';
import {
  TrendingUp,
  ShoppingCart,
  Boxes,
  AlertTriangle,
  Zap,
  Users,
  ArrowUpRight,
  Receipt,
  Calendar,
  Clock,
  FileText,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const [data, setData] = useState<DashboardMetrics | null>(null);
  const [overdueInvoices, setOverdueInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals & Details State
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [selectedPurchase, setSelectedPurchase] = useState<Purchase | null>(null);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);

  const [auxVendors, setAuxVendors] = useState<Vendor[]>([]);
  const [auxItems, setAuxItems] = useState<Item[]>([]);
  const [auxPurchases, setAuxPurchases] = useState<Purchase[]>([]);

  const loadAuxDataIfNeeded = async () => {
    if (auxVendors.length === 0 || auxItems.length === 0 || auxPurchases.length === 0) {
      try {
        const [v, i, p] = await Promise.all([
          api.getVendors(),
          api.getItems(),
          api.getPurchases(),
        ]);
        setAuxVendors(v);
        setAuxItems(i);
        setAuxPurchases(p);
      } catch (err) {
        console.error('Failed to load auxiliary data for modals:', err);
      }
    }
  };

  const handleSelectInvoice = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
  };

  const handleSelectPurchase = async (purchase: Purchase) => {
    await loadAuxDataIfNeeded();
    setSelectedPurchase(purchase);
  };

  const handleSelectVendor = async (vendor: Vendor) => {
    await loadAuxDataIfNeeded();
    setSelectedVendor(vendor);
  };

  const handlePurchaseUpdated = () => {
    setSelectedPurchase(null);
    fetchMetrics();
    api.getPurchases().then(setAuxPurchases).catch(console.error);
  };

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      setError(null);
      const [metrics, overdue] = await Promise.all([
        api.getDashboardMetrics(),
        api.getOverdueInvoices(),
      ]);
      setData(metrics);
      setOverdueInvoices(overdue);
    } catch (err: any) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Accounting & Inventory Dashboard (V2)"
        subtitle="Real-time business performance metrics, GST summaries, & overdue credit tracking"
        onRefresh={fetchMetrics}
      />

      <div className="px-8 mt-6 space-y-8">
        {/* UNIVERSAL SEARCH HERO COMPONENT */}
        <DashboardSearch
          onSelectInvoice={handleSelectInvoice}
          onSelectPurchase={handleSelectPurchase}
          onSelectVendor={handleSelectVendor}
        />

        {/* Error Notification */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-center justify-between text-red-400">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
            <button
              onClick={fetchMetrics}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs font-bold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* OVERDUE CREDIT BILLS ALERT WIDGET */}
        {overdueInvoices.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-red-400">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                <h3 className="font-bold text-base text-white">
                  Overdue Credit Customer Invoices ({overdueInvoices.length})
                </h3>
              </div>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-500/20 font-bold font-mono">
                Payment Overdue Alert
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {overdueInvoices.map((inv) => (
                <div
                  key={inv.id}
                  className="p-3.5 rounded-xl bg-tally-bg/80 border border-red-500/20 flex items-center justify-between"
                >
                  <div>
                    <div className="font-bold text-white text-xs">{inv.customerName}</div>
                    <div className="text-[11px] font-mono text-tally-textMuted mt-0.5">
                      Ref: {inv.invoiceNumber} • Phone: {inv.customerPhone || 'N/A'}
                    </div>
                    <div className="text-[10px] text-red-400 font-semibold mt-1">
                      Due Date: {new Date(inv.dueDate!).toLocaleDateString()} ({inv.overdueDays} days overdue)
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-bold text-sm text-red-400">
                      {formatCurrency(inv.outstandingBalance)}
                    </div>
                    <span className="text-[10px] font-bold text-gray-400">Balance Due</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STAT CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Today Sales */}
          <div className="glass-card rounded-2xl p-5 hover:border-brand-500/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase tracking-wider">
                Sales Today
              </span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : formatCurrency(data?.metrics.totalSalesToday)}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-xs text-tally-textMuted">
                <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-bold">
                  {data?.metrics.salesTodayCount || 0} Bills
                </span>
                <span>Generated today</span>
              </div>
            </div>
          </div>

          {/* Card 2: Today Purchases */}
          <div className="glass-card rounded-2xl p-5 hover:border-blue-500/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase tracking-wider">
                Purchases Today
              </span>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : formatCurrency(data?.metrics.totalPurchasesToday)}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-xs text-tally-textMuted">
                <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-bold">
                  {data?.metrics.purchasesTodayCount || 0} Entries
                </span>
                <span>Restocked items</span>
              </div>
            </div>
          </div>

          {/* Card 3: Inventory Value */}
          <div className="glass-card rounded-2xl p-5 hover:border-purple-500/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase tracking-wider">
                Total Stock Value
              </span>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Boxes className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : formatCurrency(data?.metrics.totalInventoryValue)}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-xs text-tally-textMuted">
                <span>Total valuation at purchase cost</span>
              </div>
            </div>
          </div>

          {/* Card 4: Low Stock Alert */}
          <div className="glass-card rounded-2xl p-5 hover:border-amber-500/40 transition-all group">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase tracking-wider">
                Low Stock Warning
              </span>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {loading ? '...' : data?.metrics.lowStockCount} Items
              </h2>
              <div className="flex items-center gap-2 mt-2 text-xs text-amber-400 font-medium">
                <span>Requires immediate reorder</span>
              </div>
            </div>
          </div>
        </div>

        {/* QUICK ACTIONS BAR */}
        <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-brand-500/20 bg-gradient-to-r from-tally-card to-tally-bg">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Zap className="w-4 h-4 fill-brand-400" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Quick Entry Actions</h4>
              <p className="text-xs text-tally-textMuted">Accelerate workflow with single-click shortcuts</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            <Link
              href="/billing"
              className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-tally-bg font-bold text-xs py-2 px-4 rounded-xl transition-all shadow-md shadow-brand-500/20"
            >
              <Zap className="w-4 h-4 fill-tally-bg" />
              <span>Fast POS Checkout</span>
            </Link>

            <Link
              href="/reports/gst"
              className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-tally-border text-gray-200 font-medium text-xs py-2 px-4 rounded-xl transition-colors"
            >
              <FileText className="w-4 h-4 text-brand-400" />
              <span>GST Tax Reports</span>
            </Link>

            <Link
              href="/purchases"
              className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-tally-border text-gray-200 font-medium text-xs py-2 px-4 rounded-xl transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-blue-400" />
              <span>New Purchase Entry</span>
            </Link>

            <Link
              href="/journal"
              className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-tally-border text-gray-200 font-medium text-xs py-2 px-4 rounded-xl transition-colors"
            >
              <Calendar className="w-4 h-4 text-purple-400" />
              <span>Journal Voucher</span>
            </Link>
          </div>
        </div>

        {/* TWO COLUMN CONTENT: LOW STOCK & RECENT TRANSACTIONS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Low Stock Items List (2 cols) */}
          <div className="lg:col-span-2 glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <h3 className="font-bold text-base text-white">Low Stock Alert List</h3>
              </div>
              <Link
                href="/inventory"
                className="text-xs font-semibold text-brand-400 hover:underline flex items-center gap-1"
              >
                View Full Inventory <ArrowUpRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-tally-textMuted">Loading stock data...</div>
            ) : !data?.lowStockItems || data.lowStockItems.length === 0 ? (
              <div className="py-8 text-center text-sm text-emerald-400 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                🎉 Excellent! All stock levels are above minimum thresholds.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-tally-border text-tally-textMuted uppercase">
                      <th className="pb-3 font-semibold">SKU & Item Name</th>
                      <th className="pb-3 font-semibold text-center">Category</th>
                      <th className="pb-3 font-semibold text-center">Stock / Min</th>
                      <th className="pb-3 font-semibold text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tally-border/50">
                    {data.lowStockItems.map((item) => (
                      <tr key={item.id} className="hover:bg-tally-cardHover/50 transition-colors">
                        <td className="py-3">
                          <div className="font-bold text-white">{item.name}</div>
                          <div className="text-[11px] font-mono text-tally-textMuted">{item.sku}</div>
                        </td>
                        <td className="py-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-tally-bg text-gray-300 border border-tally-border">
                            {item.category || 'General'}
                          </span>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-white">
                          <span className="text-amber-400">{item.currentQuantity}</span> / {item.minStockLevel} {item.unit}
                        </td>
                        <td className="py-3 text-right">
                          <Link
                            href="/purchases"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-semibold hover:bg-amber-500/25 transition-colors"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Reorder</span>
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Recent Sales Invoices (1 col) */}
          <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-base text-white">Recent Bills</h3>
                </div>
                <Link href="/billing" className="text-xs text-brand-400 hover:underline">
                  New Bill
                </Link>
              </div>

              {loading ? (
                <div className="py-8 text-center text-sm text-tally-textMuted">Loading transactions...</div>
              ) : !data?.recentInvoices || data.recentInvoices.length === 0 ? (
                <div className="py-8 text-center text-sm text-tally-textMuted">No invoices created yet.</div>
              ) : (
                <div className="space-y-3">
                  {data.recentInvoices.map((inv) => (
                    <div
                      key={inv.id}
                      onClick={() => handleSelectInvoice(inv)}
                      className="p-3 rounded-xl bg-tally-bg/60 border border-tally-border flex items-center justify-between hover:border-brand-500/40 hover:bg-tally-card cursor-pointer transition-all group"
                      title="Click to view & print invoice"
                    >
                      <div>
                        <div className="font-mono text-xs font-bold text-brand-400 group-hover:underline">{inv.invoiceNumber}</div>
                        <div className="text-xs text-gray-300 font-medium mt-0.5">
                          {inv.customerName || 'Walk-in Customer'}
                        </div>
                        <div className="text-[10px] text-tally-textMuted mt-0.5">
                          {new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-bold text-sm text-white">{formatCurrency(inv.totalAmount)}</div>
                        <span className="inline-block mt-0.5 text-[10px] font-semibold px-2 py-0.5 rounded bg-brand-500/10 text-brand-400 uppercase">
                          {inv.paymentMode}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modals from Search or Dashboard Clicks */}
      {selectedInvoice && (
        <ThermalInvoiceModal
          invoice={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
        />
      )}

      {selectedPurchase && (
        <EditPurchaseModal
          isOpen={!!selectedPurchase}
          onClose={() => setSelectedPurchase(null)}
          purchase={selectedPurchase}
          vendors={auxVendors}
          availableItems={auxItems}
          onPurchaseUpdated={handlePurchaseUpdated}
        />
      )}

      {selectedVendor && (
        <VendorPurchaseHistoryModal
          isOpen={!!selectedVendor}
          onClose={() => setSelectedVendor(null)}
          vendor={selectedVendor}
          allPurchases={auxPurchases}
          availableItems={auxItems}
          vendors={auxVendors}
          onRefresh={() => {
            fetchMetrics();
            api.getPurchases().then(setAuxPurchases).catch(console.error);
            api.getVendors().then(setAuxVendors).catch(console.error);
          }}
        />
      )}
    </div>
  );
}
