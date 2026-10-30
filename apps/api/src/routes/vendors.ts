import { Router } from 'express';
import { prisma } from '@tally/database';
import { ensureRecycleBinTable } from './recycleBin';

const router = Router();

// GET all vendors
router.get('/vendors', async (req, res) => {
  try {
    const vendors = await prisma.vendor.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { purchases: true },
        },
      },
    });
    res.json(vendors);
  } catch (error) {
    console.error('Error fetching vendors:', error);
    res.status(500).json({ error: 'Failed to fetch vendors' });
  }
});

// GET single vendor
router.get('/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const vendor = await prisma.vendor.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!vendor) {
      return res.status(404).json({ error: 'Vendor not found' });
    }
    res.json(vendor);
  } catch (error) {
    console.error('Error fetching vendor:', error);
    res.status(500).json({ error: 'Failed to fetch vendor' });
  }
});

// POST new vendor
router.post('/vendors', async (req, res) => {
  try {
    const { name, email, phone, gstin, address, balance } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Vendor name is required' });
    }
    const vendor = await prisma.vendor.create({
      data: {
        name,
        email: email || null,
        phone: phone || null,
        gstin: gstin || null,
        address: address || null,
        balance: balance ? parseFloat(balance) : 0,
      },
    });
    res.status(201).json(vendor);
  } catch (error) {
    console.error('Error creating vendor:', error);
    res.status(500).json({ error: 'Failed to create vendor' });
  }
});

// PUT update vendor
router.put('/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, gstin, address, balance } = req.body;
    const vendor = await prisma.vendor.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(gstin !== undefined && { gstin }),
        ...(address !== undefined && { address }),
        ...(balance !== undefined && { balance: parseFloat(balance) }),
      },
    });
    res.json(vendor);
  } catch (error) {
    console.error('Error updating vendor:', error);
    res.status(500).json({ error: 'Failed to update vendor' });
  }
});

// DELETE vendor
router.delete('/vendors/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await ensureRecycleBinTable();

    // Check if vendor has linked purchases
    const purchaseCount = await prisma.purchase.count({ where: { vendorId: id } });
    if (purchaseCount > 0) {
      return res.status(400).json({
        error: `Cannot delete vendor because ${purchaseCount} purchase order(s) are linked to this supplier.`,
      });
    }

    const existing = await prisma.vendor.findUnique({ where: { id } });
    if (existing) {
      await prisma.recycleBin.create({
        data: {
          entityType: 'VENDOR',
          entityId: id,
          displayName: `Vendor: ${existing.name}`,
          details: `GSTIN: ${existing.gstin || 'Unregistered'} | Phone: ${existing.phone || 'N/A'} | Balance: ₹${Number(existing.balance).toLocaleString('en-IN')}`,
          payload: JSON.stringify(existing),
        },
      });
    }

    await prisma.vendor.delete({ where: { id } });
    res.json({ message: 'Vendor moved to Recycle Bin', id });
  } catch (error) {
    console.error('Error deleting vendor:', error);
    res.status(500).json({ error: 'Failed to delete vendor' });
  }
});

export default router;
