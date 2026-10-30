'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api, InventoryItem, formatCurrency } from '@/lib/api';
import {
  Boxes,
  Plus,
  Search,
  AlertCircle,
  Tag,
  DollarSign,
  TrendingDown,
  X,
  Pencil,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

export default function InventoryPage() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);

  // Add Item Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Edit Item Modal
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Delete Item Modal
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    unit: 'Pcs',
    purchasePrice: '',
    sellingPrice: '',
    taxRate: '18',
    minStockLevel: '5',
    currentQuantity: '0',
  });

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const data = await api.getInventory(filterLowStock);
      setInventory(data);
    } catch (err: any) {
      console.error('Failed to load inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [filterLowStock]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.sku || !formData.purchasePrice || !formData.sellingPrice) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await api.createItem({
        name: formData.name,
        sku: formData.sku,
        category: formData.category || undefined,
        unit: formData.unit || 'Pcs',
        purchasePrice: parseFloat(formData.purchasePrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        taxRate: parseFloat(formData.taxRate) || 18,
        minStockLevel: parseInt(formData.minStockLevel, 10) || 5,
        initialQuantity: parseFloat(formData.currentQuantity) || 0,
      });
      setIsAddModalOpen(false);
      resetForm();
      fetchInventory();
    } catch (err: any) {
      console.error('Failed to create item:', err);
      setModalError(err.message || 'Failed to create item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (item: InventoryItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      sku: item.sku,
      category: item.category || '',
      unit: item.unit || 'Pcs',
      purchasePrice: item.purchasePrice.toString(),
      sellingPrice: item.sellingPrice.toString(),
      taxRate: item.taxRate ? item.taxRate.toString() : '18',
      minStockLevel: item.minStockLevel ? item.minStockLevel.toString() : '5',
      currentQuantity: item.currentQuantity.toString(),
    });
    setModalError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem || !formData.name || !formData.sku) return;

    try {
      setSubmitting(true);
      setModalError(null);
      await api.updateItem(editingItem.id, {
        name: formData.name,
        sku: formData.sku,
        category: formData.category || undefined,
        unit: formData.unit || 'Pcs',
        purchasePrice: parseFloat(formData.purchasePrice),
        sellingPrice: parseFloat(formData.sellingPrice),
        taxRate: parseFloat(formData.taxRate) || 18,
        minStockLevel: parseInt(formData.minStockLevel, 10) || 5,
        currentQuantity: parseFloat(formData.currentQuantity) || 0,
      });
      setEditingItem(null);
      resetForm();
      fetchInventory();
    } catch (err: any) {
      console.error('Failed to update item:', err);
      setModalError(err.message || 'Failed to update item');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deletingItem) return;

    try {
      setDeleting(true);
      setModalError(null);
      await api.deleteItem(deletingItem.id);
      setDeletingItem(null);
      fetchInventory();
    } catch (err: any) {
      console.error('Failed to delete item:', err);
      setModalError(err.message || 'Failed to delete item');
    } finally {
      setDeleting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      sku: '',
      category: '',
      unit: 'Pcs',
      purchasePrice: '',
      sellingPrice: '',
      taxRate: '18',
      minStockLevel: '5',
      currentQuantity: '0',
    });
  };

  const filteredItems = inventory.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalInventoryValue = inventory.reduce((acc, item) => acc + item.totalPurchaseValue, 0);
  const lowStockCount = inventory.filter((item) => item.isLowStock).length;

  return (
    <div className="flex-1 pb-12">
      <Header
        title="Inventory & Stock Ledger"
        subtitle="Manage product catalog, edit stock levels, track minimum stock alerts, & valuation"
        onRefresh={fetchInventory}
        actionButton={
          <button
            onClick={() => {
              resetForm();
              setModalError(null);
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-tally-bg font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4 fill-tally-bg" />
            <span>Add Catalog Item</span>
          </button>
        }
      />

      <div className="px-8 mt-6 space-y-6">
        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card rounded-2xl p-5 border border-tally-border flex items-center justify-between">
            <div>
              <span className="text-xs text-tally-textMuted uppercase font-semibold block">Total Catalog Items</span>
              <span className="text-2xl font-bold text-white font-mono mt-1 block">{inventory.length}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
              <Boxes className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-tally-border flex items-center justify-between">
            <div>
              <span className="text-xs text-tally-textMuted uppercase font-semibold block">Total Inventory Valuation</span>
              <span className="text-2xl font-bold text-emerald-400 font-mono mt-1 block">
                {formatCurrency(totalInventoryValue)}
              </span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <div className="glass-card rounded-2xl p-5 border border-tally-border flex items-center justify-between">
            <div>
              <span className="text-xs text-tally-textMuted uppercase font-semibold block">Low Stock Alerts</span>
              <span className="text-2xl font-bold text-amber-400 font-mono mt-1 block">{lowStockCount} Items</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* SEARCH & FILTERS */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="relative max-w-md w-full">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Search items by name, SKU, or category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-tally-card border border-tally-border rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
            />
          </div>

          <button
            onClick={() => setFilterLowStock(!filterLowStock)}
            className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${
              filterLowStock
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : 'bg-tally-card border-tally-border text-gray-300 hover:text-white'
            }`}
          >
            {filterLowStock ? 'Showing Low Stock Only' : 'Filter Low Stock'}
          </button>
        </div>

        {/* INVENTORY TABLE */}
        <div className="glass-card rounded-2xl p-6">
          {loading ? (
            <div className="py-12 text-center text-sm text-tally-textMuted">Loading inventory catalog...</div>
          ) : filteredItems.length === 0 ? (
            <div className="py-12 text-center text-sm text-tally-textMuted">No inventory items found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-tally-border text-tally-textMuted uppercase font-semibold">
                    <th className="pb-3">Item & SKU</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3 text-right">Purchase Price</th>
                    <th className="pb-3 text-right">Selling Price</th>
                    <th className="pb-3 text-center">GST %</th>
                    <th className="pb-3 text-center">Stock Level</th>
                    <th className="pb-3 text-right">Stock Value</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-tally-border/60">
                  {filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-tally-cardHover/40">
                      <td className="py-3.5">
                        <div className="font-bold text-white text-sm">{item.name}</div>
                        <div className="text-[11px] font-mono text-tally-textMuted">{item.sku}</div>
                      </td>
                      <td className="py-3.5 font-medium text-gray-300">
                        {item.category || 'General'}
                      </td>
                      <td className="py-3.5 text-right font-mono text-gray-300">
                        {formatCurrency(item.purchasePrice)}
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-white">
                        {formatCurrency(item.sellingPrice)}
                      </td>
                      <td className="py-3.5 text-center font-mono text-gray-400">
                        {item.taxRate}%
                      </td>
                      <td className="py-3.5 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold ${
                            item.isLowStock
                              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}
                        >
                          {item.currentQuantity} {item.unit}
                        </span>
                      </td>
                      <td className="py-3.5 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(item.totalPurchaseValue)}
                      </td>
                      <td className="py-3.5 text-right space-x-1">
                        <button
                          onClick={() => handleEditOpen(item)}
                          title="Edit Item & Stock"
                          className="p-1.5 rounded-lg bg-tally-bg text-gray-400 hover:text-brand-400 hover:bg-tally-card border border-tally-border transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            setDeletingItem(item);
                            setModalError(null);
                          }}
                          title="Remove Item"
                          className="p-1.5 rounded-lg bg-tally-bg text-gray-400 hover:text-red-400 hover:bg-tally-card border border-tally-border transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: ADD ITEM */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white">Add Catalog Item</h3>
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
                <label className="block font-medium text-tally-textMuted mb-1">Item Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Logitech MX Master 3S Wireless Mouse"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="SKU-LOG-MX3S"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Category</label>
                  <input
                    type="text"
                    placeholder="Peripherals"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="6500.00"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="8999.00"
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">GST %</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="18"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    placeholder="5"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Initial Qty</label>
                  <input
                    type="number"
                    placeholder="10"
                    value={formData.currentQuantity}
                    onChange={(e) => setFormData({ ...formData, currentQuantity: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-tally-bg font-bold shadow">
                  {submitting ? 'Saving...' : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: EDIT ITEM & STOCK */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-brand-400" />
                <span>Edit Item: {editingItem.name}</span>
              </h3>
              <button onClick={() => setEditingItem(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
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
                <label className="block font-medium text-tally-textMuted mb-1">Item Name *</label>
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
                  <label className="block font-medium text-tally-textMuted mb-1">SKU Code *</label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Category</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">GST %</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.taxRate}
                    onChange={(e) => setFormData({ ...formData, taxRate: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Min Stock Alert</label>
                  <input
                    type="number"
                    value={formData.minStockLevel}
                    onChange={(e) => setFormData({ ...formData, minStockLevel: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-brand-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Stock Qty</label>
                  <input
                    type="number"
                    value={formData.currentQuantity}
                    onChange={(e) => setFormData({ ...formData, currentQuantity: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono font-bold text-emerald-400 focus:border-brand-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-end gap-3">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-tally-bg font-bold shadow">
                  {submitting ? 'Updating...' : 'Update Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DELETE CONFIRMATION */}
      {deletingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-4">
            <div className="flex items-center gap-3 text-red-400">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-bold text-base text-white">Remove Catalog Item?</h3>
            </div>

            <p className="text-xs text-tally-textMuted">
              Are you sure you want to remove <span className="text-white font-bold">{deletingItem.name}</span> ({deletingItem.sku}) from catalog?
            </p>

            {modalError && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded-xl text-xs">
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingItem(null)}
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
    </div>
  );
}
