import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// GET /api/search?q=...&type=...
router.get('/search', async (req, res) => {
  try {
    const q = (req.query.q as string || '').trim();
    const type = (req.query.type as string || 'all').toLowerCase();
    const limit = Math.min(Number(req.query.limit) || 20, 50);

    if (!q) {
      return res.json({
        query: '',
        counts: {
          all: 0,
          invoices: 0,
          purchases: 0,
          vendors: 0,
          items: 0,
          vouchers: 0,
        },
        results: {
          invoices: [],
          purchases: [],
          vendors: [],
          items: [],
          vouchers: [],
        },
      });
    }

    const searchInvoices = type === 'all' || type === 'invoices' || type === 'sales';
    const searchPurchases = type === 'all' || type === 'purchases';
    const searchVendors = type === 'all' || type === 'vendors';
    const searchItems = type === 'all' || type === 'items' || type === 'inventory';
    const searchVouchers = type === 'all' || type === 'vouchers' || type === 'banking';

    const [invoices, purchases, vendors, items, vouchers] = await Promise.all([
      // 1. Invoices (Sales / Sell Entries)
      searchInvoices
        ? prisma.invoice.findMany({
            where: {
              OR: [
                { invoiceNumber: { contains: q } },
                { customerName: { contains: q } },
                { customerPhone: { contains: q } },
                { customerGstin: { contains: q } },
                { customerAddress: { contains: q } },
                {
                  items: {
                    some: {
                      item: {
                        name: { contains: q },
                      },
                    },
                  },
                },
              ],
            },
            include: {
              items: {
                include: {
                  item: true,
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          })
        : [],

      // 2. Purchases (Purchase Entries)
      searchPurchases
        ? prisma.purchase.findMany({
            where: {
              OR: [
                { invoiceNumber: { contains: q } },
                {
                  vendor: {
                    OR: [
                      { name: { contains: q } },
                      { phone: { contains: q } },
                      { gstin: { contains: q } },
                    ],
                  },
                },
                {
                  items: {
                    some: {
                      item: {
                        name: { contains: q },
                      },
                    },
                  },
                },
              ],
            },
            include: {
              vendor: true,
              items: {
                include: {
                  item: true,
                },
              },
            },
            orderBy: { purchaseDate: 'desc' },
            take: limit,
          })
        : [],

      // 3. Vendors
      searchVendors
        ? prisma.vendor.findMany({
            where: {
              OR: [
                { name: { contains: q } },
                { phone: { contains: q } },
                { gstin: { contains: q } },
                { email: { contains: q } },
                { address: { contains: q } },
              ],
            },
            include: {
              _count: {
                select: { purchases: true },
              },
            },
            orderBy: { name: 'asc' },
            take: limit,
          })
        : [],

      // 4. Items (Inventory Products)
      searchItems
        ? prisma.item.findMany({
            where: {
              OR: [
                { name: { contains: q } },
                { sku: { contains: q } },
                { category: { contains: q } },
              ],
            },
            include: {
              stock: true,
            },
            orderBy: { name: 'asc' },
            take: limit,
          })
        : [],

      // 5. Vouchers (Journal & Banking Transactions)
      searchVouchers
        ? prisma.voucher.findMany({
            where: {
              OR: [
                { voucherNumber: { contains: q } },
                { referenceNumber: { contains: q } },
                { narration: { contains: q } },
                {
                  lines: {
                    some: {
                      accountName: { contains: q },
                    },
                  },
                },
              ],
            },
            include: {
              bankAccount: true,
              lines: true,
            },
            orderBy: { date: 'desc' },
            take: limit,
          })
        : [],
    ]);

    const totalMatches =
      invoices.length + purchases.length + vendors.length + items.length + vouchers.length;

    res.json({
      query: q,
      counts: {
        all: totalMatches,
        invoices: invoices.length,
        purchases: purchases.length,
        vendors: vendors.length,
        items: items.length,
        vouchers: vouchers.length,
      },
      results: {
        invoices,
        purchases,
        vendors,
        items,
        vouchers,
      },
    });
  } catch (error: any) {
    console.error('Error executing universal search:', error);
    res.status(500).json({ error: 'Failed to execute search', details: error.message });
  }
});

export default router;
