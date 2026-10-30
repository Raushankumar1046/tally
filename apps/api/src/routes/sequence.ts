import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// GET sequence configuration & preview
router.get('/settings/sequence', async (req, res) => {
  try {
    let settings = await prisma.companySettings.findFirst();

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Tally Solutions Enterprise Pvt Ltd',
          invoicePrefix: '26-27/',
          nextInvoiceNumber: 1,
          invoiceNumberPadding: 3,
          purchasePrefix: 'PUR/26-27/',
          nextPurchaseNumber: 1,
        },
      });
    }

    const previewInvoice = `${settings.invoicePrefix}${String(settings.nextInvoiceNumber).padStart(settings.invoiceNumberPadding, '0')}`;
    const previewPurchase = `${settings.purchasePrefix}${String(settings.nextPurchaseNumber).padStart(settings.invoiceNumberPadding, '0')}`;

    res.json({
      invoicePrefix: settings.invoicePrefix,
      nextInvoiceNumber: settings.nextInvoiceNumber,
      invoiceNumberPadding: settings.invoiceNumberPadding,
      purchasePrefix: settings.purchasePrefix,
      nextPurchaseNumber: settings.nextPurchaseNumber,
      previewInvoice,
      previewPurchase,
    });
  } catch (error) {
    console.error('Error fetching sequence config:', error);
    res.status(500).json({ error: 'Failed to fetch sequence configuration' });
  }
});

// PUT update sequence configuration
router.put('/settings/sequence', async (req, res) => {
  try {
    const {
      invoicePrefix,
      nextInvoiceNumber,
      invoiceNumberPadding,
      purchasePrefix,
      nextPurchaseNumber,
    } = req.body;

    let settings = await prisma.companySettings.findFirst();

    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          ...(invoicePrefix !== undefined && { invoicePrefix }),
          ...(nextInvoiceNumber !== undefined && { nextInvoiceNumber: parseInt(nextInvoiceNumber, 10) }),
          ...(invoiceNumberPadding !== undefined && { invoiceNumberPadding: parseInt(invoiceNumberPadding, 10) }),
          ...(purchasePrefix !== undefined && { purchasePrefix }),
          ...(nextPurchaseNumber !== undefined && { nextPurchaseNumber: parseInt(nextPurchaseNumber, 10) }),
        },
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Tally Solutions Enterprise Pvt Ltd',
          invoicePrefix: invoicePrefix || '26-27/',
          nextInvoiceNumber: nextInvoiceNumber ? parseInt(nextInvoiceNumber, 10) : 1,
          invoiceNumberPadding: invoiceNumberPadding ? parseInt(invoiceNumberPadding, 10) : 3,
          purchasePrefix: purchasePrefix || 'PUR/26-27/',
          nextPurchaseNumber: nextPurchaseNumber ? parseInt(nextPurchaseNumber, 10) : 1,
        },
      });
    }

    const previewInvoice = `${settings.invoicePrefix}${String(settings.nextInvoiceNumber).padStart(settings.invoiceNumberPadding, '0')}`;
    const previewPurchase = `${settings.purchasePrefix}${String(settings.nextPurchaseNumber).padStart(settings.invoiceNumberPadding, '0')}`;

    res.json({
      invoicePrefix: settings.invoicePrefix,
      nextInvoiceNumber: settings.nextInvoiceNumber,
      invoiceNumberPadding: settings.invoiceNumberPadding,
      purchasePrefix: settings.purchasePrefix,
      nextPurchaseNumber: settings.nextPurchaseNumber,
      previewInvoice,
      previewPurchase,
    });
  } catch (error) {
    console.error('Error updating sequence config:', error);
    res.status(500).json({ error: 'Failed to update sequence configuration' });
  }
});

export default router;
