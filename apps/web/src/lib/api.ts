const API_BASE_URL =
  typeof window !== 'undefined'
    ? '/api'
    : process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export interface CompanySettings {
  id?: string;
  companyName: string;
  address?: string;
  phone?: string;
  email?: string;
  gstin?: string;
  panNumber?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  upiId?: string;
  invoicePrefix?: string;
  nextInvoiceNumber?: number;
  invoiceNumberPadding?: number;
  purchasePrefix?: string;
  nextPurchaseNumber?: number;
}

export interface SequenceConfig {
  invoicePrefix: string;
  nextInvoiceNumber: number;
  invoiceNumberPadding: number;
  purchasePrefix: string;
  nextPurchaseNumber: number;
  previewInvoice: string;
  previewPurchase: string;
}

export interface BankAccount {
  id: string;
  accountName: string;
  accountType: 'BANK' | 'CASH';
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
  openingBalance: number;
  currentBalance: number;
  createdAt: string;
  _count?: {
    vouchers: number;
  };
}

export interface BankAccountDetails extends BankAccount {
  vouchers: Voucher[];
  analytics: {
    totalMoneyIn: number;
    totalMoneyOut: number;
    totalVouchersCount: number;
  };
}

export interface CustomerProfile {
  id?: string;
  customerName: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  shippedAddress?: string;
  outstandingBalance: number;
  count: number;
  type?: 'VENDOR' | 'CUSTOMER';
}

export interface LedgerStatementEntry {
  id: string;
  date: string;
  type: string;
  vchNo: string;
  particulars: string;
  debit: string;
  credit: string;
  balance: string;
}

export interface LedgerStatement {
  company: {
    name: string;
    address: string;
    phone: string;
    gstin: string;
    financialYear: string;
  };
  accountName: string;
  accountType: 'VENDOR' | 'CUSTOMER';
  dateRangeText: string;
  openingBalance: string | null;
  openingBalanceType: 'Dr' | 'Cr' | null;
  entries: LedgerStatementEntry[];
  totalDebit: string;
  totalCredit: string;
  closingBalanceText: string;
  rawClosingBalance: number;
}

export interface Vendor {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  gstin?: string;
  address?: string;
  balance: number;
  createdAt: string;
  _count?: {
    purchases: number;
  };
}

export interface Item {
  id: string;
  name: string;
  sku: string;
  category?: string;
  unit: string;
  purchasePrice: number;
  sellingPrice: number;
  taxRate: number;
  minStockLevel: number;
  stock?: {
    currentQuantity: number;
    updatedAt: string;
  };
}

export interface InventoryItem extends Item {
  currentQuantity: number;
  isLowStock: boolean;
  totalPurchaseValue: number;
  totalSellingValue: number;
}

export interface PurchaseItemLine {
  id?: string;
  itemId: string;
  quantity: number;
  unitPurchasePrice: number;
  taxRate?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalPrice?: number;
  item?: Item;
}

export interface Purchase {
  id: string;
  vendorId: string;
  vendor?: Vendor;
  invoiceNumber: string;
  totalAmount: number;
  purchaseDate: string;
  createdAt?: string;
  items: PurchaseItemLine[];
}

export interface InvoiceItemLine {
  id?: string;
  itemId: string;
  name?: string;
  quantity: number;
  unitSellingPrice: number;
  taxRate?: number;
  totalPrice?: number;
  item?: Item;
}

export interface Invoice {
  id: string;
  customerName?: string;
  customerPhone?: string;
  customerGstin?: string;
  customerAddress?: string;
  shippedAddress?: string;
  placeOfSupply?: string;
  poNumber?: string;
  poDate?: string;
  paymentTerms?: string;
  invoiceNumber: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentMode: 'CASH' | 'UPI' | 'BANK' | 'CREDIT';
  creditDays?: number;
  dueDate?: string;
  outstandingBalance?: number;
  overdueDays?: number;
  createdAt: string;
  items: InvoiceItemLine[];
}

export interface JournalLine {
  id?: string;
  accountName: string;
  type: 'DEBIT' | 'CREDIT';
  amount: number;
}

export interface JournalEntry {
  id: string;
  voucherNumber: string;
  entryDate: string;
  description: string;
  totalAmount: number;
  createdAt: string;
  lines: JournalLine[];
}

export interface VoucherLine {
  id?: string;
  ledgerType: 'VENDOR' | 'CUSTOMER' | 'BANK' | 'CASH' | 'EXPENSE' | 'INCOME' | 'ITEM' | 'GENERAL';
  ledgerId?: string;
  accountName: string;
  debitAmount: number;
  creditAmount: number;
}

export interface Voucher {
  id: string;
  voucherNumber: string;
  voucherType: 'RECEIPT' | 'PAYMENT' | 'CONTRA' | 'JOURNAL';
  date: string;
  amount: number;
  referenceNumber?: string;
  narration?: string;
  vendorId?: string;
  bankAccountId?: string;
  bankAccount?: BankAccount;
  createdAt: string;
  lines: VoucherLine[];
}

export interface LedgerSearchResult {
  id: string;
  name: string;
  type: 'VENDOR' | 'CUSTOMER' | 'BANK' | 'CASH' | 'ITEM' | 'EXPENSE' | 'INCOME' | 'GENERAL';
  subtext: string;
  balance: number;
  badge: string;
}

export interface GSTR1Summary {
  summary: {
    totalInvoicesCount: number;
    totalTaxableValue: number;
    totalTaxCollected: number;
    totalCGST: number;
    totalSGST: number;
    totalIGST: number;
    totalTurnover: number;
  };
  b2bSummary: {
    count: number;
    taxableValue: number;
    taxCollected: number;
  };
  b2cSummary: {
    count: number;
    taxableValue: number;
    taxCollected: number;
  };
  rateBreakdown: {
    rate: number;
    taxable: number;
    tax: number;
    cgst: number;
    sgst: number;
    igst: number;
  }[];
  invoices: {
    id: string;
    invoiceNumber: string;
    customerName: string;
    customerGstin: string;
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    createdAt: string;
  }[];
}

export interface GSTR3BSummary {
  section31_OutwardSupplies: {
    invoicesCount: number;
    taxableValue: number;
    cgstPayable: number;
    sgstPayable: number;
    igstPayable: number;
    totalTaxPayable: number;
    totalTurnover: number;
  };
  section4_EligibleITC: {
    taxableValue: number;
    cgstItc: number;
    sgstItc: number;
    igstItc: number;
    totalEligibleItc: number;
  };
  netLiability: {
    netCgstPayable: number;
    netSgstPayable: number;
    netIgstPayable: number;
    netTotalPayable: number;
    itcRemainingBalance: number;
  };
}

export interface DashboardMetrics {
  metrics: {
    totalSalesToday: number;
    salesTodayCount: number;
    totalPurchasesToday: number;
    purchasesTodayCount: number;
    totalInventoryValue: number;
    lowStockCount: number;
    totalVendorsCount: number;
    totalVendorBalance: number;
  };
  lowStockItems: {
    id: string;
    name: string;
    sku: string;
    category?: string;
    currentQuantity: number;
    minStockLevel: number;
    unit: string;
  }[];
  recentInvoices: Invoice[];
  recentPurchases: Purchase[];
}

export interface BackupSummary {
  companySettingsCount: number;
  vendorCount: number;
  itemCount: number;
  bankAccountCount: number;
  invoiceCount: number;
  purchaseCount: number;
  journalEntryCount: number;
  voucherCount: number;
  totalRecords: number;
}

export interface BackupEngineConfig {
  enabled: boolean;
  schedule: '15m' | '30m' | '1h' | 'daily' | 'realtime';
  dailyTime: string;
  localBackupDir: string;
  gdriveClientId: string;
  gdriveClientSecret?: string;
  hasSecret?: boolean;
  gdriveConnected: boolean;
  gdriveUserEmail: string | null;
  gdriveFileId: string | null;
  lastBackupAt: string | null;
  lastBackupRecords: number | null;
  lastBackupSize: number | null;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'offline_pending' | 'error';
  lastError: string | null;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorData.error || errorData.message || 'API Request Failed');
  }
  return res.json();
}

export const api = {
  // Backup & Data Safety
  getBackupSummary: () => fetch(`${API_BASE_URL}/backup/summary`).then(res => handleResponse<BackupSummary>(res)),
  exportBackupData: () => fetch(`${API_BASE_URL}/backup/export`).then(res => res.json()),
  importBackupData: (backupData: any, mode: 'overwrite' | 'merge' = 'overwrite') =>
    fetch(`${API_BASE_URL}/backup/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ backupData, mode }),
    }).then(res => handleResponse<{ message: string; mode: string; stats: any }>(res)),
  getBackupConfig: () => fetch(`${API_BASE_URL}/backup/config`).then(res => handleResponse<BackupEngineConfig>(res)),
  updateBackupConfig: (data: Partial<BackupEngineConfig>) =>
    fetch(`${API_BASE_URL}/backup/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<{ message: string; config: BackupEngineConfig }>(res)),
  runManualBackup: () =>
    fetch(`${API_BASE_URL}/backup/run-now`, { method: 'POST' }).then(res => handleResponse<any>(res)),
  getGoogleDriveAuthUrl: (redirectUri?: string) => {
    const url = redirectUri
      ? `${API_BASE_URL}/backup/gdrive/auth-url?redirectUri=${encodeURIComponent(redirectUri)}`
      : `${API_BASE_URL}/backup/gdrive/auth-url`;
    return fetch(url).then(res => handleResponse<{ authUrl: string; redirectUri: string }>(res));
  },
  connectGoogleDriveCode: (code: string, redirectUri: string) =>
    fetch(`${API_BASE_URL}/backup/gdrive/connect-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, redirectUri }),
    }).then(res => handleResponse<any>(res)),
  disconnectGoogleDrive: () =>
    fetch(`${API_BASE_URL}/backup/gdrive/disconnect`, { method: 'POST' }).then(res => handleResponse<any>(res)),
  syncGoogleDriveNow: () =>
    fetch(`${API_BASE_URL}/backup/gdrive/sync-now`, { method: 'POST' }).then(res => handleResponse<any>(res)),
  previewGoogleDriveBackup: () =>
    fetch(`${API_BASE_URL}/backup/gdrive/preview`).then(res => handleResponse<{ preview: any }>(res)),
  restoreFromGoogleDrive: () =>
    fetch(`${API_BASE_URL}/backup/gdrive/restore`, { method: 'POST' }).then(res => handleResponse<any>(res)),
  restoreFromLocalMaster: () =>
    fetch(`${API_BASE_URL}/backup/local/restore`, { method: 'POST' }).then(res => handleResponse<any>(res)),
  selectLocalBackupFolder: () =>
    fetch(`${API_BASE_URL}/backup/select-folder`, { method: 'POST' }).then(res => handleResponse<{ selectedPath: string | null }>(res)),
  detectCloudFolders: () =>
    fetch(`${API_BASE_URL}/backup/detect-cloud-folders`).then(res =>
      handleResponse<{ detected: Array<{ id: string; name: string; path: string; exists: boolean }> }>(res)
    ),
  setBackupFolder: (folderPath: string) =>
    fetch(`${API_BASE_URL}/backup/set-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folderPath }),
    }).then(res => handleResponse<{ success: boolean; localBackupDir: string }>(res)),
  // Settings & Sequence Config
  getSettings: () => fetch(`${API_BASE_URL}/settings`).then(res => handleResponse<CompanySettings>(res)),
  updateSettings: (data: Partial<CompanySettings>) =>
    fetch(`${API_BASE_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<CompanySettings>(res)),
  getSequenceConfig: () => fetch(`${API_BASE_URL}/settings/sequence`).then(res => handleResponse<SequenceConfig>(res)),
  updateSequenceConfig: (data: Partial<SequenceConfig>) =>
    fetch(`${API_BASE_URL}/settings/sequence`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<SequenceConfig>(res)),

  // Ledgers Search & Statement
  searchLedgers: (query = '') =>
    fetch(`${API_BASE_URL}/ledgers/search?query=${encodeURIComponent(query)}`).then(res => handleResponse<LedgerSearchResult[]>(res)),
  getLedgerAccounts: () =>
    fetch(`${API_BASE_URL}/ledgers/accounts`).then(res =>
      handleResponse<Array<{ id: string; name: string; type: 'VENDOR' | 'CUSTOMER'; subtext: string }>>(res)
    ),
  getLedgerStatement: (params: { accountName?: string; vendorId?: string; fromDate?: string; toDate?: string }) => {
    const sp = new URLSearchParams();
    if (params.accountName) sp.append('accountName', params.accountName);
    if (params.vendorId) sp.append('vendorId', params.vendorId);
    if (params.fromDate) sp.append('fromDate', params.fromDate);
    if (params.toDate) sp.append('toDate', params.toDate);
    return fetch(`${API_BASE_URL}/ledgers/statement?${sp.toString()}`).then(res =>
      handleResponse<LedgerStatement>(res)
    );
  },

  // Banking
  getBankAccounts: () =>
    fetch(`${API_BASE_URL}/banking/accounts`).then(res =>
      handleResponse<{ accounts: BankAccount[]; metrics: any }>(res)
    ),
  getBankAccountDetails: (id: string) =>
    fetch(`${API_BASE_URL}/banking/accounts/${id}`).then(res => handleResponse<BankAccountDetails>(res)),
  createBankAccount: (data: Partial<BankAccount>) =>
    fetch(`${API_BASE_URL}/banking/accounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<BankAccount>(res)),
  updateBankAccount: (id: string, data: Partial<BankAccount>) =>
    fetch(`${API_BASE_URL}/banking/accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<BankAccount>(res)),
  deleteBankAccount: (id: string) =>
    fetch(`${API_BASE_URL}/banking/accounts/${id}`, {
      method: 'DELETE',
    }).then(res => handleResponse<{ message: string; id: string }>(res)),

  // Vouchers
  getVouchers: () => fetch(`${API_BASE_URL}/vouchers`).then(res => handleResponse<Voucher[]>(res)),
  createReceiptVoucher: (data: { customerName: string; bankAccountId: string; amount: number; referenceNumber?: string; narration?: string; date?: string }) =>
    fetch(`${API_BASE_URL}/vouchers/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Voucher>(res)),
  createPaymentVoucher: (data: { vendorId: string; bankAccountId: string; amount: number; referenceNumber?: string; narration?: string; date?: string; paymentMode?: string }) =>
    fetch(`${API_BASE_URL}/vouchers/payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Voucher>(res)),
  createContraVoucher: (data: { fromBankAccountId: string; toBankAccountId: string; amount: number; referenceNumber?: string; narration?: string; date?: string }) =>
    fetch(`${API_BASE_URL}/vouchers/contra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Voucher>(res)),
  updateVoucher: (id: string, data: { amount?: number; date?: string; referenceNumber?: string; narration?: string }) =>
    fetch(`${API_BASE_URL}/vouchers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Voucher>(res)),
  deleteVoucher: (id: string) =>
    fetch(`${API_BASE_URL}/vouchers/${id}`, {
      method: 'DELETE',
    }).then(res => handleResponse<{ message: string; id: string }>(res)),

  // Vendors
  getVendors: () => fetch(`${API_BASE_URL}/vendors`).then(res => handleResponse<Vendor[]>(res)),
  createVendor: (data: Partial<Vendor>) =>
    fetch(`${API_BASE_URL}/vendors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Vendor>(res)),
  updateVendor: (id: string, data: Partial<Vendor>) =>
    fetch(`${API_BASE_URL}/vendors/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Vendor>(res)),
  deleteVendor: (id: string) =>
    fetch(`${API_BASE_URL}/vendors/${id}`, {
      method: 'DELETE',
    }).then(res => handleResponse<{ message: string; id: string }>(res)),

  // Items / Catalog
  getItems: () => fetch(`${API_BASE_URL}/items`).then(res => handleResponse<Item[]>(res)),
  createItem: (data: any) =>
    fetch(`${API_BASE_URL}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Item>(res)),
  updateItem: (id: string, data: any) =>
    fetch(`${API_BASE_URL}/items/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Item>(res)),
  deleteItem: (id: string) =>
    fetch(`${API_BASE_URL}/items/${id}`, {
      method: 'DELETE',
    }).then(res => handleResponse<{ message: string; id: string }>(res)),

  // Inventory
  getInventory: (lowStockOnly = false) =>
    fetch(`${API_BASE_URL}/inventory${lowStockOnly ? '?lowStock=true' : ''}`).then(res => handleResponse<InventoryItem[]>(res)),

  // Purchases
  getPurchases: () => fetch(`${API_BASE_URL}/purchases`).then(res => handleResponse<Purchase[]>(res)),
  createPurchase: (data: { vendorId: string; invoiceNumber: string; items: any[]; isCredit?: boolean; purchaseDate?: string }) =>
    fetch(`${API_BASE_URL}/purchases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Purchase>(res)),
  updatePurchase: (id: string, data: { vendorId?: string; invoiceNumber?: string; items: any[]; isCredit?: boolean; purchaseDate?: string }) =>
    fetch(`${API_BASE_URL}/purchases/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Purchase>(res)),
  deletePurchase: (id: string) =>
    fetch(`${API_BASE_URL}/purchases/${id}`, {
      method: 'DELETE',
    }).then(res => handleResponse<{ message: string; id: string }>(res)),

  // Invoices / Billing & Customer Directory
  getCustomers: (query = '') =>
    fetch(`${API_BASE_URL}/customers?query=${encodeURIComponent(query)}`).then(res => handleResponse<CustomerProfile[]>(res)),
  getInvoices: () => fetch(`${API_BASE_URL}/invoices`).then(res => handleResponse<Invoice[]>(res)),
  getOverdueInvoices: () => fetch(`${API_BASE_URL}/invoices/overdue`).then(res => handleResponse<Invoice[]>(res)),
  createInvoice: (data: {
    customerName?: string;
    customerPhone?: string;
    customerGstin?: string;
    customerAddress?: string;
    shippedAddress?: string;
    placeOfSupply?: string;
    poNumber?: string;
    poDate?: string;
    paymentTerms?: string;
    paymentMode: string;
    creditDays?: number;
    items: any[];
    discountAmount?: number;
  }) =>
    fetch(`${API_BASE_URL}/invoices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Invoice>(res)),
  upsertInvoice: (id: string, data: Partial<Invoice>) =>
    fetch(`${API_BASE_URL}/invoices/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<Invoice>(res)),
  deleteInvoice: (id: string) =>
    fetch(`${API_BASE_URL}/invoices/${id}`, {
      method: 'DELETE',
    }).then(res => handleResponse<{ message: string; id: string }>(res)),

  // Reports
  getGstr1: () => fetch(`${API_BASE_URL}/reports/gstr1`).then(res => handleResponse<GSTR1Summary>(res)),
  getGstr3b: () => fetch(`${API_BASE_URL}/reports/gstr3b`).then(res => handleResponse<GSTR3BSummary>(res)),
  getDashboardMetrics: () => fetch(`${API_BASE_URL}/reports/dashboard`).then(res => handleResponse<DashboardMetrics>(res)),

  // Journal Entries
  getJournalEntries: () => fetch(`${API_BASE_URL}/journal-entries`).then(res => handleResponse<JournalEntry[]>(res)),
  createJournalEntry: (data: { description: string; entryDate?: string; lines: JournalLine[] }) =>
    fetch(`${API_BASE_URL}/journal-entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(res => handleResponse<JournalEntry>(res)),

  // Universal Search
  search: (query: string, type = 'all', limit = 25) =>
    fetch(`${API_BASE_URL}/search?q=${encodeURIComponent(query)}&type=${encodeURIComponent(type)}&limit=${limit}`).then(res => handleResponse<SearchResults>(res)),

  // Recycle Bin / Trash
  getRecycleBin: (entityType?: string) =>
    fetch(`${API_BASE_URL}/recycle-bin${entityType && entityType !== 'ALL' ? `?entityType=${entityType}` : ''}`).then(res => handleResponse<RecycleBinItem[]>(res)),
  restoreFromRecycleBin: (id: string) =>
    fetch(`${API_BASE_URL}/recycle-bin/${id}/restore`, { method: 'POST' }).then(res => handleResponse<{ message: string; id: string }>(res)),
  deletePermanentlyFromRecycleBin: (id: string) =>
    fetch(`${API_BASE_URL}/recycle-bin/${id}`, { method: 'DELETE' }).then(res => handleResponse<{ message: string; id: string }>(res)),
  emptyRecycleBin: (entityType?: string) =>
    fetch(`${API_BASE_URL}/recycle-bin${entityType && entityType !== 'ALL' ? `?entityType=${entityType}` : ''}`, { method: 'DELETE' }).then(res => handleResponse<{ message: string }>(res)),
};

export interface RecycleBinItem {
  id: string;
  entityType: 'INVOICE' | 'PURCHASE' | 'VENDOR' | 'ITEM' | 'VOUCHER' | string;
  entityId: string;
  displayName: string;
  details?: string | null;
  payload: string;
  deletedAt: string;
}

export interface SearchResults {
  query: string;
  counts: {
    all: number;
    invoices: number;
    purchases: number;
    vendors: number;
    items: number;
    vouchers: number;
  };
  results: {
    invoices: Invoice[];
    purchases: Purchase[];
    vendors: (Vendor & { _count?: { purchases: number } })[];
    items: (Item & { stock?: { currentQuantity: number } })[];
    vouchers: Voucher[];
  };
}

export function formatCurrency(amount: number | string | undefined): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(num);
}

