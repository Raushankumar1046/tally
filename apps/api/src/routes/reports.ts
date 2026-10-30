import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// GET GSTR-1 Tax Summary (Outward Sales Breakdown)
router.get('/reports/gstr1', async (req, res) => {
  try {
    const invoices = await prisma.invoice.findMany({
      include: {
        items: {
          include: { item: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let b2bInvoicesCount = 0;
    let b2bTaxableValue = 0;
    let b2bTaxCollected = 0;

    let b2cInvoicesCount = 0;
    let b2cTaxableValue = 0;
    let b2cTaxCollected = 0;

    // Rate breakdown map e.g. { "5": { rate: 5, taxable: 0, tax: 0 }, ... }
    const rateMap: Record<number, { rate: number; taxable: number; tax: number; cgst: number; sgst: number; igst: number }> = {
      5: { rate: 5, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 },
      12: { rate: 12, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 },
      18: { rate: 18, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 },
      28: { rate: 28, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 },
    };

    for (const inv of invoices) {
      const isB2B = Boolean(inv.customerGstin && inv.customerGstin.trim() !== '');

      const subtotal = Number(inv.subtotal);
      const tax = Number(inv.taxAmount);

      if (isB2B) {
        b2bInvoicesCount++;
        b2bTaxableValue += subtotal;
        b2bTaxCollected += tax;
      } else {
        b2cInvoicesCount++;
        b2cTaxableValue += subtotal;
        b2cTaxCollected += tax;
      }

      for (const line of inv.items) {
        const rate = Math.round(Number(line.taxRate));
        const lineTaxable = Number(line.quantity) * Number(line.unitSellingPrice);
        const lineTax = lineTaxable * (Number(line.taxRate) / 100);

        if (!rateMap[rate]) {
          rateMap[rate] = { rate, taxable: 0, tax: 0, cgst: 0, sgst: 0, igst: 0 };
        }

        rateMap[rate].taxable += lineTaxable;
        rateMap[rate].tax += lineTax;
        rateMap[rate].cgst += lineTax / 2;
        rateMap[rate].sgst += lineTax / 2;
      }
    }

    const rateBreakdown = Object.values(rateMap).filter((item) => item.taxable > 0 || item.tax > 0);

    const totalTaxableValue = b2bTaxableValue + b2cTaxableValue;
    const totalTaxCollected = b2bTaxCollected + b2cTaxCollected;
    const totalCGST = totalTaxCollected / 2;
    const totalSGST = totalTaxCollected / 2;
    const totalIGST = 0;

    res.json({
      summary: {
        totalInvoicesCount: invoices.length,
        totalTaxableValue,
        totalTaxCollected,
        totalCGST,
        totalSGST,
        totalIGST,
        totalTurnover: totalTaxableValue + totalTaxCollected,
      },
      b2bSummary: {
        count: b2bInvoicesCount,
        taxableValue: b2bTaxableValue,
        taxCollected: b2bTaxCollected,
      },
      b2cSummary: {
        count: b2cInvoicesCount,
        taxableValue: b2cTaxableValue,
        taxCollected: b2cTaxCollected,
      },
      rateBreakdown,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName || 'Walk-in Customer',
        customerGstin: inv.customerGstin || 'N/A (B2C)',
        subtotal: Number(inv.subtotal),
        taxAmount: Number(inv.taxAmount),
        totalAmount: Number(inv.totalAmount),
        createdAt: inv.createdAt,
      })),
    });
  } catch (error) {
    console.error('Error compiling GSTR-1 summary:', error);
    res.status(500).json({ error: 'Failed to compile GSTR-1 tax summary' });
  }
});

// GET GSTR-3B Tax Summary (Section 3.1 Sales Tax vs Section 4 ITC & Net Liability)
router.get('/reports/gstr3b', async (req, res) => {
  try {
    // 1. Section 3.1 Outward Taxable Supplies (Sales)
    const salesAggregate = await prisma.invoice.aggregate({
      _sum: {
        subtotal: true,
        taxAmount: true,
        totalAmount: true,
      },
      _count: true,
    });

    const outwardTaxableValue = Number(salesAggregate._sum.subtotal || 0);
    const outwardTaxPayable = Number(salesAggregate._sum.taxAmount || 0);
    const outwardCGST = outwardTaxPayable / 2;
    const outwardSGST = outwardTaxPayable / 2;
    const outwardIGST = 0;

    // 2. Section 4 Eligible Input Tax Credit (ITC) from Purchases
    const purchaseItems = await prisma.purchaseItem.findMany();

    let purchaseTaxableValue = 0;
    let purchaseTotalITC = 0;

    for (const pItem of purchaseItems) {
      purchaseTaxableValue += Number(pItem.taxableAmount);
      purchaseTotalITC += Number(pItem.taxAmount);
    }

    const purchaseCGSTITC = purchaseTotalITC / 2;
    const purchaseSGSTITC = purchaseTotalITC / 2;
    const purchaseIGSTITC = 0;

    // 3. Net GST Liability Calculation
    const netTaxPayable = Math.max(0, outwardTaxPayable - purchaseTotalITC);
    const itcRemaining = Math.max(0, purchaseTotalITC - outwardTaxPayable);

    res.json({
      section31_OutwardSupplies: {
        invoicesCount: salesAggregate._count,
        taxableValue: outwardTaxableValue,
        cgstPayable: outwardCGST,
        sgstPayable: outwardSGST,
        igstPayable: outwardIGST,
        totalTaxPayable: outwardTaxPayable,
        totalTurnover: Number(salesAggregate._sum.totalAmount || 0),
      },
      section4_EligibleITC: {
        taxableValue: purchaseTaxableValue,
        cgstItc: purchaseCGSTITC,
        sgstItc: purchaseSGSTITC,
        igstItc: purchaseIGSTITC,
        totalEligibleItc: purchaseTotalITC,
      },
      netLiability: {
        netCgstPayable: Math.max(0, outwardCGST - purchaseCGSTITC),
        netSgstPayable: Math.max(0, outwardSGST - purchaseSGSTITC),
        netIgstPayable: 0,
        netTotalPayable: netTaxPayable,
        itcRemainingBalance: itcRemaining,
      },
    });
  } catch (error) {
    console.error('Error compiling GSTR-3B summary:', error);
    res.status(500).json({ error: 'Failed to compile GSTR-3B tax summary' });
  }
});

export default router;
