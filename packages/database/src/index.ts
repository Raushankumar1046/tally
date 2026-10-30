import { PrismaClient } from '@prisma/client';
import path from 'path';
import dotenv from 'dotenv';

// Ensure root .env is loaded if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

declare global {
  var globalPrisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.globalPrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.globalPrisma = prisma;
}

// Runtime Enums for SQLite and PostgreSQL compatibility
export enum PaymentMode {
  CASH = 'CASH',
  UPI = 'UPI',
  BANK = 'BANK',
  CREDIT = 'CREDIT',
}

export enum JournalType {
  DEBIT = 'DEBIT',
  CREDIT = 'CREDIT',
}

export enum AccountType {
  BANK = 'BANK',
  CASH = 'CASH',
}

export enum VoucherType {
  RECEIPT = 'RECEIPT',
  PAYMENT = 'PAYMENT',
  CONTRA = 'CONTRA',
  JOURNAL = 'JOURNAL',
}

export enum LedgerType {
  VENDOR = 'VENDOR',
  CUSTOMER = 'CUSTOMER',
  BANK = 'BANK',
  CASH = 'CASH',
  EXPENSE = 'EXPENSE',
  INCOME = 'INCOME',
  ITEM = 'ITEM',
  GENERAL = 'GENERAL',
}

export * from '@prisma/client';
