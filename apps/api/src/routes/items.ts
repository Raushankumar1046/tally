import { Router } from 'express';
import { prisma } from '@tally/database';
import { ensureRecycleBinTable } from './recycleBin';

const router = Router();

// GET all items in catalog
router.get('/items', async (req, res) => {
  try {
    const items = await prisma.item.findMany({
      include: {
        stock: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(items);
  } catch (error) {
    console.error('Error fetching items catalog:', error);
    res.status(500).json({ error: 'Failed to fetch items catalog' });
  }
});

// GET single item by ID
router.get('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const item = await prisma.item.findUnique({
      where: { id },
      include: { stock: true },
    });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching item:', error);
    res.status(500).json({ error: 'Failed to fetch item' });
  }
});

// POST create item in catalog with stock ledger
router.post('/items', async (req, res) => {
  try {
    const {
      name,
      sku,
      category,
      unit,
      purchasePrice,
      sellingPrice,
      taxRate,
      minStockLevel,
      initialQuantity,
    } = req.body;

    if (!name || !sku || purchasePrice === undefined || sellingPrice === undefined) {
      return res.status(400).json({ error: 'Name, SKU, purchase price, and selling price are required' });
    }

    // Check SKU duplicate
    const existingSku = await prisma.item.findUnique({ where: { sku } });
    if (existingSku) {
      return res.status(400).json({ error: `SKU code "${sku}" already exists in catalog` });
    }

    const item = await prisma.item.create({
      data: {
        name,
        sku,
        category: category || null,
        unit: unit || 'Pcs',
        purchasePrice: parseFloat(purchasePrice),
        sellingPrice: parseFloat(sellingPrice),
        taxRate: taxRate !== undefined ? parseFloat(taxRate) : 18.0,
        minStockLevel: minStockLevel !== undefined ? parseInt(minStockLevel, 10) : 5,
        stock: {
          create: {
            currentQuantity: initialQuantity !== undefined ? parseFloat(initialQuantity) : 0,
          },
        },
      },
      include: {
        stock: true,
      },
    });

    res.status(201).json(item);
  } catch (error: any) {
    console.error('Error creating item:', error);
    res.status(500).json({ error: error.message || 'Failed to create item' });
  }
});

// PUT update item & stock level
router.put('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      sku,
      category,
      unit,
      purchasePrice,
      sellingPrice,
      taxRate,
      minStockLevel,
      currentQuantity,
    } = req.body;

    const updatedItem = await prisma.$transaction(async (tx) => {
      const item = await tx.item.update({
        where: { id },
        data: {
          ...(name !== undefined && { name }),
          ...(sku !== undefined && { sku }),
          ...(category !== undefined && { category }),
          ...(unit !== undefined && { unit }),
          ...(purchasePrice !== undefined && { purchasePrice: parseFloat(purchasePrice) }),
          ...(sellingPrice !== undefined && { sellingPrice: parseFloat(sellingPrice) }),
          ...(taxRate !== undefined && { taxRate: parseFloat(taxRate) }),
          ...(minStockLevel !== undefined && { minStockLevel: parseInt(minStockLevel, 10) }),
        },
        include: { stock: true },
      });

      if (currentQuantity !== undefined) {
        await tx.stockLedger.upsert({
          where: { itemId: id },
          update: { currentQuantity: parseFloat(currentQuantity) },
          create: { itemId: id, currentQuantity: parseFloat(currentQuantity) },
        });
      }

      return await tx.item.findUnique({
        where: { id },
        include: { stock: true },
      });
    });

    res.json(updatedItem);
  } catch (error: any) {
    console.error('Error updating item:', error);
    res.status(400).json({ error: error.message || 'Failed to update item' });
  }
});

// DELETE item from catalog & stock ledger
router.delete('/items/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureRecycleBinTable();

    // Check invoice line usage
    const invoiceCount = await prisma.invoiceItem.count({ where: { itemId: id } });
    const purchaseCount = await prisma.purchaseItem.count({ where: { itemId: id } });

    if (invoiceCount > 0 || purchaseCount > 0) {
      return res.status(400).json({
        error: `Cannot delete item because it has linked transactions (${invoiceCount} sales, ${purchaseCount} purchases).`,
      });
    }

    const existing = await prisma.item.findUnique({
      where: { id },
      include: { stock: true },
    });
    if (existing) {
      await prisma.recycleBin.create({
        data: {
          entityType: 'ITEM',
          entityId: id,
          displayName: `Item: ${existing.name} (${existing.sku})`,
          details: `Selling: ₹${Number(existing.sellingPrice).toLocaleString('en-IN')} | Stock: ${existing.stock?.currentQuantity || 0} ${existing.unit}`,
          payload: JSON.stringify(existing),
        },
      });
    }

    await prisma.item.delete({ where: { id } });
    res.json({ message: 'Item moved to Recycle Bin', id });
  } catch (error: any) {
    console.error('Error deleting item:', error);
    res.status(500).json({ error: error.message || 'Failed to delete item' });
  }
});

export default router;
