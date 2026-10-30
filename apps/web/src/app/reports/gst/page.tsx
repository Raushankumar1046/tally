'use client';

import React, { useEffect, useState } from 'react';
import Header from '@/components/Header';
import { api, GSTR1Summary, GSTR3BSummary, formatCurrency } from '@/lib/api';
import {
  FileText,
  TrendingUp,
  ShoppingCart,
  Printer,
  Receipt,
  Building2,
  Users2,
  Calculator,
  Percent,
} from 'lucide-react';

export default function GSTReportsPage() {
  const [activeTab, setActiveTab] = useState<'gstr1' | 'gstr3b'>('gstr1');
  const [gstr1, setGstr1] = useState<GSTR1Summary | null>(null);
  const [gstr3b, setGstr3b] = useState<GSTR3BSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const [data1, data3b] = await Promise.all([api.getGstr1(), api.getGstr3b()]);
      setGstr1(data1);
      setGstr3b(data3b);
    } catch (err: any) {
      console.error('Failed to load GST reports:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex-1 pb-12">
      <Header
        title="GST Tax Compliance Reports"
        subtitle="Automated GSTR-1 Outward Sales Summary & GSTR-3B Tax Liability vs Input Tax Credit (ITC)"
        onRefresh={fetchReports}
        actionButton={
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-tally-card hover:bg-tally-cardHover border border-tally-border text-white font-bold py-2 px-4 rounded-lg text-xs transition-colors"
          >
            <Printer className="w-4 h-4 text-brand-400" />
            <span>Print Report</span>
          </button>
        }
      />

      <div className="px-8 mt-6 space-y-6">
        {/* DUAL TAB SWITCHER */}
        <div className="flex items-center gap-3 border-b border-tally-border pb-3">
          <button
            onClick={() => setActiveTab('gstr1')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'gstr1'
                ? 'bg-brand-500 text-tally-bg shadow-md shadow-brand-500/20'
                : 'bg-tally-card text-gray-400 border border-tally-border hover:text-white'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>GSTR-1 Sales Tax Summary</span>
          </button>

          <button
            onClick={() => setActiveTab('gstr3b')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all ${
              activeTab === 'gstr3b'
                ? 'bg-brand-500 text-tally-bg shadow-md shadow-brand-500/20'
                : 'bg-tally-card text-gray-400 border border-tally-border hover:text-white'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>GSTR-3B Net Liability & ITC</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm text-tally-textMuted">Compiling GST Tax Ledgers...</div>
        ) : activeTab === 'gstr1' ? (
          /* TAB 1: GSTR-1 SUMMARY */
          <div className="space-y-6">
            {/* OVERVIEW STATS GRID */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="glass-card rounded-2xl p-5">
                <span className="text-xs text-tally-textMuted uppercase font-semibold">Total Turnover</span>
                <h3 className="text-2xl font-bold text-white mt-2">
                  {formatCurrency(gstr1?.summary.totalTurnover)}
                </h3>
                <p className="text-[11px] text-gray-400 mt-1">Taxable + GST Collected</p>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <span className="text-xs text-tally-textMuted uppercase font-semibold">Total Taxable Value</span>
                <h3 className="text-2xl font-bold text-emerald-400 mt-2">
                  {formatCurrency(gstr1?.summary.totalTaxableValue)}
                </h3>
                <p className="text-[11px] text-emerald-400/80 mt-1">{gstr1?.summary.totalInvoicesCount} Total Invoices</p>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <span className="text-xs text-tally-textMuted uppercase font-semibold">Central Tax (CGST)</span>
                <h3 className="text-2xl font-bold text-blue-400 mt-2">
                  {formatCurrency(gstr1?.summary.totalCGST)}
                </h3>
                <p className="text-[11px] text-blue-400/80 mt-1">50% Intra-State Split</p>
              </div>

              <div className="glass-card rounded-2xl p-5">
                <span className="text-xs text-tally-textMuted uppercase font-semibold">State Tax (SGST)</span>
                <h3 className="text-2xl font-bold text-purple-400 mt-2">
                  {formatCurrency(gstr1?.summary.totalSGST)}
                </h3>
                <p className="text-[11px] text-purple-400/80 mt-1">50% Intra-State Split</p>
              </div>
            </div>

            {/* B2B vs B2C BREAKDOWN */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="glass-card rounded-2xl p-6 border border-brand-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-brand-400" />
                    <h4 className="font-bold text-base text-white">B2B Outward Supplies</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-brand-500/20 text-brand-400 font-mono text-xs font-bold">
                    Registered Taxpayers
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-tally-border">
                    <span className="text-tally-textMuted">Invoices Count:</span>
                    <span className="font-bold font-mono text-white">{gstr1?.b2bSummary.count}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-tally-border">
                    <span className="text-tally-textMuted">Taxable Value:</span>
                    <span className="font-bold font-mono text-white">{formatCurrency(gstr1?.b2bSummary.taxableValue)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-sm pt-2 text-brand-400">
                    <span>Tax Collected:</span>
                    <span className="font-mono">{formatCurrency(gstr1?.b2bSummary.taxCollected)}</span>
                  </div>
                </div>
              </div>

              <div className="glass-card rounded-2xl p-6 border border-blue-500/30">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Users2 className="w-5 h-5 text-blue-400" />
                    <h4 className="font-bold text-base text-white">B2C Outward Supplies</h4>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-mono text-xs font-bold">
                    Retail Consumers
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-tally-border">
                    <span className="text-tally-textMuted">Invoices Count:</span>
                    <span className="font-bold font-mono text-white">{gstr1?.b2cSummary.count}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-tally-border">
                    <span className="text-tally-textMuted">Taxable Value:</span>
                    <span className="font-bold font-mono text-white">{formatCurrency(gstr1?.b2cSummary.taxableValue)}</span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-sm pt-2 text-blue-400">
                    <span>Tax Collected:</span>
                    <span className="font-mono">{formatCurrency(gstr1?.b2cSummary.taxCollected)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* TAX RATE BREAKDOWN TABLE */}
            <div className="glass-card rounded-2xl p-6">
              <h4 className="font-bold text-base text-white mb-4 flex items-center gap-2">
                <Percent className="w-5 h-5 text-purple-400" />
                <span>Rate-wise Outward Taxable Supplies (5%, 12%, 18%, 28%)</span>
              </h4>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-tally-border text-tally-textMuted uppercase">
                      <th className="pb-3 font-semibold">GST Rate</th>
                      <th className="pb-3 font-semibold text-right">Taxable Value</th>
                      <th className="pb-3 font-semibold text-right">Central Tax (CGST)</th>
                      <th className="pb-3 font-semibold text-right">State Tax (SGST)</th>
                      <th className="pb-3 font-semibold text-right">Total Tax Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tally-border/60">
                    {gstr1?.rateBreakdown.map((row) => (
                      <tr key={row.rate} className="hover:bg-tally-cardHover">
                        <td className="py-3 font-mono font-bold text-brand-400">{row.rate}% GST</td>
                        <td className="py-3 text-right font-mono text-white">{formatCurrency(row.taxable)}</td>
                        <td className="py-3 text-right font-mono text-gray-300">{formatCurrency(row.cgst)}</td>
                        <td className="py-3 text-right font-mono text-gray-300">{formatCurrency(row.sgst)}</td>
                        <td className="py-3 text-right font-mono font-bold text-emerald-400">
                          {formatCurrency(row.tax)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          /* TAB 2: GSTR-3B SUMMARY */
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* SECTION 3.1 OUTWARD SUPPLIES */}
              <div className="glass-card rounded-2xl p-6 border border-emerald-500/30">
                <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
                  <h4 className="font-bold text-base text-white flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-emerald-400" />
                    <span>3.1 Outward Taxable Supplies (Sales)</span>
                  </h4>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">Total Outward Turnover:</span>
                    <span className="font-bold font-mono text-white">
                      {formatCurrency(gstr3b?.section31_OutwardSupplies.totalTurnover)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">Taxable Value:</span>
                    <span className="font-bold font-mono text-white">
                      {formatCurrency(gstr3b?.section31_OutwardSupplies.taxableValue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">Central Tax (CGST):</span>
                    <span className="font-mono text-gray-300">
                      {formatCurrency(gstr3b?.section31_OutwardSupplies.cgstPayable)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">State Tax (SGST):</span>
                    <span className="font-mono text-gray-300">
                      {formatCurrency(gstr3b?.section31_OutwardSupplies.sgstPayable)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-bold text-emerald-400 pt-3">
                    <span>Total Output Tax Payable:</span>
                    <span className="font-mono text-base">
                      {formatCurrency(gstr3b?.section31_OutwardSupplies.totalTaxPayable)}
                    </span>
                  </div>
                </div>
              </div>

              {/* SECTION 4 ELIGIBLE ITC */}
              <div className="glass-card rounded-2xl p-6 border border-blue-500/30">
                <div className="flex items-center justify-between border-b border-tally-border pb-4 mb-4">
                  <h4 className="font-bold text-base text-white flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-blue-400" />
                    <span>4. Eligible Input Tax Credit (ITC Purchases)</span>
                  </h4>
                </div>
                <div className="space-y-3 text-xs">
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">Purchases Taxable Value:</span>
                    <span className="font-bold font-mono text-white">
                      {formatCurrency(gstr3b?.section4_EligibleITC.taxableValue)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">Central Tax Credit (CGST ITC):</span>
                    <span className="font-mono text-gray-300">
                      {formatCurrency(gstr3b?.section4_EligibleITC.cgstItc)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-tally-border">
                    <span className="text-tally-textMuted">State Tax Credit (SGST ITC):</span>
                    <span className="font-mono text-gray-300">
                      {formatCurrency(gstr3b?.section4_EligibleITC.sgstItc)}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 text-sm font-bold text-blue-400 pt-3">
                    <span>Total Eligible ITC Available:</span>
                    <span className="font-mono text-base">
                      {formatCurrency(gstr3b?.section4_EligibleITC.totalEligibleItc)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* NET GST LIABILITY CALCULATION WIDGET */}
            <div className="glass-card rounded-2xl p-6 border border-brand-500/40 bg-gradient-to-r from-tally-card to-tally-bg">
              <h4 className="font-bold text-lg text-white mb-2 flex items-center gap-2">
                <Calculator className="w-6 h-6 text-brand-400" />
                <span>Net GST Tax Liability (Output Tax - Eligible ITC)</span>
              </h4>
              <p className="text-xs text-tally-textMuted mb-6">
                Formula: Net Tax Payable = Total Tax Payable (Sales) - Total Eligible Input Tax Credit (Purchases)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <div className="p-4 rounded-xl bg-tally-bg border border-tally-border">
                  <span className="text-xs text-tally-textMuted">Gross Output Tax (Sales)</span>
                  <div className="text-xl font-bold font-mono text-emerald-400 mt-1">
                    {formatCurrency(gstr3b?.section31_OutwardSupplies.totalTaxPayable)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-tally-bg border border-tally-border">
                  <span className="text-xs text-tally-textMuted">Less: Input Tax Credit (Purchases)</span>
                  <div className="text-xl font-bold font-mono text-blue-400 mt-1">
                    -{formatCurrency(gstr3b?.section4_EligibleITC.totalEligibleItc)}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/40">
                  <span className="text-xs text-brand-400 font-bold">NET CASH TAX LIABILITY</span>
                  <div className="text-2xl font-bold font-mono text-brand-400 mt-1">
                    {formatCurrency(gstr3b?.netLiability.netTotalPayable)}
                  </div>
                </div>
              </div>

              {gstr3b?.netLiability.itcRemainingBalance! > 0 && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400 text-center font-semibold">
                  🎉 ITC Carry-Forward Balance: You have {formatCurrency(gstr3b?.netLiability.itcRemainingBalance)} remaining input credit to offset future sales taxes.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
