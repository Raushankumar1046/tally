'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import ThermalInvoiceModal from '@/components/ThermalInvoiceModal';
import { api, Item, Invoice, SequenceConfig, CustomerProfile, formatCurrency } from '@/lib/api';
import {
  Zap,
  Plus,
  Trash2,
  Search,
  ShoppingCart,
  CheckCircle2,
  AlertTriangle,
  Landmark,
  Banknote,
  QrCode,
  Calendar,
  Building,
  Hash,
  FileEdit,
  Clock,
  Printer,
  X,
  Save,
  DollarSign,
  Filter,
  User,
  Users,
  Edit3,
  Wrench,
} from 'lucide-react';

interface CartLine {
  item: Item;
  quantity: number;
  unitSellingPrice: number;
}

export default function BillingPOSPage() {
  const [activeTab, setActiveTab] = useState<'checkout' | 'pending'>('checkout');

  // Catalog & POS states
  const [items, setItems] = useState<Item[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [shippedAddress, setShippedAddress] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('Haryana (06)');
  const [poNumber, setPoNumber] = useState('By MAIL');
  const [poDate, setPoDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [paymentTerms, setPaymentTerms] = useState<string>('Against Delivery');
  const [sameAsBilled, setSameAsBilled] = useState(true);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'UPI' | 'BANK' | 'CREDIT'>('CASH');
  const [creditDays, setCreditDays] = useState<number>(15);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [sequenceConfig, setSequenceConfig] = useState<SequenceConfig | null>(null);

  // Customer Autocomplete States
  const [customerQuery, setCustomerQuery] = useState('');
  const [isCustomerFocused, setIsCustomerFocused] = useState(false);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerProfile[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);

  // Invoices & Pending Bills states
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [pendingFilter, setPendingFilter] = useState<'all' | 'pending' | 'paid'>('pending');
  const [selectedUpsertInvoice, setSelectedUpsertInvoice] = useState<Invoice | null>(null);
  const [upsertSubmitting, setUpsertSubmitting] = useState(false);
  const [upsertMessage, setUpsertMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Edit form states for Upsert modal
  const [editForm, setEditForm] = useState({
    customerName: '',
    customerPhone: '',
    customerGstin: '',
    customerAddress: '',
    shippedAddress: '',
    placeOfSupply: 'Haryana (06)',
    poNumber: 'By MAIL',
    paymentMode: 'CASH',
    creditDays: 30,
    outstandingBalance: 0,
  });

  interface EditLineItem {
    id?: string;
    itemId: string;
    name: string;
    sku?: string;
    quantity: number;
    unitSellingPrice: number;
    taxRate: number;
  }

  const [editItems, setEditItems] = useState<EditLineItem[]>([]);
  const [editSearchQuery, setEditSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [createdInvoice, setCreatedInvoice] = useState<Invoice | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [itemsData, seqData, invoiceList] = await Promise.all([
        api.getItems(),
        api.getSequenceConfig(),
        api.getInvoices(),
      ]);
      setItems(itemsData);
      setSequenceConfig(seqData);
      setAllInvoices(invoiceList);
    } catch (err: any) {
      console.error('Failed to load billing catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Customer Autocomplete Search
  useEffect(() => {
    if (isCustomerFocused) {
      const delayFn = setTimeout(async () => {
        try {
          setLoadingCustomers(true);
          const results = await api.getCustomers(customerQuery);
          setCustomerSuggestions(results);
        } catch (err) {
          console.error('Failed to search customers:', err);
        } finally {
          setLoadingCustomers(false);
        }
      }, 150);

      return () => clearTimeout(delayFn);
    }
  }, [customerQuery, isCustomerFocused]);

  const selectCustomer = (cust: CustomerProfile) => {
    setCustomerName(cust.customerName);
    setCustomerPhone(cust.customerPhone || '');
    setCustomerGstin(cust.customerGstin || '');
    setCustomerAddress(cust.customerAddress || '');
    setShippedAddress(cust.shippedAddress || cust.customerAddress || '');
    setSameAsBilled(true);
    setCustomerQuery(cust.customerName);
    setIsCustomerFocused(false);
  };

  // Filter items for search dropdown
  const filteredItems = items.filter(
    (item) =>
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (item: Item) => {
    const existingIndex = cart.findIndex((c) => c.item.id === item.id);
    if (existingIndex > -1) {
      const updated = [...cart];
      updated[existingIndex].quantity += 1;
      setCart(updated);
    } else {
      setCart([...cart, { item: { ...item }, quantity: 1, unitSellingPrice: Number(item.sellingPrice) }]);
    }
    setSearchQuery('');
    setErrorMessage(null);
  };

  const addCustomService = (serviceName = 'Service Charge') => {
    const cleanName = serviceName.trim() || 'Service Charge';
    const tempId = `temp-srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newItem: Item = {
      id: tempId,
      name: cleanName,
      sku: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
      category: 'Service',
      unit: 'Service',
      purchasePrice: 0,
      sellingPrice: 0,
      taxRate: 18,
      minStockLevel: 0,
      stock: {
        currentQuantity: 999999,
        updatedAt: new Date().toISOString(),
      },
    };

    setCart([...cart, { item: newItem, quantity: 1, unitSellingPrice: 0 }]);
    setSearchQuery('');
    setErrorMessage(null);
  };

  const updateCartItemName = (itemId: string, newName: string) => {
    setCart(
      cart.map((c) =>
        c.item.id === itemId
          ? { ...c, item: { ...c.item, name: newName } }
          : c
      )
    );
  };

  const updateCartItemTaxRate = (itemId: string, newTaxRate: number) => {
    setCart(
      cart.map((c) =>
        c.item.id === itemId
          ? { ...c, item: { ...c.item, taxRate: isNaN(newTaxRate) ? 0 : newTaxRate } }
          : c
      )
    );
  };

  const updateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      removeFromCart(itemId);
      return;
    }
    setCart(
      cart.map((c) => (c.item.id === itemId ? { ...c, quantity: newQty } : c))
    );
  };

  const updateUnitPrice = (itemId: string, newPrice: number) => {
    const validPrice = isNaN(newPrice) || newPrice < 0 ? 0 : newPrice;
    setCart(
      cart.map((c) => (c.item.id === itemId ? { ...c, unitSellingPrice: validPrice } : c))
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.item.id !== itemId));
  };

  // PRE-TAX BASE SUBTOTAL DISCOUNT GST MATH
  const grossSubtotal = cart.reduce((acc, line) => {
    return acc + line.unitSellingPrice * line.quantity;
  }, 0);

  const discountedSubtotal = Math.max(0, grossSubtotal - (discountAmount || 0));
  const taxRatio = grossSubtotal > 0 ? (discountedSubtotal / grossSubtotal) : 1;

  const taxAmount = cart.reduce((acc, line) => {
    const lineGross = line.unitSellingPrice * line.quantity;
    const lineDiscountedTaxable = lineGross * taxRatio;
    return acc + lineDiscountedTaxable * (Number(line.item.taxRate) / 100);
  }, 0);

  const netTotal = discountedSubtotal + taxAmount;

  // Compute estimated due date for credit mode
  const computedDueDate = new Date();
  computedDueDate.setDate(computedDueDate.getDate() + (creditDays || 15));

  const handleCheckout = async () => {
    if (cart.length === 0) {
      setErrorMessage('Please add at least one item to checkout');
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage(null);

      const processedItems = await Promise.all(
        cart.map(async (line) => {
          let realItemId = line.item.id;
          const originalItem = items.find((i) => i.id === line.item.id);
          const nameHasChanged = originalItem && originalItem.name !== line.item.name;

          if (line.item.id.startsWith('temp-srv-') || nameHasChanged) {
            const created = await api.createItem({
              name: line.item.name || 'Service Charge',
              sku: `SRV-${Math.floor(100000 + Math.random() * 900000)}`,
              category: line.item.category || 'Service',
              unit: line.item.unit || 'Service',
              purchasePrice: 0,
              sellingPrice: line.unitSellingPrice,
              taxRate: Number(line.item.taxRate) || 18,
              minStockLevel: 0,
              initialQuantity: 999999,
            });
            realItemId = created.id;
          }

          return {
            itemId: realItemId,
            quantity: line.quantity,
            unitSellingPrice: line.unitSellingPrice,
          };
        })
      );

      const payload = {
        customerName: customerName || 'Walk-in Customer',
        customerPhone: customerPhone || undefined,
        customerGstin: customerGstin || undefined,
        customerAddress: customerAddress || undefined,
        shippedAddress: (sameAsBilled ? customerAddress : shippedAddress) || undefined,
        placeOfSupply: placeOfSupply || 'Haryana (06)',
        poNumber: poNumber || 'By MAIL',
        poDate: poDate || undefined,
        paymentTerms: paymentTerms || undefined,
        paymentMode,
        creditDays: paymentMode === 'CREDIT' ? creditDays : undefined,
        discountAmount,
        items: processedItems,
      };

      const invoice = await api.createInvoice(payload);
      setCreatedInvoice(invoice);

      // Reset Form & Refetch stock levels & next sequence
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setCustomerGstin('');
      setCustomerAddress('');
      setShippedAddress('');
      setSameAsBilled(true);
      setCustomerQuery('');
      setDiscountAmount(0);
      fetchData();
    } catch (err: any) {
      console.error('Checkout failed:', err);
      setErrorMessage(err.message || 'Failed to complete checkout');
    } finally {
      setSubmitting(false);
    }
  };

  // UPSERT OPERATION FOR PENDING BILLS
  const openUpsertModal = (inv: Invoice) => {
    setSelectedUpsertInvoice(inv);
    setEditForm({
      customerName: inv.customerName || '',
      customerPhone: inv.customerPhone || '',
      customerGstin: inv.customerGstin || '',
      customerAddress: inv.customerAddress || '',
      shippedAddress: inv.shippedAddress || '',
      placeOfSupply: inv.placeOfSupply || 'Uttar Pradesh, Code : 09',
      poNumber: inv.poNumber || 'By MAIL',
      paymentMode: inv.paymentMode || 'CASH',
      creditDays: inv.creditDays || 30,
      outstandingBalance: Number(inv.outstandingBalance || 0),
    });

    const initialLines: EditLineItem[] = (inv.items || []).map((line) => ({
      id: line.id,
      itemId: line.itemId,
      name: line.item?.name || 'Stock Item',
      sku: line.item?.sku || '',
      quantity: Number(line.quantity),
      unitSellingPrice: Number(line.unitSellingPrice),
      taxRate: Number(line.taxRate || line.item?.taxRate || 18),
    }));
    setEditItems(initialLines);
    setEditSearchQuery('');
    setUpsertMessage(null);
  };

  const handleUpdateEditItemQuantity = (index: number, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveEditItem(index);
      return;
    }
    const updated = [...editItems];
    updated[index].quantity = newQty;
    setEditItems(updated);
  };

  const handleUpdateEditItemPrice = (index: number, newPrice: number) => {
    const updated = [...editItems];
    updated[index].unitSellingPrice = isNaN(newPrice) || newPrice < 0 ? 0 : newPrice;
    setEditItems(updated);
  };

  const handleUpdateEditItemName = (index: number, newName: string) => {
    const updated = [...editItems];
    updated[index].name = newName;
    setEditItems(updated);
  };

  const handleRemoveEditItem = (index: number) => {
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleAddCatalogItemToEdit = (catItem: Item) => {
    setEditItems([
      ...editItems,
      {
        itemId: catItem.id,
        name: catItem.name,
        sku: catItem.sku,
        quantity: 1,
        unitSellingPrice: Number(catItem.sellingPrice),
        taxRate: Number(catItem.taxRate || 18),
      },
    ]);
  };

  const handleAddCustomServiceToEdit = (serviceName: string) => {
    const cleanName = serviceName.trim() || 'Service Charge';
    setEditItems([
      ...editItems,
      {
        itemId: `temp-srv-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        sku: `SRV-${Math.floor(1000 + Math.random() * 9000)}`,
        quantity: 1,
        unitSellingPrice: 0,
        taxRate: 18,
      },
    ]);
  };

  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!window.confirm(`⚠️ Are you sure you want to delete Invoice ${inv.invoiceNumber}?\n\nIt will be moved to the Recycle Bin where it can be restored at any time with 1 click. Item stock quantities will be restored.`)) {
      return;
    }

    try {
      await api.deleteInvoice(inv.id);
      if (createdInvoice?.id === inv.id) setCreatedInvoice(null);
      if (selectedUpsertInvoice?.id === inv.id) setSelectedUpsertInvoice(null);
      fetchData();
      alert(`🗑️ Invoice ${inv.invoiceNumber} moved to Recycle Bin! You can restore it anytime from the Recycle Bin menu.`);
    } catch (err: any) {
      console.error('Delete invoice failed:', err);
      alert(err.message || 'Failed to delete invoice');
    }
  };

  const handleUpsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUpsertInvoice) return;

    if (editItems.length === 0) {
      setUpsertMessage({ type: 'error', text: 'An invoice must have at least one line item!' });
      return;
    }

    try {
      setUpsertSubmitting(true);
      setUpsertMessage(null);

      const updated = await api.upsertInvoice(selectedUpsertInvoice.id, {
        customerName: editForm.customerName,
        customerPhone: editForm.customerPhone,
        customerGstin: editForm.customerGstin,
        customerAddress: editForm.customerAddress,
        shippedAddress: editForm.shippedAddress,
        placeOfSupply: editForm.placeOfSupply,
        poNumber: editForm.poNumber,
        paymentMode: editForm.paymentMode as any,
        creditDays: editForm.creditDays,
        outstandingBalance: editForm.outstandingBalance,
        items: editItems.map((line) => ({
          itemId: line.itemId,
          name: line.name,
          quantity: line.quantity,
          unitSellingPrice: line.unitSellingPrice,
          taxRate: line.taxRate,
        })),
      });

      setUpsertMessage({ type: 'success', text: '🎉 Invoice details & items successfully updated and saved!' });
      setSelectedUpsertInvoice(updated);
      fetchData();
    } catch (err: any) {
      console.error('Failed to upsert invoice:', err);
      setUpsertMessage({ type: 'error', text: err.message || 'Failed to update invoice' });
    } finally {
      setUpsertSubmitting(false);
    }
  };

  // Filtered pending invoices
  const filteredPendingInvoices = allInvoices.filter((inv) => {
    const isPending = Number(inv.outstandingBalance || 0) > 0 || inv.paymentMode === 'CREDIT';
    if (pendingFilter === 'pending') return isPending;
    if (pendingFilter === 'paid') return !isPending;
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-0 pb-12">
      <Header
        title="Fast Billing POS & Pending Bills Suite"
        subtitle="Tally-style rapid checkout, dynamic FY invoice prefixes, & pending bills upsert ledger"
        onRefresh={fetchData}
      />

      {/* DUAL-TAB NAVIGATION BAR */}
      <div className="px-8 mt-4 border-b border-tally-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setActiveTab('checkout')}
            className={`py-3 px-5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'checkout'
                ? 'border-brand-500 text-brand-400 bg-brand-500/10 rounded-t-xl'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>Fast Billing POS Checkout</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3 px-5 font-bold text-xs flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'pending'
                ? 'border-purple-500 text-purple-400 bg-purple-500/10 rounded-t-xl'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pending & Credit Bills Ledger</span>
            {allInvoices.filter((i) => Number(i.outstandingBalance || 0) > 0).length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-400 font-mono font-bold">
                {allInvoices.filter((i) => Number(i.outstandingBalance || 0) > 0).length} Pending
              </span>
            )}
          </button>
        </div>

        {sequenceConfig && (
          <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1.5">
            <Hash className="w-4 h-4" /> Next Ref: {sequenceConfig.previewInvoice}
          </div>
        )}
      </div>

      {/* TAB 1: FAST BILLING CHECKOUT (POS) */}
      {activeTab === 'checkout' && (
        <div className="flex-1 p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT COLUMN: ITEM SEARCH & CART GRID (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* SEARCH PANEL */}
            <div className="glass-card rounded-2xl p-5 border border-brand-500/20">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-tally-textMuted uppercase tracking-wider">
                  Search Item by Name or SKU
                </h3>
                <button
                  type="button"
                  onClick={() => addCustomService(searchQuery || 'Service Charge')}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-1.5 border border-emerald-500/30 transition-all cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <Wrench className="w-3.5 h-3.5" />
                  <span>+ Add Custom Service / Charge</span>
                </button>
              </div>

              <div className="relative">
                <Search className="w-5 h-5 text-gray-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  placeholder="Type item name, service charge or SKU code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl pl-12 pr-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>

              {/* Dropdown Results */}
              {searchQuery && (
                <div className="mt-2 bg-tally-card border border-tally-border rounded-xl max-h-60 overflow-y-auto divide-y divide-tally-border z-10 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => addCustomService(searchQuery)}
                    className="w-full p-3 text-left bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center justify-between border-b border-emerald-500/20 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-emerald-400" />
                      <span>Add "{searchQuery}" as Custom Service / Charge Line Item</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 text-[10px] font-mono font-bold">
                      + CUSTOM SERVICE
                    </span>
                  </button>

                  {filteredItems.length === 0 ? (
                    <div className="p-4 text-xs text-tally-textMuted text-center">
                      No catalog items matching "{searchQuery}". Click above to add as custom service charge!
                    </div>
                  ) : (
                    filteredItems.map((item) => {
                      const currentQty = item.stock ? Number(item.stock.currentQuantity) : 0;
                      const isOut = currentQty <= 0 && item.category !== 'Service';

                      return (
                        <button
                          key={item.id}
                          disabled={isOut}
                          onClick={() => addToCart(item)}
                          className={`w-full p-3 text-left flex items-center justify-between transition-colors ${
                            isOut
                              ? 'opacity-50 cursor-not-allowed bg-tally-bg/40'
                              : 'hover:bg-tally-cardHover'
                          }`}
                        >
                          <div>
                            <div className="font-bold text-sm text-white">{item.name}</div>
                            <div className="text-xs text-tally-textMuted font-mono">
                              {item.sku} • Default Selling: {formatCurrency(item.sellingPrice)} (GST {item.taxRate}%)
                            </div>
                          </div>

                          <div className="text-right">
                            <span
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                                currentQty <= item.minStockLevel && item.category !== 'Service'
                                  ? 'bg-red-500/20 text-red-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {item.category === 'Service'
                                ? 'Unlimited Service'
                                : isOut
                                ? 'Out of Stock'
                                : `${currentQty} ${item.unit} available`}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>

            {/* ACTIVE CART GRID WITH EDITABLE UNIT PRICE INPUT */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-brand-400" />
                  <span>Selected Billing Items</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-mono font-bold">
                    {cart.length} Lines
                  </span>
                </h3>

                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-xs text-red-400 hover:underline"
                  >
                    Clear All
                  </button>
                )}
              </div>

              {cart.length === 0 ? (
                <div className="py-12 text-center text-tally-textMuted space-y-3">
                  <Zap className="w-12 h-12 mx-auto text-tally-border stroke-1" />
                  <p className="text-sm font-medium">Your billing cart is empty</p>
                  <p className="text-xs text-gray-500">
                    Search and click catalog items above to build customer invoice
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-tally-border text-tally-textMuted uppercase">
                        <th className="pb-3 font-semibold">Editable Item / Service Name</th>
                        <th className="pb-3 font-semibold text-center">Editable Unit Price (₹)</th>
                        <th className="pb-3 font-semibold text-center">Quantity</th>
                        <th className="pb-3 font-semibold text-center">GST %</th>
                        <th className="pb-3 font-semibold text-right">Line Total</th>
                        <th className="pb-3 text-right"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tally-border/60">
                      {cart.map((line) => {
                        const linePrice = line.unitSellingPrice;
                        const lineTax = Number(line.item.taxRate || 18);
                        const lineGrossTotal = linePrice * line.quantity * (1 + lineTax / 100);

                        return (
                          <tr key={line.item.id} className="hover:bg-tally-cardHover/40">
                            {/* EDITABLE ITEM / SERVICE NAME INPUT */}
                            <td className="py-3 pr-2">
                              <input
                                type="text"
                                value={line.item.name}
                                onChange={(e) => updateCartItemName(line.item.id, e.target.value)}
                                placeholder="Enter item or service charge description..."
                                className="w-full bg-tally-bg border border-tally-border focus:border-brand-500 rounded-lg px-2.5 py-1.5 text-white font-bold text-xs focus:outline-none"
                              />
                              <div className="text-[10px] font-mono text-tally-textMuted mt-1 flex items-center gap-2">
                                <span>SKU: {line.item.sku}</span>
                                {line.item.category === 'Service' && (
                                  <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-400 font-bold font-mono text-[9px]">
                                    SERVICE CHARGE
                                  </span>
                                )}
                              </div>
                            </td>
                            {/* EDITABLE UNIT PRICE INPUT */}
                            <td className="py-3 text-center">
                              <div className="inline-flex items-center gap-1 bg-tally-bg border border-tally-border rounded-lg px-2 py-1">
                                <span className="text-gray-400 font-mono">₹</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={line.unitSellingPrice}
                                  onChange={(e) =>
                                    updateUnitPrice(line.item.id, parseFloat(e.target.value))
                                  }
                                  className="w-20 bg-transparent text-center text-white font-bold font-mono focus:outline-none focus:text-brand-400"
                                />
                              </div>
                            </td>
                            <td className="py-3 text-center">
                              <div className="inline-flex items-center border border-tally-border rounded-lg bg-tally-bg overflow-hidden">
                                <button
                                  onClick={() => updateQuantity(line.item.id, line.quantity - 1)}
                                  className="px-2 py-1 text-gray-400 hover:text-white hover:bg-tally-card"
                                >
                                  -
                                </button>
                                <input
                                  type="number"
                                  min="1"
                                  value={line.quantity}
                                  onChange={(e) =>
                                    updateQuantity(line.item.id, parseInt(e.target.value, 10) || 1)
                                  }
                                  className="w-12 text-center bg-transparent text-white font-bold font-mono focus:outline-none"
                                />
                                <button
                                  onClick={() => updateQuantity(line.item.id, line.quantity + 1)}
                                  className="px-2 py-1 text-gray-400 hover:text-white hover:bg-tally-card"
                                >
                                  +
                                </button>
                              </div>
                            </td>
                            {/* EDITABLE GST TAX RATE SELECTOR */}
                            <td className="py-3 text-center">
                              <select
                                value={line.item.taxRate}
                                onChange={(e) => updateCartItemTaxRate(line.item.id, parseFloat(e.target.value))}
                                className="bg-tally-bg border border-tally-border rounded-lg px-1.5 py-1 text-xs text-white font-mono focus:outline-none focus:border-brand-500"
                              >
                                <option value={0}>0%</option>
                                <option value={5}>5%</option>
                                <option value={12}>12%</option>
                                <option value={18}>18%</option>
                                <option value={28}>28%</option>
                              </select>
                            </td>
                            <td className="py-3 text-right font-mono font-bold text-emerald-400">
                              {formatCurrency(lineGrossTotal)}
                            </td>
                            <td className="py-3 text-right">
                              <button
                                onClick={() => removeFromCart(line.item.id)}
                                className="text-gray-500 hover:text-red-400 p-1"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: CHECKOUT SUMMARY (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="glass-card rounded-2xl p-6 border border-brand-500/30 sticky top-24">
              <h3 className="font-bold text-lg text-white border-b border-tally-border pb-4 mb-4 flex items-center justify-between">
                <span>Bill Checkout Summary</span>
                <span className="font-mono text-xs text-brand-400 px-2.5 py-1 rounded bg-brand-500/10">
                  Tally POS V3
                </span>
              </h3>

              {/* Error Notification */}
              {errorMessage && (
                <div className="mb-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-red-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="font-medium">{errorMessage}</div>
                </div>
              )}

              {/* CUSTOMER DETAILS WITH REAL-TIME AUTOCOMPLETE & AUTO-FILL */}
              <div className="space-y-3 mb-6 relative">
                <div className="relative">
                  <label className="block text-xs font-medium text-tally-textMuted mb-1 flex items-center justify-between">
                    <span>Customer / Vendor / Business Name</span>
                    <span className="text-[10px] text-brand-400 font-mono">Type to search existing</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type Customer or Vendor Name to autofill..."
                      value={customerName}
                      onFocus={() => setIsCustomerFocused(true)}
                      onBlur={() => setTimeout(() => setIsCustomerFocused(false), 200)}
                      onChange={(e) => {
                        setCustomerName(e.target.value);
                        setCustomerQuery(e.target.value);
                        setIsCustomerFocused(true);
                      }}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl pl-9 pr-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                    <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
                  </div>

                  {/* CUSTOMER & VENDOR AUTOCOMPLETE DROPDOWN */}
                  {isCustomerFocused && customerSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-tally-card border border-tally-border rounded-xl max-h-60 overflow-y-auto z-40 shadow-2xl divide-y divide-tally-border">
                      {customerSuggestions.map((cust, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onMouseDown={() => selectCustomer(cust)}
                          className="w-full p-2.5 text-left hover:bg-tally-cardHover transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-xs text-white truncate">{cust.customerName}</div>
                            <div className="text-[10px] text-tally-textMuted font-mono truncate">
                              Phone: {cust.customerPhone || 'N/A'} • GSTIN: {cust.customerGstin || 'B2C Retail'}
                            </div>
                            {cust.customerAddress && (
                              <div className="text-[9.5px] text-gray-400 truncate italic mt-0.5">
                                Addr: {cust.customerAddress}
                              </div>
                            )}
                          </div>
                          <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                            cust.type === 'VENDOR'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                              : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          }`}>
                            {cust.type === 'VENDOR' ? 'REGISTERED VENDOR' : 'PAST CUSTOMER'}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-tally-textMuted mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 98000 00000"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tally-textMuted mb-1">
                      Customer GSTIN (B2B)
                    </label>
                    <input
                      type="text"
                      placeholder="27AAACT9999K1Z2"
                      value={customerGstin}
                      onChange={(e) => setCustomerGstin(e.target.value)}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase placeholder-gray-500 focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-tally-textMuted mb-1">
                      Place of Supply (Editable)
                    </label>
                    <input
                      type="text"
                      placeholder="Haryana (06)"
                      value={placeOfSupply}
                      onChange={(e) => setPlaceOfSupply(e.target.value)}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tally-textMuted mb-1">
                      PO. No. (Editable)
                    </label>
                    <input
                      type="text"
                      placeholder="By MAIL"
                      value={poNumber}
                      onChange={(e) => setPoNumber(e.target.value)}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-tally-textMuted mb-1">
                      PO. Date (Editable)
                    </label>
                    <input
                      type="date"
                      value={poDate}
                      onChange={(e) => setPoDate(e.target.value)}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-tally-textMuted mb-1">
                      Payment Terms (Editable)
                    </label>
                    <input
                      type="text"
                      placeholder="Against Delivery"
                      value={paymentTerms}
                      onChange={(e) => setPaymentTerms(e.target.value)}
                      className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                {/* BILLED TO ADDRESS INPUT */}
                <div>
                  <label className="block text-xs font-medium text-tally-textMuted mb-1 flex items-center justify-between">
                    <span>Billed To Address</span>
                    <span className="text-[10px] text-gray-400">Street, City, State, Pincode</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter billing address (e.g. 46/4 Sector 14, Gurgaon, Haryana 122001)..."
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none"
                  />
                </div>

                {/* SAME AS BILLED CHECKBOX & SHIPPED TO ADDRESS INPUT */}
                <div className="space-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-tally-textMuted select-none">
                    <input
                      type="checkbox"
                      checked={sameAsBilled}
                      onChange={(e) => setSameAsBilled(e.target.checked)}
                      className="w-4 h-4 rounded border-tally-border bg-tally-bg text-brand-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Shipped To address is same as Billed To address</span>
                  </label>

                  {!sameAsBilled && (
                    <div>
                      <label className="block text-xs font-medium text-tally-textMuted mb-1">
                        Shipped To Address (Different Delivery Destination)
                      </label>
                      <textarea
                        rows={2}
                        placeholder="Enter different shipping address..."
                        value={shippedAddress}
                        onChange={(e) => setShippedAddress(e.target.value)}
                        className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 resize-none"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* PAYMENT MODE SELECTION */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-tally-textMuted mb-2">
                  Payment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { mode: 'CASH', label: 'Cash', icon: Banknote },
                    { mode: 'UPI', label: 'UPI / QR', icon: QrCode },
                    { mode: 'BANK', label: 'Bank', icon: Landmark },
                    { mode: 'CREDIT', label: 'Credit', icon: Calendar },
                  ].map(({ mode, label, icon: Icon }) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPaymentMode(mode as any)}
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-bold transition-all ${
                        paymentMode === mode
                          ? 'bg-brand-500/20 border-brand-500 text-brand-400'
                          : 'bg-tally-bg border-tally-border text-gray-400 hover:bg-tally-cardHover'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span>{label}</span>
                    </button>
                  ))}
                </div>

                {/* CREDIT DAYS & DUE DATE COMPUTATION */}
                {paymentMode === 'CREDIT' && (
                  <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="font-semibold text-amber-400">Credit Days Allowed:</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="15"
                        value={creditDays}
                        onChange={(e) => setCreditDays(parseInt(e.target.value, 10) || 15)}
                        className="w-20 bg-tally-bg border border-tally-border rounded-lg px-2 py-1 text-center font-mono font-bold text-white"
                      />
                    </div>
                    <div className="flex justify-between text-[11px] text-gray-300 pt-1 border-t border-amber-500/20">
                      <span>Calculated Due Date:</span>
                      <span className="font-mono font-bold text-amber-400">
                        {computedDueDate.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* DISCOUNT INPUT (PRE-TAX BASE SUBTOTAL DISCOUNT) */}
              <div className="mb-6">
                <label className="block text-xs font-medium text-tally-textMuted mb-1 flex items-center justify-between">
                  <span>Pre-Tax Base Subtotal Discount (₹)</span>
                  <span className="text-[10px] text-emerald-400 font-mono">Deducted before GST Tax</span>
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="0.00"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* PRICE BREAKDOWN (ACCURATE PRE-TAX GST MATH) */}
              <div className="space-y-2 border-t border-tally-border pt-4 text-xs font-medium text-gray-300">
                <div className="flex justify-between">
                  <span>Gross Base Subtotal:</span>
                  <span className="font-mono text-white">{formatCurrency(grossSubtotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Base Subtotal Discount:</span>
                    <span className="font-mono">-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-gray-200">
                  <span>Discounted Taxable Subtotal:</span>
                  <span className="font-mono text-white font-bold">{formatCurrency(discountedSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>GST Tax (on Taxable Subtotal):</span>
                  <span className="font-mono text-white">{formatCurrency(taxAmount)}</span>
                </div>
                <div className="flex justify-between border-t border-tally-border pt-3 text-base font-bold text-white">
                  <span>Net Total Payable:</span>
                  <span className="font-mono text-brand-400 text-xl">{formatCurrency(netTotal)}</span>
                </div>
              </div>

              {/* FINAL SUBMIT BUTTON */}
              <button
                onClick={handleCheckout}
                disabled={submitting || cart.length === 0}
                className={`w-full mt-6 py-4 px-6 rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg transition-all ${
                  cart.length === 0 || submitting
                    ? 'bg-tally-border text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-tally-bg shadow-brand-500/25 hover:shadow-brand-500/40'
                }`}
              >
                <Zap className="w-5 h-5 fill-tally-bg" />
                <span>{submitting ? 'Processing Transaction...' : 'Complete & Print Bill'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PENDING & CREDIT BILLS LEDGER (UPSERT ENGINE) */}
      {activeTab === 'pending' && (
        <div className="flex-1 p-8 space-y-6">
          <div className="glass-card rounded-2xl p-6">
            <div className="flex flex-wrap items-center justify-between border-b border-tally-border pb-4 mb-4 gap-4">
              <div>
                <h3 className="font-bold text-base text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-400" />
                  <span>Pending Bills & Credit Customer Accounts</span>
                </h3>
                <p className="text-xs text-tally-textMuted mt-0.5">
                  Perform real-time upsert operations to update customer info, credit status, and payment receipts
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="text-tally-textMuted">Filter:</span>
                {[
                  { id: 'pending', label: 'Pending Only' },
                  { id: 'all', label: 'All Invoices' },
                  { id: 'paid', label: 'Paid Only' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setPendingFilter(f.id as any)}
                    className={`px-3 py-1.5 rounded-lg border transition-all ${
                      pendingFilter === f.id
                        ? 'bg-purple-500/20 border-purple-500 text-purple-400'
                        : 'bg-tally-bg border-tally-border text-gray-400 hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <div className="py-12 text-center text-sm text-tally-textMuted">Loading invoices...</div>
            ) : filteredPendingInvoices.length === 0 ? (
              <div className="py-12 text-center text-sm text-tally-textMuted">No invoices found matching current filter.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-tally-border text-tally-textMuted uppercase">
                      <th className="pb-3 font-semibold">Ref Number</th>
                      <th className="pb-3 font-semibold">Customer & GSTIN</th>
                      <th className="pb-3 font-semibold text-center">Payment Mode</th>
                      <th className="pb-3 font-semibold text-center">Due Date</th>
                      <th className="pb-3 font-semibold text-right">Total Amount</th>
                      <th className="pb-3 font-semibold text-right">Outstanding</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tally-border/60">
                    {filteredPendingInvoices.map((inv) => {
                      const out = Number(inv.outstandingBalance || 0);
                      const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && out > 0;

                      return (
                        <tr key={inv.id} className="hover:bg-tally-cardHover/40">
                          <td className="py-3.5 font-mono font-bold text-brand-400">
                            {inv.invoiceNumber}
                          </td>
                          <td className="py-3.5">
                            <div className="font-bold text-white text-sm">{inv.customerName || 'Walk-in Customer'}</div>
                            <div className="text-[11px] text-tally-textMuted font-mono">
                              GSTIN: {inv.customerGstin || 'B2C Retail'}
                            </div>
                          </td>
                          <td className="py-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                                inv.paymentMode === 'CREDIT'
                                  ? 'bg-amber-500/20 text-amber-400'
                                  : 'bg-emerald-500/20 text-emerald-400'
                              }`}
                            >
                              {inv.paymentMode}
                            </span>
                          </td>
                          <td className="py-3.5 text-center font-mono">
                            {inv.dueDate ? (
                              <span className={isOverdue ? 'text-red-400 font-bold' : 'text-gray-300'}>
                                {new Date(inv.dueDate).toLocaleDateString()}
                              </span>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="py-3.5 text-right font-mono font-bold text-white">
                            {formatCurrency(inv.totalAmount)}
                          </td>
                          <td className="py-3.5 text-right font-mono font-bold">
                            <span className={out > 0 ? 'text-red-400' : 'text-emerald-400'}>
                              {formatCurrency(out)}
                            </span>
                          </td>
                          <td className="py-3.5 text-right space-x-2">
                            <button
                              onClick={() => setCreatedInvoice(inv)}
                              className="px-2.5 py-1 rounded-lg bg-tally-bg border border-tally-border hover:bg-tally-card text-gray-300 font-bold text-[11px] inline-flex items-center gap-1"
                            >
                              <Printer className="w-3.5 h-3.5" /> Print
                            </button>
                            <button
                              onClick={() => openUpsertModal(inv)}
                              className="px-3 py-1 rounded-lg bg-purple-500 hover:bg-purple-600 text-white font-bold text-[11px] inline-flex items-center gap-1 shadow"
                            >
                              <FileEdit className="w-3.5 h-3.5" /> Edit Bill & Items
                            </button>
                            <button
                              onClick={() => handleDeleteInvoice(inv)}
                              className="px-2 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/40 text-red-300 font-bold text-[11px] inline-flex items-center gap-1 border border-red-500/30"
                              title="Delete / Cancel Invoice"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* UPSERT BILL DRAWER / MODAL */}
      {selectedUpsertInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-tally-card border border-tally-border rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
              <div>
                <h3 className="font-bold text-lg text-white flex items-center gap-2">
                  <FileEdit className="w-5 h-5 text-purple-400" />
                  <span>Upsert Invoice: {selectedUpsertInvoice.invoiceNumber}</span>
                </h3>
                <p className="text-xs text-tally-textMuted">Modify bill details, record payment received, or adjust credit</p>
              </div>
              <button onClick={() => setSelectedUpsertInvoice(null)} className="p-1 rounded bg-tally-bg text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {upsertMessage && (
              <div
                className={`mb-4 p-3 rounded-xl text-xs font-medium ${
                  upsertMessage.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                    : 'bg-red-500/10 border border-red-500/30 text-red-400'
                }`}
              >
                {upsertMessage.text}
              </div>
            )}

            <form onSubmit={handleUpsertSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Customer / Business Name</label>
                <input
                  type="text"
                  required
                  value={editForm.customerName}
                  onChange={(e) => setEditForm({ ...editForm, customerName: e.target.value })}
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Phone Number</label>
                  <input
                    type="text"
                    value={editForm.customerPhone}
                    onChange={(e) => setEditForm({ ...editForm, customerPhone: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Customer GSTIN</label>
                  <input
                    type="text"
                    value={editForm.customerGstin}
                    onChange={(e) => setEditForm({ ...editForm, customerGstin: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono uppercase focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Place of Supply</label>
                  <input
                    type="text"
                    value={editForm.placeOfSupply}
                    onChange={(e) => setEditForm({ ...editForm, placeOfSupply: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">PO. No.</label>
                  <input
                    type="text"
                    value={editForm.poNumber}
                    onChange={(e) => setEditForm({ ...editForm, poNumber: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Billed To Address</label>
                <textarea
                  rows={2}
                  value={editForm.customerAddress}
                  onChange={(e) => setEditForm({ ...editForm, customerAddress: e.target.value })}
                  placeholder="Enter billing address..."
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">Shipped To Address</label>
                <textarea
                  rows={2}
                  value={editForm.shippedAddress}
                  onChange={(e) => setEditForm({ ...editForm, shippedAddress: e.target.value })}
                  placeholder="Enter shipping address..."
                  className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-xs text-white focus:border-purple-500 focus:outline-none resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Payment Mode</label>
                  <select
                    value={editForm.paymentMode}
                    onChange={(e) => setEditForm({ ...editForm, paymentMode: e.target.value })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none"
                  >
                    <option value="CASH">CASH</option>
                    <option value="UPI">UPI / QR</option>
                    <option value="BANK">BANK</option>
                    <option value="CREDIT">CREDIT</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium text-tally-textMuted mb-1">Credit Days</label>
                  <input
                    type="number"
                    value={editForm.creditDays}
                    onChange={(e) => setEditForm({ ...editForm, creditDays: parseInt(e.target.value, 10) || 30 })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-tally-textMuted mb-1">
                  Outstanding Balance Amount (₹)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    step="0.01"
                    value={editForm.outstandingBalance}
                    onChange={(e) => setEditForm({ ...editForm, outstandingBalance: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-2 text-sm text-white font-mono focus:border-purple-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setEditForm({ ...editForm, outstandingBalance: 0 })}
                    className="px-3 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold border border-emerald-500/30 whitespace-nowrap"
                  >
                    Mark Fully Paid
                  </button>
                </div>
              </div>

              {/* INVOICE LINE ITEMS EDITOR */}
              <div className="border border-tally-border rounded-xl p-3 bg-tally-bg/40 space-y-3">
                <div className="flex items-center justify-between font-bold text-white text-xs border-b border-tally-border pb-2">
                  <span className="flex items-center gap-1.5 text-purple-400">
                    <ShoppingCart className="w-4 h-4" />
                    <span>Invoice Line Items & Parts ({editItems.length} Lines)</span>
                  </span>
                  <span className="text-[10px] text-tally-textMuted font-mono">
                    Edit item names, prices, quantities or remove mistaken items
                  </span>
                </div>

                {/* Search / Add Item to Existing Invoice */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type to search and add new item or service to invoice..."
                    value={editSearchQuery}
                    onChange={(e) => setEditSearchQuery(e.target.value)}
                    className="w-full bg-tally-bg border border-tally-border rounded-xl px-3 py-1.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                  />
                  {editSearchQuery && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-tally-card border border-tally-border rounded-xl max-h-48 overflow-y-auto z-50 shadow-2xl divide-y divide-tally-border">
                      <button
                        type="button"
                        onClick={() => {
                          handleAddCustomServiceToEdit(editSearchQuery);
                          setEditSearchQuery('');
                        }}
                        className="w-full p-2 text-left bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-bold text-xs flex items-center justify-between"
                      >
                        <span>+ Add "{editSearchQuery}" as Custom Service Line</span>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/30">+ SERVICE</span>
                      </button>
                      {items
                        .filter((i) => i.name.toLowerCase().includes(editSearchQuery.toLowerCase()) || i.sku.toLowerCase().includes(editSearchQuery.toLowerCase()))
                        .map((catItem) => (
                          <button
                            key={catItem.id}
                            type="button"
                            onClick={() => {
                              handleAddCatalogItemToEdit(catItem);
                              setEditSearchQuery('');
                            }}
                            className="w-full p-2 text-left hover:bg-tally-cardHover text-xs flex items-center justify-between"
                          >
                            <div>
                              <div className="font-bold text-white">{catItem.name}</div>
                              <div className="text-[10px] text-tally-textMuted font-mono">{catItem.sku} • ₹{catItem.sellingPrice}</div>
                            </div>
                            <span className="text-[10px] text-purple-400 font-bold">+ Add Line</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Editable Items Table */}
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1 divide-y divide-tally-border/60">
                  {editItems.map((line, idx) => (
                    <div key={idx} className="pt-2 flex items-center gap-2 text-xs">
                      <div className="flex-1">
                        <input
                          type="text"
                          value={line.name}
                          onChange={(e) => handleUpdateEditItemName(idx, e.target.value)}
                          className="w-full bg-tally-bg border border-tally-border rounded-lg px-2 py-1 text-white font-bold text-xs focus:border-purple-500 focus:outline-none"
                        />
                      </div>
                      <div className="w-24">
                        <div className="inline-flex items-center gap-0.5 bg-tally-bg border border-tally-border rounded-lg px-1.5 py-0.5">
                          <span className="text-gray-400 font-mono text-[10px]">₹</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={line.unitSellingPrice}
                            onChange={(e) => handleUpdateEditItemPrice(idx, parseFloat(e.target.value))}
                            className="w-full bg-transparent text-center font-mono font-bold text-white focus:outline-none text-xs"
                          />
                        </div>
                      </div>
                      <div className="w-16">
                        <input
                          type="number"
                          min="1"
                          value={line.quantity}
                          onChange={(e) => handleUpdateEditItemQuantity(idx, parseInt(e.target.value, 10) || 1)}
                          className="w-full bg-tally-bg border border-tally-border rounded-lg px-1.5 py-1 text-center font-mono font-bold text-white focus:border-purple-500 focus:outline-none text-xs"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveEditItem(idx)}
                        className="p-1.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/40 transition-colors"
                        title="Remove Item from Invoice"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-tally-bg/60 rounded-xl border border-tally-border space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>Current Outstanding:</span>
                  <span className="font-mono font-bold text-amber-400">{formatCurrency(selectedUpsertInvoice.outstandingBalance)}</span>
                </div>
              </div>

              <div className="pt-4 border-t border-tally-border flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleDeleteInvoice(selectedUpsertInvoice)}
                  className="px-3.5 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-bold border border-red-500/30 text-xs flex items-center gap-1.5 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete Invoice</span>
                </button>

                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedUpsertInvoice(null)} className="px-4 py-2 rounded-xl bg-tally-bg text-gray-400 font-semibold">
                    Close
                  </button>
                  <button type="submit" disabled={upsertSubmitting} className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-600/20">
                    {upsertSubmitting ? 'Upserting...' : 'Save & Upsert Bill'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* THERMAL INVOICE MODAL */}
      <ThermalInvoiceModal
        invoice={createdInvoice}
        onClose={() => setCreatedInvoice(null)}
        onEdit={(inv) => {
          setCreatedInvoice(null);
          openUpsertModal(inv);
        }}
        onDelete={handleDeleteInvoice}
      />
    </div>
  );
}
