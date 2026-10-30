'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api, JournalEntry, JournalLine, LedgerSearchResult, formatCurrency } from '@/lib/api';
import { BookOpen, Plus, Trash2, CheckCircle2, AlertTriangle, Search, Tag, Building2, Landmark, Boxes, Wallet } from 'lucide-react';

export default function JournalPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [description, setDescription] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [lines, setLines] = useState<(JournalLine & { subtext?: string; badge?: string })[]>([
    { accountName: 'Office Rent & Maintenance Expense', type: 'DEBIT', amount: 5000, subtext: 'Indirect Expense' },
    { accountName: 'HDFC Bank Operating Current A/C', type: 'CREDIT', amount: 5000, subtext: 'BANK A/C' },
  ]);

  // Search Autocomplete state for active row
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LedgerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchJournalEntries = async () => {
    try {
      setLoading(true);
      const data = await api.getJournalEntries();
      setEntries(data);
    } catch (err: any) {
      console.error('Failed to load journal entries:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournalEntries();
  }, []);

  // Search ledgers effect
  useEffect(() => {
    if (activeSearchIndex !== null) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          setSearching(true);
          const results = await api.searchLedgers(searchQuery);
          setSearchResults(results);
        } catch (err) {
          console.error('Search ledgers error:', err);
        } finally {
          setSearching(false);
        }
      }, 200);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, activeSearchIndex]);

  const addLine = () => {
    setLines([...lines, { accountName: '', type: 'DEBIT', amount: 0 }]);
  };

  const updateLine = (index: number, field: keyof JournalLine, value: any) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      [field]: field === 'amount' ? parseFloat(value) || 0 : value,
    };
    setLines(updated);
  };

  const selectLedger = (index: number, ledger: LedgerSearchResult) => {
    const updated = [...lines];
    updated[index] = {
      ...updated[index],
      accountName: ledger.name,
      subtext: ledger.subtext,
      badge: ledger.badge,
    };
    setLines(updated);
    setActiveSearchIndex(null);
    setSearchQuery('');
  };

  const removeLine = (index: number) => {
    setLines(lines.filter((_, idx) => idx !== index));
  };

  // Balance calculations
  const totalDebit = lines.reduce((acc, line) => (line.type === 'DEBIT' ? acc + (line.amount || 0) : acc), 0);
  const totalCredit = lines.reduce((acc, line) => (line.type === 'CREDIT' ? acc + (line.amount || 0) : acc), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || lines.length < 2) {
      setMessage({ type: 'error', text: 'Please fill description and add at least 2 journal lines.' });
      return;
    }

    if (!isBalanced) {
      setMessage({
        type: 'error',
        text: `Unbalanced entry! Total Debit (${formatCurrency(totalDebit)}) must equal Total Credit (${formatCurrency(totalCredit)}).`,
      });
      return;
    }

    try {
      setSubmitting(true);
      setMessage(null);
      await api.createJournalEntry({
        description,
        entryDate,
        lines: lines.map(({ accountName, type, amount }) => ({ accountName, type, amount })),
      });

      setMessage({ type: 'success', text: '🎉 Journal Entry posted successfully!' });
      setDescription('');
      setLines([
        { accountName: 'Office Rent & Maintenance Expense', type: 'DEBIT', amount: 5000, subtext: 'Indirect Expense' },
        { accountName: 'HDFC Bank Operating Current A/C', type: 'CREDIT', amount: 5000, subtext: 'BANK A/C' },
      ]);
      fetchJournalEntries();
    } catch (err: any) {
      console.error('Failed to post journal entry:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to post journal entry' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="General Journal Voucher Module (V3)"
        subtitle="Universal multi-ledger autocomplete search across Vendors, Customers, Banks, Items, and General Accounts"
        onRefresh={fetchJournalEntries}
      />

      <div className="px-8 mt-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* LEFT COLUMN: NEW JOURNAL ENTRY FORM (7 cols) */}
        <div className="lg:col-span-7 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-5">
            <h3 className="font-bold text-base text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-purple-400" />
              <span>Post New General Voucher Entry</span>
            </h3>
          </div>

          {message && (
            <div
              className={`mb-6 p-4 rounded-xl text-xs font-medium flex items-center gap-3 ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/30 text-red-400'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-5 h-5 shrink-0" />
              ) : (
                <AlertTriangle className="w-5 h-5 shrink-0" />
              )}
              <div>{message.text}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="sm:col-span-2">
                <label className="block font-medium text-tally-textMuted mb-1">
                  Voucher Narration / Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Office Rent & Freight Expense Adjustment"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3.5 py-2.5 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">
                  Voucher Date
                </label>
                <input
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2.5 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                />
              </div>
            </div>

            {/* JOURNAL LINES BUILDER WITH MULTI-LEDGER AUTOCOMPLETE */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="font-semibold text-white">Universal Ledger Lines (Vendors, Banks, Customers, Expenses)</label>
                <button
                  type="button"
                  onClick={addLine}
                  className="flex items-center gap-1 text-xs text-purple-400 font-bold hover:underline"
                >
                  <Plus className="w-4 h-4" /> Add Account Line
                </button>
              </div>

              <div className="space-y-3">
                {lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-tally-bg rounded-xl border border-tally-border space-y-2 relative"
                  >
                    <div className="grid grid-cols-12 gap-3 items-center">
                      <div className="col-span-5 relative">
                        <label className="block text-[10px] text-tally-textMuted mb-0.5">
                          Ledger Account Name *
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            required
                            placeholder="Type to search ledger..."
                            value={activeSearchIndex === idx ? searchQuery : line.accountName}
                            onFocus={() => {
                              setActiveSearchIndex(idx);
                              setSearchQuery(line.accountName);
                            }}
                            onChange={(e) => {
                              setActiveSearchIndex(idx);
                              setSearchQuery(e.target.value);
                              updateLine(idx, 'accountName', e.target.value);
                            }}
                            className="w-full bg-tally-card border border-tally-border rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-purple-500 focus:outline-none pr-7"
                          />
                          <Search className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2" />
                        </div>

                        {/* AUTOCOMPLETE DROPDOWN */}
                        {activeSearchIndex === idx && (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-tally-card border border-tally-border rounded-xl max-h-56 overflow-y-auto z-30 shadow-2xl divide-y divide-tally-border">
                            {searching ? (
                              <div className="p-3 text-[11px] text-tally-textMuted text-center">Searching ledgers...</div>
                            ) : searchResults.length === 0 ? (
                              <div className="p-3 text-[11px] text-tally-textMuted text-center">No ledger found matching "{searchQuery}"</div>
                            ) : (
                              searchResults.map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => selectLedger(idx, item)}
                                  className="w-full p-2.5 text-left flex items-center justify-between hover:bg-tally-cardHover transition-colors"
                                >
                                  <div>
                                    <div className="font-bold text-xs text-white">{item.name}</div>
                                    <div className="text-[10px] text-tally-textMuted">{item.subtext}</div>
                                  </div>
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-tally-bg text-purple-400 border border-purple-500/30">
                                    [{item.badge}]
                                  </span>
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-tally-textMuted mb-0.5">Type</label>
                        <select
                          value={line.type}
                          onChange={(e) => updateLine(idx, 'type', e.target.value)}
                          className={`w-full border rounded-lg px-2 py-1.5 text-xs font-bold ${
                            line.type === 'DEBIT'
                              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400'
                              : 'bg-blue-500/10 border-blue-500/40 text-blue-400'
                          }`}
                        >
                          <option value="DEBIT">DEBIT</option>
                          <option value="CREDIT">CREDIT</option>
                        </select>
                      </div>

                      <div className="col-span-3">
                        <label className="block text-[10px] text-tally-textMuted mb-0.5">Amount (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={line.amount || ''}
                          onChange={(e) => updateLine(idx, 'amount', e.target.value)}
                          className="w-full bg-tally-card border border-tally-border rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                        />
                      </div>

                      <div className="col-span-1 text-right pt-4">
                        {lines.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            className="text-gray-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {line.subtext && (
                      <div className="text-[10px] font-mono text-purple-400/80 px-1">
                        Subtext: {line.subtext}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* REAL TIME DOUBLE-ENTRY BALANCE SUMMARY */}
            <div className="p-4 rounded-xl bg-tally-bg/80 border border-tally-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs font-mono">
                <div>
                  <span className="text-tally-textMuted block text-[10px]">TOTAL DEBIT</span>
                  <span className="text-base font-bold text-emerald-400">
                    {formatCurrency(totalDebit)}
                  </span>
                </div>
                <div className="text-gray-600 font-bold text-lg">=</div>
                <div>
                  <span className="text-tally-textMuted block text-[10px]">TOTAL CREDIT</span>
                  <span className="text-base font-bold text-blue-400">
                    {formatCurrency(totalCredit)}
                  </span>
                </div>
              </div>

              {isBalanced ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Voucher Balanced</span>
                </div>
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4" />
                  <span>Diff: {formatCurrency(Math.abs(totalDebit - totalCredit))}</span>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={submitting || !isBalanced}
                className={`py-3 px-6 rounded-xl font-bold text-sm flex items-center gap-2 shadow-lg transition-all ${
                  !isBalanced || submitting
                    ? 'bg-tally-border text-gray-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>{submitting ? 'Posting Voucher...' : 'Post Journal Entry'}</span>
              </button>
            </div>
          </form>
        </div>

        {/* RIGHT COLUMN: POSTED JOURNAL VOUCHERS LIST (5 cols) */}
        <div className="lg:col-span-5 glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
            <h3 className="font-bold text-base text-white">Journal Voucher History</h3>
          </div>

          {loading ? (
            <div className="py-8 text-center text-sm text-tally-textMuted">Loading journal vouchers...</div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-sm text-tally-textMuted">No journal entries recorded yet.</div>
          ) : (
            <div className="space-y-4">
              {entries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-4 rounded-xl bg-tally-bg/70 border border-tally-border space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-purple-400">
                      {entry.voucherNumber}
                    </span>
                    <span className="font-mono font-bold text-sm text-white">
                      {formatCurrency(entry.totalAmount)}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-gray-200">{entry.description}</p>

                  <div className="divide-y divide-tally-border/40 border-t border-b border-tally-border/40 py-1.5 space-y-1 text-[11px]">
                    {entry.lines.map((line, lIdx) => (
                      <div key={lIdx} className="flex justify-between py-0.5">
                        <span className="text-gray-300">
                          {line.accountName}{' '}
                          <span
                            className={`font-mono text-[9px] px-1 rounded ${
                              line.type === 'DEBIT' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'
                            }`}
                          >
                            {line.type}
                          </span>
                        </span>
                        <span className="font-mono text-gray-200">{formatCurrency(line.amount)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-tally-textMuted text-right">
                    Entry Date: {new Date(entry.entryDate).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
