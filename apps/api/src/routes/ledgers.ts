import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// General Ledger static fallback categories for manual vouchers
const GENERAL_LEDGERS = [
  { id: 'gen-rent', name: 'Office Rent & Maintenance Expense', type: 'EXPENSE', subtext: 'Indirect Expense' },
  { id: 'gen-electric', name: 'Electricity & Utilities Expense', type: 'EXPENSE', subtext: 'Direct Operating Expense' },
  { id: 'gen-freight', name: 'Freight & Transportation Inward', type: 'EXPENSE', subtext: 'Direct Logistics Expense' },
  { id: 'gen-salary', name: 'Staff Salaries & Wages', type: 'EXPENSE', subtext: 'Payroll Expense' },
  { id: 'gen-audit', name: 'Legal & Audit Fees', type: 'EXPENSE', subtext: 'Professional Fees' },
  { id: 'gen-sales-ac', name: 'Primary Sales Revenue Account', type: 'INCOME', subtext: 'Direct Income' },
  { id: 'gen-interest', name: 'Interest & Investment Income', type: 'INCOME', subtext: 'Indirect Income' },
  { id: 'gen-[#001]', name: 'General Sundry Ledger Account', type: 'GENERAL', subtext: 'General Adjustment' },
];

// GET /api/ledgers/search?query=...
router.get('/ledgers/search', async (req, res) => {
  try {
    const query = (req.query.query as string || '').toLowerCase().trim();

    const [vendors, bankAccounts, items, invoices] = await Promise.all([
      prisma.vendor.findMany({
        orderBy: { name: 'asc' },
      }),
      prisma.bankAccount.findMany({
        orderBy: { accountName: 'asc' },
      }),
      prisma.item.findMany({
        include: { stock: true },
        orderBy: { name: 'asc' },
      }),
      prisma.invoice.findMany({
        where: { customerName: { not: null } },
        distinct: ['customerName'],
        take: 30,
      }),
    ]);

    const results: any[] = [];

    // 1. Vendors
    vendors.forEach((v) => {
      if (
        !query ||
        v.name.toLowerCase().includes(query) ||
        (v.gstin && v.gstin.toLowerCase().includes(query))
      ) {
        results.push({
          id: v.id,
          name: v.name,
          type: 'VENDOR',
          subtext: `Vendor • GSTIN: ${v.gstin || 'N/A'}`,
          balance: Number(v.balance),
          badge: 'VENDOR',
        });
      }
    });

    // 2. Bank & Cash Accounts
    bankAccounts.forEach((b) => {
      if (!query || b.accountName.toLowerCase().includes(query)) {
        results.push({
          id: b.id,
          name: b.accountName,
          type: b.accountType === 'BANK' ? 'BANK' : 'CASH',
          subtext: `${b.accountType} A/C • A/C No: ${b.accountNumber || 'N/A'}`,
          balance: Number(b.currentBalance),
          badge: b.accountType,
        });
      }
    });

    // 3. Customers (distinct names from invoices)
    invoices.forEach((inv) => {
      if (
        inv.customerName &&
        (!query || inv.customerName.toLowerCase().includes(query))
      ) {
        results.push({
          id: `cust-${inv.id}`,
          name: inv.customerName,
          type: 'CUSTOMER',
          subtext: `Customer • GSTIN: ${inv.customerGstin || 'B2C Retail'}`,
          balance: Number(inv.outstandingBalance || 0),
          badge: 'CUSTOMER',
        });
      }
    });

    // 4. Inventory Stock Items
    items.forEach((i) => {
      if (
        !query ||
        i.name.toLowerCase().includes(query) ||
        i.sku.toLowerCase().includes(query)
      ) {
        const qty = i.stock ? Number(i.stock.currentQuantity) : 0;
        results.push({
          id: i.id,
          name: i.name,
          type: 'ITEM',
          subtext: `Stock Item • SKU: ${i.sku} • Stock: ${qty} ${i.unit}`,
          balance: Number(i.sellingPrice),
          badge: 'STOCK ITEM',
        });
      }
    });

    // 5. General Ledger Accounts
    GENERAL_LEDGERS.forEach((g) => {
      if (!query || g.name.toLowerCase().includes(query) || g.subtext.toLowerCase().includes(query)) {
        results.push({
          id: g.id,
          name: g.name,
          type: g.type,
          subtext: g.subtext,
          balance: 0,
          badge: g.type,
        });
      }
    });

    res.json(results);
  } catch (error) {
    console.error('Error performing ledger search:', error);
    res.status(500).json({ error: 'Failed to perform ledger search' });
  }
});

function formatLedgerDate(d: Date): string {
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

function formatLedgerNum(n: number): string {
  return Number(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// GET /api/ledgers/accounts - List all distinct party accounts (Vendors & Customers)
router.get('/ledgers/accounts', async (req, res) => {
  try {
    const [vendors, invoices] = await Promise.all([
      prisma.vendor.findMany({ select: { id: true, name: true, phone: true, gstin: true, balance: true } }),
      prisma.invoice.findMany({
        where: { customerName: { not: null } },
        select: { customerName: true, customerPhone: true, customerGstin: true },
        distinct: ['customerName'],
      }),
    ]);

    const accountsMap = new Map<string, { id: string; name: string; type: 'VENDOR' | 'CUSTOMER'; subtext: string }>();

    vendors.forEach((v) => {
      accountsMap.set(v.name.toLowerCase().trim(), {
        id: v.id,
        name: v.name,
        type: 'VENDOR',
        subtext: `Vendor / Supplier • GST: ${v.gstin || 'N/A'}`,
      });
    });

    invoices.forEach((inv) => {
      if (inv.customerName) {
        const key = inv.customerName.toLowerCase().trim();
        if (!accountsMap.has(key)) {
          accountsMap.set(key, {
            id: `cust-${encodeURIComponent(inv.customerName)}`,
            name: inv.customerName,
            type: 'CUSTOMER',
            subtext: `Customer / Buyer • GST: ${inv.customerGstin || 'B2C Retail'}`,
          });
        }
      }
    });

    res.json(Array.from(accountsMap.values()));
  } catch (error: any) {
    console.error('Error fetching ledger accounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/ledgers/statement - Generate exact Tally-style Account Ledger Statement
router.get('/ledgers/statement', async (req, res) => {
  try {
    const { accountName, vendorId, fromDate, toDate } = req.query as {
      accountName?: string;
      vendorId?: string;
      fromDate?: string;
      toDate?: string;
    };

    if (!accountName && !vendorId) {
      return res.status(400).json({ error: 'accountName or vendorId is required' });
    }

    // 1. Fetch Company Settings
    const company = await prisma.companySettings.findFirst();

    // 2. Resolve party details
    let resolvedVendor = null;
    if (vendorId) {
      resolvedVendor = await prisma.vendor.findUnique({ where: { id: vendorId } });
    } else if (accountName) {
      resolvedVendor = await prisma.vendor.findFirst({
        where: { name: { equals: accountName.trim() } },
      });
    }

    const partyName = resolvedVendor ? resolvedVendor.name : (accountName || '').trim();

    // 3. Collect transactions
    // Invoices (Sales to Customer)
    const invoices = await prisma.invoice.findMany({
      where: { customerName: { equals: partyName } },
      orderBy: { createdAt: 'asc' },
    });

    // Purchases (from Vendor)
    const purchases = resolvedVendor
      ? await prisma.purchase.findMany({
          where: { vendorId: resolvedVendor.id },
          orderBy: { purchaseDate: 'asc' },
        })
      : [];

    // Vouchers (Receipts, Payments, Journals)
    const vouchers = await prisma.voucher.findMany({
      include: { bankAccount: true, lines: true },
      orderBy: { date: 'asc' },
    });

    const matchingVouchers = vouchers.filter((v) => {
      if (resolvedVendor && v.vendorId === resolvedVendor.id) return true;
      if (v.narration && v.narration.toLowerCase().includes(partyName.toLowerCase())) return true;
      if (v.lines && v.lines.some((l) => l.accountName.toLowerCase() === partyName.toLowerCase())) return true;
      return false;
    });

    // Is this primarily a vendor (creditor) or customer (debtor)?
    const isVendor = Boolean(resolvedVendor && (purchases.length > 0 || invoices.length === 0));

    interface RawItem {
      id: string;
      rawDate: Date;
      dateFormatted: string;
      type: string;
      vchNo: string;
      particulars: string;
      debit: number | null;
      credit: number | null;
    }

    const allItems: RawItem[] = [];

    // A. Sales Invoices
    invoices.forEach((inv) => {
      const d = inv.createdAt;
      allItems.push({
        id: `inv-${inv.id}`,
        rawDate: d,
        dateFormatted: formatLedgerDate(d),
        type: 'Sale',
        vchNo: inv.invoiceNumber,
        particulars: 'Sales',
        debit: Number(inv.totalAmount),
        credit: null,
      });
    });

    // B. Purchases
    purchases.forEach((pur) => {
      const d = pur.purchaseDate || pur.createdAt;
      allItems.push({
        id: `pur-${pur.id}`,
        rawDate: d,
        dateFormatted: formatLedgerDate(d),
        type: 'Purc',
        vchNo: pur.invoiceNumber || 'BILL',
        particulars: 'Purchases',
        debit: null,
        credit: Number(pur.totalAmount),
      });
    });

    // C. Vouchers
    matchingVouchers.forEach((v) => {
      const d = v.date;
      const bankName = v.bankAccount ? v.bankAccount.accountName : 'Cash / Bank';
      const ref = v.referenceNumber || v.voucherNumber;

      if (v.voucherType === 'RECEIPT') {
        allItems.push({
          id: `vch-${v.id}`,
          rawDate: d,
          dateFormatted: formatLedgerDate(d),
          type: 'Rcpt',
          vchNo: ref,
          particulars: bankName,
          debit: null,
          credit: Number(v.amount),
        });
      } else if (v.voucherType === 'PAYMENT') {
        allItems.push({
          id: `vch-${v.id}`,
          rawDate: d,
          dateFormatted: formatLedgerDate(d),
          type: 'Pymt',
          vchNo: ref,
          particulars: bankName,
          debit: Number(v.amount),
          credit: null,
        });
      } else if (v.voucherType === 'JOURNAL') {
        const partyLine = v.lines.find((l) => l.accountName.toLowerCase() === partyName.toLowerCase());
        const otherLine = v.lines.find((l) => l.accountName.toLowerCase() !== partyName.toLowerCase());
        if (partyLine) {
          const deb = Number(partyLine.debitAmount);
          const cred = Number(partyLine.creditAmount);
          allItems.push({
            id: `vch-${v.id}`,
            rawDate: d,
            dateFormatted: formatLedgerDate(d),
            type: 'Jrnl',
            vchNo: v.voucherNumber,
            particulars: otherLine ? otherLine.accountName : v.narration || 'Journal Entry',
            debit: deb > 0 ? deb : null,
            credit: cred > 0 ? cred : null,
          });
        }
      }
    });

    // Sort chronologically
    allItems.sort((a, b) => a.rawDate.getTime() - b.rawDate.getTime());

    // Date Filtering & Opening Balance
    const fromTime = fromDate ? new Date(fromDate).getTime() : 0;
    const toTime = toDate ? new Date(toDate).setHours(23, 59, 59, 999) : Infinity;

    let openingBalance = 0;
    const periodItems: RawItem[] = [];

    allItems.forEach((item) => {
      const t = item.rawDate.getTime();
      if (t < fromTime) {
        if (isVendor) {
          openingBalance += (item.credit || 0) - (item.debit || 0);
        } else {
          openingBalance += (item.debit || 0) - (item.credit || 0);
        }
      } else if (t <= toTime) {
        periodItems.push(item);
      }
    });

    // Calculate running balance row by row
    let running = openingBalance;
    let totalDebit = 0;
    let totalCredit = 0;

    const entries = periodItems.map((item) => {
      const deb = item.debit || 0;
      const cred = item.credit || 0;
      totalDebit += deb;
      totalCredit += cred;

      if (isVendor) {
        running += cred - deb;
      } else {
        running += deb - cred;
      }

      let balanceFormatted = '0.00';
      if (Math.abs(running) < 0.001) {
        balanceFormatted = '0.00';
      } else if (isVendor) {
        balanceFormatted = running > 0
          ? `${formatLedgerNum(running)} Cr`
          : `${formatLedgerNum(Math.abs(running))} Dr`;
      } else {
        balanceFormatted = running > 0
          ? `${formatLedgerNum(running)} Dr`
          : `${formatLedgerNum(Math.abs(running))} Cr`;
      }

      return {
        id: item.id,
        date: item.dateFormatted,
        type: item.type,
        vchNo: item.vchNo || '',
        particulars: item.particulars,
        debit: item.debit ? formatLedgerNum(item.debit) : '',
        credit: item.credit ? formatLedgerNum(item.credit) : '',
        balance: balanceFormatted,
      };
    });

    let closingFormatted = '0.00';
    if (Math.abs(running) < 0.001) {
      closingFormatted = '0.00';
    } else if (isVendor) {
      closingFormatted = running > 0
        ? `${formatLedgerNum(running)} Cr`
        : `${formatLedgerNum(Math.abs(running))} Dr`;
    } else {
      closingFormatted = running > 0
        ? `${formatLedgerNum(running)} Dr`
        : `${formatLedgerNum(Math.abs(running))} Cr`;
    }

    const curYear = new Date().getFullYear();
    const fyString = `${curYear}-${(curYear + 1).toString().slice(2)}`;

    res.json({
      company: {
        name: company?.companyName || 'Industrial Gas Agency',
        address: company?.address || '',
        phone: company?.phone || '',
        gstin: company?.gstin || '',
        financialYear: fyString,
      },
      accountName: partyName,
      accountType: isVendor ? 'VENDOR' : 'CUSTOMER',
      dateRangeText: `( From ${fromDate ? formatLedgerDate(new Date(fromDate)) : '01-04-' + curYear} to ${toDate ? formatLedgerDate(new Date(toDate)) : '31-03-' + (curYear + 1)} )`,
      openingBalance: openingBalance !== 0 ? formatLedgerNum(Math.abs(openingBalance)) : null,
      openingBalanceType: openingBalance > 0 ? (isVendor ? 'Cr' : 'Dr') : openingBalance < 0 ? (isVendor ? 'Dr' : 'Cr') : null,
      entries,
      totalDebit: formatLedgerNum(totalDebit),
      totalCredit: formatLedgerNum(totalCredit),
      closingBalanceText: `Closing Balance = ${closingFormatted}`,
      rawClosingBalance: running,
    });
  } catch (error: any) {
    console.error('Error generating ledger statement:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
