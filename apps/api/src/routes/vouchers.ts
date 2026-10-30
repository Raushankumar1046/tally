import { Router } from 'express';
import { prisma, VoucherType, LedgerType } from '@tally/database';
import { ensureRecycleBinTable } from './recycleBin';

const router = Router();

// GET all vouchers
router.get('/vouchers', async (req, res) => {
  try {
    const vouchers = await prisma.voucher.findMany({
      include: {
        bankAccount: true,
        lines: true,
      },
      orderBy: { date: 'desc' },
    });
    res.json(vouchers);
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({ error: 'Failed to fetch vouchers' });
  }
});

// POST Customer Payment Receipt (ATOMIC TRANSACTION WITH CUSTOM DATE)
router.post('/vouchers/receipt', async (req, res) => {
  try {
    const { customerName, bankAccountId, amount, referenceNumber, narration, date } = req.body;

    const receiptAmount = parseFloat(amount);
    if (!customerName || !bankAccountId || isNaN(receiptAmount) || receiptAmount <= 0) {
      return res.status(400).json({ error: 'Customer name, bank account, and valid positive amount are required' });
    }

    const voucherDate = date ? new Date(date) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify Bank/Cash Account
      const bank = await tx.bankAccount.findUnique({ where: { id: bankAccountId } });
      if (!bank) {
        throw new Error(`Bank/Cash account with ID ${bankAccountId} not found`);
      }

      // 2. Increment Bank Account Balance
      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          currentBalance: {
            increment: receiptAmount,
          },
        },
      });

      // 3. Reduce Customer Outstanding Credit Invoice Balances if any
      const creditInvoices = await tx.invoice.findMany({
        where: {
          customerName,
          outstandingBalance: { gt: 0 },
        },
        orderBy: { dueDate: 'asc' },
      });

      let remainingReceipt = receiptAmount;
      for (const inv of creditInvoices) {
        if (remainingReceipt <= 0) break;
        const currentOut = Number(inv.outstandingBalance || 0);
        const deduction = Math.min(currentOut, remainingReceipt);
        remainingReceipt -= deduction;

        await tx.invoice.update({
          where: { id: inv.id },
          data: {
            outstandingBalance: currentOut - deduction,
          },
        });
      }

      // 4. Generate Voucher Number REC-YYYYMMDD-XXXX
      const dateStr = voucherDate.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.voucher.count({ where: { voucherType: VoucherType.RECEIPT } });
      const voucherNumber = `REC-${dateStr}-${(count + 1001).toString().padStart(4, '0')}`;

      // 5. Create Receipt Voucher & Lines
      const voucher = await tx.voucher.create({
        data: {
          voucherNumber,
          voucherType: VoucherType.RECEIPT,
          amount: receiptAmount,
          date: voucherDate,
          referenceNumber: referenceNumber || null,
          narration: narration || `Customer receipt from ${customerName}`,
          bankAccountId: bank.id,
          lines: {
            create: [
              {
                ledgerType: bank.accountType === 'BANK' ? LedgerType.BANK : LedgerType.CASH,
                ledgerId: bank.id,
                accountName: bank.accountName,
                debitAmount: receiptAmount,
                creditAmount: 0.00,
              },
              {
                ledgerType: LedgerType.CUSTOMER,
                accountName: customerName,
                debitAmount: 0.00,
                creditAmount: receiptAmount,
              },
            ],
          },
        },
        include: {
          bankAccount: true,
          lines: true,
        },
      });

      return voucher;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error recording receipt voucher:', error);
    res.status(400).json({ error: error.message || 'Failed to record receipt voucher' });
  }
});

// POST Vendor Payment Voucher (ATOMIC TRANSACTION WITH CUSTOM DATE & PAYMENT MODE)
router.post('/vouchers/payment', async (req, res) => {
  try {
    const { vendorId, bankAccountId, amount, referenceNumber, narration, date, paymentMode } = req.body;

    const paymentAmount = parseFloat(amount);
    if (!vendorId || !bankAccountId || isNaN(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Vendor, bank account, and valid positive amount are required' });
    }

    const voucherDate = date ? new Date(date) : new Date();
    const modeLabel = paymentMode || 'BANK';

    const result = await prisma.$transaction(async (tx) => {
      // 1. Verify Vendor & Bank
      const vendor = await tx.vendor.findUnique({ where: { id: vendorId } });
      if (!vendor) throw new Error('Vendor not found');

      const bank = await tx.bankAccount.findUnique({ where: { id: bankAccountId } });
      if (!bank) throw new Error('Bank account not found');

      // 2. Decrement Vendor balance & Decrement Bank balance
      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          balance: {
            decrement: paymentAmount,
          },
        },
      });

      await tx.bankAccount.update({
        where: { id: bankAccountId },
        data: {
          currentBalance: {
            decrement: paymentAmount,
          },
        },
      });

      // 3. Generate Voucher Number PAY-YYYYMMDD-XXXX
      const dateStr = voucherDate.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.voucher.count({ where: { voucherType: VoucherType.PAYMENT } });
      const voucherNumber = `PAY-${dateStr}-${(count + 1001).toString().padStart(4, '0')}`;

      // 4. Create Payment Voucher & Lines
      const refStr = referenceNumber ? `${modeLabel}-${referenceNumber}` : modeLabel;
      const voucher = await tx.voucher.create({
        data: {
          voucherNumber,
          voucherType: VoucherType.PAYMENT,
          amount: paymentAmount,
          date: voucherDate,
          referenceNumber: refStr,
          narration: narration || `Vendor payment to ${vendor.name} via ${modeLabel}`,
          vendorId: vendor.id,
          bankAccountId: bank.id,
          lines: {
            create: [
              {
                ledgerType: LedgerType.VENDOR,
                ledgerId: vendor.id,
                accountName: vendor.name,
                debitAmount: paymentAmount,
                creditAmount: 0.00,
              },
              {
                ledgerType: bank.accountType === 'BANK' ? LedgerType.BANK : LedgerType.CASH,
                ledgerId: bank.id,
                accountName: bank.accountName,
                debitAmount: 0.00,
                creditAmount: paymentAmount,
              },
            ],
          },
        },
        include: {
          bankAccount: true,
          lines: true,
        },
      });

      return voucher;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error recording payment voucher:', error);
    res.status(400).json({ error: error.message || 'Failed to record payment voucher' });
  }
});

// POST Contra Entry (Cash Deposit / Withdrawal / Bank Transfer) (ATOMIC TRANSACTION WITH CUSTOM DATE)
router.post('/vouchers/contra', async (req, res) => {
  try {
    const { fromBankAccountId, toBankAccountId, amount, referenceNumber, narration, date } = req.body;

    const contraAmount = parseFloat(amount);
    if (!fromBankAccountId || !toBankAccountId || isNaN(contraAmount) || contraAmount <= 0) {
      return res.status(400).json({ error: 'Source account, destination account, and valid positive amount are required' });
    }

    if (fromBankAccountId === toBankAccountId) {
      return res.status(400).json({ error: 'Source and destination accounts must be different' });
    }

    const voucherDate = date ? new Date(date) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      const fromAcc = await tx.bankAccount.findUnique({ where: { id: fromBankAccountId } });
      const toAcc = await tx.bankAccount.findUnique({ where: { id: toBankAccountId } });

      if (!fromAcc || !toAcc) {
        throw new Error('Source or destination bank/cash account not found');
      }

      // Decrement source & Increment destination
      await tx.bankAccount.update({
        where: { id: fromBankAccountId },
        data: { currentBalance: { decrement: contraAmount } },
      });

      await tx.bankAccount.update({
        where: { id: toBankAccountId },
        data: { currentBalance: { increment: contraAmount } },
      });

      // Generate Voucher Number CON-YYYYMMDD-XXXX
      const dateStr = voucherDate.toISOString().slice(0, 10).replace(/-/g, '');
      const count = await tx.voucher.count({ where: { voucherType: VoucherType.CONTRA } });
      const voucherNumber = `CON-${dateStr}-${(count + 1001).toString().padStart(4, '0')}`;

      const voucher = await tx.voucher.create({
        data: {
          voucherNumber,
          voucherType: VoucherType.CONTRA,
          amount: contraAmount,
          date: voucherDate,
          referenceNumber: referenceNumber || null,
          narration: narration || `Contra transfer from ${fromAcc.accountName} to ${toAcc.accountName}`,
          bankAccountId: fromAcc.id,
          lines: {
            create: [
              {
                ledgerType: toAcc.accountType === 'BANK' ? LedgerType.BANK : LedgerType.CASH,
                ledgerId: toAcc.id,
                accountName: toAcc.accountName,
                debitAmount: contraAmount,
                creditAmount: 0.00,
              },
              {
                ledgerType: fromAcc.accountType === 'BANK' ? LedgerType.BANK : LedgerType.CASH,
                ledgerId: fromAcc.id,
                accountName: fromAcc.accountName,
                debitAmount: 0.00,
                creditAmount: contraAmount,
              },
            ],
          },
        },
        include: {
          bankAccount: true,
          lines: true,
        },
      });

      return voucher;
    });

    res.status(201).json(result);
  } catch (error: any) {
    console.error('Error recording contra voucher:', error);
    res.status(400).json({ error: error.message || 'Failed to record contra voucher' });
  }
});

// GET single voucher by ID
router.get('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await prisma.voucher.findUnique({
      where: { id },
      include: {
        bankAccount: true,
        lines: true,
      },
    });
    if (!voucher) return res.status(404).json({ error: 'Voucher not found' });
    res.json(voucher);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch voucher' });
  }
});

// PUT update voucher details
router.put('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, date, referenceNumber, narration } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.voucher.findUnique({
        where: { id },
        include: { lines: true, bankAccount: true },
      });

      if (!existing) throw new Error(`Voucher with ID ${id} not found`);

      const oldAmount = Number(existing.amount);
      const newAmount = amount !== undefined ? parseFloat(amount) : oldAmount;
      if (isNaN(newAmount) || newAmount <= 0) throw new Error('Invalid positive amount');

      const amountDiff = newAmount - oldAmount; // if increased: +ve, if decreased: -ve

      // Handle balance reconciliations based on voucher type
      if (existing.voucherType === VoucherType.PAYMENT) {
        if (amountDiff !== 0) {
          // Decrement bank & vendor balance by difference
          if (existing.bankAccountId) {
            await tx.bankAccount.update({
              where: { id: existing.bankAccountId },
              data: { currentBalance: { decrement: amountDiff } },
            });
          }
          if (existing.vendorId) {
            await tx.vendor.update({
              where: { id: existing.vendorId },
              data: { balance: { decrement: amountDiff } },
            });
          }
        }
      } else if (existing.voucherType === VoucherType.RECEIPT) {
        if (amountDiff !== 0 && existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { currentBalance: { increment: amountDiff } },
          });
        }
      } else if (existing.voucherType === VoucherType.CONTRA) {
        if (amountDiff !== 0) {
          // In contra, line 0 is destination (debit), line 1 is source (credit)
          const destLine = existing.lines.find((l) => Number(l.debitAmount) > 0);
          const srcLine = existing.lines.find((l) => Number(l.creditAmount) > 0);
          if (destLine?.ledgerId) {
            await tx.bankAccount.update({
              where: { id: destLine.ledgerId },
              data: { currentBalance: { increment: amountDiff } },
            });
          }
          if (srcLine?.ledgerId) {
            await tx.bankAccount.update({
              where: { id: srcLine.ledgerId },
              data: { currentBalance: { decrement: amountDiff } },
            });
          }
        }
      }

      // Update lines amount
      if (amountDiff !== 0) {
        for (const line of existing.lines) {
          await tx.voucherLine.update({
            where: { id: line.id },
            data: {
              debitAmount: Number(line.debitAmount) > 0 ? newAmount : 0,
              creditAmount: Number(line.creditAmount) > 0 ? newAmount : 0,
            },
          });
        }
      }

      // Update Voucher
      const updated = await tx.voucher.update({
        where: { id },
        data: {
          amount: newAmount,
          date: date ? new Date(date) : existing.date,
          referenceNumber: referenceNumber !== undefined ? referenceNumber : existing.referenceNumber,
          narration: narration !== undefined ? narration : existing.narration,
        },
        include: {
          bankAccount: true,
          lines: true,
        },
      });

      return updated;
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error updating voucher:', error);
    res.status(400).json({ error: error.message || 'Failed to update voucher' });
  }
});

// DELETE voucher and revert balances
router.delete('/vouchers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureRecycleBinTable();

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.voucher.findUnique({
        where: { id },
        include: { lines: true, bankAccount: true },
      });

      if (!existing) throw new Error(`Voucher with ID ${id} not found`);

      const vAmount = Number(existing.amount);

      // Revert balances
      if (existing.voucherType === VoucherType.PAYMENT) {
        // Revert payment: Add back to bank and add back to vendor balance
        if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { currentBalance: { increment: vAmount } },
          });
        }
        if (existing.vendorId) {
          await tx.vendor.update({
            where: { id: existing.vendorId },
            data: { balance: { increment: vAmount } },
          });
        }
      } else if (existing.voucherType === VoucherType.RECEIPT) {
        // Revert receipt: Deduct from bank
        if (existing.bankAccountId) {
          await tx.bankAccount.update({
            where: { id: existing.bankAccountId },
            data: { currentBalance: { decrement: vAmount } },
          });
        }
      } else if (existing.voucherType === VoucherType.CONTRA) {
        // Revert contra: Add back to source, deduct from destination
        const destLine = existing.lines.find((l) => Number(l.debitAmount) > 0);
        const srcLine = existing.lines.find((l) => Number(l.creditAmount) > 0);
        if (destLine?.ledgerId) {
          await tx.bankAccount.update({
            where: { id: destLine.ledgerId },
            data: { currentBalance: { decrement: vAmount } },
          });
        }
        if (srcLine?.ledgerId) {
          await tx.bankAccount.update({
            where: { id: srcLine.ledgerId },
            data: { currentBalance: { increment: vAmount } },
          });
        }
      }

      // Save snapshot to RecycleBin for 1-click restore
      await tx.recycleBin.create({
        data: {
          entityType: 'VOUCHER',
          entityId: id,
          displayName: `Voucher #${existing.voucherNumber} (${existing.voucherType})`,
          details: `Amount: ₹${Number(existing.amount).toLocaleString('en-IN')} | Ref: ${existing.referenceNumber || 'None'} | Narration: ${existing.narration || 'None'}`,
          payload: JSON.stringify(existing),
        },
      });

      await tx.voucher.delete({ where: { id } });

      return { message: 'Voucher moved to Recycle Bin and account balances reverted', id };
    });

    res.json(result);
  } catch (error: any) {
    console.error('Error deleting voucher:', error);
    res.status(400).json({ error: error.message || 'Failed to delete voucher' });
  }
});

export default router;
