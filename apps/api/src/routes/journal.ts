import { Router } from 'express';
import { prisma, JournalType } from '@tally/database';

const router = Router();

// GET all journal entries
router.get('/journal-entries', async (req, res) => {
  try {
    const entries = await prisma.journalEntry.findMany({
      include: {
        lines: true,
      },
      orderBy: { entryDate: 'desc' },
    });
    res.json(entries);
  } catch (error) {
    console.error('Error fetching journal entries:', error);
    res.status(500).json({ error: 'Failed to fetch journal entries' });
  }
});

// POST create a manual journal voucher (VALIDATES DEBIT === CREDIT BALANCE)
router.post('/journal-entries', async (req, res) => {
  try {
    const { description, entryDate, lines } = req.body;

    if (!description || !Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: 'Description and at least two line items (Debit & Credit) are required' });
    }

    // 1. Calculate Debit and Credit totals
    let totalDebit = 0;
    let totalCredit = 0;
    const validatedLines = [];

    for (const line of lines) {
      const { accountName, type, amount } = line;
      const parsedAmount = parseFloat(amount);

      if (!accountName || !type || isNaN(parsedAmount) || parsedAmount <= 0) {
        return res.status(400).json({ error: 'Invalid account name or amount in journal lines' });
      }

      if (type !== 'DEBIT' && type !== 'CREDIT') {
        return res.status(400).json({ error: 'Journal line type must be either DEBIT or CREDIT' });
      }

      if (type === 'DEBIT') {
        totalDebit += parsedAmount;
      } else {
        totalCredit += parsedAmount;
      }

      validatedLines.push({
        accountName,
        type: type as JournalType,
        amount: parsedAmount,
      });
    }

    // Double-entry validation rule: Debit == Credit
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      return res.status(400).json({
        error: `Unbalanced journal entry! Total Debit (${totalDebit.toFixed(2)}) must equal Total Credit (${totalCredit.toFixed(2)}). Difference: ${Math.abs(totalDebit - totalCredit).toFixed(2)}`,
      });
    }

    // 2. Generate unique voucher number JV-YYYYMMDD-XXXX
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const entryCount = await prisma.journalEntry.count();
    const voucherNumber = `JV-${dateStr}-${(entryCount + 1001).toString().padStart(4, '0')}`;

    // 3. Create Journal Entry
    const journalEntry = await prisma.journalEntry.create({
      data: {
        voucherNumber,
        description,
        entryDate: entryDate ? new Date(entryDate) : new Date(),
        totalAmount: totalDebit,
        lines: {
          create: validatedLines,
        },
      },
      include: {
        lines: true,
      },
    });

    res.status(201).json(journalEntry);
  } catch (error: any) {
    console.error('Error creating journal entry:', error);
    res.status(500).json({ error: error.message || 'Failed to create journal entry' });
  }
});

export default router;
