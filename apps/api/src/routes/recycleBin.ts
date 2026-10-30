import express from 'express';
import { prisma } from '@tally/database';

export async function ensureRecycleBinTable() {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "RecycleBin" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "entityType" TEXT NOT NULL,
        "entityId" TEXT NOT NULL,
        "displayName" TEXT NOT NULL,
        "details" TEXT,
        "payload" TEXT NOT NULL,
        "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (err) {
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS "RecycleBin" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "entityType" TEXT NOT NULL,
          "entityId" TEXT NOT NULL,
          "displayName" TEXT NOT NULL,
          "details" TEXT,
          "payload" TEXT NOT NULL,
          "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);
    } catch (e: any) {
      console.error('Failed to ensure RecycleBin table:', e.message);
    }
  }
}

const router = express.Router();

// GET /api/recycle-bin - List all soft-deleted items in trash
router.get('/recycle-bin', async (req, res) => {
  try {
    await ensureRecycleBinTable();
    const { entityType } = req.query;
    const where: any = {};
    if (entityType && typeof entityType === 'string' && entityType !== 'ALL') {
      where.entityType = entityType.toUpperCase();
    }

    const items = await prisma.recycleBin.findMany({
      where,
      orderBy: { deletedAt: 'desc' },
    });

    res.json(items);
  } catch (error: any) {
    console.error('Error fetching recycle bin:', error);
    res.status(500).json({ error: 'Failed to fetch recycle bin items' });
  }
});

// POST /api/recycle-bin/:id/restore - Restore an item back to its active table
router.post('/recycle-bin/:id/restore', async (req, res) => {
  try {
    const { id } = req.params;

    const binItem = await prisma.recycleBin.findUnique({ where: { id } });
    if (!binItem) {
      return res.status(404).json({ error: 'Item not found in Recycle Bin' });
    }

    const snapshot = JSON.parse(binItem.payload);

    await prisma.$transaction(async (tx) => {
      switch (binItem.entityType) {
        case 'INVOICE': {
          // Recreate invoice & items
          const { items, ...invoiceData } = snapshot;

          // Check if invoice number already taken
          const existingInv = await tx.invoice.findUnique({
            where: { invoiceNumber: invoiceData.invoiceNumber },
          });

          let finalInvoiceNumber = invoiceData.invoiceNumber;
          if (existingInv) {
            finalInvoiceNumber = `${invoiceData.invoiceNumber}-RESTORED`;
          }

          // Convert date strings to Date objects if needed
          const restoredInvoice = await tx.invoice.create({
            data: {
              ...invoiceData,
              id: invoiceData.id, // preserve original id
              invoiceNumber: finalInvoiceNumber,
              createdAt: new Date(invoiceData.createdAt || Date.now()),
              poDate: invoiceData.poDate ? new Date(invoiceData.poDate) : null,
              dueDate: invoiceData.dueDate ? new Date(invoiceData.dueDate) : null,
              items: {
                create: (items || []).map((line: any) => ({
                  itemId: line.itemId,
                  quantity: line.quantity,
                  unitSellingPrice: line.unitSellingPrice,
                  taxRate: line.taxRate,
                  totalPrice: line.totalPrice,
                })),
              },
            },
          });

          // Deduct stock for all items
          for (const line of items || []) {
            if (line.itemId) {
              await tx.stockLedger.upsert({
                where: { itemId: line.itemId },
                update: { currentQuantity: { decrement: Number(line.quantity) } },
                create: { itemId: line.itemId, currentQuantity: -Number(line.quantity) },
              });
            }
          }
          break;
        }

        case 'PURCHASE': {
          const { items, vendor, ...purchaseData } = snapshot;

          await tx.purchase.create({
            data: {
              ...purchaseData,
              id: purchaseData.id,
              purchaseDate: new Date(purchaseData.purchaseDate || Date.now()),
              createdAt: new Date(purchaseData.createdAt || Date.now()),
              items: {
                create: (items || []).map((line: any) => ({
                  itemId: line.itemId,
                  quantity: line.quantity,
                  unitPurchasePrice: line.unitPurchasePrice,
                  taxRate: line.taxRate,
                  taxableAmount: line.taxableAmount,
                  taxAmount: line.taxAmount,
                  totalPrice: line.totalPrice,
                })),
              },
            },
          });

          // Increment stock back
          for (const line of items || []) {
            if (line.itemId) {
              await tx.stockLedger.upsert({
                where: { itemId: line.itemId },
                update: { currentQuantity: { increment: Number(line.quantity) } },
                create: { itemId: line.itemId, currentQuantity: Number(line.quantity) },
              });
            }
          }

          // Restore vendor balance
          if (purchaseData.vendorId) {
            await tx.vendor.update({
              where: { id: purchaseData.vendorId },
              data: { balance: { increment: Number(purchaseData.totalAmount) } },
            });
          }
          break;
        }

        case 'VENDOR': {
          const { purchases, _count, ...vendorData } = snapshot;
          await tx.vendor.create({
            data: {
              ...vendorData,
              id: vendorData.id,
              createdAt: new Date(vendorData.createdAt || Date.now()),
              updatedAt: new Date(),
            },
          });
          break;
        }

        case 'ITEM': {
          const { stock, purchaseItems, invoiceItems, ...itemData } = snapshot;
          const restoredItem = await tx.item.create({
            data: {
              ...itemData,
              id: itemData.id,
              createdAt: new Date(itemData.createdAt || Date.now()),
              updatedAt: new Date(),
            },
          });

          await tx.stockLedger.create({
            data: {
              itemId: restoredItem.id,
              currentQuantity: stock ? Number(stock.currentQuantity) : 0,
            },
          });
          break;
        }

        case 'VOUCHER': {
          const { lines, bankAccount, ...voucherData } = snapshot;

          await tx.voucher.create({
            data: {
              ...voucherData,
              id: voucherData.id,
              date: new Date(voucherData.date || Date.now()),
              createdAt: new Date(voucherData.createdAt || Date.now()),
              lines: {
                create: (lines || []).map((l: any) => ({
                  ledgerType: l.ledgerType,
                  ledgerId: l.ledgerId,
                  accountName: l.accountName,
                  debitAmount: l.debitAmount,
                  creditAmount: l.creditAmount,
                })),
              },
            },
          });

          const vAmount = Number(voucherData.amount);
          const vType = String(voucherData.voucherType).toUpperCase();

          if (vType === 'PAYMENT') {
            if (voucherData.bankAccountId) {
              await tx.bankAccount.update({
                where: { id: voucherData.bankAccountId },
                data: { currentBalance: { decrement: vAmount } },
              });
            }
            if (voucherData.vendorId) {
              await tx.vendor.update({
                where: { id: voucherData.vendorId },
                data: { balance: { decrement: vAmount } },
              });
            }
          } else if (vType === 'RECEIPT') {
            if (voucherData.bankAccountId) {
              await tx.bankAccount.update({
                where: { id: voucherData.bankAccountId },
                data: { currentBalance: { increment: vAmount } },
              });
            }
          } else if (vType === 'CONTRA') {
            const destLine = (lines || []).find((l: any) => Number(l.debitAmount) > 0);
            const srcLine = (lines || []).find((l: any) => Number(l.creditAmount) > 0);
            if (destLine?.ledgerId) {
              await tx.bankAccount.update({
                where: { id: destLine.ledgerId },
                data: { currentBalance: { increment: vAmount } },
              });
            }
            if (srcLine?.ledgerId) {
              await tx.bankAccount.update({
                where: { id: srcLine.ledgerId },
                data: { currentBalance: { decrement: vAmount } },
              });
            }
          }
          break;
        }

        default:
          throw new Error(`Unsupported entity type: ${binItem.entityType}`);
      }

      // Delete from RecycleBin table
      await tx.recycleBin.delete({ where: { id } });
    });

    res.json({ message: `"${binItem.displayName}" restored successfully!`, id });
  } catch (error: any) {
    console.error('Error restoring from recycle bin:', error);
    res.status(400).json({ error: error.message || 'Failed to restore item' });
  }
});

// DELETE /api/recycle-bin/:id - Permanently delete an item from trash
router.delete('/recycle-bin/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.recycleBin.delete({ where: { id } });
    res.json({ message: 'Item deleted permanently from Recycle Bin', id });
  } catch (error: any) {
    console.error('Error deleting permanently:', error);
    res.status(400).json({ error: error.message || 'Failed to permanently delete item' });
  }
});

// DELETE /api/recycle-bin - Empty entire Recycle Bin (or by entityType)
router.delete('/recycle-bin', async (req, res) => {
  try {
    const { entityType } = req.query;
    const where: any = {};
    if (entityType && typeof entityType === 'string' && entityType !== 'ALL') {
      where.entityType = entityType.toUpperCase();
    }

    const { count } = await prisma.recycleBin.deleteMany({ where });
    res.json({ message: `Recycle Bin emptied successfully (${count} items removed)` });
  } catch (error: any) {
    console.error('Error emptying recycle bin:', error);
    res.status(500).json({ error: 'Failed to empty recycle bin' });
  }
});

export default router;
