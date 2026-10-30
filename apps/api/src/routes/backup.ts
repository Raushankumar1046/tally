import { Router } from 'express';
import { prisma } from '@tally/database';
import fs from 'fs';
import path from 'path';

const router = Router();

// GET Live Backup Summary (Counts of all records)
router.get('/backup/summary', async (req, res) => {
  try {
    const [
      companySettingsCount,
      vendorCount,
      itemCount,
      bankAccountCount,
      invoiceCount,
      purchaseCount,
      journalEntryCount,
      voucherCount,
    ] = await Promise.all([
      prisma.companySettings.count(),
      prisma.vendor.count(),
      prisma.item.count(),
      prisma.bankAccount.count(),
      prisma.invoice.count(),
      prisma.purchase.count(),
      prisma.journalEntry.count(),
      prisma.voucher.count(),
    ]);

    res.json({
      companySettingsCount,
      vendorCount,
      itemCount,
      bankAccountCount,
      invoiceCount,
      purchaseCount,
      journalEntryCount,
      voucherCount,
      totalRecords:
        companySettingsCount +
        vendorCount +
        itemCount +
        bankAccountCount +
        invoiceCount +
        purchaseCount +
        journalEntryCount +
        voucherCount,
    });
  } catch (error: any) {
    console.error('Error fetching backup summary:', error);
    res.status(500).json({ error: 'Failed to fetch backup summary', message: error.message });
  }
});

// GET Full System Data Export (.json)
router.get('/backup/export', async (req, res) => {
  try {
    const [
      companySettings,
      bankAccounts,
      vendors,
      items,
      stockLedgers,
      purchases,
      invoices,
      journalEntries,
      vouchers,
    ] = await Promise.all([
      prisma.companySettings.findMany(),
      prisma.bankAccount.findMany(),
      prisma.vendor.findMany(),
      prisma.item.findMany(),
      prisma.stockLedger.findMany(),
      prisma.purchase.findMany({ include: { items: true } }),
      prisma.invoice.findMany({ include: { items: true } }),
      prisma.journalEntry.findMany({ include: { lines: true } }),
      prisma.voucher.findMany({ include: { lines: true } }),
    ]);

    const backupPayload = {
      version: '3.0.0',
      exportedAt: new Date().toISOString(),
      appName: 'Tally Solutions Enterprise V3',
      summary: {
        companySettingsCount: companySettings.length,
        bankAccountsCount: bankAccounts.length,
        vendorsCount: vendors.length,
        itemsCount: items.length,
        stockLedgersCount: stockLedgers.length,
        purchasesCount: purchases.length,
        invoicesCount: invoices.length,
        journalEntriesCount: journalEntries.length,
        vouchersCount: vouchers.length,
      },
      data: {
        companySettings,
        bankAccounts,
        vendors,
        items,
        stockLedgers,
        purchases,
        invoices,
        journalEntries,
        vouchers,
      },
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="tally_backup_${new Date().toISOString().split('T')[0]}.json"`
    );
    res.json(backupPayload);
  } catch (error: any) {
    console.error('Error exporting system backup:', error);
    res.status(500).json({ error: 'Failed to export backup', message: error.message });
  }
});

// POST Data Import & System Restore
router.post('/backup/import', async (req, res) => {
  try {
    const { backupData, mode = 'overwrite' } = req.body;

    if (!backupData || !backupData.data) {
      return res.status(400).json({
        error: 'Invalid backup file format. Expected a valid Tally backup JSON file with data payload.',
      });
    }

    const {
      companySettings = [],
      bankAccounts = [],
      vendors = [],
      items = [],
      stockLedgers = [],
      purchases = [],
      invoices = [],
      journalEntries = [],
      vouchers = [],
    } = backupData.data;

    let restoredStats = {
      companySettings: 0,
      bankAccounts: 0,
      vendors: 0,
      items: 0,
      stockLedgers: 0,
      purchases: 0,
      invoices: 0,
      journalEntries: 0,
      vouchers: 0,
    };

    if (mode === 'overwrite') {
      // Clean Wipe in foreign key safe order
      await prisma.$transaction([
        prisma.invoiceItem.deleteMany(),
        prisma.invoice.deleteMany(),
        prisma.purchaseItem.deleteMany(),
        prisma.purchase.deleteMany(),
        prisma.voucherLine.deleteMany(),
        prisma.voucher.deleteMany(),
        prisma.journalLine.deleteMany(),
        prisma.journalEntry.deleteMany(),
        prisma.stockLedger.deleteMany(),
        prisma.item.deleteMany(),
        prisma.vendor.deleteMany(),
        prisma.bankAccount.deleteMany(),
        prisma.companySettings.deleteMany(),
      ]);
    }

    // Restore Company Settings
    for (const setting of companySettings) {
      const { id, createdAt, updatedAt, ...rest } = setting;
      await prisma.companySettings.create({
        data: {
          ...rest,
          ...(id && mode === 'merge' ? {} : id ? { id } : {}),
        },
      });
      restoredStats.companySettings++;
    }

    // Restore Bank Accounts
    for (const bank of bankAccounts) {
      const { id, createdAt, updatedAt, openingBalance, currentBalance, ...rest } = bank;
      await prisma.bankAccount.upsert({
        where: { id: id || 'non-existent-id' },
        update: {
          ...rest,
          openingBalance: parseFloat(openingBalance || 0),
          currentBalance: parseFloat(currentBalance || 0),
        },
        create: {
          ...(id ? { id } : {}),
          ...rest,
          openingBalance: parseFloat(openingBalance || 0),
          currentBalance: parseFloat(currentBalance || 0),
        },
      });
      restoredStats.bankAccounts++;
    }

    // Restore Vendors
    for (const vendor of vendors) {
      const { id, createdAt, updatedAt, balance, ...rest } = vendor;
      await prisma.vendor.upsert({
        where: { id: id || 'non-existent-id' },
        update: {
          ...rest,
          balance: parseFloat(balance || 0),
        },
        create: {
          ...(id ? { id } : {}),
          ...rest,
          balance: parseFloat(balance || 0),
        },
      });
      restoredStats.vendors++;
    }

    // Restore Items & Stock Ledgers
    for (const item of items) {
      const { id, createdAt, updatedAt, purchasePrice, sellingPrice, taxRate, ...rest } = item;
      const createdItem = await prisma.item.upsert({
        where: { id: id || 'non-existent-id' },
        update: {
          ...rest,
          purchasePrice: parseFloat(purchasePrice || 0),
          sellingPrice: parseFloat(sellingPrice || 0),
          taxRate: parseFloat(taxRate || 18),
        },
        create: {
          ...(id ? { id } : {}),
          ...rest,
          purchasePrice: parseFloat(purchasePrice || 0),
          sellingPrice: parseFloat(sellingPrice || 0),
          taxRate: parseFloat(taxRate || 18),
        },
      });
      restoredStats.items++;

      // Check corresponding stock ledger
      const matchingLedger = stockLedgers.find((s: any) => s.itemId === item.id);
      const qty = matchingLedger ? parseFloat(matchingLedger.currentQuantity || 0) : 0;
      await prisma.stockLedger.upsert({
        where: { itemId: createdItem.id },
        update: { currentQuantity: qty },
        create: { itemId: createdItem.id, currentQuantity: qty },
      });
      restoredStats.stockLedgers++;
    }

    // Restore Purchases & PurchaseItems
    for (const purchase of purchases) {
      const { id, createdAt, purchaseDate, totalAmount, items: pItems, ...rest } = purchase;
      const validVendor = await prisma.vendor.findUnique({ where: { id: rest.vendorId } });
      if (!validVendor) continue;

      const createdPurchase = await prisma.purchase.create({
        data: {
          ...(id && mode === 'overwrite' ? { id } : {}),
          ...rest,
          totalAmount: parseFloat(totalAmount || 0),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        },
      });

      if (Array.isArray(pItems)) {
        for (const itemLine of pItems) {
          const { id: lineId, purchaseId, itemId, quantity, unitPurchasePrice, taxRate, taxableAmount, taxAmount, totalPrice } = itemLine;
          const validItem = await prisma.item.findUnique({ where: { id: itemId } });
          if (!validItem) continue;

          await prisma.purchaseItem.create({
            data: {
              purchaseId: createdPurchase.id,
              itemId,
              quantity: parseFloat(quantity || 1),
              unitPurchasePrice: parseFloat(unitPurchasePrice || 0),
              taxRate: parseFloat(taxRate || 18),
              taxableAmount: parseFloat(taxableAmount || 0),
              taxAmount: parseFloat(taxAmount || 0),
              totalPrice: parseFloat(totalPrice || 0),
            },
          });
        }
      }
      restoredStats.purchases++;
    }

    // Restore Invoices & InvoiceItems
    for (const invoice of invoices) {
      const { id, createdAt, dueDate, subtotal, taxAmount, totalAmount, outstandingBalance, items: invItems, ...rest } = invoice;
      
      const createdInvoice = await prisma.invoice.create({
        data: {
          ...(id && mode === 'overwrite' ? { id } : {}),
          ...rest,
          subtotal: parseFloat(subtotal || 0),
          taxAmount: parseFloat(taxAmount || 0),
          totalAmount: parseFloat(totalAmount || 0),
          outstandingBalance: outstandingBalance !== undefined && outstandingBalance !== null ? parseFloat(outstandingBalance) : 0,
          dueDate: dueDate ? new Date(dueDate) : null,
          createdAt: createdAt ? new Date(createdAt) : new Date(),
        },
      });

      if (Array.isArray(invItems)) {
        for (const line of invItems) {
          const { id: lineId, invoiceId, itemId, quantity, unitSellingPrice, taxRate, totalPrice } = line;
          const validItem = await prisma.item.findUnique({ where: { id: itemId } });
          if (!validItem) continue;

          await prisma.invoiceItem.create({
            data: {
              invoiceId: createdInvoice.id,
              itemId,
              quantity: parseFloat(quantity || 1),
              unitSellingPrice: parseFloat(unitSellingPrice || 0),
              taxRate: parseFloat(taxRate || 18),
              totalPrice: parseFloat(totalPrice || 0),
            },
          });
        }
      }
      restoredStats.invoices++;
    }

    // Restore Journal Entries
    for (const journal of journalEntries) {
      const { id, createdAt, entryDate, totalAmount, lines, ...rest } = journal;
      const createdJournal = await prisma.journalEntry.create({
        data: {
          ...(id && mode === 'overwrite' ? { id } : {}),
          ...rest,
          totalAmount: parseFloat(totalAmount || 0),
          entryDate: entryDate ? new Date(entryDate) : new Date(),
        },
      });

      if (Array.isArray(lines)) {
        for (const line of lines) {
          const { id: lineId, journalEntryId, accountName, type, amount } = line;
          await prisma.journalLine.create({
            data: {
              journalEntryId: createdJournal.id,
              accountName,
              type,
              amount: parseFloat(amount || 0),
            },
          });
        }
      }
      restoredStats.journalEntries++;
    }

    // Restore Vouchers
    for (const voucher of vouchers) {
      const { id, createdAt, date, amount, lines, ...rest } = voucher;
      const createdVoucher = await prisma.voucher.create({
        data: {
          ...(id && mode === 'overwrite' ? { id } : {}),
          ...rest,
          amount: parseFloat(amount || 0),
          date: date ? new Date(date) : new Date(),
        },
      });

      if (Array.isArray(lines)) {
        for (const line of lines) {
          const { id: lineId, voucherId, ledgerType, ledgerId, accountName, debitAmount, creditAmount } = line;
          await prisma.voucherLine.create({
            data: {
              voucherId: createdVoucher.id,
              ledgerType: ledgerType || 'GENERAL',
              ledgerId: ledgerId || null,
              accountName,
              debitAmount: parseFloat(debitAmount || 0),
              creditAmount: parseFloat(creditAmount || 0),
            },
          });
        }
      }
      restoredStats.vouchers++;
    }

    res.json({
      message: 'System data imported and restored successfully!',
      mode,
      stats: restoredStats,
    });
  } catch (error: any) {
    console.error('Error importing backup data:', error);
    res.status(500).json({ error: 'Failed to import backup data', message: error.message });
  }
});

// ── Automated Container & Google Drive Routes ───────────────────────────────
import { backupEngine } from '../services/backupEngine';

// GET backup engine configuration & status
router.get('/backup/config', (req, res) => {
  try {
    const config = backupEngine.getConfig();
    // Return sanitized config (mask sensitive client secret slightly if set)
    res.json({
      ...config,
      hasSecret: Boolean(config.gdriveClientSecret),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT update backup engine settings
router.put('/backup/config', (req, res) => {
  try {
    const { enabled, schedule, dailyTime, localBackupDir, gdriveClientId, gdriveClientSecret } = req.body;
    const updated = backupEngine.updateConfig({
      ...(enabled !== undefined ? { enabled } : {}),
      ...(schedule ? { schedule } : {}),
      ...(dailyTime ? { dailyTime } : {}),
      ...(localBackupDir ? { localBackupDir } : {}),
      ...(gdriveClientId !== undefined ? { gdriveClientId } : {}),
      ...(gdriveClientSecret !== undefined ? { gdriveClientSecret } : {}),
    });
    res.json({ message: 'Backup settings updated successfully', config: updated });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// POST trigger immediate master backup
router.post('/backup/run-now', async (req, res) => {
  try {
    const result = await backupEngine.executeBackup({ reason: 'Manual User Backup' });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Google Drive OAuth2 Auth URL
router.get('/backup/gdrive/auth-url', (req, res) => {
  try {
    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:5000';
    const redirectUri = (req.query.redirectUri as string) || `${protocol}://${host}/api/backup/gdrive/callback`;
    const authUrl = backupEngine.getGoogleAuthUrl(redirectUri);
    res.json({ authUrl, redirectUri });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

// GET Google Drive OAuth Callback redirect
router.get('/backup/gdrive/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    if (!code) {
      return res.status(400).send('<h1>OAuth Error: Missing authorization code</h1>');
    }

    const protocol = req.protocol;
    const host = req.get('host') || 'localhost:5000';
    const redirectUri = `${protocol}://${host}/api/backup/gdrive/callback`;

    await backupEngine.exchangeCodeForTokens(code, redirectUri);

    // Redirect user back to desktop app web view /backup page
    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Google Drive Connected</title>
          <style>
            body { font-family: sans-serif; background: #0b0f17; color: #10b981; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
            .card { background: #131b26; border: 1px solid #10b98140; padding: 2.5rem; border-radius: 1rem; text-align: center; max-width: 450px; }
            h2 { color: #fff; margin-bottom: 0.5rem; }
            p { color: #94a3b8; font-size: 14px; }
            button { background: #10b981; color: #0b0f17; border: none; padding: 0.75rem 1.5rem; font-weight: bold; border-radius: 0.5rem; cursor: pointer; margin-top: 1rem; }
          </style>
        </head>
        <body>
          <div class="card">
            <h2>✅ Google Drive Connected!</h2>
            <p>Your Google Drive account has been linked successfully. Tally will now automatically sync your master backup container.</p>
            <button onclick="window.close(); window.opener && window.opener.location.reload();">Close Window</button>
          </div>
          <script>
            setTimeout(() => {
              if (window.opener) {
                window.opener.postMessage('gdrive-connected', '*');
                window.close();
              } else {
                window.location.href = '/backup';
              }
            }, 2500);
          </script>
        </body>
      </html>
    `);
  } catch (error: any) {
    res.status(500).send(`<h1>Authentication Failed</h1><p>${error.message}</p>`);
  }
});

// POST exchange code manually (if opened in external browser without direct callback redirect)
router.post('/backup/gdrive/connect-code', async (req, res) => {
  try {
    const { code, redirectUri } = req.body;
    if (!code) return res.status(400).json({ error: 'Code is required' });
    const defaultRedirect = `${req.protocol}://${req.get('host') || 'localhost:5000'}/api/backup/gdrive/callback`;
    const result = await backupEngine.exchangeCodeForTokens(code, redirectUri || defaultRedirect);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST disconnect Google Drive
router.post('/backup/gdrive/disconnect', (req, res) => {
  try {
    backupEngine.disconnectGoogleDrive();
    res.json({ message: 'Google Drive disconnected successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST force immediate Google Drive sync
router.post('/backup/gdrive/sync-now', async (req, res) => {
  try {
    const status = await backupEngine.syncToGoogleDrive();
    res.json({ status, message: status === 'synced' ? 'Google Drive synchronized successfully' : 'Sync pending or offline' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET preview of Google Drive master backup
router.get('/backup/gdrive/preview', async (req, res) => {
  try {
    const preview = await backupEngine.getGoogleDriveBackupPreview();
    res.json({ preview });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST 1-Click Restore directly from Google Drive
router.post('/backup/gdrive/restore', async (req, res) => {
  try {
    const result = await backupEngine.restoreFromGoogleDrive();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST 1-Click Restore from Local Master File
router.post('/backup/local/restore', async (req, res) => {
  try {
    const result = await backupEngine.restoreFromLocalMaster();
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET Detect installed Cloud folders (Google Drive, OneDrive, Documents)
router.get('/backup/detect-cloud-folders', (req, res) => {
  try {
    const userProfile = process.env.USERPROFILE || '';
    const oneDrivePath = process.env.OneDrive || (userProfile ? path.join(userProfile, 'OneDrive') : null);

    const detected: Array<{ id: string; name: string; path: string; exists: boolean }> = [];

    // Check OneDrive
    if (oneDrivePath && fs.existsSync(oneDrivePath)) {
      detected.push({
        id: 'onedrive',
        name: 'Microsoft OneDrive (Cloud)',
        path: path.join(oneDrivePath, 'Tally_Master_Backup'),
        exists: true,
      });
    }

    // Check Google Drive paths
    const gdriveCandidates = [
      'G:\\My Drive',
      'G:\\',
      userProfile ? path.join(userProfile, 'Google Drive') : '',
      userProfile ? path.join(userProfile, 'Google Drive\\My Drive') : '',
    ].filter((p) => p && fs.existsSync(p));

    if (gdriveCandidates.length > 0) {
      detected.push({
        id: 'gdrive',
        name: 'Google Drive for Desktop (Cloud)',
        path: path.join(gdriveCandidates[0], 'Tally_Master_Backup'),
        exists: true,
      });
    }

    // Default Documents
    if (userProfile && fs.existsSync(userProfile)) {
      const docsPath = path.join(userProfile, 'Documents');
      if (fs.existsSync(docsPath)) {
        detected.push({
          id: 'documents',
          name: 'My Documents (Local Disk)',
          path: path.join(docsPath, 'Tally_Master_Backup'),
          exists: true,
        });
      }
    }

    res.json({ detected });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Set specific backup folder
router.post('/backup/set-folder', (req, res) => {
  try {
    const { folderPath } = req.body;
    if (!folderPath) return res.status(400).json({ error: 'folderPath is required' });
    fs.mkdirSync(folderPath, { recursive: true });
    backupEngine.updateConfig({ localBackupDir: folderPath });
    res.json({ success: true, localBackupDir: folderPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// POST Native Windows folder picker
router.post('/backup/select-folder', async (req, res) => {
  try {
    const selectedPath = await backupEngine.openNativeFolderDialog();
    if (selectedPath) {
      backupEngine.updateConfig({ localBackupDir: selectedPath });
    }
    res.json({ selectedPath });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;

