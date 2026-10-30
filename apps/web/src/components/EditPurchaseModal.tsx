'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Purchase, Vendor, Item, api, formatCurrency } from '@/lib/api';
import {
  X,
  Building,
  Calendar,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle2,
  Receipt,
  Save,
  Loader2,
} from 'lucide-react';

interface EditPurchaseLine {
  itemId: string;
  itemName: string;
  itemSku: string;
  unit: string;
  quantity: number;
  unitPurchasePrice: number;
  taxRate: number;
}

interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: Purchase | null;
  vendors: Vendor[];
  availableItems: Item[];
  onPurchaseUpdated: (updatedPurchase: Purchase) => void;
}

export default function EditPurchaseModal({
  isOpen,
  onClose,
  purchase,
  vendors,
  availableItems,
  onPurchaseUpdated,
}: EditPurchaseModalProps) {
  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [lines, setLines] = useState<EditPurchaseLine[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (purchase) {
      setVendorId(purchase.vendorId);
      setInvoiceNumber(purchase.invoiceNumber);
      setPurchaseDate(
        purchase.purchaseDate
          ? new Date(purchase.purchaseDate).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );

      const mappedLines: EditPurchaseLine[] = (purchase.items || []).map((line) => {
        const itemInfo = line.item || availableItems.find((i) => i.id === line.itemId);
        return {
          itemId: line.itemId,
          itemName: itemInfo?.name || 'Unknown Item',
          itemSku: itemInfo?.sku || '-',
          unit: itemInfo?.unit || 'Pcs',
          quantity: Number(line.quantity) || 1,
          unitPurchasePrice: Number(line.unitPurchasePrice) || 0,
          taxRate: line.taxRate !== undefined ? Number(line.taxRate) : (itemInfo?.taxRate || 18.0),
        };
      });

      setLines(mappedLines);
      setErrorMessage(null);
    }
  }, [purchase, availableItems]);

  const updateLine = (index: number, field: keyof EditPurchaseLine, val: any) => {
    setLines((prev) => {
      const next = [...prev];
      if (field === 'itemId') {
        const selected = availableItems.find((i) => i.id === val);
        if (selected) {
          next[index] = {
            ...next[index],
            itemId: selected.id,
            itemName: selected.name,
            itemSku: selected.sku,
            unit: selected.unit || 'Pcs',
            unitPurchasePrice: Number(selected.purchasePrice) || next[index].unitPurchasePrice,
            taxRate: Number(selected.taxRate) || next[index].taxRate,
          };
        }
      } else if (field === 'quantity') {
        const qty = parseFloat(val);
        next[index] = { ...next[index], quantity: isNaN(qty) ? 0 : qty };
      } else if (field === 'unitPurchasePrice') {
        const price = parseFloat(val);
        next[index] = { ...next[index], unitPurchasePrice: isNaN(price) ? 0 : price };
      } else if (field === 'taxRate') {
        const rate = parseFloat(val);
        next[index] = { ...next[index], taxRate: isNaN(rate) ? 0 : rate };
      }
      return next;
    });
  };

  const addEmptyLine = () => {
    if (availableItems.length === 0) return;
    const defaultItem = availableItems[0];
    setLines((prev) => [
      ...prev,
      {
        itemId: defaultItem.id,
        itemName: defaultItem.name,
        itemSku: defaultItem.sku,
        unit: defaultItem.unit || 'Pcs',
        quantity: 1,
        unitPurchasePrice: Number(defaultItem.purchasePrice) || 0,
        taxRate: Number(defaultItem.taxRate) || 18.0,
      },
    ]);
  };

  const removeLine = (index: number) => {
    if (lines.length <= 1) {
      setErrorMessage('A purchase entry must have at least 1 item. If you want to delete the whole bill, please use Delete.');
      return;
    }
    setErrorMessage(null);
    setLines((prev) => prev.filter((_, i) => i !== index));
  };

  // Calculations
  const { totalTaxable, totalTaxAmount, totalPurchaseAmount } = useMemo(() => {
    let taxable = 0;
    let tax = 0;
    lines.forEach((l) => {
      const lTaxable = (l.quantity || 0) * (l.unitPurchasePrice || 0);
      const lTax = lTaxable * ((l.taxRate || 0) / 100);
      taxable += lTaxable;
      tax += lTax;
    });
    return {
      totalTaxable: taxable,
      totalTaxAmount: tax,
      totalPurchaseAmount: taxable + tax,
    };
  }, [lines]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!purchase) return;

    if (lines.length === 0) {
      setErrorMessage('Please add at least one line item.');
      return;
    }

    for (const l of lines) {
      if (l.quantity <= 0) {
        setErrorMessage(`Quantity for "${l.itemName}" must be greater than 0.`);
        return;
      }
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const payload = {
        vendorId,
        invoiceNumber,
        purchaseDate,
        items: lines.map((l) => ({
          itemId: l.itemId,
          quantity: l.quantity,
          unitPurchasePrice: l.unitPurchasePrice,
          taxRate: l.taxRate,
        })),
      };

      const updated = await api.updatePurchase(purchase.id, payload);
      onPurchaseUpdated(updated);
      onClose();
    } catch (err: any) {
      console.error('Failed to update purchase:', err);
      setErrorMessage(err.message || 'Failed to update purchase entry');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen || !purchase) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex justify-center items-center animate-in fade-in duration-200">
      <div className="bg-tally-card border border-tally-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative space-y-5 my-6 max-h-[92vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-tally-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Edit Purchase Entry</h2>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-semibold">
                  {purchase.invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-tally-textMuted mt-0.5">
                Correct mistaken quantities, item prices, or GST rates. Stock ledger will auto-sync.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ERROR NOTIFICATION */}
        {errorMessage && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-5 pr-1">
          {/* TOP METADATA GRID */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-tally-bg/60 p-4 rounded-xl border border-tally-border">
            {/* Vendor Selector */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-400" />
                <span>Supplier / Vendor</span>
              </label>
              <select
                value={vendorId}
                onChange={(e) => setVendorId(e.target.value)}
                required
                className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} {v.gstin ? `(${v.gstin})` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Invoice Number */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5">
                Supplier Invoice / Bill #
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Purchase Date */}
            <div>
              <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-purple-400" />
                <span>Invoice Date</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {/* LINE ITEMS LIST */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300">
                  Purchased Items ({lines.length})
                </h4>
              </div>
              <button
                type="button"
                onClick={addEmptyLine}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 font-semibold px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const lineTaxable = (line.quantity || 0) * (line.unitPurchasePrice || 0);
                const lineTax = lineTaxable * ((line.taxRate || 0) / 100);
                const lineTotal = lineTaxable + lineTax;

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl border border-tally-border bg-tally-bg/40 space-y-2.5"
                  >
                    <div className="grid grid-cols-12 gap-3 items-end">
                      {/* Item selection */}
                      <div className="col-span-12 sm:col-span-4">
                        <label className="block text-[10px] text-gray-400 mb-1">
                          Item Name / SKU
                        </label>
                        <select
                          value={line.itemId}
                          onChange={(e) => updateLine(idx, 'itemId', e.target.value)}
                          className="w-full bg-tally-card border border-tally-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                        >
                          {availableItems.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name} ({it.sku})
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity input - with highlight for easy correction */}
                      <div className="col-span-4 sm:col-span-2">
                        <label className="block text-[10px] text-amber-300 font-semibold mb-1">
                          Qty ({line.unit}) *
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          required
                          value={line.quantity}
                          onChange={(e) => updateLine(idx, 'quantity', e.target.value)}
                          className="w-full bg-amber-500/10 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-mono font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>

                      {/* Unit Price input */}
                      <div className="col-span-4 sm:col-span-3">
                        <label className="block text-[10px] text-gray-400 mb-1">
                          Purchase Rate (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          required
                          value={line.unitPurchasePrice}
                          onChange={(e) => updateLine(idx, 'unitPurchasePrice', e.target.value)}
                          className="w-full bg-tally-card border border-tally-border rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* GST % input */}
                      <div className="col-span-3 sm:col-span-2">
                        <label className="block text-[10px] text-gray-400 mb-1">GST %</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.taxRate}
                          onChange={(e) => updateLine(idx, 'taxRate', e.target.value)}
                          className="w-full bg-tally-card border border-tally-border rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Delete Line Button */}
                      <div className="col-span-1 text-right pb-1">
                        <button
                          type="button"
                          onClick={() => removeLine(idx)}
                          className="text-gray-500 hover:text-red-400 p-1.5 rounded hover:bg-red-500/10 transition-colors"
                          title="Remove item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Calculated Line Breakdown */}
                    <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 pt-1.5 border-t border-tally-border/40 px-1">
                      <span>Taxable: {formatCurrency(lineTaxable)}</span>
                      <span className="text-blue-400">
                        + GST ({line.taxRate}%): {formatCurrency(lineTax)}
                      </span>
                      <span className="font-bold text-white">
                        Line Total: {formatCurrency(lineTotal)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TOTAL SUMMARY CARD */}
          <div className="p-4 rounded-xl bg-tally-bg/90 border border-tally-border space-y-2">
            <div className="flex justify-between text-xs text-gray-300">
              <span>Total Taxable Amount:</span>
              <span className="font-mono text-white">{formatCurrency(totalTaxable)}</span>
            </div>
            <div className="flex justify-between text-xs text-blue-400">
              <span>Eligible Input Tax Credit (ITC):</span>
              <span className="font-mono font-bold">+{formatCurrency(totalTaxAmount)}</span>
            </div>
            <div className="flex justify-between border-t border-tally-border pt-2 text-base font-bold text-white">
              <span>Updated Total Purchase Cost:</span>
              <span className="font-mono text-emerald-400 text-xl font-bold">
                {formatCurrency(totalPurchaseAmount)}
              </span>
            </div>
          </div>

          {/* NOTICE NOTE */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs flex items-start gap-2">
            <span className="text-sm">⚡</span>
            <span>
              <strong>Inventory Stock Auto-Adjustment:</strong> If you reduce quantity (e.g. from 10 to 1), stock will automatically decrement by 9. If you increase quantity, stock will increment accordingly.
            </span>
          </div>

          {/* MODAL ACTIONS */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-tally-border">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl bg-tally-bg border border-tally-border text-gray-300 text-xs font-semibold hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving & Syncing Stock...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes & Sync Stock</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
