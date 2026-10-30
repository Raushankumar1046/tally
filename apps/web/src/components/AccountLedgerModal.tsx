'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { api, LedgerStatement } from '@/lib/api';
import { Printer, X, Download, Calendar, Search, ArrowLeft, RefreshCw, FileText } from 'lucide-react';

interface AccountLedgerModalProps {
  initialAccountName?: string;
  initialVendorId?: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountLedgerModal({
  initialAccountName,
  initialVendorId,
  isOpen,
  onClose,
}: AccountLedgerModalProps) {
  const [statement, setStatement] = useState<LedgerStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available accounts for quick switching
  const [accounts, setAccounts] = useState<Array<{ id: string; name: string; type: 'VENDOR' | 'CUSTOMER'; subtext: string }>>([]);
  const [selectedAccountName, setSelectedAccountName] = useState<string>(initialAccountName || '');
  const [selectedVendorId, setSelectedVendorId] = useState<string | undefined>(initialVendorId);

  // Date filters
  const currentYear = new Date().getFullYear();
  const defaultFrom = `${currentYear}-04-01`;
  const defaultTo = `${currentYear + 1}-03-31`;

  const [datePreset, setDatePreset] = useState<'FY' | 'THIS_MONTH' | 'LAST_30' | 'ALL' | 'CUSTOM'>('FY');
  const [fromDate, setFromDate] = useState<string>(defaultFrom);
  const [toDate, setToDate] = useState<string>(defaultTo);

  // Load account list once
  useEffect(() => {
    if (isOpen) {
      api.getLedgerAccounts().then(setAccounts).catch(console.error);
    }
  }, [isOpen]);

  // Sync initial props
  useEffect(() => {
    if (initialAccountName) setSelectedAccountName(initialAccountName);
    if (initialVendorId) setSelectedVendorId(initialVendorId);
  }, [initialAccountName, initialVendorId]);

  // Handle Preset Changes
  const handlePresetChange = (preset: 'FY' | 'THIS_MONTH' | 'LAST_30' | 'ALL' | 'CUSTOM') => {
    setDatePreset(preset);
    const today = new Date();
    if (preset === 'FY') {
      const fy = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
      setFromDate(`${fy}-04-01`);
      setToDate(`${fy + 1}-03-31`);
    } else if (preset === 'THIS_MONTH') {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const lastDay = new Date(y, today.getMonth() + 1, 0).getDate();
      setFromDate(`${y}-${m}-01`);
      setToDate(`${y}-${m}-${lastDay}`);
    } else if (preset === 'LAST_30') {
      const past = new Date();
      past.setDate(today.getDate() - 30);
      setFromDate(past.toISOString().slice(0, 10));
      setToDate(today.toISOString().slice(0, 10));
    } else if (preset === 'ALL') {
      setFromDate('');
      setToDate('');
    }
  };

  // Fetch Statement
  const fetchStatement = async () => {
    if (!selectedAccountName && !selectedVendorId) return;

    try {
      setLoading(true);
      setError(null);
      const data = await api.getLedgerStatement({
        accountName: selectedAccountName,
        vendorId: selectedVendorId,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
      });
      setStatement(data);
    } catch (err: any) {
      console.error('Failed to load ledger statement:', err);
      setError(err.message || 'Failed to load ledger statement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && (selectedAccountName || selectedVendorId)) {
      fetchStatement();
    }
  }, [isOpen, selectedAccountName, selectedVendorId, fromDate, toDate]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (!statement) return;

    const headers = ['Date', 'Type', 'VchNo', 'Particulars', 'Debit(Rs.)', 'Credit(Rs.)', 'Balance(Rs.)'];
    const rows = statement.entries.map((e) => [
      e.date,
      e.type,
      e.vchNo || '',
      `"${e.particulars.replace(/"/g, '""')}"`,
      e.debit || '',
      e.credit || '',
      e.balance || '',
    ]);

    rows.push(['', '', '', 'Total', statement.totalDebit, statement.totalCredit, '']);
    rows.push(['', '', '', statement.closingBalanceText, '', '', '']);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ledger_${statement.accountName.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0e1420] border border-tally-border rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* MODAL CONTROL HEADER (NO-PRINT) */}
        <div className="no-print p-4 bg-[#141b27] border-b border-tally-border flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-brand-500/20 text-brand-400 rounded-xl">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <span>Account Ledger Statement</span>
                <span className="text-xs font-mono font-normal text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                  Tally Print Format
                </span>
              </h2>
              <p className="text-xs text-tally-textMuted">Complete chronological transaction khata with running Dr / Cr balance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              disabled={!statement || loading}
              className="flex items-center gap-1.5 py-2 px-3.5 bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all cursor-pointer disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              <span>Print Ledger (A4)</span>
            </button>

            <button
              onClick={handleDownloadCSV}
              disabled={!statement || loading}
              className="flex items-center gap-1.5 py-2 px-3 bg-tally-card hover:bg-tally-cardHover text-gray-300 hover:text-white text-xs font-semibold rounded-xl border border-tally-border transition-all cursor-pointer disabled:opacity-50"
              title="Download CSV"
            >
              <Download className="w-4 h-4" />
              <span>CSV</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-tally-card hover:bg-tally-cardHover text-gray-400 hover:text-white border border-tally-border transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* FILTERS TOOLBAR (NO-PRINT) */}
        <div className="no-print p-3.5 bg-[#0b0f17] border-b border-tally-border flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Account Selector Autocomplete */}
          <div className="flex items-center gap-2 flex-1 min-w-[280px]">
            <span className="text-tally-textMuted font-medium">Party / Account:</span>
            <div className="relative flex-1">
              <select
                value={selectedAccountName}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedAccountName(val);
                  const matched = accounts.find((a) => a.name === val);
                  setSelectedVendorId(matched && matched.type === 'VENDOR' ? matched.id : undefined);
                }}
                className="w-full bg-[#141b27] border border-tally-border text-white rounded-xl px-3 py-1.5 text-xs focus:border-brand-500 focus:outline-none cursor-pointer"
              >
                <option value="">-- Select Party Account --</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.name}>
                    {acc.name} ({acc.type === 'VENDOR' ? 'Supplier' : 'Customer'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Date Range Presets */}
          <div className="flex items-center gap-1.5 bg-[#141b27] p-1 rounded-xl border border-tally-border">
            <button
              type="button"
              onClick={() => handlePresetChange('FY')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                datePreset === 'FY' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              FY 2026-27
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('THIS_MONTH')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                datePreset === 'THIS_MONTH' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('LAST_30')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                datePreset === 'LAST_30' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Last 30 Days
            </button>
            <button
              type="button"
              onClick={() => handlePresetChange('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                datePreset === 'ALL' ? 'bg-brand-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              All Time
            </button>
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="bg-[#141b27] border border-tally-border text-white text-[11px] rounded-lg px-2 py-1 focus:outline-none"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setDatePreset('CUSTOM');
              }}
              className="bg-[#141b27] border border-tally-border text-white text-[11px] rounded-lg px-2 py-1 focus:outline-none"
            />
          </div>
        </div>

        {/* PRINTABLE SHEET CONTAINER (MATCHES SCREENSHOT EXACTLY) */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-[#0b0f17] flex justify-center">
          {loading && (
            <div className="py-24 text-center text-cyan-400 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin" />
              <span className="text-sm font-medium">Generating Account Ledger Statement...</span>
            </div>
          )}

          {!loading && error && (
            <div className="py-16 text-center text-red-400 max-w-md mx-auto">
              <p className="font-semibold text-sm mb-1">Failed to generate ledger</p>
              <p className="text-xs text-gray-400">{error}</p>
            </div>
          )}

          {!loading && !statement && !error && (
            <div className="py-24 text-center text-gray-500">
              <p className="text-sm">Please select a party account above to view the ledger.</p>
            </div>
          )}

          {!loading && statement && (
            <div
              id="printable-ledger-modal"
              className="bg-white text-black p-8 md:p-12 w-full max-w-4xl shadow-xl font-sans text-[13px] leading-snug rounded-sm"
              style={{ minHeight: '800px', color: '#000000', backgroundColor: '#ffffff' }}
            >
              {/* ── 1. HEADER (CENTERED COMPANY DETAILS) ───────────────────── */}
              <div className="text-center mb-6 space-y-1">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-black">
                  {statement.company.name}({statement.company.financialYear})
                </h1>
                {statement.company.address && (
                  <p className="text-xs text-gray-800 font-medium max-w-2xl mx-auto leading-relaxed">
                    {statement.company.address}
                  </p>
                )}
                {statement.company.gstin && (
                  <p className="text-[11px] text-gray-700">GSTIN: {statement.company.gstin}</p>
                )}

                <div className="pt-2">
                  <h2 className="text-lg font-bold tracking-[0.3em] uppercase text-black">L E D G E R</h2>
                  <p className="text-xs font-medium text-gray-800">{statement.dateRangeText}</p>
                </div>

                <div className="pt-2 text-center">
                  <h3 className="text-base font-bold text-black uppercase tracking-wide">
                    Account : {statement.accountName}
                  </h3>
                </div>
              </div>

              {/* ── 2. LEDGER TABLE (EXACT SCREENSHOT LAYOUT) ─────────────── */}
              <div className="w-full">
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-t-2 border-b border-black text-xs font-bold">
                      <th className="py-2 pr-2 text-left w-[12%]">Date</th>
                      <th className="py-2 px-2 text-left w-[8%]">Type</th>
                      <th className="py-2 px-2 text-left w-[16%]">VchNo.</th>
                      <th className="py-2 px-2 text-left w-[28%]">Particulars</th>
                      <th className="py-2 px-2 text-right w-[12%]">Debit(Rs.)</th>
                      <th className="py-2 px-2 text-right w-[12%]">Credit(Rs.)</th>
                      <th className="py-2 pl-2 text-right w-[12%]">Balance(Rs.)</th>
                    </tr>
                  </thead>
                  <tbody className="text-xs divide-y divide-transparent">
                    {/* Optional Opening Balance Row */}
                    {statement.openingBalance && (
                      <tr className="font-semibold italic text-gray-700">
                        <td className="py-1.5 pr-2"></td>
                        <td className="py-1.5 px-2"></td>
                        <td className="py-1.5 px-2"></td>
                        <td className="py-1.5 px-2">Opening Balance</td>
                        <td className="py-1.5 px-2 text-right">
                          {statement.openingBalanceType === 'Dr' ? statement.openingBalance : ''}
                        </td>
                        <td className="py-1.5 px-2 text-right">
                          {statement.openingBalanceType === 'Cr' ? statement.openingBalance : ''}
                        </td>
                        <td className="py-1.5 pl-2 text-right font-mono font-bold">
                          {statement.openingBalance} {statement.openingBalanceType}
                        </td>
                      </tr>
                    )}

                    {/* Transaction Rows */}
                    {statement.entries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-gray-500 italic">
                          No transactions found for this account in the selected date range.
                        </td>
                      </tr>
                    ) : (
                      statement.entries.map((entry) => (
                        <tr key={entry.id} className="hover:bg-gray-50/50">
                          <td className="py-1 pr-2 font-mono whitespace-nowrap text-gray-900">{entry.date}</td>
                          <td className="py-1 px-2 font-medium">{entry.type}</td>
                          <td className="py-1 px-2 font-mono text-[11px] text-gray-800">{entry.vchNo}</td>
                          <td className="py-1 px-2 uppercase font-medium text-gray-900">{entry.particulars}</td>
                          <td className="py-1 px-2 text-right font-mono text-gray-900">{entry.debit}</td>
                          <td className="py-1 px-2 text-right font-mono text-gray-900">{entry.credit}</td>
                          <td className="py-1 pl-2 text-right font-mono font-bold text-gray-900 whitespace-nowrap">
                            {entry.balance}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>

                  {/* ── 3. TOTALS FOOTER ─────────────────────────────────────── */}
                  <tfoot>
                    <tr className="border-t border-b border-black font-bold text-xs">
                      <td colSpan={4} className="py-2.5 text-right uppercase tracking-wider pr-4 font-bold">
                        Total
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold">{statement.totalDebit}</td>
                      <td className="py-2.5 px-2 text-right font-mono font-bold">{statement.totalCredit}</td>
                      <td className="py-2.5 pl-2"></td>
                    </tr>
                  </tfoot>
                </table>

                {/* ── 4. CLOSING BALANCE ROW (RIGHT ALIGNED) ──────────────── */}
                <div className="pt-4 text-right">
                  <div className="text-sm md:text-base font-bold font-mono tracking-tight text-black">
                    {statement.closingBalanceText}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
