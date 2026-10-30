'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api, RecycleBinItem } from '@/lib/api';
import {
  Trash2,
  RotateCcw,
  Search,
  Receipt,
  ShoppingCart,
  Users,
  Boxes,
  Landmark,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  X,
  ShieldCheck,
} from 'lucide-react';

const TABS = [
  { id: 'ALL', label: 'All Items', icon: Filter },
  { id: 'INVOICE', label: 'Invoices', icon: Receipt },
  { id: 'PURCHASE', label: 'Purchases', icon: ShoppingCart },
  { id: 'VENDOR', label: 'Vendors', icon: Users },
  { id: 'ITEM', label: 'Items', icon: Boxes },
  { id: 'VOUCHER', label: 'Vouchers', icon: Landmark },
];

export default function RecycleBinPage() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Action states
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeletingItem, setPermanentDeletingItem] = useState<RecycleBinItem | null>(null);
  const [isEmptyingBin, setIsEmptyingBin] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const data = await api.getRecycleBin(selectedTab);
      setItems(data);
    } catch (err: any) {
      console.error('Failed to load recycle bin:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, [selectedTab]);

  const handleRestore = async (item: RecycleBinItem) => {
    try {
      setRestoringId(item.id);
      setNotification(null);
      const res = await api.restoreFromRecycleBin(item.id);
      setNotification({ type: 'success', text: res.message || `"${item.displayName}" restored successfully!` });
      await fetchItems();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to restore item' });
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeletingItem) return;
    try {
      setIsProcessing(true);
      await api.deletePermanentlyFromRecycleBin(permanentDeletingItem.id);
      setPermanentDeletingItem(null);
      setNotification({ type: 'success', text: 'Item permanently deleted.' });
      await fetchItems();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to delete permanently' });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEmptyBin = async () => {
    try {
      setIsProcessing(true);
      const res = await api.emptyRecycleBin(selectedTab);
      setIsEmptyingBin(false);
      setNotification({ type: 'success', text: res.message || 'Recycle Bin emptied successfully!' });
      await fetchItems();
    } catch (err: any) {
      setNotification({ type: 'error', text: err.message || 'Failed to empty recycle bin' });
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = items.filter((i) => {
    const q = searchQuery.toLowerCase();
    return (
      i.displayName.toLowerCase().includes(q) ||
      (i.details && i.details.toLowerCase().includes(q)) ||
      i.entityType.toLowerCase().includes(q)
    );
  });

  const getEntityBadge = (type: string) => {
    switch (type) {
      case 'INVOICE':
        return {
          icon: Receipt,
          label: 'Sales Invoice',
          cls: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        };
      case 'PURCHASE':
        return {
          icon: ShoppingCart,
          label: 'Purchase Bill',
          cls: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        };
      case 'VENDOR':
        return {
          icon: Users,
          label: 'Vendor Supplier',
          cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'ITEM':
        return {
          icon: Boxes,
          label: 'Inventory Item',
          cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'VOUCHER':
        return {
          icon: Landmark,
          label: 'Banking Voucher',
          cls: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        };
      default:
        return {
          icon: Filter,
          label: type,
          cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
        };
    }
  };

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Recycle Bin & Data Recovery (कचरा पेटी)"
        subtitle="Accidentally deleted an Invoice, Vendor, or Voucher? Recover it instantly with 1-click restore"
        onRefresh={fetchItems}
        actionButton={
          items.length > 0 ? (
            <button
              onClick={() => setIsEmptyingBin(true)}
              className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-sm"
            >
              <Trash2 className="w-4 h-4" />
              <span>Empty Recycle Bin</span>
            </button>
          ) : undefined
        }
      />

      <div className="px-8 mt-6 space-y-6">
        {/* SAFEGUARD NOTIFICATION */}
        {notification && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between text-xs font-medium animate-fadeIn ${
              notification.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : 'bg-red-500/10 border-red-500/30 text-red-400'
            }`}
          >
            <div className="flex items-center gap-2">
              {notification.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0" />
              )}
              <span>{notification.text}</span>
            </div>
            <button onClick={() => setNotification(null)} className="p-1 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* SECURITY & RECOVERY BANNER */}
        <div className="glass-card rounded-2xl p-4 border border-brand-500/20 bg-gradient-to-r from-brand-900/10 to-transparent flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white uppercase tracking-wider">Zero Data Loss Protection</h4>
              <p className="text-xs text-tally-textMuted mt-0.5">
                Every deleted record stays safely in the Recycle Bin until you decide to permanently delete it. Restoring recreates all line items, tax details, and stock levels accurately.
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">Total In Bin</span>
            <span className="text-lg font-bold font-mono text-brand-400">{items.length} items</span>
          </div>
        </div>

        {/* TABS & SEARCH BAR */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = selectedTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setSelectedTab(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                    isActive
                      ? 'bg-brand-500/20 text-brand-400 border border-brand-500/40 shadow-sm'
                      : 'text-gray-400 hover:text-white bg-tally-card hover:bg-tally-cardHover border border-tally-border'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search deleted records..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-tally-card border border-tally-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* ITEMS LIST */}
        {loading ? (
          <div className="py-16 text-center text-sm text-tally-textMuted">Loading recycle bin contents...</div>
        ) : filteredItems.length === 0 ? (
          <div className="glass-card rounded-2xl p-16 text-center text-tally-textMuted space-y-3">
            <Trash2 className="w-12 h-12 mx-auto text-tally-border stroke-1" />
            <p className="text-sm font-medium text-white">Recycle Bin is Empty</p>
            <p className="text-xs text-tally-textMuted max-w-sm mx-auto">
              {searchQuery
                ? 'No deleted items matched your search query.'
                : 'No deleted items found. When you delete invoices, vendors, or items, they will appear here safely.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((item) => {
              const badge = getEntityBadge(item.entityType);
              const BadgeIcon = badge.icon;
              const isRestoring = restoringId === item.id;

              return (
                <div
                  key={item.id}
                  className="glass-card rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:border-brand-500/30 transition-all group"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-tally-bg border border-tally-border flex items-center justify-center text-gray-400 group-hover:text-brand-400 transition-colors shrink-0 mt-0.5">
                      <BadgeIcon className="w-5 h-5" />
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border font-mono ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <h4 className="text-sm font-bold text-white">{item.displayName}</h4>
                      </div>

                      {item.details && (
                        <p className="text-xs text-tally-textMuted mt-1 font-mono">{item.details}</p>
                      )}

                      <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mt-1.5">
                        <Clock className="w-3 h-3 text-gray-500" />
                        <span>Deleted on {formatDate(item.deletedAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* ACTION BUTTONS: RESTORE & DELETE FOREVER */}
                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    <button
                      onClick={() => handleRestore(item)}
                      disabled={isRestoring}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50"
                      title="Restore back to active records"
                    >
                      <RotateCcw className={`w-3.5 h-3.5 ${isRestoring ? 'animate-spin' : ''}`} />
                      <span>{isRestoring ? 'Restoring...' : 'Restore (वापस लाएं)'}</span>
                    </button>

                    <button
                      onClick={() => setPermanentDeletingItem(item)}
                      className="p-1.5 rounded-xl bg-tally-bg text-gray-400 hover:text-red-400 hover:bg-red-500/10 border border-tally-border hover:border-red-500/30 transition-colors"
                      title="Permanently Delete Forever"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL 1: PERMANENT DELETE CONFIRMATION */}
      {permanentDeletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-lg text-white">Permanently Delete?</h3>
              <p className="text-xs text-tally-textMuted">
                Are you sure you want to permanently erase <br />
                <span className="text-white font-bold font-mono">"{permanentDeletingItem.displayName}"</span>?
              </p>
              <p className="text-[11px] text-red-400/80 mt-2">
                ⚠️ This action cannot be undone. The record will be permanently destroyed.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-tally-border">
              <button
                type="button"
                onClick={() => setPermanentDeletingItem(null)}
                className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePermanentDelete}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20"
              >
                {isProcessing ? 'Erasing...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: EMPTY RECYCLE BIN CONFIRMATION */}
      {isEmptyingBin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-lg text-white">Empty Recycle Bin?</h3>
              <p className="text-xs text-tally-textMuted">
                This will permanently delete all {items.length} items in{' '}
                <span className="text-white font-bold">
                  {selectedTab === 'ALL' ? 'all categories' : `${selectedTab} category`}
                </span>
                .
              </p>
              <p className="text-[11px] text-red-400/80 mt-2">
                ⚠️ Once emptied, these records cannot be recovered.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-tally-border">
              <button
                type="button"
                onClick={() => setIsEmptyingBin(false)}
                className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEmptyBin}
                disabled={isProcessing}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow-md shadow-red-500/20"
              >
                {isProcessing ? 'Emptying...' : 'Empty Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
