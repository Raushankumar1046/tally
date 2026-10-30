import { PrismaClient, PaymentMode, JournalType, AccountType, VoucherType, LedgerType } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding (V3)...');

  // Clean existing data
  await prisma.voucherLine.deleteMany();
  await prisma.voucher.deleteMany();
  await prisma.journalLine.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.purchaseItem.deleteMany();
  await prisma.purchase.deleteMany();
  await prisma.stockLedger.deleteMany();
  await prisma.item.deleteMany();
  await prisma.vendor.deleteMany();
  await prisma.bankAccount.deleteMany();
  await prisma.companySettings.deleteMany();

  console.log('🧹 Cleaned existing tables.');

  // 1. Create Default Company & Sequence Settings
  await prisma.companySettings.create({
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
      invoicePrefix: '26-27/',
      nextInvoiceNumber: 1,
      invoiceNumberPadding: 3,
      purchasePrefix: 'PUR/26-27/',
      nextPurchaseNumber: 1,
    },
  });

  console.log('✅ Created Company & Sequence Settings');

  // 2. Create Bank Accounts & Cash Ledgers
  const bankHdfc = await prisma.bankAccount.create({
    data: {
      accountName: 'HDFC Bank Operating Current A/C',
      accountType: AccountType.BANK,
      accountNumber: '50200098765432',
      ifscCode: 'HDFC0001234',
      branch: 'Koramangala Branch',
      openingBalance: 150000.00,
      currentBalance: 175000.00,
    },
  });

  const cashAccount = await prisma.bankAccount.create({
    data: {
      accountName: 'Main Office Petty Cash Account',
      accountType: AccountType.CASH,
      openingBalance: 25000.00,
      currentBalance: 20000.00,
    },
  });

  const bankIcici = await prisma.bankAccount.create({
    data: {
      accountName: 'ICICI Merchant Collection A/C',
      accountType: AccountType.BANK,
      accountNumber: '001105001234',
      ifscCode: 'ICIC0000011',
      branch: 'MG Road Branch',
      openingBalance: 85000.00,
      currentBalance: 85000.00,
    },
  });

  console.log('✅ Created Bank Accounts');

  // 3. Create Vendors
  const vendor1 = await prisma.vendor.create({
    data: {
      name: 'Acme Tech Distributors',
      email: 'sales@acmetech.com',
      phone: '+91 98765 43210',
      gstin: '27AAAAA0000A1Z5',
      address: '102 Industrial Estate, Andheri East, Mumbai',
      balance: 15400.00,
    },
  });

  const vendor2 = await prisma.vendor.create({
    data: {
      name: 'Apex Electronics Hub',
      email: 'orders@apexelectronics.in',
      phone: '+91 91234 56789',
      gstin: '07BBBBB1111B2Z8',
      address: '45 Nehru Place, New Delhi',
      balance: 8500.00,
    },
  });

  const vendor3 = await prisma.vendor.create({
    data: {
      name: 'Global Hardware & Tools',
      email: 'contact@globalhardware.com',
      phone: '+91 99887 76655',
      gstin: '33CCCCC2222C3Z1',
      address: '88 SP Road, Bengaluru',
      balance: 0.00,
    },
  });

  console.log('✅ Created Vendors');

  // 4. Create Items & Stock Ledgers
  const item1 = await prisma.item.create({
    data: {
      name: 'Logitech MX Master 3S Wireless Mouse',
      sku: 'SKU-LOG-MX3S',
      category: 'Peripherals',
      unit: 'Pcs',
      purchasePrice: 6500.00,
      sellingPrice: 8999.00,
      taxRate: 18.00,
      minStockLevel: 5,
      stock: {
        create: { currentQuantity: 18 },
      },
    },
  });

  const item2 = await prisma.item.create({
    data: {
      name: 'Keychron K2 Mechanical Keyboard',
      sku: 'SKU-KEY-K2V2',
      category: 'Peripherals',
      unit: 'Pcs',
      purchasePrice: 5200.00,
      sellingPrice: 7499.00,
      taxRate: 18.00,
      minStockLevel: 4,
      stock: {
        create: { currentQuantity: 3 },
      },
    },
  });

  const item3 = await prisma.item.create({
    data: {
      name: 'Dell UltraSharp 27" 4K Monitor (U2723QE)',
      sku: 'SKU-DEL-274K',
      category: 'Displays',
      unit: 'Pcs',
      purchasePrice: 38000.00,
      sellingPrice: 48999.00,
      taxRate: 18.00,
      minStockLevel: 2,
      stock: {
        create: { currentQuantity: 7 },
      },
    },
  });

  console.log('✅ Created Items & Stock Ledgers');

  // 5. Create Sample Purchases
  await prisma.purchase.create({
    data: {
      vendorId: vendor1.id,
      invoiceNumber: 'PUR/26-27/001',
      totalAmount: 138060.00,
      purchaseDate: new Date(),
      items: {
        create: [
          {
            itemId: item1.id,
            quantity: 10,
            unitPurchasePrice: 6500.00,
            taxRate: 18.00,
            taxableAmount: 65000.00,
            taxAmount: 11700.00,
            totalPrice: 76700.00,
          },
          {
            itemId: item2.id,
            quantity: 10,
            unitPurchasePrice: 5200.00,
            taxRate: 18.00,
            taxableAmount: 52000.00,
            taxAmount: 9360.00,
            totalPrice: 61360.00,
          },
        ],
      },
    },
  });

  // 6. Create Sample Invoices with Formatted Dynamic Prefixes
  await prisma.invoice.create({
    data: {
      customerName: 'TechCorp Solutions Pvt Ltd',
      customerPhone: '+91 98200 11223',
      customerGstin: '27AAACT9999K1Z2',
      invoiceNumber: '26-27/001',
      subtotal: 57998.00,
      taxAmount: 10439.64,
      totalAmount: 68437.64,
      paymentMode: PaymentMode.UPI,
      createdAt: new Date(),
      items: {
        create: [
          {
            itemId: item3.id,
            quantity: 1,
            unitSellingPrice: 48999.00,
            taxRate: 18.00,
            totalPrice: 57818.82,
          },
          {
            itemId: item1.id,
            quantity: 1,
            unitSellingPrice: 8999.00,
            taxRate: 18.00,
            totalPrice: 10618.82,
          },
        ],
      },
    },
  });

  // Increment sequence setting after initial invoice
  await prisma.companySettings.updateMany({
    data: {
      nextInvoiceNumber: 2,
    },
  });

  console.log('✅ Created Invoices with Formatted Sequence (26-27/001)');

  // 7. Create Sample Banking Vouchers (Receipt, Payment, Contra)
  // Customer Payment Receipt
  await prisma.voucher.create({
    data: {
      voucherNumber: 'REC-2026-0001',
      voucherType: VoucherType.RECEIPT,
      amount: 25000.00,
      referenceNumber: 'NEFT-998811',
      narration: 'Customer payment received via NEFT from TechCorp Solutions',
      bankAccountId: bankHdfc.id,
      date: new Date(),
      lines: {
        create: [
          {
            ledgerType: LedgerType.BANK,
            ledgerId: bankHdfc.id,
            accountName: bankHdfc.accountName,
            debitAmount: 25000.00,
            creditAmount: 0.00,
          },
          {
            ledgerType: LedgerType.CUSTOMER,
            accountName: 'TechCorp Solutions Pvt Ltd',
            debitAmount: 0.00,
            creditAmount: 25000.00,
          },
        ],
      },
    },
  });

  // Vendor Payment Voucher
  await prisma.voucher.create({
    data: {
      voucherNumber: 'PAY-2026-0001',
      voucherType: VoucherType.PAYMENT,
      amount: 10000.00,
      referenceNumber: 'UPI-774422',
      narration: 'Part payment to Acme Tech Distributors via HDFC Bank',
      vendorId: vendor1.id,
      bankAccountId: bankHdfc.id,
      date: new Date(),
      lines: {
        create: [
          {
            ledgerType: LedgerType.VENDOR,
            ledgerId: vendor1.id,
            accountName: vendor1.name,
            debitAmount: 10000.00,
            creditAmount: 0.00,
          },
          {
            ledgerType: LedgerType.BANK,
            ledgerId: bankHdfc.id,
            accountName: bankHdfc.accountName,
            debitAmount: 0.00,
            creditAmount: 10000.00,
          },
        ],
      },
    },
  });

  // Contra Voucher (Cash Withdrawal)
  await prisma.voucher.create({
    data: {
      voucherNumber: 'CON-2026-0001',
      voucherType: VoucherType.CONTRA,
      amount: 5000.00,
      referenceNumber: 'ATM-441122',
      narration: 'Cash withdrawn from HDFC Bank for Petty Cash',
      bankAccountId: bankHdfc.id,
      date: new Date(),
      lines: {
        create: [
          {
            ledgerType: LedgerType.CASH,
            ledgerId: cashAccount.id,
            accountName: cashAccount.accountName,
            debitAmount: 5000.00,
            creditAmount: 0.00,
          },
          {
            ledgerType: LedgerType.BANK,
            ledgerId: bankHdfc.id,
            accountName: bankHdfc.accountName,
            debitAmount: 0.00,
            creditAmount: 5000.00,
          },
        ],
      },
    },
  });

  console.log('✅ Created Banking Vouchers (Receipt, Payment, Contra)');
  console.log('🎉 V3 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
