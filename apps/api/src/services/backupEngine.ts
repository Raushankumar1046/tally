import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { prisma } from '@tally/database';

export interface BackupConfig {
  enabled: boolean;
  schedule: '15m' | '30m' | '1h' | 'daily' | 'realtime';
  dailyTime: string; // HH:MM e.g. "20:00"
  localBackupDir: string;
  gdriveClientId: string;
  gdriveClientSecret: string;
  gdriveConnected: boolean;
  gdriveUserEmail: string | null;
  gdriveTokens: {
    access_token?: string;
    refresh_token?: string;
    expiry_date?: number;
  } | null;
  gdriveFolderId: string | null;
  gdriveFileId: string | null;
  lastBackupAt: string | null;
  lastBackupRecords: number | null;
  lastBackupSize: number | null;
  lastSyncAt: string | null;
  syncStatus: 'idle' | 'syncing' | 'synced' | 'offline_pending' | 'error';
  lastError: string | null;
}

class BackupEngine {
  private configPath: string;
  private config: BackupConfig;
  private timer: NodeJS.Timeout | null = null;
  private isBackingUp = false;
  private realtimeTimeout: NodeJS.Timeout | null = null;

  constructor() {
    const baseDir =
      process.env.APP_DATA_PATH ||
      (process.env.NODE_ENV === 'production'
        ? path.join(process.cwd(), 'data')
        : path.resolve(__dirname, '../../../backups'));

    fs.mkdirSync(baseDir, { recursive: true });
    this.configPath = path.join(baseDir, 'tally-backup-settings.json');

    const defaultBackupDir = path.join(baseDir, 'master-backup');
    fs.mkdirSync(defaultBackupDir, { recursive: true });

    this.config = this.loadConfig(defaultBackupDir);
    this.initScheduler();
  }

  private loadConfig(defaultBackupDir: string): BackupConfig {
    const envClientId =
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_DRIVE_CLIENT_ID ||
      '';
    const envClientSecret =
      process.env.GOOGLE_CLIENT_SECRET_KEY ||
      process.env.GOOGLE_CLIENT_SECRET ||
      process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
      '';

    const defaultConfig: BackupConfig = {
      enabled: true,
      schedule: '30m',
      dailyTime: '20:00',
      localBackupDir: defaultBackupDir,
      gdriveClientId: envClientId,
      gdriveClientSecret: envClientSecret,
      gdriveConnected: false,
      gdriveUserEmail: null,
      gdriveTokens: null,
      gdriveFolderId: null,
      gdriveFileId: null,
      lastBackupAt: null,
      lastBackupRecords: null,
      lastBackupSize: null,
      lastSyncAt: null,
      syncStatus: 'idle',
      lastError: null,
    };

    if (fs.existsSync(this.configPath)) {
      try {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...defaultConfig,
          ...parsed,
          gdriveClientId: parsed.gdriveClientId || envClientId,
          gdriveClientSecret: parsed.gdriveClientSecret || envClientSecret,
        };
      } catch (err) {
        console.error('[BackupEngine] Failed to parse existing config, using defaults:', err);
      }
    }

    this.saveConfig(defaultConfig);
    return defaultConfig;
  }

  public saveConfig(newConfig?: Partial<BackupConfig>): BackupConfig {
    if (newConfig) {
      this.config = { ...this.config, ...newConfig };
    }
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8');
    } catch (err) {
      console.error('[BackupEngine] Failed to save config to disk:', err);
    }
    return this.config;
  }

  public getConfig(): BackupConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<BackupConfig>): BackupConfig {
    if (updates.localBackupDir && !fs.existsSync(updates.localBackupDir)) {
      try {
        fs.mkdirSync(updates.localBackupDir, { recursive: true });
      } catch (err: any) {
        throw new Error(`Cannot access or create local backup directory: ${err.message}`);
      }
    }
    return this.saveConfig(updates);
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────
  private initScheduler() {
    if (this.timer) clearInterval(this.timer);

    // Initial check after 15 seconds
    setTimeout(() => {
      this.checkAndRunScheduled();
    }, 15000);

    // Periodic check every 60 seconds
    this.timer = setInterval(() => {
      this.checkAndRunScheduled();
    }, 60 * 1000);

    console.log('[BackupEngine] Auto-backup scheduler initialized.');
  }

  private async checkAndRunScheduled() {
    if (!this.config.enabled || this.isBackingUp) return;

    // Check if offline pending sync needs retry
    if (this.config.syncStatus === 'offline_pending' && this.config.gdriveConnected) {
      const isOnline = await this.checkInternet();
      if (isOnline) {
        console.log('[BackupEngine] Internet restored. Syncing pending master backup to Google Drive...');
        await this.syncToGoogleDrive();
      }
    }

    const now = new Date();
    const lastBackup = this.config.lastBackupAt ? new Date(this.config.lastBackupAt) : null;
    const minutesSince = lastBackup ? (now.getTime() - lastBackup.getTime()) / (60 * 1000) : 999999;

    let shouldRun = false;

    switch (this.config.schedule) {
      case '15m':
        shouldRun = minutesSince >= 15;
        break;
      case '30m':
        shouldRun = minutesSince >= 30;
        break;
      case '1h':
        shouldRun = minutesSince >= 60;
        break;
      case 'daily': {
        const [targetHour, targetMin] = (this.config.dailyTime || '20:00').split(':').map(Number);
        const currentHour = now.getHours();
        const currentMin = now.getMinutes();

        // Check if within 5-minute window of scheduled time and hasn't run today yet
        const isTimeMatch =
          currentHour === targetHour && Math.abs(currentMin - targetMin) <= 2;
        const alreadyRanToday =
          lastBackup &&
          lastBackup.getFullYear() === now.getFullYear() &&
          lastBackup.getMonth() === now.getMonth() &&
          lastBackup.getDate() === now.getDate();

        shouldRun = isTimeMatch && !alreadyRanToday;
        break;
      }
      case 'realtime':
        // Handled via notifyDataChange()
        shouldRun = false;
        break;
    }

    if (shouldRun) {
      console.log(`[BackupEngine] Scheduled backup trigger (${this.config.schedule}). Executing...`);
      await this.executeBackup({ reason: `Scheduled (${this.config.schedule})` });
    }
  }

  // Realtime change notification (debounced by 8 seconds)
  public notifyDataChange() {
    if (!this.config.enabled || this.config.schedule !== 'realtime') return;

    if (this.realtimeTimeout) clearTimeout(this.realtimeTimeout);
    this.realtimeTimeout = setTimeout(async () => {
      console.log('[BackupEngine] Realtime transaction backup trigger. Executing...');
      await this.executeBackup({ reason: 'Realtime Transaction' });
    }, 8000);
  }

  // ── Core Backup Execution: Single Container File ──────────────────────────
  public async executeBackup(options: { reason?: string } = {}): Promise<{
    success: boolean;
    filePath: string;
    totalRecords: number;
    fileSizeBytes: number;
    gdriveSyncStatus: string;
    message: string;
  }> {
    if (this.isBackingUp) {
      return {
        success: false,
        filePath: '',
        totalRecords: 0,
        fileSizeBytes: 0,
        gdriveSyncStatus: this.config.syncStatus,
        message: 'A backup process is already running.',
      };
    }

    this.isBackingUp = true;
    try {
      // 1. Gather 100% full dataset across all models
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

      const totalRecords =
        companySettings.length +
        bankAccounts.length +
        vendors.length +
        items.length +
        stockLedgers.length +
        purchases.length +
        invoices.length +
        journalEntries.length +
        vouchers.length;

      const containerPayload = {
        magicHeader: 'TALLY_ENTERPRISE_MASTER_CONTAINER',
        version: '3.0.0',
        appName: 'Tally Solutions Enterprise V3',
        backupType: 'COMPLETE_SINGLE_CONTAINER',
        updatedAt: new Date().toISOString(),
        backupReason: options.reason || 'Manual / Scheduled',
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
          totalRecords,
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

      // 2. Ensure target local directory exists
      const targetDir = this.config.localBackupDir;
      fs.mkdirSync(targetDir, { recursive: true });

      // Atomic single-file write: write to .tmp then rename
      const masterJsonPath = path.join(targetDir, 'tally_master_backup.json');
      const tempJsonPath = path.join(targetDir, `tally_master_backup.tmp.${Date.now()}`);

      fs.writeFileSync(tempJsonPath, JSON.stringify(containerPayload, null, 2), 'utf-8');
      fs.renameSync(tempJsonPath, masterJsonPath);

      const stats = fs.statSync(masterJsonPath);
      const fileSizeBytes = stats.size;

      // Also copy SQLite .db if running on local SQLite
      try {
        const dbUrl = process.env.DATABASE_URL || '';
        if (dbUrl.startsWith('file:')) {
          const sqliteDbPath = dbUrl.replace('file:', '').trim();
          if (fs.existsSync(sqliteDbPath)) {
            const masterDbPath = path.join(targetDir, 'tally_master_backup.db');
            fs.copyFileSync(sqliteDbPath, masterDbPath);
          }
        }
      } catch (dbCopyErr) {
        console.warn('[BackupEngine] Notice: SQLite raw binary copy skipped:', dbCopyErr);
      }

      this.updateConfig({
        lastBackupAt: new Date().toISOString(),
        lastBackupRecords: totalRecords,
        lastBackupSize: fileSizeBytes,
        lastError: null,
      });

      console.log(
        `[BackupEngine] Local Master Backup updated at: ${masterJsonPath} (${totalRecords} records, ${(fileSizeBytes / 1024).toFixed(1)} KB)`
      );

      // 3. Trigger Google Drive Sync if connected
      let gdriveSyncStatus = this.config.syncStatus;
      if (this.config.gdriveConnected) {
        gdriveSyncStatus = await this.syncToGoogleDrive();
      }

      return {
        success: true,
        filePath: masterJsonPath,
        totalRecords,
        fileSizeBytes,
        gdriveSyncStatus,
        message: `Master container successfully updated with ${totalRecords} records.`,
      };
    } catch (err: any) {
      console.error('[BackupEngine] Backup execution failed:', err);
      this.updateConfig({
        lastError: err.message,
      });
      return {
        success: false,
        filePath: '',
        totalRecords: 0,
        fileSizeBytes: 0,
        gdriveSyncStatus: 'error',
        message: `Backup failed: ${err.message}`,
      };
    } finally {
      this.isBackingUp = false;
    }
  }

  // ── Restore From Local Master Container ───────────────────────────────────
  public async restoreFromLocalMaster(): Promise<{
    success: boolean;
    restoredStats: any;
    message: string;
  }> {
    const targetDir = this.config.localBackupDir;
    const masterJsonPath = path.join(targetDir, 'tally_master_backup.json');

    if (!fs.existsSync(masterJsonPath)) {
      throw new Error(`Master backup file not found at: ${masterJsonPath}`);
    }

    const raw = fs.readFileSync(masterJsonPath, 'utf-8');
    const container = JSON.parse(raw);

    if (!container.data) {
      throw new Error('Invalid master container format: Missing data payload.');
    }

    const stats = await this.applyRestoreData(container.data);
    return {
      success: true,
      restoredStats: stats,
      message: `System restored successfully from local master container!`,
    };
  }

  // ── Apply Restore Data Transactionally ────────────────────────────────────
  public async applyRestoreData(data: any): Promise<any> {
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
    } = data;

    const restoredStats = {
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

    // Clean wipe in foreign-key safe order
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

    // Restore Company Settings
    for (const setting of companySettings) {
      const { id, createdAt, updatedAt, ...rest } = setting;
      await prisma.companySettings.create({
        data: {
          ...rest,
          ...(id ? { id } : {}),
        },
      });
      restoredStats.companySettings++;
    }

    // Restore Bank Accounts
    for (const bank of bankAccounts) {
      const { id, createdAt, updatedAt, openingBalance, currentBalance, ...rest } = bank;
      await prisma.bankAccount.create({
        data: {
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
      await prisma.vendor.create({
        data: {
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
      const createdItem = await prisma.item.create({
        data: {
          ...(id ? { id } : {}),
          ...rest,
          purchasePrice: parseFloat(purchasePrice || 0),
          sellingPrice: parseFloat(sellingPrice || 0),
          taxRate: parseFloat(taxRate || 18),
        },
      });
      restoredStats.items++;

      const matchingLedger = stockLedgers.find((s: any) => s.itemId === item.id);
      const qty = matchingLedger ? parseFloat(matchingLedger.currentQuantity || 0) : 0;
      await prisma.stockLedger.create({
        data: { itemId: createdItem.id, currentQuantity: qty },
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
          ...(id ? { id } : {}),
          ...rest,
          totalAmount: parseFloat(totalAmount || 0),
          purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),
        },
      });

      if (Array.isArray(pItems)) {
        for (const item of pItems) {
          const { id: itemIdVal, purchaseId, quantity, unitPrice, taxRate, totalPrice, ...itemRest } = item;
          await prisma.purchaseItem.create({
            data: {
              ...itemRest,
              purchaseId: createdPurchase.id,
              quantity: parseFloat(quantity || 0),
              unitPrice: parseFloat(unitPrice || 0),
              taxRate: parseFloat(taxRate || 18),
              totalPrice: parseFloat(totalPrice || 0),
            },
          });
        }
      }
      restoredStats.purchases++;
    }

    // Restore Invoices & InvoiceItems
    for (const invoice of invoices) {
      const { id, createdAt, invoiceDate, dueDate, poDate, totalAmount, subtotal, taxAmount, items: invItems, ...rest } = invoice;
      const createdInvoice = await prisma.invoice.create({
        data: {
          ...(id ? { id } : {}),
          ...rest,
          totalAmount: parseFloat(totalAmount || 0),
          subtotal: parseFloat(subtotal || 0),
          taxAmount: parseFloat(taxAmount || 0),
          invoiceDate: invoiceDate ? new Date(invoiceDate) : new Date(),
          dueDate: dueDate ? new Date(dueDate) : null,
          poDate: poDate ? new Date(poDate) : null,
        },
      });

      if (Array.isArray(invItems)) {
        for (const item of invItems) {
          const { id: itemIdVal, invoiceId, quantity, unitSellingPrice, taxRate, totalPrice, ...itemRest } = item;
          await prisma.invoiceItem.create({
            data: {
              ...itemRest,
              invoiceId: createdInvoice.id,
              quantity: parseFloat(quantity || 0),
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
    for (const entry of journalEntries) {
      const { id, createdAt, entryDate, totalAmount, lines, ...rest } = entry;
      const createdEntry = await prisma.journalEntry.create({
        data: {
          ...(id ? { id } : {}),
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
              journalEntryId: createdEntry.id,
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
          ...(id ? { id } : {}),
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

    return restoredStats;
  }

  // ── Internet Reachability Helper ──────────────────────────────────────────
  public async checkInternet(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 3500);
      const res = await fetch('https://www.googleapis.com/generate_204', {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(id);
      return res.status === 204 || res.ok;
    } catch {
      return false;
    }
  }

  // ── Google Drive OAuth2 Helpers ───────────────────────────────────────────
  public getGoogleAuthUrl(redirectUri: string): string {
    const clientId =
      this.config.gdriveClientId ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_DRIVE_CLIENT_ID ||
      '';
    if (!clientId) {
      throw new Error('Google Drive Client ID is not configured. Please set GOOGLE_CLIENT_ID in .env or Settings.');
    }

    const scope = encodeURIComponent('https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email');
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      clientId
    )}&redirect_uri=${encodeURIComponent(
      redirectUri
    )}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  }

  public async exchangeCodeForTokens(code: string, redirectUri: string): Promise<any> {
    const clientId =
      this.config.gdriveClientId ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_DRIVE_CLIENT_ID ||
      '';
    const clientSecret =
      this.config.gdriveClientSecret ||
      process.env.GOOGLE_CLIENT_SECRET_KEY ||
      process.env.GOOGLE_CLIENT_SECRET ||
      process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
      '';

    if (!clientId || !clientSecret) {
      throw new Error('Google OAuth Client ID & Secret must be provided.');
    }

    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokens: any = await tokenRes.json();
    if (tokens.error) {
      throw new Error(`Google OAuth error: ${tokens.error_description || tokens.error}`);
    }

    // Calculate expiry timestamp
    const expiry_date = Date.now() + (tokens.expires_in || 3600) * 1000;
    const tokenData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expiry_date,
    };

    // Fetch user email
    let userEmail = 'Google Drive User';
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (userRes.ok) {
        const userInfo: any = await userRes.json();
        userEmail = userInfo.email || userEmail;
      }
    } catch (e) {
      console.warn('[BackupEngine] Could not fetch user email:', e);
    }

    this.updateConfig({
      gdriveConnected: true,
      gdriveUserEmail: userEmail,
      gdriveTokens: tokenData,
      syncStatus: 'idle',
      lastError: null,
    });

    console.log(`[BackupEngine] Google Drive connected successfully for: ${userEmail}`);
    return { userEmail, tokens: tokenData };
  }

  public disconnectGoogleDrive() {
    this.updateConfig({
      gdriveConnected: false,
      gdriveUserEmail: null,
      gdriveTokens: null,
      gdriveFolderId: null,
      gdriveFileId: null,
      syncStatus: 'idle',
      lastError: null,
    });
    console.log('[BackupEngine] Google Drive disconnected.');
  }

  // Get valid access token, auto-refreshing if expired
  private async getValidAccessToken(): Promise<string> {
    const tokens = this.config.gdriveTokens;
    if (!tokens || !tokens.refresh_token) {
      throw new Error('Google Drive is not connected or missing refresh token.');
    }

    // Refresh 5 minutes before expiry
    if (tokens.access_token && tokens.expiry_date && tokens.expiry_date > Date.now() + 300000) {
      return tokens.access_token;
    }

    const clientId =
      this.config.gdriveClientId ||
      process.env.GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_DRIVE_CLIENT_ID ||
      '';
    const clientSecret =
      this.config.gdriveClientSecret ||
      process.env.GOOGLE_CLIENT_SECRET_KEY ||
      process.env.GOOGLE_CLIENT_SECRET ||
      process.env.GOOGLE_DRIVE_CLIENT_SECRET ||
      '';

    console.log('[BackupEngine] Refreshing Google Drive access token...');
    const refreshRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
        grant_type: 'refresh_token',
      }),
    });

    const refreshed: any = await refreshRes.json();
    if (refreshed.error) {
      throw new Error(`Failed to refresh Google token: ${refreshed.error_description || refreshed.error}`);
    }

    const expiry_date = Date.now() + (refreshed.expires_in || 3600) * 1000;
    const updatedTokens = {
      ...tokens,
      access_token: refreshed.access_token,
      expiry_date,
    };

    this.updateConfig({ gdriveTokens: updatedTokens });
    return refreshed.access_token;
  }

  // Ensure "Tally_Enterprise_Backups" folder exists in Drive
  private async ensureDriveFolder(accessToken: string): Promise<string> {
    if (this.config.gdriveFolderId) {
      return this.config.gdriveFolderId;
    }

    const folderName = 'Tally_Enterprise_Backups';
    const query = encodeURIComponent(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const searchData: any = await searchRes.json();
    if (searchData.files && searchData.files.length > 0) {
      const folderId = searchData.files[0].id;
      this.updateConfig({ gdriveFolderId: folderId });
      return folderId;
    }

    // Create folder
    const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: 'application/vnd.google-apps.folder',
      }),
    });

    const newFolder: any = await createRes.json();
    this.updateConfig({ gdriveFolderId: newFolder.id });
    return newFolder.id;
  }

  // ── Sync Single Master Container to Google Drive ──────────────────────────
  public async syncToGoogleDrive(): Promise<'synced' | 'offline_pending' | 'error'> {
    if (!this.config.gdriveConnected) {
      return 'idle' as any;
    }

    const isOnline = await this.checkInternet();
    if (!isOnline) {
      console.warn('[BackupEngine] No internet connection. Setting status to offline_pending.');
      this.updateConfig({ syncStatus: 'offline_pending' });
      return 'offline_pending';
    }

    this.updateConfig({ syncStatus: 'syncing' });

    try {
      const accessToken = await this.getValidAccessToken();
      const folderId = await this.ensureDriveFolder(accessToken);

      const targetDir = this.config.localBackupDir;
      const masterJsonPath = path.join(targetDir, 'tally_master_backup.json');

      if (!fs.existsSync(masterJsonPath)) {
        throw new Error(`Master backup file does not exist locally at ${masterJsonPath}. Run backup first.`);
      }

      const fileContent = fs.readFileSync(masterJsonPath, 'utf-8');
      const fileName = 'tally_master_backup.json';

      // Check if file already exists in Google Drive
      let existingFileId = this.config.gdriveFileId;
      if (!existingFileId) {
        const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
        const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const searchData: any = await searchRes.json();
        if (searchData.files && searchData.files.length > 0) {
          existingFileId = searchData.files[0].id;
          this.updateConfig({ gdriveFileId: existingFileId });
        }
      }

      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      if (existingFileId) {
        // UPDATE EXISTING FILE (PATCH) - Preserves single file container!
        console.log(`[BackupEngine] Updating existing single container on Google Drive (ID: ${existingFileId})...`);
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
          description: `Tally Master Container. Last updated: ${new Date().toLocaleString()}`,
        };

        const multipartBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          fileContent +
          closeDelim;

        const updateRes = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`,
          {
            method: 'PATCH',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        if (!updateRes.ok) {
          const errData = await updateRes.text();
          throw new Error(`Failed to update Drive file: ${errData}`);
        }
      } else {
        // CREATE NEW SINGLE FILE
        console.log(`[BackupEngine] Uploading initial single master container to Google Drive...`);
        const metadata = {
          name: fileName,
          mimeType: 'application/json',
          parents: [folderId],
          description: `Tally Master Container. Created: ${new Date().toLocaleString()}`,
        };

        const multipartBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(metadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          fileContent +
          closeDelim;

        const createRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': `multipart/related; boundary=${boundary}`,
            },
            body: multipartBody,
          }
        );

        const newFile: any = await createRes.json();
        if (newFile.error) {
          throw new Error(`Failed to create Drive file: ${newFile.error.message || newFile.error}`);
        }
        this.updateConfig({ gdriveFileId: newFile.id });
      }

      this.updateConfig({
        syncStatus: 'synced',
        lastSyncAt: new Date().toISOString(),
        lastError: null,
      });

      console.log('[BackupEngine] Google Drive single container sync completed successfully!');
      return 'synced';
    } catch (err: any) {
      console.error('[BackupEngine] Google Drive sync failed:', err);
      this.updateConfig({
        syncStatus: 'error',
        lastError: `Drive Sync Failed: ${err.message}`,
      });
      return 'error';
    }
  }

  // ── Preview Master Backup From Google Drive ───────────────────────────────
  public async getGoogleDriveBackupPreview(): Promise<any> {
    if (!this.config.gdriveConnected) {
      throw new Error('Google Drive is not connected.');
    }

    const accessToken = await this.getValidAccessToken();
    const folderId = await this.ensureDriveFolder(accessToken);
    const fileName = 'tally_master_backup.json';

    const q = encodeURIComponent(`name='${fileName}' and '${folderId}' in parents and trashed=false`);
    const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,size,modifiedTime)`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const searchData: any = await searchRes.json();
    if (!searchData.files || searchData.files.length === 0) {
      return null;
    }

    const file = searchData.files[0];
    this.updateConfig({ gdriveFileId: file.id });

    return {
      fileId: file.id,
      name: file.name,
      sizeBytes: Number(file.size || 0),
      modifiedTime: file.modifiedTime,
    };
  }

  // ── Restore Directly From Google Drive ────────────────────────────────────
  public async restoreFromGoogleDrive(): Promise<{
    success: boolean;
    restoredStats: any;
    message: string;
  }> {
    if (!this.config.gdriveConnected) {
      throw new Error('Google Drive is not connected.');
    }

    const accessToken = await this.getValidAccessToken();
    let fileId = this.config.gdriveFileId;

    if (!fileId) {
      const preview = await this.getGoogleDriveBackupPreview();
      if (!preview) {
        throw new Error('No master backup file found on Google Drive.');
      }
      fileId = preview.fileId;
    }

    console.log(`[BackupEngine] Downloading master container from Google Drive (ID: ${fileId})...`);
    const downloadRes = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!downloadRes.ok) {
      throw new Error(`Failed to download backup from Google Drive: ${downloadRes.statusText}`);
    }

    const containerJson = await downloadRes.json();
    if (!containerJson.data) {
      throw new Error('Invalid backup file downloaded from Google Drive: Missing data payload.');
    }

    // Save a copy locally as well to update local master
    const targetDir = this.config.localBackupDir;
    fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(
      path.join(targetDir, 'tally_master_backup.json'),
      JSON.stringify(containerJson, null, 2),
      'utf-8'
    );

    console.log('[BackupEngine] Applying downloaded data restore...');
    const stats = await this.applyRestoreData(containerJson.data);

    return {
      success: true,
      restoredStats: stats,
      message: 'System database successfully restored from Google Drive cloud container!',
    };
  }

  // ── Native Windows Folder Dialog Helper ───────────────────────────────────
  public async openNativeFolderDialog(): Promise<string | null> {
    return new Promise((resolve) => {
      if (process.platform !== 'win32') {
        resolve(null);
        return;
      }

      // Windows Forms FolderBrowserDialog
      const psCommand = `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $dialog = New-Object System.Windows.Forms.FolderBrowserDialog; $dialog.Description = 'Select Local Backup Folder for Tally Master Container'; if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"`;

      exec(psCommand, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve(null);
        } else {
          resolve(stdout.trim());
        }
      });
    });
  }
}

export const backupEngine = new BackupEngine();
