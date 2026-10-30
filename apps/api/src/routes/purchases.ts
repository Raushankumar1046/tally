import { Router } from 'express';
import { prisma } from '@tally/database';
import { ensureRecycleBinTable } from './recycleBin';

const router = Router();

// GET all purchases with vendor & items details
router.get('/purchases', async (req, res) => {
  try {
    const purchases = await prisma.purchase.findMany({
      include: {
        vendor: true,
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { purchaseDate: 'desc' },
    });
    res.json(purchases);
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchases' });
  }
});

// POST new purchase entry (ATOMIC DB TRANSACTION WITH PER-ITEM GST)
router.post('/purchases', async (req, res) => {
  try {
    const { vendorId, invoiceNumber, items, isCredit, purchaseDate } = req.body;

    if (!vendorId || !invoiceNumber || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'Vendor ID, invoice number, and at least one line item are required',
      });
    }

    // Perform atomic transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify Vendor
      const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) {
        throw new Error(`Vendor with ID ${vendorId} not found`);
      }

      // 2. Calculate Total Purchase Amount & validate items with GST
      let totalAmount = 0;
      const purchaseItemsData = [];

      for (const line of items) {
        const { itemId, quantity, unitPurchasePrice, taxRate } = line;
        const qty = parseFloat(quantity);
        const price = parseFloat(unitPurchasePrice);
        const gstRate = taxRate !== undefined ? parseFloat(taxRate) : 18.0;

        if (!itemId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
          throw new Error('Invalid item data in purchase lines');
        }

        const dbItem = await tx.item.findUnique({ where: { id: itemId } });
        if (!dbItem) {
          throw new Error(`Item with ID ${itemId} not found`);
        }

        // GST calculations
        const lineTaxable = qty * price;
        const lineTax = lineTaxable * (gstRate / 100);
        const lineTotal = lineTaxable + lineTax;

        totalAmount += lineTotal;

        purchaseItemsData.push({
          itemId,
          quantity: qty,
          unitPurchasePrice: price,
          taxRate: gstRate,
          taxableAmount: lineTaxable,
          taxAmount: lineTax,
          totalPrice: lineTotal,
        });
      }

      // 3. Create Purchase Record
      const purchase = await tx.purchase.create({
        data: {
          vendorId,
          invoiceNumber,
          totalAmount,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
          items: {
            create: purchaseItemsData,
          },
        },
        include: {
          vendor: true,
          items: { include: { item: true } },
        },
      });

      // 4. Increment Stock Ledger currentQuantity for each item
      for (const line of purchaseItemsData) {
        await tx.stockLedger.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantity: {
              increment: line.quantity,
            },
          },
          create: {
            itemId: line.itemId,
            currentQuantity: line.quantity,
          },
        });
      }

      // 5. Update Vendor Balance if purchased on credit
      if (isCredit) {
        await tx.vendor.update({
          where: { id: vendorId },
          data: {
            balance: {
              increment: totalAmount,
            },
          },
        });
      }

      return purchase;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error creating purchase transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to process purchase entry' });
  }
});

// GET single purchase by ID
router.get('/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        vendor: true,
        items: {
          include: { item: true },
        },
      },
    });
    if (!purchase) {
      return res.status(404).json({ error: 'Purchase entry not found' });
    }
    res.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase:', error);
    res.status(500).json({ error: 'Failed to fetch purchase' });
  }
});

// PUT update purchase entry (adjust items, quantities, and sync inventory)
router.put('/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { vendorId, invoiceNumber, purchaseDate, items, isCredit } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        error: 'At least one line item is required',
      });
    }

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      // 1. Fetch existing purchase with current items
      const existingPurchase = await tx.purchase.findUnique({
        where: { id },
        include: { items: true, vendor: true },
      });

      if (!existingPurchase) {
        throw new Error(`Purchase entry with ID ${id} not found`);
      }

      // 2. Map old quantities per item: itemId -> oldQty
      const oldItemQuantities: Record<string, number> = {};
      for (const line of existingPurchase.items) {
        oldItemQuantities[line.itemId] = (oldItemQuantities[line.itemId] || 0) + Number(line.quantity);
      }

      // 3. Validate new items and calculate totals
      let newTotalAmount = 0;
      const newPurchaseItemsData = [];
      const newItemQuantities: Record<string, number> = {};

      for (const line of items) {
        const { itemId, quantity, unitPurchasePrice, taxRate } = line;
        const qty = parseFloat(quantity);
        const price = parseFloat(unitPurchasePrice);
        const gstRate = taxRate !== undefined ? parseFloat(taxRate) : 18.0;

        if (!itemId || isNaN(qty) || qty <= 0 || isNaN(price) || price < 0) {
          throw new Error('Invalid item data in purchase lines');
        }

        const dbItem = await tx.item.findUnique({ where: { id: itemId } });
        if (!dbItem) {
          throw new Error(`Item with ID ${itemId} not found`);
        }

        const lineTaxable = qty * price;
        const lineTax = lineTaxable * (gstRate / 100);
        const lineTotal = lineTaxable + lineTax;

        newTotalAmount += lineTotal;
        newItemQuantities[itemId] = (newItemQuantities[itemId] || 0) + qty;

        newPurchaseItemsData.push({
          purchaseId: id,
          itemId,
          quantity: qty,
          unitPurchasePrice: price,
          taxRate: gstRate,
          taxableAmount: lineTaxable,
          taxAmount: lineTax,
          totalPrice: lineTotal,
        });
      }

      // 4. Adjust Inventory Stock for all affected items (both old and new)
      const allItemIds = new Set([
        ...Object.keys(oldItemQuantities),
        ...Object.keys(newItemQuantities),
      ]);

      for (const affectedItemId of allItemIds) {
        const oldQty = oldItemQuantities[affectedItemId] || 0;
        const newQty = newItemQuantities[affectedItemId] || 0;
        const diff = newQty - oldQty; // e.g. was 10, now 2 => diff = -8; was 2, now 5 => diff = +3

        if (diff !== 0) {
          if (diff > 0) {
            await tx.stockLedger.upsert({
              where: { itemId: affectedItemId },
              update: {
                currentQuantity: { increment: diff },
              },
              create: {
                itemId: affectedItemId,
                currentQuantity: diff,
              },
            });
          } else {
            await tx.stockLedger.upsert({
              where: { itemId: affectedItemId },
              update: {
                currentQuantity: { decrement: Math.abs(diff) },
              },
              create: {
                itemId: affectedItemId,
                currentQuantity: 0,
              },
            });
          }
        }
      }

      // 5. Adjust Vendor Balance if amount changed and credit was used or vendor balance exists
      const oldTotal = Number(existingPurchase.totalAmount);
      const totalDiff = newTotalAmount - oldTotal;

      const targetVendorId = vendorId || existingPurchase.vendorId;
      if (totalDiff !== 0 && (isCredit || Number(existingPurchase.vendor?.balance || 0) > 0)) {
        if (targetVendorId === existingPurchase.vendorId) {
          if (totalDiff > 0) {
            await tx.vendor.update({
              where: { id: targetVendorId },
              data: { balance: { increment: totalDiff } },
            });
          } else {
            const currentBal = Number(existingPurchase.vendor?.balance || 0);
            const deduct = Math.min(currentBal, Math.abs(totalDiff));
            if (deduct > 0) {
              await tx.vendor.update({
                where: { id: targetVendorId },
                data: { balance: { decrement: deduct } },
              });
            }
          }
        }
      }

      // 6. Delete old line items
      await tx.purchaseItem.deleteMany({
        where: { purchaseId: id },
      });

      // 7. Create new line items
      await tx.purchaseItem.createMany({
        data: newPurchaseItemsData,
      });

      // 8. Update Purchase record
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          invoiceNumber: invoiceNumber || existingPurchase.invoiceNumber,
          vendorId: targetVendorId,
          totalAmount: newTotalAmount,
          purchaseDate: purchaseDate ? new Date(purchaseDate) : existingPurchase.purchaseDate,
        },
        include: {
          vendor: true,
          items: {
            include: { item: true },
          },
        },
      });

      return updated;
    });

    res.json(updatedPurchase);
  } catch (error: any) {
    console.error('Error updating purchase transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to update purchase entry' });
  }
});

// DELETE purchase entry and revert inventory stock
router.delete('/purchases/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureRecycleBinTable();

    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.purchase.findUnique({
        where: { id },
        include: { items: true, vendor: true },
      });

      if (!purchase) {
        throw new Error(`Purchase entry with ID ${id} not found`);
      }

      // 1. Revert stock quantity for each item
      for (const line of purchase.items) {
        const qty = Number(line.quantity);
        await tx.stockLedger.upsert({
          where: { itemId: line.itemId },
          update: {
            currentQuantity: {
              decrement: qty,
            },
          },
          create: {
            itemId: line.itemId,
            currentQuantity: 0,
          },
        });
      }

      // 2. Adjust vendor balance if positive
      if (purchase.vendor && Number(purchase.vendor.balance) > 0) {
        const deductAmount = Math.min(Number(purchase.vendor.balance), Number(purchase.totalAmount));
        await tx.vendor.update({
          where: { id: purchase.vendorId },
          data: {
            balance: {
              decrement: deductAmount,
            },
          },
        });
      }

      // Save snapshot to RecycleBin for 1-click restore
      await tx.recycleBin.create({
        data: {
          entityType: 'PURCHASE',
          entityId: id,
          displayName: `Purchase #${purchase.invoiceNumber} (${purchase.vendor?.name || 'Vendor'})`,
          details: `Total: ₹${Number(purchase.totalAmount).toLocaleString('en-IN')} | Items: ${purchase.items.length}`,
          payload: JSON.stringify(purchase),
        },
      });

      // 3. Delete purchase (cascade deletes purchase items)
      await tx.purchase.delete({
        where: { id },
      });

      return { message: 'Purchase entry moved to Recycle Bin and inventory reverted', id };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error deleting purchase:', error);
    res.status(400).json({ error: error.message || 'Failed to delete purchase entry' });
  }
});

export default router;
