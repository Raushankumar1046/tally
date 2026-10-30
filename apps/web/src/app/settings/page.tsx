'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Header from '@/components/Header';
import { api, CompanySettings, SequenceConfig } from '@/lib/api';
import { Settings, Landmark, Building, CheckCircle2, Save, Hash, Eye, Database, ShieldCheck } from 'lucide-react';

export default function SettingsPage() {
  const [formData, setFormData] = useState<CompanySettings>({
    companyName: '',
    address: '',
    phone: '',
    email: '',
    gstin: '',
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
    upiId: '',
    invoicePrefix: '26-27/',
    nextInvoiceNumber: 1,
    invoiceNumberPadding: 3,
    purchasePrefix: 'PUR/26-27/',
    nextPurchaseNumber: 1,
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const settings = await api.getSettings();
      if (settings) {
        setFormData(settings);
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      setMessage(null);
      const updated = await api.updateSettings(formData);
      setFormData(updated);
      setMessage({ type: 'success', text: '🎉 Company Profile, Bank Details & Invoice Prefix Sequence saved successfully!' });
    } catch (err: any) {
      console.error('Failed to update settings:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSubmitting(false);
    }
  };

  // Previews
  const previewNextInvoice = `${formData.invoicePrefix || ''}${String(formData.nextInvoiceNumber || 1).padStart(formData.invoiceNumberPadding || 3, '0')}`;
  const previewNextPurchase = `${formData.purchasePrefix || ''}${String(formData.nextPurchaseNumber || 1).padStart(formData.invoiceNumberPadding || 3, '0')}`;

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Company Profile & Sequence Settings (V3)"
        subtitle="Manage business profile, bank account remittance details, and dynamic Financial Year invoice prefix sequences"
        onRefresh={fetchSettings}
      />

      <div className="px-8 mt-6 max-w-4xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {message && (
            <div
              className={`p-4 rounded-xl text-xs font-medium flex items-center gap-3 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <div>{message.text}</div>
            </div>
          )}

          {/* SECTION 1: DYNAMIC INVOICE & ORDER SEQUENCE ENGINE */}
          <div className="glass-card rounded-2xl p-6 border border-purple-500/30">
            <h3 className="font-bold text-base text-white border-b border-tally-border pb-4 mb-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Hash className="w-5 h-5 text-purple-400" />
                <span>Financial Year Prefix & Auto-Incrementing Invoice Sequence</span>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-purple-500/20 text-purple-400 font-bold">
                Atomic Engine
              </span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Sales Invoice Prefix (e.g., 26-27/)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="26-27/"
                    value={formData.invoicePrefix || ''}
                    onChange={(e) => setFormData({ ...formData, invoicePrefix: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Next Sequence Counter
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.nextInvoiceNumber || 1}
                    onChange={(e) => setFormData({ ...formData, nextInvoiceNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Number Zero Padding
                  </label>
                  <select
                    value={formData.invoiceNumberPadding || 3}
                    onChange={(e) => setFormData({ ...formData, invoiceNumberPadding: parseInt(e.target.value, 10) || 3 })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  >
                    <option value={2}>2 Digits (01, 02)</option>
                    <option value={3}>3 Digits (001, 002)</option>
                    <option value={4}>4 Digits (0001, 0002)</option>
                  </select>
                </div>
              </div>

              {/* LIVE PREVIEW BOX */}
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-purple-400" />
                  <span className="font-semibold text-gray-200">Next Formatted Invoice Number Preview:</span>
                </div>
                <span className="font-mono font-bold text-base text-purple-400 px-3 py-1 bg-tally-bg rounded-lg border border-purple-500/40">
                  {previewNextInvoice}
                </span>
              </div>

              <div className="pt-2 border-t border-tally-border/60 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Purchase Entry Prefix (e.g., PUR/26-27/)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="PUR/26-27/"
                    value={formData.purchasePrefix || ''}
                    onChange={(e) => setFormData({ ...formData, purchasePrefix: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Next Purchase Counter
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={formData.nextPurchaseNumber || 1}
                    onChange={(e) => setFormData({ ...formData, nextPurchaseNumber: parseInt(e.target.value, 10) || 1 })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: COMPANY PROFILE */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="font-bold text-base text-white border-b border-tally-border pb-4 mb-5 flex items-center gap-2">
              <Building className="w-5 h-5 text-brand-400" />
              <span>Company Business Profile</span>
            </h3>

            {loading ? (
              <div className="py-8 text-center text-sm text-tally-textMuted">Loading company details...</div>
            ) : (
              <div className="space-y-4 text-xs">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Company / Trade Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tally Solutions Enterprise Pvt Ltd"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">
                      Company GSTIN Tax ID
                    </label>
                    <input
                      type="text"
                      placeholder="29AAAAA0000A1Z5"
                      value={formData.gstin || ''}
                      onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">
                      Company PAN Number
                    </label>
                    <input
                      type="text"
                      placeholder="AVCPT7101L"
                      value={formData.panNumber || ''}
                      onChange={(e) => setFormData({ ...formData, panNumber: e.target.value })}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 80000 12345"
                      value={formData.phone || ''}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    placeholder="billing@company.com"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Full Registered Address
                  </label>
                  <textarea
                    rows={2}
                    placeholder="100 Tech Park Avenue, Silicon Valley, Bengaluru - 560100"
                    value={formData.address || ''}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* SECTION 3: BANK ACCOUNT & REMITTANCE DETAILS */}
          <div className="glass-card rounded-2xl p-6 border border-emerald-500/30">
            <h3 className="font-bold text-base text-white border-b border-tally-border pb-4 mb-5 flex items-center gap-2">
              <Landmark className="w-5 h-5 text-emerald-400" />
              <span>Bank Account & Remittance Details (Printed on Bills)</span>
            </h3>

            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    placeholder="HDFC Bank Ltd"
                    value={formData.bankName || ''}
                    onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    placeholder="50200098765432"
                    value={formData.accountNumber || ''}
                    onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    placeholder="HDFC0001234"
                    value={formData.ifscCode || ''}
                    onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">
                    Branch Name
                  </label>
                  <input
                    type="text"
                    placeholder="Koramangala Branch"
                    value={formData.branchName || ''}
                    onChange={(e) => setFormData({ ...formData, branchName: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">
                  UPI ID / QR Handle
                </label>
                <input
                  type="text"
                  placeholder="tallyenterprise@hdfcbank"
                  value={formData.upiId || ''}
                  onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-emerald-400 font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* SECTION 4: SYSTEM DATA SAFETY & BACKUP EXPORT / IMPORT */}
          <div className="glass-card rounded-2xl p-6 border border-cyan-500/30">
            <h3 className="font-bold text-base text-white border-b border-tally-border pb-4 mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-cyan-400" />
                <span>System Data Safety & Backup (Crash Protection)</span>
              </div>
              <span className="text-xs font-mono px-2.5 py-1 rounded bg-cyan-500/20 text-cyan-400 font-bold">
                1-Click Export & Import
              </span>
            </h3>

            <p className="text-xs text-tally-textMuted mb-5">
              Protect your business data against PC hardware failure or easily transfer all vendors, inventory, bank details, invoices, and vouchers to a new PC.
            </p>

            <div className="flex items-center justify-between p-4 rounded-xl bg-cyan-500/10 border border-cyan-500/20">
              <div className="flex items-center gap-3 text-xs text-gray-200">
                <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0" />
                <span>Export JSON backup snapshot or import restored backup package.</span>
              </div>

              <Link
                href="/backup"
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-cyan-500 hover:bg-cyan-600 text-tally-bg shadow-md shadow-cyan-500/20 transition-all"
              >
                <Database className="w-4 h-4" />
                <span>Open Backup & Restore Engine</span>
              </Link>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 py-3 px-8 rounded-xl font-bold text-sm bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-tally-bg shadow-lg shadow-brand-500/25 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4 fill-tally-bg" />
              <span>{submitting ? 'Saving Settings...' : 'Save Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
