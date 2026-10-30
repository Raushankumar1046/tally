'use client';

import React, { useState, useMemo } from 'react';
import { Vendor, Purchase, Item, api, formatCurrency } from '@/lib/api';
import EditPurchaseModal from '@/components/EditPurchaseModal';
import {
  X,
  Building,
  Phone,
  MapPin,
  FileText,
  Package,
  Search,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Pencil,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface VendorPurchaseHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  vendor: Vendor | null;
  allPurchases: Purchase[];
  availableItems?: Item[];
  vendors?: Vendor[];
  onRefresh?: () => Promise<void> | void;
}

export default function VendorPurchaseHistoryModal({
  isOpen,
  onClose,
  vendor,
  allPurchases,
  availableItems = [],
  vendors = [],
  onRefresh,
}: VendorPurchaseHistoryModalProps) {
  const [activeTab, setActiveTab] = useState<'items' | 'invoices'>('items');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedInvoices, setExpandedInvoices] = useState<Record<string, boolean>>({});

  // Editing state
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);

  // Deleting state
  const [deleteConfirmPurchase, setDeleteConfirmPurchase] = useState<Purchase | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter purchases for this specific vendor
  const vendorPurchases = useMemo(() => {
    if (!vendor) return [];
    return allPurchases.filter((p) => p.vendorId === vendor.id);
  }, [allPurchases, vendor]);

  // Aggregate Stats
  const stats = useMemo(() => {
    const totalAmount = vendorPurchases.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
    const invoiceCount = vendorPurchases.length;
    let totalItemsQty = 0;
    const uniqueItemIds = new Set<string>();

    vendorPurchases.forEach((p) => {
      (p.items || []).forEach((line) => {
        totalItemsQty += line.quantity || 0;
        if (line.itemId) uniqueItemIds.add(line.itemId);
      });
    });

    return {
      totalAmount,
      invoiceCount,
      totalItemsQty,
      uniqueItemsCount: uniqueItemIds.size,
    };
  }, [vendorPurchases]);

  // Flatten all items across all invoices from this vendor
  const flattenedItems = useMemo(() => {
    const list: Array<{
      purchaseId: string;
      invoiceNumber: string;
      purchaseDate: string;
      itemId: string;
      itemName: string;
      itemSku: string;
      category: string;
      unit: string;
      quantity: number;
      unitPurchasePrice: number;
      taxRate: number;
      taxableAmount: number;
      taxAmount: number;
      totalPrice: number;
    }> = [];

    vendorPurchases.forEach((p) => {
      (p.items || []).forEach((line) => {
        const itemInfo = line.item;
        const taxable = line.taxableAmount || (line.unitPurchasePrice * line.quantity);
        const taxRate = line.taxRate || itemInfo?.taxRate || 0;
        const tax = line.taxAmount || (taxable * taxRate / 100);
        const total = line.totalPrice || (taxable + tax);

        list.push({
          purchaseId: p.id,
          invoiceNumber: p.invoiceNumber,
          purchaseDate: p.purchaseDate,
          itemId: line.itemId,
          itemName: itemInfo?.name || 'Unknown Item',
          itemSku: itemInfo?.sku || '-',
          category: itemInfo?.category || 'General',
          unit: itemInfo?.unit || 'Pcs',
          quantity: line.quantity,
          unitPurchasePrice: line.unitPurchasePrice,
          taxRate,
          taxableAmount: taxable,
          taxAmount: tax,
          totalPrice: total,
        });
      });
    });

    // Sort by purchase date descending (newest first)
    list.sort((a, b) => new Date(b.purchaseDate).getTime() - new Date(a.purchaseDate).getTime());
    return list;
  }, [vendorPurchases]);

  // Filtered items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return flattenedItems;
    const q = searchQuery.toLowerCase().trim();
    return flattenedItems.filter(
      (it) =>
        it.itemName.toLowerCase().includes(q) ||
        it.itemSku.toLowerCase().includes(q) ||
        it.category.toLowerCase().includes(q) ||
        it.invoiceNumber.toLowerCase().includes(q)
    );
  }, [flattenedItems, searchQuery]);

  const toggleInvoiceExpand = (id: string) => {
    setExpandedInvoices((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStartEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
  };

  const handlePurchaseUpdated = async (_updated: Purchase) => {
    setEditingPurchase(null);
    setNotification({
      type: 'success',
      message: 'Purchase entry updated & inventory stock synchronized successfully!',
    });
    setTimeout(() => setNotification(null), 4000);
    if (onRefresh) await onRefresh();
  };

  const handleDeletePurchase = async () => {
    if (!deleteConfirmPurchase) return;

    try {
      setDeleting(true);
      await api.deletePurchase(deleteConfirmPurchase.id);
      setDeleteConfirmPurchase(null);
      setNotification({
        type: 'success',
        message: `Purchase bill ${deleteConfirmPurchase.invoiceNumber} deleted and inventory stock reverted.`,
      });
      setTimeout(() => setNotification(null), 4000);
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      console.error('Failed to delete purchase:', err);
      setNotification({
        type: 'error',
        message: err.message || 'Failed to delete purchase entry',
      });
      setTimeout(() => setNotification(null), 5000);
    } finally {
      setDeleting(false);
    }
  };

  if (!isOpen || !vendor) return null;

  const pendingBalance = vendor.balance || 0;
  const isBalancePending = pendingBalance > 0;

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex justify-center items-center animate-in fade-in duration-200">
        <div className="bg-tally-card border border-tally-border rounded-2xl max-w-5xl w-full p-6 shadow-2xl relative space-y-6 my-8 max-h-[90vh] flex flex-col">
          {/* HEADER */}
          <div className="flex items-start justify-between border-b border-tally-border pb-4">
            <div className="flex items-start gap-3">
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl border border-blue-500/20 mt-1">
                <Building className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white tracking-wide">{vendor.name}</h2>
                  {vendor.gstin && (
                    <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                      GSTIN: {vendor.gstin}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-tally-textMuted mt-1.5">
                  {vendor.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-gray-400" />
                      {vendor.phone}
                    </span>
                  )}
                  {vendor.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400" />
                      {vendor.address}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
              title="Close modal"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* NOTIFICATION TOAST */}
          {notification && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
                notification.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              }`}
            >
              <div className="flex items-center gap-2">
                {notification.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span className="font-medium">{notification.message}</span>
              </div>
              <button
                onClick={() => setNotification(null)}
                className="text-gray-400 hover:text-white ml-3"
              >
                ✕
              </button>
            </div>
          )}

          {/* 4 SUMMARY STAT CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Card 1: Total Purchases */}
            <div className="p-4 rounded-xl bg-tally-bg/60 border border-tally-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-tally-textMuted mb-2">
                <span>Total Purchases</span>
                <Receipt className="w-4 h-4 text-blue-400" />
              </div>
              <div>
                <div className="text-lg md:text-xl font-bold font-mono text-white">
                  {formatCurrency(stats.totalAmount)}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">Lifetime bills value</p>
              </div>
            </div>

            {/* Card 2: Pending / Outstanding Balance */}
            <div
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                isBalancePending
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-emerald-500/10 border-emerald-500/30'
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-2">
                <span className={isBalancePending ? 'text-rose-300' : 'text-emerald-300 font-medium'}>
                  {isBalancePending ? 'Pending Balance' : 'Payment Status'}
                </span>
                {isBalancePending ? (
                  <AlertCircle className="w-4 h-4 text-rose-400" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div>
                <div
                  className={`text-lg md:text-xl font-bold font-mono ${
                    isBalancePending ? 'text-rose-400' : 'text-emerald-400'
                  }`}
                >
                  {formatCurrency(pendingBalance)}
                </div>
                <p className={`text-[11px] mt-0.5 ${isBalancePending ? 'text-rose-300/80' : 'text-emerald-300/80'}`}>
                  {isBalancePending ? 'Amount to be paid' : 'Fully Settled / No Due'}
                </p>
              </div>
            </div>

            {/* Card 3: Total Invoices */}
            <div className="p-4 rounded-xl bg-tally-bg/60 border border-tally-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-tally-textMuted mb-2">
                <span>Total Invoices</span>
                <FileText className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <div className="text-lg md:text-xl font-bold font-mono text-white">
                  {stats.invoiceCount}
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">Purchase bills entered</p>
              </div>
            </div>

            {/* Card 4: Items Sourced */}
            <div className="p-4 rounded-xl bg-tally-bg/60 border border-tally-border flex flex-col justify-between">
              <div className="flex items-center justify-between text-xs text-tally-textMuted mb-2">
                <span>Items Sourced</span>
                <Package className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <div className="text-lg md:text-xl font-bold font-mono text-white">
                  {stats.uniqueItemsCount}{' '}
                  <span className="text-xs font-normal text-gray-400">
                    ({stats.totalItemsQty} total qty)
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5">Unique products bought</p>
              </div>
            </div>
          </div>

          {/* TABS & SEARCH BAR */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-tally-border pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('items')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'items'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-tally-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <Package className="w-4 h-4" />
                Purchased Items & Rates ({flattenedItems.length})
              </button>
              <button
                onClick={() => setActiveTab('invoices')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                  activeTab === 'invoices'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-tally-textMuted hover:text-white hover:bg-white/5'
                }`}
              >
                <Receipt className="w-4 h-4" />
                Invoices & Bills ({vendorPurchases.length})
              </button>
            </div>

            {activeTab === 'items' && (
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search item name, SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            )}
          </div>

          {/* TAB CONTENTS (Scrollable Area) */}
          <div className="flex-1 overflow-y-auto pr-1">
            {activeTab === 'items' ? (
              /* TAB 1: ALL PURCHASED ITEMS & RATES */
              filteredItems.length === 0 ? (
                <div className="py-16 text-center text-tally-textMuted space-y-2">
                  <Package className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm">
                    {searchQuery
                      ? `No items found matching "${searchQuery}"`
                      : 'No items have been purchased from this vendor yet.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-tally-border bg-tally-bg/50">
                  <table className="w-full text-left text-xs text-gray-300">
                    <thead className="bg-tally-bg border-b border-tally-border text-gray-400 font-semibold sticky top-0 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="py-3 px-4">Item Name / SKU</th>
                        <th className="py-3 px-3">Category</th>
                        <th className="py-3 px-3">Invoice #</th>
                        <th className="py-3 px-3">Date</th>
                        <th className="py-3 px-3 text-right">Qty</th>
                        <th className="py-3 px-4 text-right">
                          <span className="text-emerald-400 font-bold">Purchase Rate</span>
                        </th>
                        <th className="py-3 px-3 text-right">GST %</th>
                        <th className="py-3 px-4 text-right">Total (₹)</th>
                        <th className="py-3 px-3 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tally-border/50">
                      {filteredItems.map((item, idx) => {
                        const parentPurchase = vendorPurchases.find((p) => p.id === item.purchaseId);
                        return (
                          <tr key={`${item.purchaseId}-${item.itemId}-${idx}`} className="hover:bg-white/[0.03] transition-colors">
                            <td className="py-3 px-4">
                              <div className="font-semibold text-white">{item.itemName}</div>
                              <div className="font-mono text-[10px] text-gray-400">{item.itemSku}</div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-white/5 text-gray-300 text-[10px]">
                                {item.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-blue-400 font-semibold">
                              {item.invoiceNumber}
                            </td>
                            <td className="py-3 px-3 text-gray-400 whitespace-nowrap">
                              {new Date(item.purchaseDate).toLocaleDateString()}
                            </td>
                            <td className="py-3 px-3 text-right font-mono font-medium text-white">
                              {item.quantity} {item.unit}
                            </td>
                            {/* HIGHLIGHTED PURCHASE RATE */}
                            <td className="py-3 px-4 text-right">
                              <span className="inline-block font-mono font-bold text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20 shadow-sm">
                                {formatCurrency(item.unitPurchasePrice)}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-mono text-gray-400">
                              {item.taxRate}%
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-white">
                              {formatCurrency(item.totalPrice)}
                            </td>
                            {/* ACTION: QUICK EDIT BILL */}
                            <td className="py-3 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  if (parentPurchase) handleStartEdit(parentPurchase);
                                }}
                                className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 px-2.5 py-1 rounded-lg transition-all"
                                title="Edit this bill's quantity or price"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Edit Bill</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              /* TAB 2: INVOICES BREAKDOWN */
              vendorPurchases.length === 0 ? (
                <div className="py-16 text-center text-tally-textMuted space-y-2">
                  <FileText className="w-10 h-10 mx-auto opacity-30" />
                  <p className="text-sm">No purchase bills found for this vendor.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendorPurchases.map((purchase) => {
                    const isExpanded = !!expandedInvoices[purchase.id];
                    const itemCount = purchase.items?.length || 0;

                    return (
                      <div
                        key={purchase.id}
                        className="rounded-xl border border-tally-border bg-tally-bg/60 overflow-hidden transition-all"
                      >
                        {/* INVOICE CARD HEADER */}
                        <div
                          onClick={() => toggleInvoiceExpand(purchase.id)}
                          className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <button className="text-gray-400 p-1">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4" />
                              )}
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-sm font-bold text-blue-400">
                                  {purchase.invoiceNumber}
                                </span>
                                <span className="text-[10px] text-gray-400 px-2 py-0.5 rounded bg-white/5">
                                  {itemCount} {itemCount === 1 ? 'Item' : 'Items'}
                                </span>
                              </div>
                              <div className="text-xs text-tally-textMuted mt-0.5 flex items-center gap-2">
                                <Calendar className="w-3 h-3 text-gray-500" />
                                <span>{new Date(purchase.purchaseDate).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <div className="text-right">
                              <div className="font-mono font-bold text-base text-white">
                                {formatCurrency(purchase.totalAmount)}
                              </div>
                              <span className="text-[10px] text-gray-400 block">
                                {isExpanded ? 'Click to collapse' : 'Click to view line items'}
                              </span>
                            </div>

                            {/* EDIT & DELETE ACTIONS */}
                            <div
                              className="flex items-center gap-1.5 pl-2 border-l border-tally-border/60"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                onClick={() => handleStartEdit(purchase)}
                                className="px-2.5 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                                title="Edit Bill & Adjust Quantities"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmPurchase(purchase)}
                                className="px-2.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors flex items-center gap-1.5 text-xs font-semibold"
                                title="Delete Bill & Revert Stock"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* EXPANDED LINE ITEMS */}
                        {isExpanded && (
                          <div className="border-t border-tally-border/60 bg-black/20 p-4 animate-in fade-in duration-150">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                                Line Items
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(purchase);
                                }}
                                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-medium"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Modify quantities / items in this bill</span>
                              </button>
                            </div>
                            <table className="w-full text-left text-xs text-gray-300">
                              <thead className="text-[10px] uppercase text-gray-400 border-b border-tally-border/40 pb-2">
                                <tr>
                                  <th className="pb-2 font-medium">Item</th>
                                  <th className="pb-2 font-medium">SKU</th>
                                  <th className="pb-2 text-right font-medium">Qty</th>
                                  <th className="pb-2 text-right font-medium text-emerald-400">Rate (₹)</th>
                                  <th className="pb-2 text-right font-medium">GST %</th>
                                  <th className="pb-2 text-right font-medium">Total (₹)</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-tally-border/30">
                                {(purchase.items || []).map((line, lIdx) => {
                                  const taxable = line.taxableAmount || (line.unitPurchasePrice * line.quantity);
                                  const taxRate = line.taxRate || line.item?.taxRate || 0;
                                  const tax = line.taxAmount || (taxable * taxRate / 100);
                                  const total = line.totalPrice || (taxable + tax);

                                  return (
                                    <tr key={lIdx} className="hover:bg-white/[0.02]">
                                      <td className="py-2 text-white font-medium">
                                        {line.item?.name || 'Item'}
                                      </td>
                                      <td className="py-2 font-mono text-[10px] text-gray-400">
                                        {line.item?.sku || '-'}
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-amber-300">
                                        {line.quantity} {line.item?.unit || 'Pcs'}
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-emerald-400">
                                        {formatCurrency(line.unitPurchasePrice)}
                                      </td>
                                      <td className="py-2 text-right font-mono text-gray-400">
                                        {taxRate}%
                                      </td>
                                      <td className="py-2 text-right font-mono font-bold text-white">
                                        {formatCurrency(total)}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>

          {/* FOOTER */}
          <div className="flex items-center justify-between border-t border-tally-border pt-4 text-xs text-tally-textMuted">
            <div className="flex items-center gap-1.5 text-gray-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Click &quot;Edit&quot; on any bill to correct item quantities; stock auto-adjusts immediately.</span>
            </div>
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* EDIT PURCHASE MODAL */}
      {editingPurchase && (
        <EditPurchaseModal
          isOpen={!!editingPurchase}
          onClose={() => setEditingPurchase(null)}
          purchase={editingPurchase}
          vendors={vendors.length > 0 ? vendors : [vendor]}
          availableItems={availableItems}
          onPurchaseUpdated={handlePurchaseUpdated}
        />
      )}

      {/* DELETE CONFIRMATION DIALOG */}
      {deleteConfirmPurchase && (
        <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm p-4 flex justify-center items-center animate-in fade-in duration-150">
          <div className="bg-tally-card border border-red-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/20">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Delete Purchase Entry?</h3>
                <p className="text-xs text-gray-400 font-mono">{deleteConfirmPurchase.invoiceNumber}</p>
              </div>
            </div>

            <div className="text-xs text-gray-300 space-y-2 bg-tally-bg/60 p-3.5 rounded-xl border border-tally-border">
              <p className="text-amber-300 font-semibold flex items-center gap-1">
                <span>⚠️</span> Consequences of Deletion:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-400">
                <li>
                  Stock quantity for all items in this bill will be <strong>decremented</strong> (reverted from inventory).
                </li>
                <li>
                  Bill total ({formatCurrency(deleteConfirmPurchase.totalAmount)}) will be erased.
                </li>
                <li>Vendor outstanding balance will be automatically adjusted.</li>
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteConfirmPurchase(null)}
                className="px-4 py-2 rounded-xl bg-tally-bg border border-tally-border text-xs text-gray-300 font-semibold hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDeletePurchase}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all disabled:opacity-50"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting & Reverting Stock...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Purchase</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
