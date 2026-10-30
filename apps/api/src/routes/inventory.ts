import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// Get real-time stock ledger list with visual indicator status
router.get('/inventory', async (req, res) => {
  try {
    const { lowStock } = req.query;

    const items = await prisma.item.findMany({
      include: {
        stock: true,
      },
      orderBy: { name: 'asc' },
    });

    const inventory = items.map((item) => {
      const qty = item.stock ? Number(item.stock.currentQuantity) : 0;
      const isLowStock = qty <= item.minStockLevel;
      const totalPurchaseValue = qty * Number(item.purchasePrice);
      const totalSellingValue = qty * Number(item.sellingPrice);

      return {
        id: item.id,
        name: item.name,
        sku: item.sku,
        category: item.category,
        unit: item.unit,
        purchasePrice: Number(item.purchasePrice),
        sellingPrice: Number(item.sellingPrice),
        taxRate: Number(item.taxRate),
        minStockLevel: item.minStockLevel,
        currentQuantity: qty,
        isLowStock,
        totalPurchaseValue,
        totalSellingValue,
        updatedAt: item.stock?.updatedAt || item.updatedAt,
      };
    });

    if (lowStock === 'true') {
      return res.json(inventory.filter((inv) => inv.isLowStock));
    }

    res.json(inventory);
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory ledger' });
  }
});

export default router;
