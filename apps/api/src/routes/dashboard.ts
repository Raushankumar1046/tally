import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// GET Dashboard Overview Metrics
router.get('/reports/dashboard', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Sales Today
    const salesTodayAggregate = await prisma.invoice.aggregate({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // 2. Purchases Today
    const purchasesTodayAggregate = await prisma.purchase.aggregate({
      where: {
        createdAt: {
          gte: startOfToday,
        },
      },
      _sum: {
        totalAmount: true,
      },
      _count: true,
    });

    // 3. All items & Inventory status
    const allItems = await prisma.item.findMany({
      include: { stock: true },
    });

    let totalInventoryValue = 0;
    const lowStockItems = [];

    for (const item of allItems) {
      const qty = item.stock ? Number(item.stock.currentQuantity) : 0;
      const purchasePrice = Number(item.purchasePrice);
      totalInventoryValue += qty * purchasePrice;

      if (qty <= item.minStockLevel) {
        lowStockItems.push({
          id: item.id,
          name: item.name,
          sku: item.sku,
          category: item.category,
          currentQuantity: qty,
          minStockLevel: item.minStockLevel,
          unit: item.unit,
        });
      }
    }

    // 4. Recent Invoices (Sales)
    const recentInvoices = await prisma.invoice.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: { item: true },
        },
      },
    });

    // 5. Recent Purchases
    const recentPurchases = await prisma.purchase.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        vendor: true,
      },
    });

    // 6. Total Vendors Count & Total Outstanding Balance
    const vendorAggregate = await prisma.vendor.aggregate({
      _count: true,
      _sum: {
        balance: true,
      },
    });

    res.json({
      metrics: {
        totalSalesToday: Number(salesTodayAggregate._sum.totalAmount || 0),
        salesTodayCount: salesTodayAggregate._count,
        totalPurchasesToday: Number(purchasesTodayAggregate._sum.totalAmount || 0),
        purchasesTodayCount: purchasesTodayAggregate._count,
        totalInventoryValue,
        lowStockCount: lowStockItems.length,
        totalVendorsCount: vendorAggregate._count,
        totalVendorBalance: Number(vendorAggregate._sum.balance || 0),
      },
      lowStockItems,
      recentInvoices,
      recentPurchases,
    });
  } catch (error) {
    console.error('Error compiling dashboard metrics:', error);
    res.status(500).json({ error: 'Failed to compile dashboard metrics' });
  }
});

export default router;
