'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import VoucherDetailsEditModal from '@/components/VoucherDetailsEditModal';
import AccountLedgerModal from '@/components/AccountLedgerModal';
import { api, BankAccount, BankAccountDetails, Voucher, Vendor, CustomerProfile, formatCurrency } from '@/lib/api';
import {
  Landmark,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Wallet,
  Building,
  CheckCircle2,
  X,
  CreditCard,
  Banknote,
  Repeat,
  Eye,
  FileText,
  Clock,
  ArrowDown,
  ArrowUp,
  User,
  Calendar,
  Pencil,
  Trash2,
  Save,
} from 'lucide-react';

export default function BankingPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Inspector Modal State for Bank Account Detailed View
  const [selectedAccountDetails, setSelectedAccountDetails] = useState<BankAccountDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Selected Voucher Modal State
  const [selectedVoucher, setSelectedVoucher] = useState<Voucher | null>(null);

  // Quick Action Modal States
  const [activeModal, setActiveModal] = useState<'receipt' | 'payment' | 'contra' | 'addAccount' | null>(null);
  const [isLedgerModalOpen, setIsLedgerModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalMessage, setModalMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Customer Autocomplete state for Receipt Modal
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Form states with Date fields
  const [receiptForm, setReceiptForm] = useState({
    customerName: '',
    bankAccountId: '',
    amount: '',
    referenceNumber: '',
    narration: '',
    date: todayStr,
  });

  const [paymentForm, setPaymentForm] = useState({
    vendorId: '',
    bankAccountId: '',
    amount: '',
    referenceNumber: '',
    narration: '',
    date: todayStr,
    paymentMode: 'NEFT',
  });

  const [contraForm, setContraForm] = useState({
    fromBankAccountId: '',
    toBankAccountId: '',
    amount: '',
    referenceNumber: '',
    narration: '',
    date: todayStr,
  });

  const [accountForm, setAccountForm] = useState({
    accountName: '',
    accountType: 'BANK',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    openingBalance: '0',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bankData, voucherData, vendorData, customerData] = await Promise.all([
        api.getBankAccounts(),
        api.getVouchers(),
        api.getVendors(),
        api.getCustomers(),
      ]);
      setAccounts(bankData.accounts);
      setMetrics(bankData.metrics);
      setVouchers(voucherData);
      setVendors(vendorData);
      setCustomers(customerData);

      if (bankData.accounts.length > 0) {
        setReceiptForm((prev) => ({ ...prev, bankAccountId: bankData.accounts[0].id }));
        setPaymentForm((prev) => ({ ...prev, bankAccountId: bankData.accounts[0].id }));
        if (bankData.accounts.length > 1) {
          setContraForm({
            fromBankAccountId: bankData.accounts[0].id,
            toBankAccountId: bankData.accounts[1].id,
            amount: '',
            referenceNumber: '',
            narration: '',
            date: todayStr,
          });
        }
      }

      if (vendorData.length > 0) {
        setPaymentForm((prev) => ({ ...prev, vendorId: vendorData[0].id }));
      }
    } catch (err: any) {
      console.error('Failed to load banking data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const [isEditingAccount, setIsEditingAccount] = useState(false);
  const [editAccountForm, setEditAccountForm] = useState({
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    branch: '',
    openingBalance: '',
    currentBalance: '',
  });
  const [savingAccount, setSavingAccount] = useState(false);

  const openAccountDetails = async (accId: string) => {
    try {
      setLoadingDetails(true);
      setIsEditingAccount(false);
      const details = await api.getBankAccountDetails(accId);
      setSelectedAccountDetails(details);
    } catch (err) {
      console.error('Failed to fetch account details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const startEditAccount = () => {
    if (!selectedAccountDetails) return;
    setEditAccountForm({
      accountName: selectedAccountDetails.accountName,
      accountNumber: selectedAccountDetails.accountNumber || '',
      ifscCode: selectedAccountDetails.ifscCode || '',
      branch: selectedAccountDetails.branch || '',
      openingBalance: selectedAccountDetails.openingBalance.toString(),
      currentBalance: selectedAccountDetails.currentBalance.toString(),
    });
    setIsEditingAccount(true);
  };

  const handleUpdateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccountDetails) return;
    try {
      setSavingAccount(true);
      await api.updateBankAccount(selectedAccountDetails.id, {
        accountName: editAccountForm.accountName,
        accountNumber: editAccountForm.accountNumber,
        ifscCode: editAccountForm.ifscCode,
        branch: editAccountForm.branch,
        openingBalance: parseFloat(editAccountForm.openingBalance) || 0,
        currentBalance: parseFloat(editAccountForm.currentBalance) || 0,
      });
      setIsEditingAccount(false);
      await fetchData();
      await openAccountDetails(selectedAccountDetails.id);
    } catch (err: any) {
      console.error('Failed to update bank account:', err);
    } finally {
      setSavingAccount(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccountDetails) return;
    if (!confirm(`Are you sure you want to delete "${selectedAccountDetails.accountName}"?`)) return;
    try {
      setSavingAccount(true);
      await api.deleteBankAccount(selectedAccountDetails.id);
      setSelectedAccountDetails(null);
      setIsEditingAccount(false);
      await fetchData();
    } catch (err: any) {
      console.error('Failed to delete account:', err);
    } finally {
      setSavingAccount(false);
    }
  };

  const filteredCustomerOptions = customers.filter((c) =>
    c.customerName.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
    (c.customerPhone && c.customerPhone.includes(customerSearchQuery)) ||
    (c.customerGstin && c.customerGstin.toLowerCase().includes(customerSearchQuery.toLowerCase()))
  );

  const handleReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptForm.customerName || !receiptForm.bankAccountId || !receiptForm.amount) return;

    try {
      setSubmitting(true);
      setModalMessage(null);
      await api.createReceiptVoucher({
        ...receiptForm,
        amount: parseFloat(receiptForm.amount),
      });
      setActiveModal(null);
      setReceiptForm({ customerName: '', bankAccountId: accounts[0]?.id || '', amount: '', referenceNumber: '', narration: '', date: todayStr });
      setCustomerSearchQuery('');
      fetchData();
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err.message || 'Failed to record receipt' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentForm.vendorId || !paymentForm.bankAccountId || !paymentForm.amount) return;

    try {
      setSubmitting(true);
      setModalMessage(null);
      await api.createPaymentVoucher({
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
      });
      setActiveModal(null);
      setPaymentForm({ vendorId: vendors[0]?.id || '', bankAccountId: accounts[0]?.id || '', amount: '', referenceNumber: '', narration: '', date: todayStr, paymentMode: 'NEFT' });
      fetchData();
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err.message || 'Failed to record payment' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleContra = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contraForm.fromBankAccountId || !contraForm.toBankAccountId || !contraForm.amount) return;

    try {
      setSubmitting(true);
      setModalMessage(null);
      await api.createContraVoucher({
        ...contraForm,
        amount: parseFloat(contraForm.amount),
      });
      setActiveModal(null);
      fetchData();
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err.message || 'Failed to record contra transfer' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountForm.accountName) return;

    try {
      setSubmitting(true);
      setModalMessage(null);
      await api.createBankAccount({
        ...accountForm,
        accountType: accountForm.accountType as any,
        openingBalance: parseFloat(accountForm.openingBalance) || 0,
      });
      setActiveModal(null);
      setAccountForm({ accountName: '', accountType: 'BANK', accountNumber: '', ifscCode: '', branch: '', openingBalance: '0' });
      fetchData();
    } catch (err: any) {
      setModalMessage({ type: 'error', text: err.message || 'Failed to create bank account' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Banking & Cash Management Suite"
        subtitle="Manage bank accounts, petty cash ledgers, customer payment receipts, vendor payments, and contra transfers"
        onRefresh={fetchData}
        actionButton={
          <button
            onClick={() => setActiveModal('addAccount')}
            className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-tally-border text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>Add Bank/Cash Account</span>
          </button>
        }
      />

      <div className="px-8 mt-6 space-y-8">
        {/* STATS OVERVIEW CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-6 border border-emerald-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase">Total Liquidity</span>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <Landmark className="w-5 h-5" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mt-4 font-mono">
              {loading ? '...' : formatCurrency(metrics?.totalCombinedBalance)}
            </h2>
            <p className="text-xs text-emerald-400 mt-2 font-medium">Combined Bank & Cash Liquidity</p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-blue-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase">Bank Accounts Total</span>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <CreditCard className="w-5 h-5" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mt-4 font-mono">
              {loading ? '...' : formatCurrency(metrics?.totalBankBalance)}
            </h2>
            <p className="text-xs text-blue-400 mt-2 font-medium">Across all commercial bank accounts</p>
          </div>

          <div className="glass-card rounded-2xl p-6 border border-amber-500/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-tally-textMuted uppercase">Petty Cash Total</span>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Banknote className="w-5 h-5" />
              </div>
            </div>
            <h2 className="text-3xl font-bold text-white mt-4 font-mono">
              {loading ? '...' : formatCurrency(metrics?.totalCashBalance)}
            </h2>
            <p className="text-xs text-amber-400 mt-2 font-medium">Main & branch petty cash ledgers</p>
          </div>
        </div>

        {/* QUICK BANKING VOUCHER ACTIONS */}
        <div className="glass-card rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 border border-brand-500/30 bg-gradient-to-r from-tally-card to-tally-bg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">Banking Voucher Engine</h4>
              <p className="text-xs text-tally-textMuted">Record Customer Receipts, Vendor Payments & Contra transfers with custom dates</p>
            </div>
          </div>

          <div className="flex items-center flex-wrap gap-3">
            <button
              onClick={() => setActiveModal('receipt')}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-tally-bg font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-emerald-500/20"
            >
              <ArrowDownLeft className="w-4 h-4" />
              <span>Receive Customer Payment</span>
            </button>

            <button
              onClick={() => setActiveModal('payment')}
              className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-bold text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-blue-500/20"
            >
              <ArrowUpRight className="w-4 h-4" />
              <span>Pay Supplier Vendor</span>
            </button>

            <button
              onClick={() => setActiveModal('contra')}
              className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-tally-border text-gray-200 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors"
            >
              <Repeat className="w-4 h-4 text-purple-400" />
              <span>Contra Bank/Cash Transfer</span>
            </button>

            <button
              onClick={() => setIsLedgerModalOpen(true)}
              className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-brand-500/40 text-brand-400 font-bold text-xs py-2.5 px-4 rounded-xl transition-colors shadow-sm"
              title="View Account Ledger / Statement of Accounts for any party"
            >
              <FileText className="w-4 h-4" />
              <span>Party Ledger (Khata)</span>
            </button>
          </div>
        </div>

        {/* BANK ACCOUNTS DIRECTORY & RECENT VOUCHERS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Bank Accounts Grid (7 cols) - CLICK CARD TO OPEN DETAILED VIEW MODAL */}
          <div className="lg:col-span-7 glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-400" />
                  <span>Bank & Cash Accounts Directory</span>
                </h3>
                <p className="text-xs text-tally-textMuted mt-0.5">
                  Click any account card to view full transaction ledger and detailed analytics
                </p>
              </div>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-tally-textMuted">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="py-8 text-center text-sm text-tally-textMuted">No bank accounts configured yet.</div>
            ) : (
              <div className="space-y-4">
                {accounts.map((acc) => (
                  <div
                    key={acc.id}
                    onClick={() => openAccountDetails(acc.id)}
                    className="p-5 rounded-2xl bg-tally-bg/80 border border-tally-border hover:border-brand-500/60 hover:bg-tally-cardHover/60 cursor-pointer transition-all flex flex-wrap items-center justify-between gap-4 group"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-white group-hover:text-brand-400 transition-colors flex items-center gap-1.5">
                          <span>{acc.accountName}</span>
                          <Eye className="w-4 h-4 text-gray-500 group-hover:text-brand-400" />
                        </h4>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            acc.accountType === 'BANK'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {acc.accountType}
                        </span>
                      </div>

                      <div className="text-xs text-tally-textMuted mt-1 space-y-0.5">
                        {acc.accountNumber && (
                          <div className="font-mono">A/C: {acc.accountNumber} • IFSC: {acc.ifscCode || 'N/A'}</div>
                        )}
                        {acc.branch && <div>Branch: {acc.branch}</div>}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">
                        Current Liquidity
                      </span>
                      <span className="font-mono font-bold text-xl text-emerald-400">
                        {formatCurrency(acc.currentBalance)}
                      </span>
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        Opening: {formatCurrency(acc.openingBalance)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Vouchers Feed (5 cols) */}
          <div className="lg:col-span-5 glass-card rounded-2xl p-6">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-base text-white">Recent Banking Vouchers</h3>
            </div>

            {loading ? (
              <div className="py-8 text-center text-sm text-tally-textMuted">Loading vouchers...</div>
            ) : vouchers.length === 0 ? (
              <div className="py-8 text-center text-sm text-tally-textMuted">No banking vouchers recorded yet.</div>
            ) : (
              <div className="space-y-3">
                {vouchers.map((v) => (
                  <div
                    key={v.id}
                    onClick={() => setSelectedVoucher(v)}
                    className="p-3.5 rounded-xl bg-tally-bg/70 border border-tally-border space-y-1.5 cursor-pointer hover:border-brand-500/60 hover:bg-white/[0.04] transition-all group"
                    title="Click to view full voucher details, ledgers, and edit"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-brand-400 group-hover:text-brand-300">
                          {v.voucherNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            v.voucherType === 'RECEIPT'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : v.voucherType === 'PAYMENT'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {v.voucherType}
                        </span>
                      </div>
                      <span className="text-[10px] text-brand-400 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 font-semibold">
                        <Eye className="w-3 h-3" /> View & Edit
                      </span>
                    </div>

                    <p className="text-xs text-gray-200 font-semibold">{v.narration}</p>

                    <div className="flex items-center justify-between text-[11px] text-tally-textMuted pt-1 border-t border-tally-border/40">
                      <span>Date: {new Date(v.date).toLocaleDateString()}</span>
                      <span className="font-mono font-bold text-emerald-400 text-xs">{formatCurrency(v.amount)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* DETAILED BANK ACCOUNT INSPECTOR MODAL */}
      {selectedAccountDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8 space-y-6">
            <div className="flex items-center justify-between border-b border-tally-border pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-xl text-white">{selectedAccountDetails.accountName}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-mono font-bold ${
                      selectedAccountDetails.accountType === 'BANK'
                        ? 'bg-blue-500/20 text-blue-400'
                        : 'bg-amber-500/20 text-amber-400'
                    }`}
                  >
                    {selectedAccountDetails.accountType} ACCOUNT
                  </span>
                </div>
                <p className="text-xs text-tally-textMuted mt-1">
                  Full system ledger details, opening balances, & linked vouchers
                </p>
              </div>

              <div className="flex items-center gap-2">
                {!isEditingAccount && (
                  <>
                    <button
                      type="button"
                      onClick={startEditAccount}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Edit Account & Balances</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDeleteAccount}
                      className="px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
                <button
                  onClick={() => {
                    setSelectedAccountDetails(null);
                    setIsEditingAccount(false);
                  }}
                  className="p-1.5 rounded-xl bg-tally-bg text-gray-400 hover:text-white border border-tally-border"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {isEditingAccount ? (
              <form onSubmit={handleUpdateAccount} className="space-y-4 text-xs bg-tally-bg/60 p-4 rounded-xl border border-tally-border">
                <h4 className="font-bold text-sm text-white border-b border-tally-border pb-2 flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-blue-400" />
                  <span>Edit Account Details & Balances</span>
                </h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">Account Name *</label>
                    <input
                      type="text"
                      required
                      value={editAccountForm.accountName}
                      onChange={(e) => setEditAccountForm({ ...editAccountForm, accountName: e.target.value })}
                      className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">Current Balance (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={editAccountForm.currentBalance}
                      onChange={(e) => setEditAccountForm({ ...editAccountForm, currentBalance: e.target.value })}
                      className="w-full bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-emerald-300 font-mono font-bold text-xs focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">Opening Balance (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={editAccountForm.openingBalance}
                      onChange={(e) => setEditAccountForm({ ...editAccountForm, openingBalance: e.target.value })}
                      className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">Account Number</label>
                    <input
                      type="text"
                      value={editAccountForm.accountNumber}
                      onChange={(e) => setEditAccountForm({ ...editAccountForm, accountNumber: e.target.value })}
                      className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={editAccountForm.ifscCode}
                      onChange={(e) => setEditAccountForm({ ...editAccountForm, ifscCode: e.target.value })}
                      className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-white font-mono uppercase text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">Branch Name</label>
                    <input
                      type="text"
                      value={editAccountForm.branch}
                      onChange={(e) => setEditAccountForm({ ...editAccountForm, branch: e.target.value })}
                      className="w-full bg-tally-card border border-tally-border rounded-xl px-3 py-2 text-white text-xs focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-tally-border">
                  <button
                    type="button"
                    onClick={() => setIsEditingAccount(false)}
                    className="px-4 py-2 rounded-xl bg-tally-card text-gray-400 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingAccount}
                    className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold shadow-md flex items-center gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{savingAccount ? 'Saving...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="p-3 bg-tally-bg rounded-xl border border-tally-border">
                <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">Opening Balance</span>
                <span className="font-mono font-bold text-sm text-gray-300 mt-1 block">
                  {formatCurrency(selectedAccountDetails.openingBalance)}
                </span>
              </div>

              <div className="p-3 bg-tally-bg rounded-xl border border-tally-border">
                <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">Current Balance</span>
                <span className="font-mono font-bold text-base text-emerald-400 mt-1 block">
                  {formatCurrency(selectedAccountDetails.currentBalance)}
                </span>
              </div>

              <div className="p-3 bg-tally-bg rounded-xl border border-tally-border">
                <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">Total Money In</span>
                <span className="font-mono font-bold text-sm text-emerald-400 mt-1 block">
                  +{formatCurrency(selectedAccountDetails.analytics.totalMoneyIn)}
                </span>
              </div>

              <div className="p-3 bg-tally-bg rounded-xl border border-tally-border">
                <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">Total Money Out</span>
                <span className="font-mono font-bold text-sm text-blue-400 mt-1 block">
                  -{formatCurrency(selectedAccountDetails.analytics.totalMoneyOut)}
                </span>
              </div>
            </div>

            {/* ACCOUNT SPECIFICATIONS */}
            <div className="p-4 bg-tally-bg/60 rounded-xl border border-tally-border text-xs space-y-1.5">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="text-tally-textMuted">Account Number:</span> <span className="font-mono font-bold text-white">{selectedAccountDetails.accountNumber || 'N/A'}</span></div>
                <div><span className="text-tally-textMuted">IFSC Code:</span> <span className="font-mono font-bold text-white">{selectedAccountDetails.ifscCode || 'N/A'}</span></div>
                <div><span className="text-tally-textMuted">Branch Name:</span> <span className="font-medium text-white">{selectedAccountDetails.branch || 'N/A'}</span></div>
                <div><span className="text-tally-textMuted">System ID:</span> <span className="font-mono text-gray-400">{selectedAccountDetails.id}</span></div>
              </div>
            </div>

            {/* LINKED VOUCHERS TRANSACTION LEDGER */}
            <div>
              <h4 className="font-bold text-sm text-white mb-3 flex items-center justify-between">
                <span>Account Transaction Ledger</span>
                <span className="text-xs font-mono text-tally-textMuted">{selectedAccountDetails.vouchers.length} Vouchers Recorded</span>
              </h4>

              {selectedAccountDetails.vouchers.length === 0 ? (
                <div className="py-6 text-center text-xs text-tally-textMuted bg-tally-bg rounded-xl border border-tally-border">
                  No linked voucher transactions recorded for this account.
                </div>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                  {selectedAccountDetails.vouchers.map((v) => (
                    <div key={v.id} className="p-3 bg-tally-bg rounded-xl border border-tally-border flex items-center justify-between text-xs">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-brand-400">{v.voucherNumber}</span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold bg-tally-card text-purple-400">
                            {v.voucherType}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-300 font-medium mt-0.5">{v.narration}</p>
                      </div>

                      <div className="text-right">
                        <span className="font-mono font-bold text-white text-sm block">
                          {formatCurrency(v.amount)}
                        </span>
                        <span className="text-[10px] text-tally-textMuted block font-mono">
                          {new Date(v.date).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2">
              <button onClick={() => setSelectedAccountDetails(null)} className="px-5 py-2 rounded-xl bg-tally-bg border border-tally-border text-white font-bold text-xs hover:bg-tally-card">
                Close Details
              </button>
            </div>
          </>
        )}
          </div>
        </div>
      )}

      {/* QUICK ACTION MODALS */}
      {/* MODAL 1: RECEIVE CUSTOMER PAYMENT (WITH VOUCHER DATE & CUSTOMER AUTOCOMPLETE) */}
      {activeModal === 'receipt' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-400" />
                <span>Receive Customer Payment</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMessage && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-medium">
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleReceipt} className="space-y-4 text-xs">
              {/* CUSTOMER AUTOCOMPLETE DROPDOWN */}
              <div className="relative">
                <label className="block font-medium text-tally-textMuted mb-1 flex items-center justify-between">
                  <span>Customer / Business Name *</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Select from directory</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="Type or select Customer Name..."
                    value={receiptForm.customerName}
                    onFocus={() => setIsCustomerDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsCustomerDropdownOpen(false), 200)}
                    onChange={(e) => {
                      setReceiptForm({ ...receiptForm, customerName: e.target.value });
                      setCustomerSearchQuery(e.target.value);
                      setIsCustomerDropdownOpen(true);
                    }}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl pl-9 pr-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                  />
                  <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                </div>

                {isCustomerDropdownOpen && filteredCustomerOptions.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-tally-card border border-tally-border rounded-xl max-h-52 overflow-y-auto z-50 shadow-2xl divide-y divide-tally-border">
                    {filteredCustomerOptions.map((c, cIdx) => (
                      <button
                        key={cIdx}
                        type="button"
                        onMouseDown={() => {
                          setReceiptForm({ ...receiptForm, customerName: c.customerName });
                          setCustomerSearchQuery(c.customerName);
                          setIsCustomerDropdownOpen(false);
                        }}
                        className="w-full p-2.5 text-left hover:bg-tally-cardHover transition-colors flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-xs text-white">{c.customerName}</div>
                          <div className="text-[10px] text-tally-textMuted font-mono">
                            Phone: {c.customerPhone || 'N/A'} • GSTIN: {c.customerGstin || 'B2C'}
                          </div>
                        </div>
                        {c.outstandingBalance > 0 && (
                          <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                            Due: {formatCurrency(c.outstandingBalance)}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* VOUCHER DATE FIELD */}
              <div>
                <label className="block font-medium text-tally-textMuted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Voucher Transaction Date *</span>
                </label>
                <input
                  type="date"
                  required
                  value={receiptForm.date}
                  onChange={(e) => setReceiptForm({ ...receiptForm, date: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Destination Bank/Cash Account *</label>
                <select
                  value={receiptForm.bankAccountId}
                  onChange={(e) => setReceiptForm({ ...receiptForm, bankAccountId: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} (Balance: {formatCurrency(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="25000.00"
                    value={receiptForm.amount}
                    onChange={(e) => setReceiptForm({ ...receiptForm, amount: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Ref / UTR Number</label>
                  <input
                    type="text"
                    placeholder="NEFT-998811"
                    value={receiptForm.referenceNumber}
                    onChange={(e) => setReceiptForm({ ...receiptForm, referenceNumber: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Narration / Remark</label>
                <input
                  type="text"
                  placeholder="Customer payment received via NEFT"
                  value={receiptForm.narration}
                  onChange={(e) => setReceiptForm({ ...receiptForm, narration: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold shadow-md shadow-emerald-500/20">
                  {submitting ? 'Recording...' : 'Record Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VENDOR PAYMENT (WITH VOUCHER DATE) */}
      {activeModal === 'payment' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-blue-400" />
                <span>Pay Supplier Vendor</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMessage && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-medium">
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handlePayment} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Select Supplier Vendor *</label>
                <select
                  value={paymentForm.vendorId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, vendorId: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} (Payable: {formatCurrency(v.balance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* VOUCHER DATE FIELD */}
              <div>
                <label className="block font-medium text-tally-textMuted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  <span>Voucher Transaction Date *</span>
                </label>
                <input
                  type="date"
                  required
                  value={paymentForm.date}
                  onChange={(e) => setPaymentForm({ ...paymentForm, date: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Source Bank/Cash Account *</label>
                <select
                  value={paymentForm.bankAccountId}
                  onChange={(e) => setPaymentForm({ ...paymentForm, bankAccountId: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} (Balance: {formatCurrency(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              {/* TRANSFER PAYMENT MODE (NEFT / RTGS / IMPS / BANK) */}
              <div>
                <label className="block font-medium text-tally-textMuted mb-1 flex items-center justify-between">
                  <span>Transfer Payment Mode *</span>
                  <span className="text-[10px] text-blue-400 font-mono">NEFT / RTGS / IMPS / BANK</span>
                </label>
                <select
                  value={paymentForm.paymentMode}
                  onChange={(e) => setPaymentForm({ ...paymentForm, paymentMode: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                >
                  <option value="NEFT">NEFT (National Electronic Funds Transfer)</option>
                  <option value="RTGS">RTGS (Real Time Gross Settlement)</option>
                  <option value="IMPS">IMPS (Immediate Payment Service)</option>
                  <option value="BANK">BANK (Direct Wire / Online Banking)</option>
                  <option value="UPI">UPI (Unified Payments Interface)</option>
                  <option value="CHEQUE">CHEQUE (Demand Draft / Paper Cheque)</option>
                  <option value="CASH">CASH (Physical Petty Cash)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="10000.00"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Ref / UTR Number</label>
                  <input
                    type="text"
                    placeholder="UPI-774422"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Narration / Remark</label>
                <input
                  type="text"
                  placeholder="Part payment to supplier"
                  value={paymentForm.narration}
                  onChange={(e) => setPaymentForm({ ...paymentForm, narration: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-600/20">
                  {submitting ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: CONTRA TRANSFER (WITH VOUCHER DATE) */}
      {activeModal === 'contra' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Repeat className="w-5 h-5 text-purple-400" />
                <span>Contra Cash / Bank Transfer</span>
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMessage && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-medium">
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleContra} className="space-y-4 text-xs">
              {/* VOUCHER DATE FIELD */}
              <div>
                <label className="block font-medium text-tally-textMuted mb-1 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-purple-400" />
                  <span>Voucher Transaction Date *</span>
                </label>
                <input
                  type="date"
                  required
                  value={contraForm.date}
                  onChange={(e) => setContraForm({ ...contraForm, date: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">From Source Account *</label>
                <select
                  value={contraForm.fromBankAccountId}
                  onChange={(e) => setContraForm({ ...contraForm, fromBankAccountId: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} (Balance: {formatCurrency(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">To Destination Account *</label>
                <select
                  value={contraForm.toBankAccountId}
                  onChange={(e) => setContraForm({ ...contraForm, toBankAccountId: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.accountName} (Balance: {formatCurrency(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="5000.00"
                    value={contraForm.amount}
                    onChange={(e) => setContraForm({ ...contraForm, amount: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Ref Number</label>
                  <input
                    type="text"
                    placeholder="ATM-441122"
                    value={contraForm.referenceNumber}
                    onChange={(e) => setContraForm({ ...contraForm, referenceNumber: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Narration / Remark</label>
                <input
                  type="text"
                  placeholder="Cash withdrawal from bank for petty cash"
                  value={contraForm.narration}
                  onChange={(e) => setContraForm({ ...contraForm, narration: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20">
                  {submitting ? 'Transferring...' : 'Execute Contra Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD BANK ACCOUNT */}
      {activeModal === 'addAccount' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white">Add Bank or Cash Account</h3>
              <button onClick={() => setActiveModal(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalMessage && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-medium">
                {modalMessage.text}
              </div>
            )}

            <form onSubmit={handleAddAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Account Display Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. HDFC Main Operating Current A/C"
                  value={accountForm.accountName}
                  onChange={(e) => setAccountForm({ ...accountForm, accountName: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Account Type</label>
                  <select
                    value={accountForm.accountType}
                    onChange={(e) => setAccountForm({ ...accountForm, accountType: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  >
                    <option value="BANK">BANK (Commercial Account)</option>
                    <option value="CASH">CASH (Petty Cash Ledger)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="50000.00"
                    value={accountForm.openingBalance}
                    onChange={(e) => setAccountForm({ ...accountForm, openingBalance: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              {accountForm.accountType === 'BANK' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-medium text-tally-textMuted mb-1">Account Number</label>
                      <input
                        type="text"
                        placeholder="50200098765432"
                        value={accountForm.accountNumber}
                        onChange={(e) => setAccountForm({ ...accountForm, accountNumber: e.target.value })}
                        className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-tally-textMuted mb-1">IFSC Code</label>
                      <input
                        type="text"
                        placeholder="HDFC0001234"
                        value={accountForm.ifscCode}
                        onChange={(e) => setAccountForm({ ...accountForm, ifscCode: e.target.value })}
                        className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block font-medium text-tally-textMuted mb-1">Branch Name</label>
                    <input
                      type="text"
                      placeholder="Koramangala Branch"
                      value={accountForm.branch}
                      onChange={(e) => setAccountForm({ ...accountForm, branch: e.target.value })}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                </>
              )}

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setActiveModal(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-tally-bg font-bold shadow-md shadow-emerald-500/20">
                  {submitting ? 'Saving...' : 'Save Bank Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOUCHER DETAILS & EDIT MODAL */}
      <VoucherDetailsEditModal
        isOpen={!!selectedVoucher}
        onClose={() => setSelectedVoucher(null)}
        voucher={selectedVoucher}
        onVoucherUpdated={fetchData}
        onVoucherDeleted={fetchData}
      />

      {/* ACCOUNT LEDGER (KHATA) STATEMENT MODAL */}
      {isLedgerModalOpen && (
        <AccountLedgerModal
          isOpen={isLedgerModalOpen}
          onClose={() => setIsLedgerModalOpen(false)}
        />
      )}
    </div>
  );
}
