import { Router } from 'express';
import { prisma, AccountType } from '@tally/database';

const router = Router();

// GET all bank & cash accounts with total balances
router.get('/banking/accounts', async (req, res) => {
  try {
    const accounts = await prisma.bankAccount.findMany({
      orderBy: { accountName: 'asc' },
      include: {
        _count: {
          select: { vouchers: true },
        },
      },
    });

    let totalBankBalance = 0;
    let totalCashBalance = 0;

    accounts.forEach((acc) => {
      const bal = Number(acc.currentBalance);
      if (acc.accountType === AccountType.BANK) {
        totalBankBalance += bal;
      } else {
        totalCashBalance += bal;
      }
    });

    res.json({
      accounts: accounts.map((acc) => ({
        ...acc,
        openingBalance: Number(acc.openingBalance),
        currentBalance: Number(acc.currentBalance),
      })),
      metrics: {
        totalBankBalance,
        totalCashBalance,
        totalCombinedBalance: totalBankBalance + totalCashBalance,
        totalAccountsCount: accounts.length,
      },
    });
  } catch (error) {
    console.error('Error fetching bank accounts:', error);
    res.status(500).json({ error: 'Failed to fetch bank accounts' });
  }
});

// GET single bank account details with transaction voucher ledger
router.get('/banking/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const account = await prisma.bankAccount.findUnique({
      where: { id },
      include: {
        vouchers: {
          include: {
            lines: true,
          },
          orderBy: { date: 'desc' },
        },
      },
    });

    if (!account) {
      return res.status(404).json({ error: 'Bank/Cash account not found' });
    }

    // Also fetch vouchers where lines reference this bank account ID
    const lineVouchers = await prisma.voucherLine.findMany({
      where: { ledgerId: id },
      include: {
        voucher: {
          include: { lines: true, bankAccount: true },
        },
      },
      orderBy: { voucher: { date: 'desc' } },
    });

    // Merge distinct vouchers
    const voucherMap = new Map();
    account.vouchers.forEach((v) => voucherMap.set(v.id, v));
    lineVouchers.forEach((lv) => voucherMap.set(lv.voucher.id, lv.voucher));
    const allLinkedVouchers = Array.from(voucherMap.values());

    let totalMoneyIn = 0;
    let totalMoneyOut = 0;

    allLinkedVouchers.forEach((v) => {
      const amt = Number(v.amount);
      if (v.voucherType === 'RECEIPT') {
        totalMoneyIn += amt;
      } else if (v.voucherType === 'PAYMENT') {
        totalMoneyOut += amt;
      } else if (v.voucherType === 'CONTRA') {
        // Check if debit or credit for this account
        const line = v.lines.find((l: any) => l.ledgerId === id);
        if (line) {
          if (Number(line.debitAmount) > 0) totalMoneyIn += Number(line.debitAmount);
          if (Number(line.creditAmount) > 0) totalMoneyOut += Number(line.creditAmount);
        }
      }
    });

    res.json({
      ...account,
      openingBalance: Number(account.openingBalance),
      currentBalance: Number(account.currentBalance),
      vouchers: allLinkedVouchers,
      analytics: {
        totalMoneyIn,
        totalMoneyOut,
        totalVouchersCount: allLinkedVouchers.length,
      },
    });
  } catch (error) {
    console.error('Error fetching bank account details:', error);
    res.status(500).json({ error: 'Failed to fetch bank account details' });
  }
});

// POST create new bank/cash account
router.post('/banking/accounts', async (req, res) => {
  try {
    const { accountName, accountType, accountNumber, ifscCode, branch, openingBalance } = req.body;

    if (!accountName) {
      return res.status(400).json({ error: 'Account name is required' });
    }

    const openBal = openingBalance ? parseFloat(openingBalance) : 0;

    const newAccount = await prisma.bankAccount.create({
      data: {
        accountName,
        accountType: (accountType as AccountType) || AccountType.BANK,
        accountNumber: accountNumber || null,
        ifscCode: ifscCode || null,
        branch: branch || null,
        openingBalance: openBal,
        currentBalance: openBal,
      },
    });

    res.status(201).json({
      ...newAccount,
      openingBalance: Number(newAccount.openingBalance),
      currentBalance: Number(newAccount.currentBalance),
    });
  } catch (error) {
    console.error('Error creating bank account:', error);
    res.status(500).json({ error: 'Failed to create bank account' });
  }
});

// PUT update bank/cash account
router.put('/banking/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { accountName, accountType, accountNumber, ifscCode, branch, openingBalance, currentBalance } = req.body;

    const existing = await prisma.bankAccount.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Account not found' });

    const updateData: any = {};
    if (accountName !== undefined) updateData.accountName = accountName;
    if (accountType !== undefined) updateData.accountType = accountType as AccountType;
    if (accountNumber !== undefined) updateData.accountNumber = accountNumber || null;
    if (ifscCode !== undefined) updateData.ifscCode = ifscCode || null;
    if (branch !== undefined) updateData.branch = branch || null;

    if (currentBalance !== undefined) {
      updateData.currentBalance = parseFloat(currentBalance);
    } else if (openingBalance !== undefined) {
      const newOpen = parseFloat(openingBalance);
      const diff = newOpen - Number(existing.openingBalance);
      updateData.openingBalance = newOpen;
      updateData.currentBalance = Number(existing.currentBalance) + diff;
    }

    if (openingBalance !== undefined) {
      updateData.openingBalance = parseFloat(openingBalance);
    }

    const updated = await prisma.bankAccount.update({
      where: { id },
      data: updateData,
    });

    res.json({
      ...updated,
      openingBalance: Number(updated.openingBalance),
      currentBalance: Number(updated.currentBalance),
    });
  } catch (error: any) {
    console.error('Error updating bank account:', error);
    res.status(500).json({ error: 'Failed to update bank account' });
  }
});

// DELETE bank/cash account
router.delete('/banking/accounts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.bankAccount.delete({ where: { id } });
    res.json({ message: 'Bank account deleted successfully', id });
  } catch (error: any) {
    console.error('Error deleting bank account:', error);
    res.status(500).json({ error: 'Failed to delete bank account' });
  }
});

export default router;

