import { Router } from 'express';
import { prisma, PaymentMode } from '@tally/database';
import { backupEngine } from '../services/backupEngine';
import { ensureRecycleBinTable } from './recycleBin';

const router = Router();

// GET all invoices
router.get('/invoices', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET registered customers & vendors for POS checkout autocomplete
router.get('/customers', async (req, res) => {
  try {
    const query = (req.query.query as string || '').toLowerCase().trim();

    // 1. Fetch registered Vendors from Vendor directory
    const vendors = await prisma.vendor.findMany({
      orderBy: { name: 'asc' },
    });

    // 2. Fetch past Invoices for customer profiles
    const invoices = await prisma.invoice.findMany({
      where: {
        customerName: {
          not: null,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const customerMap = new Map<string, {
      id?: string;
      customerName: string;
      customerPhone?: string;
      customerGstin?: string;
      customerAddress?: string;
      shippedAddress?: string;
      outstandingBalance: number;
      count: number;
      type: 'VENDOR' | 'CUSTOMER';
    }>();

    // Add Vendors
    vendors.forEach((v) => {
      const key = `vendor-${v.id}`;
      customerMap.set(key, {
        id: v.id,
        customerName: v.name,
        customerPhone: v.phone || undefined,
        customerGstin: v.gstin || undefined,
        customerAddress: v.address || undefined,
        shippedAddress: v.address || undefined,
        outstandingBalance: Number(v.balance || 0),
        count: 1,
        type: 'VENDOR',
      });
    });

    // Add Past Invoices (Customers)
    invoices.forEach((inv) => {
      if (!inv.customerName) return;
      const normName = inv.customerName.toLowerCase().trim();
      const existingKey = Array.from(customerMap.keys()).find(
        (k) => customerMap.get(k)?.customerName.toLowerCase().trim() === normName
      );

      const out = Number(inv.outstandingBalance || 0);

      if (existingKey) {
        const existing = customerMap.get(existingKey)!;
        existing.count += 1;
        existing.outstandingBalance += out;
        if (!existing.customerPhone && inv.customerPhone) existing.customerPhone = inv.customerPhone;
        if (!existing.customerGstin && inv.customerGstin) existing.customerGstin = inv.customerGstin;
        if (!existing.customerAddress && inv.customerAddress) existing.customerAddress = inv.customerAddress;
        if (!existing.shippedAddress && inv.shippedAddress) existing.shippedAddress = inv.shippedAddress;
      } else {
        customerMap.set(`inv-${inv.id}`, {
          id: inv.id,
          customerName: inv.customerName,
          customerPhone: inv.customerPhone || undefined,
          customerGstin: inv.customerGstin || undefined,
          customerAddress: inv.customerAddress || undefined,
          shippedAddress: inv.shippedAddress || undefined,
          outstandingBalance: out,
          count: 1,
          type: 'CUSTOMER',
        });
      }
    });

    const results = Array.from(customerMap.values()).filter((c) => {
      if (!query) return true;
      return (
        c.customerName.toLowerCase().includes(query) ||
        (c.customerPhone && c.customerPhone.toLowerCase().includes(query)) ||
        (c.customerGstin && c.customerGstin.toLowerCase().includes(query)) ||
        (c.customerAddress && c.customerAddress.toLowerCase().includes(query))
      );
    });

    res.json(results);
  } catch (error) {
    console.error('Error fetching customer directory:', error);
    res.status(500).json({ error: 'Failed to fetch customer directory' });
  }
});

// GET overdue credit invoices
router.get('/invoices/overdue', async (req, res) => {
  try {
    const now = new Date();
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        paymentMode: PaymentMode.CREDIT,
        dueDate: {
          lt: now,
        },
        outstandingBalance: {
          gt: 0,
        },
      },
      include: {
        items: {
          include: { item: true },
        },
      },
      orderBy: { dueDate: 'asc' },
    });

    const formatted = overdueInvoices.map((inv) => {
      const due = inv.dueDate ? new Date(inv.dueDate) : new Date();
      const diffTime = Math.abs(now.getTime() - due.getTime());
      const overdueDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      return {
        ...inv,
        overdueDays,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error fetching overdue invoices:', error);
    res.status(500).json({ error: 'Failed to fetch overdue invoices' });
  }
});

// GET invoice by ID
router.get('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            item: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST new sales invoice (ATOMIC DB TRANSACTION WITH PRE-TAX DISCOUNT & EDITABLE UNIT PRICES)
router.post('/invoices', async (req, res) => {
  try {
    const {
      customerName,
      customerPhone,
      customerGstin,
      customerAddress,
      shippedAddress,
      placeOfSupply,
      poNumber,
      poDate,
      paymentTerms,
      paymentMode,
      creditDays,
      items,
      discountAmount,
    } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required to generate a bill' });
    }

    const discount = discountAmount ? parseFloat(discountAmount) : 0;

    // Perform atomic transaction
    const invoice = await prisma.$transaction(async (tx) => {
      let grossSubtotal = 0;
      const rawLineItems = [];

      // 1. Stock Validation and Gross Line Calculation (Supporting Custom Unit Prices)
      for (const line of items) {
        const { itemId, quantity, unitSellingPrice } = line;
        const qty = parseFloat(quantity);

        if (!itemId || isNaN(qty) || qty <= 0) {
          throw new Error('Invalid quantity specified in bill lines');
        }

        const dbItem = await tx.item.findUnique({
          where: { id: itemId },
          include: { stock: true },
        });

        if (!dbItem) {
          throw new Error(`Item with ID ${itemId} not found`);
        }

        const availableQty = dbItem.stock ? Number(dbItem.stock.currentQuantity) : 0;
        if (availableQty < qty) {
          throw new Error(
            `Insufficient stock for "${dbItem.name}". Available: ${availableQty} ${dbItem.unit}, Requested: ${qty}`
          );
        }

        // Use custom unit price if specified by user, else default to item selling price
        const price = unitSellingPrice !== undefined && !isNaN(parseFloat(unitSellingPrice))
          ? parseFloat(unitSellingPrice)
          : Number(dbItem.sellingPrice);

        const taxRate = Number(dbItem.taxRate);
        const lineGrossSubtotal = qty * price;

        grossSubtotal += lineGrossSubtotal;

        rawLineItems.push({
          dbItem,
          qty,
          price,
          taxRate,
          lineGrossSubtotal,
        });
      }

      // 2. Pre-Tax Base Subtotal Discounting & GST Tax Math
      const discountedSubtotal = Math.max(0, grossSubtotal - discount);
      const taxRatio = grossSubtotal > 0 ? (discountedSubtotal / grossSubtotal) : 1;

      let totalTaxAmount = 0;
      const invoiceItemsData = [];

      for (const raw of rawLineItems) {
        // Line taxable amount after pre-tax discount ratio
        const lineTaxableAmount = raw.lineGrossSubtotal * taxRatio;
        const lineTaxAmount = lineTaxableAmount * (raw.taxRate / 100);
        const lineTotalPrice = lineTaxableAmount + lineTaxAmount;

        totalTaxAmount += lineTaxAmount;

        invoiceItemsData.push({
          itemId: raw.dbItem.id,
          quantity: raw.qty,
          unitSellingPrice: raw.price,
          taxRate: raw.taxRate,
          totalPrice: lineTotalPrice,
        });
      }

      const netTotal = discountedSubtotal + totalTaxAmount;

      // 3. Compute Credit Days & Due Date if CREDIT mode
      let parsedCreditDays: number | null = null;
      let dueDate: Date | null = null;
      let outstandingBalance: number = 0;

      if (paymentMode === PaymentMode.CREDIT) {
        parsedCreditDays = creditDays ? parseInt(creditDays, 10) : 30;
        dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + parsedCreditDays);
        outstandingBalance = netTotal;
      }

      // 4. ATOMIC DYNAMIC INVOICE SEQUENCE ENGINE (e.g. 26-27/001)
      let settings = await tx.companySettings.findFirst();
      if (!settings) {
        settings = await tx.companySettings.create({
          data: {
            companyName: 'Tally Solutions Enterprise',
            invoicePrefix: '26-27/',
            nextInvoiceNumber: 1,
            invoiceNumberPadding: 3,
          },
        });
      }

      const seqStr = String(settings.nextInvoiceNumber).padStart(settings.invoiceNumberPadding, '0');
      const invoiceNumber = `${settings.invoicePrefix}${seqStr}`;

      // Increment nextInvoiceNumber counter
      await tx.companySettings.update({
        where: { id: settings.id },
        data: {
          nextInvoiceNumber: { increment: 1 },
        },
      });

      // 5. Create Invoice Record (Subtotal stored as Discounted Taxable Subtotal)
      const newInvoice = await tx.invoice.create({
        data: {
          customerName: customerName || 'Walk-in Customer',
          customerPhone: customerPhone || null,
          customerGstin: customerGstin || null,
          customerAddress: customerAddress || null,
          shippedAddress: shippedAddress || customerAddress || null,
          placeOfSupply: placeOfSupply || 'Haryana (06)',
          poNumber: poNumber || 'By MAIL',
          poDate: poDate ? new Date(poDate) : new Date(),
          paymentTerms: paymentTerms || (paymentMode === 'CREDIT' ? `${creditDays || 15} Days Credit` : 'Against Delivery'),
          invoiceNumber,
          subtotal: discountedSubtotal,
          taxAmount: totalTaxAmount,
          totalAmount: netTotal,
          paymentMode: (paymentMode as PaymentMode) || PaymentMode.CASH,
          creditDays: parsedCreditDays,
          dueDate,
          outstandingBalance,
          items: {
            create: invoiceItemsData,
          },
        },
        include: {
          items: {
            include: {
              item: true,
            },
          },
        },
      });

      // 6. Decrement Stock Ledger currentQuantity
      for (const line of invoiceItemsData) {
        await tx.stockLedger.update({
          where: { itemId: line.itemId },
          data: {
            currentQuantity: {
              decrement: line.quantity,
            },
          },
        });
      }

      return newInvoice;
    });

    backupEngine.notifyDataChange();
    res.status(201).json(invoice);
  } catch (error: any) {
    console.error('Error generating invoice transaction:', error);
    res.status(400).json({ error: error.message || 'Failed to generate invoice' });
  }
});

// PUT /api/invoices/:id (UPSERT / EDIT PENDING BILL DETAILS & PAYMENT STATUS)
router.put('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      customerName,
      customerPhone,
      customerGstin,
      customerAddress,
      shippedAddress,
      placeOfSupply,
      poNumber,
      poDate,
      paymentTerms,
      paymentMode,
      creditDays,
      outstandingBalance,
      items,
    } = req.body;

    const updatedInvoice = await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      let subtotal = Number(existing.subtotal);
      let taxAmount = Number(existing.taxAmount);
      let totalAmount = Number(existing.totalAmount);

      // If items array is updated, recalculate totals
      if (Array.isArray(items) && items.length > 0) {
        subtotal = 0;
        taxAmount = 0;
        const newInvoiceItems = [];

        // Restore previous item stock
        for (const oldLine of existing.items) {
          await tx.stockLedger.update({
            where: { itemId: oldLine.itemId },
            data: { currentQuantity: { increment: oldLine.quantity } },
          });
        }

        // Delete old line items
        await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });

        // Add new line items
        for (const line of items) {
          const { itemId, quantity, unitSellingPrice, name, taxRate: lineTax } = line;
          const qty = parseFloat(quantity);
          let dbItem = await tx.item.findUnique({ where: { id: itemId } });

          if (!dbItem && name) {
            dbItem = await tx.item.create({
              data: {
                name,
                sku: `SRV-${Math.floor(100000 + Math.random() * 900000)}`,
                category: 'Service',
                unit: 'Service',
                purchasePrice: 0,
                sellingPrice: parseFloat(unitSellingPrice || 0),
                taxRate: lineTax !== undefined ? parseFloat(lineTax) : 18,
                minStockLevel: 0,
                stock: { create: { currentQuantity: 999999 } },
              },
            });
          }

          if (!dbItem) throw new Error(`Item ${itemId} not found`);

          const sellingPrice = unitSellingPrice !== undefined && !isNaN(parseFloat(unitSellingPrice))
            ? parseFloat(unitSellingPrice)
            : Number(dbItem.sellingPrice);
          const taxRate = lineTax !== undefined && !isNaN(parseFloat(lineTax)) ? parseFloat(lineTax) : Number(dbItem.taxRate);

          const lineSubtotal = qty * sellingPrice;
          const lineTaxAmt = lineSubtotal * (taxRate / 100);
          const lineTotal = lineSubtotal + lineTaxAmt;

          subtotal += lineSubtotal;
          taxAmount += lineTaxAmt;

          newInvoiceItems.push({
            invoiceId: id,
            itemId: dbItem.id,
            quantity: qty,
            unitSellingPrice: sellingPrice,
            taxRate,
            totalPrice: lineTotal,
          });

          // Decrement stock
          await tx.stockLedger.update({
            where: { itemId: dbItem.id },
            data: { currentQuantity: { decrement: qty } },
          });
        }

        totalAmount = subtotal + taxAmount;
        await tx.invoiceItem.createMany({ data: newInvoiceItems });
      }

      // Compute Due Date if creditDays updated
      let dueDate = existing.dueDate;
      if (paymentMode === PaymentMode.CREDIT || existing.paymentMode === PaymentMode.CREDIT) {
        const days = creditDays !== undefined ? parseInt(creditDays, 10) : existing.creditDays || 30;
        dueDate = new Date(existing.createdAt);
        dueDate.setDate(dueDate.getDate() + days);
      }

      const updated = await tx.invoice.update({
        where: { id },
        data: {
          ...(customerName !== undefined && { customerName }),
          ...(customerPhone !== undefined && { customerPhone }),
          ...(customerGstin !== undefined && { customerGstin }),
          ...(customerAddress !== undefined && { customerAddress }),
          ...(shippedAddress !== undefined && { shippedAddress }),
          ...(placeOfSupply !== undefined && { placeOfSupply }),
          ...(poNumber !== undefined && { poNumber }),
          ...(poDate !== undefined && { poDate: poDate ? new Date(poDate) : null }),
          ...(paymentTerms !== undefined && { paymentTerms }),
          ...(paymentMode !== undefined && { paymentMode }),
          ...(creditDays !== undefined && { creditDays: parseInt(creditDays, 10) }),
          ...(dueDate !== undefined && { dueDate }),
          ...(outstandingBalance !== undefined && { outstandingBalance: parseFloat(outstandingBalance) }),
          subtotal,
          taxAmount,
          totalAmount,
        },
        include: {
          items: {
            include: { item: true },
          },
        },
      });

      return updated;
    });

    res.json(updatedInvoice);
  } catch (error: any) {
    console.error('Error upserting invoice:', error);
    res.status(400).json({ error: error.message || 'Failed to upsert invoice' });
  }
});

// DELETE /api/invoices/:id (CANCEL / VOID INVOICE & RESTORE STOCK)
router.delete('/invoices/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureRecycleBinTable();

    await prisma.$transaction(async (tx) => {
      const existing = await tx.invoice.findUnique({
        where: { id },
        include: { items: true },
      });

      if (!existing) {
        throw new Error(`Invoice with ID ${id} not found`);
      }

      // Save snapshot to RecycleBin for 1-click restore
      await tx.recycleBin.create({
        data: {
          entityType: 'INVOICE',
          entityId: id,
          displayName: `Invoice #${existing.invoiceNumber} (${existing.customerName || 'Cash Sale'})`,
          details: `Total: ₹${Number(existing.totalAmount).toLocaleString('en-IN')} | Items: ${existing.items.length}`,
          payload: JSON.stringify(existing),
        },
      });

      // Restore stock ledger for all items in this invoice
      for (const line of existing.items) {
        await tx.stockLedger.update({
          where: { itemId: line.itemId },
          data: { currentQuantity: { increment: line.quantity } },
        });
      }

      // Delete invoice items and invoice
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    res.json({ message: 'Invoice moved to Recycle Bin and stock restored.', id });
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    res.status(400).json({ error: error.message || 'Failed to delete invoice' });
  }
});

export default router;
