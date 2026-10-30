import { Router } from 'express';
import { prisma } from '@tally/database';

const router = Router();

// GET Company Settings & Bank Details
router.get('/settings', async (req, res) => {
  try {
    let settings = await prisma.companySettings.findFirst();

    if (!settings) {
      settings = await prisma.companySettings.create({
        data: {
          companyName: 'Tally Solutions Enterprise Pvt Ltd',
          address: '100 Tech Park Avenue, Silicon Valley, Bengaluru - 560100',
          phone: '+91 80000 12345',
          email: 'billing@tallysolutions.com',
          gstin: '29AAAAA0000A1Z5',
          bankName: 'HDFC Bank Ltd',
          accountNumber: '50200098765432',
          ifscCode: 'HDFC0001234',
          branchName: 'Koramangala Branch, Bengaluru',
          upiId: 'tallyenterprise@hdfcbank',
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: 'Failed to fetch company settings' });
  }
});

// PUT Update Company Settings & Bank Details
router.put('/settings', async (req, res) => {
  try {
    const {
      companyName,
      address,
      phone,
      email,
      gstin,
      panNumber,
      bankName,
      accountNumber,
      ifscCode,
      branchName,
      upiId,
    } = req.body;

    let settings = await prisma.companySettings.findFirst();

    if (settings) {
      settings = await prisma.companySettings.update({
        where: { id: settings.id },
        data: {
          companyName: companyName || settings.companyName,
          address: address !== undefined ? address : settings.address,
          phone: phone !== undefined ? phone : settings.phone,
          email: email !== undefined ? email : settings.email,
          gstin: gstin !== undefined ? gstin : settings.gstin,
          panNumber: panNumber !== undefined ? panNumber : settings.panNumber,
          bankName: bankName !== undefined ? bankName : settings.bankName,
          accountNumber: accountNumber !== undefined ? accountNumber : settings.accountNumber,
          ifscCode: ifscCode !== undefined ? ifscCode : settings.ifscCode,
          branchName: branchName !== undefined ? branchName : settings.branchName,
          upiId: upiId !== undefined ? upiId : settings.upiId,
        },
      });
    } else {
      settings = await prisma.companySettings.create({
        data: {
          companyName: companyName || 'Tally Solutions Enterprise Pvt Ltd',
          address,
          phone,
          email,
          gstin,
          panNumber,
          bankName,
          accountNumber,
          ifscCode,
          branchName,
          upiId,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: 'Failed to update company settings' });
  }
});

export default router;
