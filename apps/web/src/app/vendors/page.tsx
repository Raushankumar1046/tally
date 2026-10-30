'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import AccountLedgerModal from '@/components/AccountLedgerModal';
import { api, Vendor, formatCurrency } from '@/lib/api';
import {
  Users,
  Plus,
  Search,
  Building,
  Phone,
  Mail,
  FileText,
  DollarSign,
  AlertCircle,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Add Vendor Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Vendor Modal
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  // Delete Vendor Modal
  const [deletingVendor, setDeletingVendor] = useState<Vendor | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Statement / Ledger Modal
  const [selectedLedgerVendor, setSelectedLedgerVendor] = useState<{ id?: string; name: string } | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gstin: '',
    address: '',
    balance: '0',
  });

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const data = await api.getVendors();
      setVendors(data);
    } catch (err: any) {
      console.error('Failed to load vendors:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVendors();
  }, []);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await api.createVendor({
        ...formData,
        balance: parseFloat(formData.balance) || 0,
      });
      setIsAddModalOpen(false);
      setFormData({ name: '', email: '', phone: '', gstin: '', address: '', balance: '0' });
      fetchVendors();
    } catch (err: any) {
      console.error('Failed to create vendor:', err);
      setModalError(err.message || 'Failed to create vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      email: vendor.email || '',
      phone: vendor.phone || '',
      gstin: vendor.gstin || '',
      address: vendor.address || '',
      balance: vendor.balance.toString(),
    });
    setModalError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVendor || !formData.name) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await api.updateVendor(editingVendor.id, {
        ...formData,
        balance: parseFloat(formData.balance) || 0,
      });
      setEditingVendor(null);
      setFormData({ name: '', email: '', phone: '', gstin: '', address: '', balance: '0' });
      fetchVendors();
    } catch (err: any) {
      console.error('Failed to update vendor:', err);
      setModalError(err.message || 'Failed to update vendor');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingVendor) return;

    try {
      setDeleting(true);
      setModalError(null);
      await api.deleteVendor(deletingVendor.id);
      setDeletingVendor(null);
      fetchVendors();
    } catch (err: any) {
      console.error('Failed to delete vendor:', err);
      setModalError(err.message || 'Failed to delete vendor');
    } finally {
      setDeleting(false);
    }
  };

  const filteredVendors = vendors.filter(
    (v) =>
      v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (v.gstin && v.gstin.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (v.email && v.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Vendor Directory & Payables"
        subtitle="Manage suppliers, track outstanding payables, and edit vendor details"
        onRefresh={fetchVendors}
        actionButton={
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedLedgerVendor({ name: '' })}
              className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover text-brand-400 border border-brand-500/40 font-bold py-2 px-3.5 rounded-xl text-xs transition-colors shadow-sm"
              title="Search and view Account Ledger Statement for any vendor or customer"
            >
              <FileText className="w-4 h-4" />
              <span>Statement / Ledger</span>
            </button>
            <button
              onClick={() => {
                setFormData({ name: '', email: '', phone: '', gstin: '', address: '', balance: '0' });
                setModalError(null);
                setIsAddModalOpen(true);
              }}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-tally-bg font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4 fill-tally-bg" />
              <span>Add New Vendor</span>
            </button>
          </div>
        }
      />

      <div className="px-8 mt-6 space-y-6">
        {/* SEARCH BAR */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search vendors by name, GSTIN, or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-tally-card border border-tally-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <div className="text-xs text-tally-textMuted font-mono font-medium">
            Total Suppliers: <span className="text-white font-bold">{vendors.length}</span>
          </div>
        </div>

        {/* VENDORS GRID */}
        {loading ? (
          <div className="py-12 text-center text-sm text-tally-textMuted">Loading vendor directory...</div>
        ) : filteredVendors.length === 0 ? (
          <div className="glass-card rounded-2xl p-12 text-center text-tally-textMuted space-y-3">
            <Users className="w-12 h-12 mx-auto text-tally-border stroke-1" />
            <p className="text-sm font-medium">No vendors found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVendors.map((vendor) => (
              <div
                key={vendor.id}
                className="glass-card rounded-2xl p-5 flex flex-col justify-between hover:border-brand-500/30 transition-all space-y-4 relative group"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-base text-white">{vendor.name}</h3>
                      <div className="text-xs text-tally-textMuted font-mono mt-0.5">
                        GSTIN: {vendor.gstin || 'Unregistered / B2C'}
                      </div>
                    </div>

                    {/* ACTION BUTTONS (EDIT & DELETE) */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleEditOpen(vendor)}
                        title="Edit Vendor"
                        className="p-1.5 rounded-lg bg-tally-bg text-gray-400 hover:text-brand-400 hover:bg-tally-card border border-tally-border transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          setDeletingVendor(vendor);
                          setModalError(null);
                        }}
                        title="Remove Vendor"
                        className="p-1.5 rounded-lg bg-tally-bg text-gray-400 hover:text-red-400 hover:bg-tally-card border border-tally-border transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-xs text-gray-300">
                    {vendor.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                        <span>{vendor.phone}</span>
                      </div>
                    )}
                    {vendor.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-brand-400 shrink-0" />
                        <span>{vendor.email}</span>
                      </div>
                    )}
                    {vendor.address && (
                      <div className="flex items-start gap-2">
                        <Building className="w-3.5 h-3.5 text-brand-400 shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{vendor.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-4 border-t border-tally-border flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-tally-textMuted uppercase font-semibold block">
                      Payable Balance
                    </span>
                    <span
                      className={`font-mono font-bold text-sm ${
                        Number(vendor.balance) > 0 ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {formatCurrency(vendor.balance)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-mono text-gray-400 hidden sm:inline">
                      {vendor._count?.purchases || 0} Orders
                    </span>
                    <button
                      onClick={() => setSelectedLedgerVendor({ id: vendor.id, name: vendor.name })}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-brand-500/10 hover:bg-brand-500/20 text-brand-400 border border-brand-500/30 text-xs font-semibold transition-colors"
                      title="View Khata / Account Ledger Statement for this vendor"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Ledger</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD VENDOR */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white">Add New Supplier Vendor</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Vendor / Business Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Tech Distributors"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">GSTIN Tax ID</label>
                  <input
                    type="text"
                    placeholder="27AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Opening Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Phone Number</label>
                  <input
                    type="text"
                    placeholder="+91 98765 43210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Email Address</label>
                  <input
                    type="email"
                    placeholder="sales@acme.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Full Address</label>
                <textarea
                  rows={2}
                  placeholder="102 Industrial Estate, Mumbai"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-tally-bg font-bold shadow">
                  {submitting ? 'Saving...' : 'Save Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT VENDOR */}
      {editingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-brand-400" />
                <span>Edit Vendor: {editingVendor.name}</span>
              </h3>
              <button onClick={() => setEditingVendor(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Vendor / Business Name *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">GSTIN Tax ID</label>
                  <input
                    type="text"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Payable Balance (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.balance}
                    onChange={(e) => setFormData({ ...formData, balance: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Full Address</label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setEditingVendor(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-tally-bg font-bold shadow">
                  {submitting ? 'Updating...' : 'Update Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-white">Remove Vendor?</h3>
            </div>

            <p className="text-xs text-tally-textMuted">
              Are you sure you want to remove <span className="text-white font-bold">{deletingVendor.name}</span> from your supplier directory? This action cannot be undone.
            </p>

            {modalError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingVendor(null)}
                className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs shadow"
              >
                {deleting ? 'Removing...' : 'Confirm Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL: ACCOUNT LEDGER STATEMENT (SCREENSHOT FORMAT) */}
      {selectedLedgerVendor && (
        <AccountLedgerModal
          isOpen={Boolean(selectedLedgerVendor)}
          onClose={() => setSelectedLedgerVendor(null)}
          initialAccountName={selectedLedgerVendor.name}
          initialVendorId={selectedLedgerVendor.id}
        />
      )}
    </div>
  );
}
