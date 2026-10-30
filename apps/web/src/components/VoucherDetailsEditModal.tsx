'use client';

import React, { useState, useEffect } from 'react';
import { Voucher, formatCurrency, api } from '@/lib/api';
import {
  X,
  Receipt,
  Calendar,
  Building,
  CreditCard,
  FileText,
  Pencil,
  Trash2,
  Save,
  AlertCircle,
  CheckCircle2,
  Loader2,
} from 'lucide-react';

interface VoucherDetailsEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  voucher: Voucher | null;
  onVoucherUpdated: () => Promise<void> | void;
  onVoucherDeleted: () => Promise<void> | void;
}

export default function VoucherDetailsEditModal({
  isOpen,
  onClose,
  voucher,
  onVoucherUpdated,
  onVoucherDeleted,
}: VoucherDetailsEditModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [narration, setNarration] = useState('');

  useEffect(() => {
    if (voucher) {
      setAmount(voucher.amount?.toString() || '');
      setDate(
        voucher.date
          ? new Date(voucher.date).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]
      );
      setReferenceNumber(voucher.referenceNumber || '');
      setNarration(voucher.narration || '');
      setIsEditing(false);
      setIsDeleting(false);
      setErrorMessage(null);
    }
  }, [voucher]);

  if (!isOpen || !voucher) return null;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setErrorMessage('Please enter a valid positive amount');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);
      await api.updateVoucher(voucher.id, {
        amount: parsedAmount,
        date,
        referenceNumber,
        narration,
      });
      setIsEditing(false);
      await onVoucherUpdated();
      onClose();
    } catch (err: any) {
      console.error('Failed to update voucher:', err);
      setErrorMessage(err.message || 'Failed to update voucher');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    try {
      setSubmitting(true);
      setErrorMessage(null);
      await api.deleteVoucher(voucher.id);
      await onVoucherDeleted();
      onClose();
    } catch (err: any) {
      console.error('Failed to delete voucher:', err);
      setErrorMessage(err.message || 'Failed to delete voucher');
    } finally {
      setSubmitting(false);
    }
  };

  const badgeColor =
    voucher.voucherType === 'RECEIPT'
      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      : voucher.voucherType === 'PAYMENT'
      ? 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      : 'bg-purple-500/20 text-purple-400 border-purple-500/30';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 flex justify-center items-center animate-in fade-in duration-200">
      <div className="bg-tally-card border border-tally-border rounded-2xl max-w-xl w-full p-6 shadow-2xl relative space-y-5 my-6">
        {/* MODAL HEADER */}
        <div className="flex items-start justify-between border-b border-tally-border pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-brand-500/10 text-brand-400 rounded-xl border border-brand-500/20">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg text-white font-mono">{voucher.voucherNumber}</h3>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${badgeColor}`}>
                  {voucher.voucherType}
                </span>
              </div>
              <p className="text-xs text-tally-textMuted mt-0.5">
                {voucher.voucherType === 'PAYMENT'
                  ? 'Vendor Payment Transaction'
                  : voucher.voucherType === 'RECEIPT'
                  ? 'Customer Receipt Voucher'
                  : 'Contra Account Transfer'}
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

        {/* ERROR MESSAGE */}
        {errorMessage && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* DELETE CONFIRMATION SCREEN */}
        {isDeleting ? (
          <div className="space-y-4 py-2">
            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Are you sure you want to delete this voucher?</span>
              </div>
              <p className="text-xs text-gray-300">
                Deleting voucher <strong className="font-mono text-white">{voucher.voucherNumber}</strong> ({formatCurrency(voucher.amount)}) will:
              </p>
              <ul className="text-xs text-gray-400 list-disc list-inside space-y-1">
                {voucher.voucherType === 'PAYMENT' && (
                  <>
                    <li>Refund {formatCurrency(voucher.amount)} back to your bank/cash account.</li>
                    <li>Add back {formatCurrency(voucher.amount)} to the supplier vendor balance.</li>
                  </>
                )}
                {voucher.voucherType === 'RECEIPT' && (
                  <li>Deduct {formatCurrency(voucher.amount)} from the bank/cash account.</li>
                )}
                {voucher.voucherType === 'CONTRA' && (
                  <li>Revert the transferred amount between both source and destination accounts.</li>
                )}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setIsDeleting(false)}
                className="px-4 py-2 rounded-xl bg-tally-bg border border-tally-border text-xs text-gray-300 font-semibold hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleDelete}
                className="px-5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reverting Balances...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Confirm Delete</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : isEditing ? (
          /* EDIT FORM */
          <form onSubmit={handleUpdate} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-tally-textMuted mb-1">
                  Voucher Amount (₹) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">
                  Voucher Date *
                </label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block font-medium text-tally-textMuted mb-1">
                Reference / Mode (e.g. UTR, Cheque #, UPI ID)
              </label>
              <input
                type="text"
                placeholder="e.g. UPI-9876543210 or CHQ-100234"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block font-medium text-tally-textMuted mb-1">
                Narration / Description
              </label>
              <textarea
                rows={2}
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
                className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-white focus:outline-none focus:border-brand-500 resize-none"
              />
            </div>

            <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[11px] flex items-start gap-2">
              <span>⚡</span>
              <span>
                <strong>Smart Ledger Adjustment:</strong> Updating the amount automatically recalibrates the associated bank account and vendor balance.
              </span>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-tally-border">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="px-4 py-2 rounded-xl bg-tally-bg border border-tally-border text-gray-300 font-semibold hover:text-white"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-2 shadow-lg shadow-emerald-600/30 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* READ-ONLY DETAILS VIEW */
          <div className="space-y-4">
            {/* Amount Big Display */}
            <div className="p-4 rounded-xl bg-tally-bg/60 border border-tally-border flex items-center justify-between">
              <div>
                <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">
                  Transaction Amount
                </span>
                <span className="font-mono font-bold text-2xl text-emerald-400">
                  {formatCurrency(voucher.amount)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">
                  Date
                </span>
                <span className="font-mono text-sm text-gray-200">
                  {new Date(voucher.date).toLocaleDateString()}
                </span>
              </div>
            </div>

            {/* Info Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-tally-bg/40 border border-tally-border/60">
                <span className="text-[10px] text-tally-textMuted block mb-1">Bank / Cash Ledger</span>
                <span className="font-semibold text-white">
                  {voucher.bankAccount?.accountName || 'Primary Account'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-tally-bg/40 border border-tally-border/60">
                <span className="text-[10px] text-tally-textMuted block mb-1">Reference / UTR</span>
                <span className="font-mono font-semibold text-white">
                  {voucher.referenceNumber || 'N/A (Standard)'}
                </span>
              </div>
            </div>

            {/* Narration */}
            <div className="p-3 rounded-xl bg-tally-bg/40 border border-tally-border/60 text-xs">
              <span className="text-[10px] text-tally-textMuted block mb-1">Narration / Remarks</span>
              <p className="text-gray-300">{voucher.narration || 'No remarks added.'}</p>
            </div>

            {/* Double-Entry Ledger Breakdown */}
            {voucher.lines && voucher.lines.length > 0 && (
              <div className="rounded-xl border border-tally-border overflow-hidden bg-tally-bg/40">
                <div className="px-3.5 py-2 bg-white/[0.02] border-b border-tally-border/60 text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                  Double-Entry Ledger Lines
                </div>
                <div className="divide-y divide-tally-border/40 text-xs">
                  {voucher.lines.map((line, idx) => (
                    <div key={idx} className="p-3 flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-white">{line.accountName}</span>
                        <span className="text-[10px] text-gray-500 font-mono ml-2">
                          ({line.ledgerType})
                        </span>
                      </div>
                      <div className="font-mono text-right">
                        {Number(line.debitAmount) > 0 ? (
                          <span className="text-blue-400 font-bold">
                            Dr: {formatCurrency(line.debitAmount)}
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold">
                            Cr: {formatCurrency(line.creditAmount)}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between pt-3 border-t border-tally-border">
              <button
                type="button"
                onClick={() => setIsDeleting(true)}
                className="px-4 py-2 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Voucher</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  <span>Edit Details</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-semibold transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
