import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';

// Load root environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
// Hot reload trigger for bank account PUT & DELETE



import healthRoutes from './routes/health';
import vendorRoutes from './routes/vendors';
import itemRoutes from './routes/items';
import inventoryRoutes from './routes/inventory';
import purchaseRoutes from './routes/purchases';
import invoiceRoutes from './routes/invoices';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import reportsRoutes from './routes/reports';
import journalRoutes from './routes/journal';
import ledgersRoutes from './routes/ledgers';
import bankingRoutes from './routes/banking';
import vouchersRoutes from './routes/vouchers';
import sequenceRoutes from './routes/sequence';
import backupRoutes from './routes/backup';
import searchRoutes from './routes/search';
import recycleBinRoutes from './routes/recycleBin';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Routes
app.use('/api', healthRoutes);
app.use('/api', vendorRoutes);
app.use('/api', itemRoutes);
app.use('/api', inventoryRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', invoiceRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', settingsRoutes);
app.use('/api', reportsRoutes);
app.use('/api', journalRoutes);
app.use('/api', ledgersRoutes);
app.use('/api', bankingRoutes);
app.use('/api', vouchersRoutes);
app.use('/api', sequenceRoutes);
app.use('/api', backupRoutes);
app.use('/api', searchRoutes);
app.use('/api', recycleBinRoutes);

// Serve Next.js Exported Static UI in Desktop / Production Mode
const staticPath = process.env.WEB_OUT_PATH || path.resolve(__dirname, '../../web/out');
if (require('fs').existsSync(staticPath)) {
  console.log('[Express API] Serving Desktop UI static files from:', staticPath);
  app.use(express.static(staticPath));
  app.get('*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.startsWith('/api')) return next();
    const cleanPath = req.path === '/' ? 'index' : req.path.replace(/^\//, '');
    const htmlPath = path.join(staticPath, `${cleanPath}.html`);
    if (require('fs').existsSync(htmlPath)) {
      res.sendFile(htmlPath);
    } else {
      res.sendFile(path.join(staticPath, 'index.html'));
    }
  });
} else {
  console.log('[Express API] No web/out static files found at:', staticPath, '— Desktop UI not served.');
}

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: 'Internal Server Error', message: err.message });
});

import { prisma } from '@tally/database';

async function ensureDatabaseSchema() {
  const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');
  const dateType = isPostgres ? 'TIMESTAMP' : 'DATETIME';
  const alterStatements = [
    'ALTER TABLE "Invoice" ADD COLUMN "customerAddress" TEXT;',
    'ALTER TABLE "Invoice" ADD COLUMN "shippedAddress" TEXT;',
    'ALTER TABLE "Invoice" ADD COLUMN "placeOfSupply" TEXT DEFAULT \'Haryana (06)\';',
    'ALTER TABLE "Invoice" ADD COLUMN "poNumber" TEXT DEFAULT \'By MAIL\';',
    `ALTER TABLE "Invoice" ADD COLUMN "poDate" ${dateType};`,
    'ALTER TABLE "Invoice" ADD COLUMN "paymentTerms" TEXT DEFAULT \'Against Delivery\';',
    'ALTER TABLE "CompanySettings" ADD COLUMN "panNumber" TEXT DEFAULT \'AVCPT7101L\';',
    `CREATE TABLE IF NOT EXISTS "RecycleBin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "entityType" TEXT NOT NULL,
      "entityId" TEXT NOT NULL,
      "displayName" TEXT NOT NULL,
      "details" TEXT,
      "payload" TEXT NOT NULL,
      "deletedAt" ${dateType} NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  ];
  for (const sql of alterStatements) {
    try {
      await prisma.$executeRawUnsafe(sql);
    } catch {
      // Column already exists or table structure up to date
    }
  }
}

app.listen(PORT, async () => {
  await ensureDatabaseSchema();
  console.log(`🚀 Tally Backend API V3 running on http://localhost:${PORT}`);
  console.log(`📊 Health Endpoint: http://localhost:${PORT}/api/health`);
});
