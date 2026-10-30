'use client';

import React, { useEffect, useState } from 'react';
import { Invoice, CompanySettings, api } from '@/lib/api';
import { Printer, X, CheckCircle2, FileEdit, Trash2 } from 'lucide-react';

interface ThermalInvoiceModalProps {
  invoice: Invoice | null;
  onClose: () => void;
  onEdit?: (invoice: Invoice) => void;
  onDelete?: (invoice: Invoice) => void;
}

// Convert numbers to Indian Rupee Words representation
function numberToWords(amount: number): string {
  const num = Math.round(amount);
  if (num === 0) return 'Rupees Zero Only';

  const a = [
    '', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ',
    'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : ' ');
    if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 !== 0 ? 'And ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 !== 0 ? inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 !== 0 ? inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 !== 0 ? inWords(n % 10000000) : '');
  }

  return `Rupees ${inWords(num).trim()} Only`;
}

export default function ThermalInvoiceModal({ invoice, onClose, onEdit, onDelete }: ThermalInvoiceModalProps) {
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [printOption, setPrintOption] = useState<'both' | 'original' | 'duplicate'>('both');

  useEffect(() => {
    if (invoice) {
      api.getSettings().then(setSettings).catch(console.error);
    }
  }, [invoice]);

  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const totalQuantity = invoice.items.reduce((acc, line) => acc + Number(line.quantity), 0);
  const formattedSubtotal = Number(invoice.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedTaxAmount = Number(invoice.taxAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const formattedGrandTotal = Number(invoice.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2 });

  // Calculate empty rows needed to give "Description of Goods" a large, standard Tally layout (min 7 rows)
  const minRows = 7;
  const emptyRowsCount = Math.max(0, minRows - invoice.items.length);

  // Single Invoice Box Component
  const renderSingleInvoiceBox = (copyTitle: 'Original Copy' | 'Duplicate Copy') => (
    <div
      className="invoice-box bg-white text-black p-4 rounded-sm font-sans text-[11px] leading-tight border border-black max-w-3xl mx-auto shadow-sm"
      style={{ fontFamily: "'Helvetica Neue', Arial, sans-serif" }}
    >
      {/* 1. Top Copy Header Indicator */}
      <div className="text-right italic font-serif text-xs font-bold mb-0.5 pr-1">
        {copyTitle}
      </div>

      {/* 2. Main Company Header */}
      <div className="border border-black p-2 mb-0 relative text-center">
        <h1 className="font-bold text-xs tracking-wider uppercase underline">TAX INVOICE</h1>
        <h2 className="font-extrabold text-lg tracking-tight text-black mt-0.5">
          {settings?.companyName || 'ATS Technologies'}
        </h2>
        <p className="text-[10px] font-medium text-gray-800">
          {settings?.address || '# 382, Kh.No. 39/1, RAJPUR KHURD, SOUTH DELHI'}
        </p>
        <p className="text-[10px] font-bold text-gray-900 mt-0.5">
          PAN : {settings?.panNumber || 'AVCPT7101L'}
        </p>
        <p className="text-[10px] font-extrabold text-black">
          GSTIN : {settings?.gstin || '07AVCPT7101L1ZE'}
        </p>
        <p className="text-[9px] text-gray-700 font-semibold">
          Tel. : {settings?.phone || '9311258404'} email : {settings?.email || 'atstechnologies001@gmail.com'}
        </p>
      </div>

      {/* 3. Invoice Meta Grid (Two Columns) */}
      <div className="grid grid-cols-2 border border-t-0 border-black">
        <div className="p-1.5 border-r border-black space-y-0.5">
          <div className="flex"><span className="w-24 font-semibold">Invoice No.</span><span>: {invoice.invoiceNumber}</span></div>
          <div className="flex"><span className="w-24 font-semibold">Dated</span><span>: {new Date(invoice.createdAt).toLocaleDateString('en-GB')}</span></div>
          <div className="flex"><span className="w-24 font-semibold">Place of Supply</span><span>: {invoice.placeOfSupply || 'Uttar Pradesh, Code : 09'}</span></div>
          <div className="flex"><span className="w-24 font-semibold">Reverse Charge</span><span>: N</span></div>
        </div>
        <div className="p-1.5 space-y-0.5">
          <div className="flex"><span className="w-24 font-semibold">PO. No.</span><span>: {invoice.poNumber || 'By MAIL'}</span></div>
          <div className="flex"><span className="w-24 font-semibold">PO. Date</span><span>: {invoice.poDate ? new Date(invoice.poDate).toLocaleDateString('en-GB') : new Date(invoice.createdAt).toLocaleDateString('en-GB')}</span></div>
          <div className="flex"><span className="w-24 font-semibold">Payment Terms</span><span>: {invoice.paymentTerms || (invoice.paymentMode === 'CREDIT' ? `${invoice.creditDays || 15} Days Credit` : 'Against Delivery')}</span></div>
          <div className="flex"><span className="w-24 font-semibold">Payment Type</span><span>: {invoice.paymentMode}</span></div>
        </div>
      </div>

      {/* 4. Billed To & Shipped To Grid */}
      <div className="grid grid-cols-2 border border-t-0 border-black min-h-[85px]">
        <div className="p-1.5 border-r border-black flex flex-col justify-between">
          <div>
            <span className="font-bold italic text-[10px] underline block mb-0.5">Billed to :</span>
            <div className="font-extrabold text-xs text-black">{invoice.customerName || 'Walk-in Customer'}</div>
            <div className="text-[10px] text-gray-800 font-medium whitespace-pre-line">
              {invoice.customerAddress || (
                <>
                  THE PRESIDENCY, 46/4 SECTOR 14<br />
                  MEHRAULI GURGAON ROAD,<br />
                  GURGAON, HARYANA 122001
                </>
              )}
            </div>
          </div>
          <div className="mt-1 font-bold flex text-[10px]">
            <span className="w-20">GSTIN / UIN</span>
            <span>: {invoice.customerGstin || '06AAICV1239K1Z5'}</span>
          </div>
        </div>

        <div className="p-1.5 flex flex-col justify-between">
          <div>
            <span className="font-bold italic text-[10px] underline block mb-0.5">Shipped to :</span>
            <div className="font-extrabold text-xs text-black">{invoice.customerName || 'Walk-in Customer'}</div>
            <div className="text-[10px] text-gray-800 font-medium whitespace-pre-line">
              {invoice.shippedAddress || invoice.customerAddress || (
                <>
                  THE PRESIDENCY, 46/4 SECTOR 14<br />
                  MEHRAULI GURGAON ROAD,<br />
                  GURGAON, HARYANA 122001
                </>
              )}
            </div>
          </div>
          <div className="mt-1 font-bold flex text-[10px]">
            <span className="w-20">GSTIN / UIN</span>
            <span>: {invoice.customerGstin || '06AAICV1239K1Z5'}</span>
          </div>
        </div>
      </div>

      {/* 5. Main Description of Goods Table */}
      <table className="w-full border-collapse border border-t-0 border-black text-left text-[10px]">
        <thead>
          <tr className="border-b border-black bg-gray-50 text-black font-bold">
            <th className="p-1.5 border-r border-black w-8 text-center">S.N.</th>
            <th className="p-1.5 border-r border-black">Description of Goods</th>
            <th className="p-1.5 border-r border-black w-20 text-center">HSN/SAC Code</th>
            <th className="p-1.5 border-r border-black w-12 text-center">Qty.</th>
            <th className="p-1.5 border-r border-black w-12 text-center">Unit</th>
            <th className="p-1.5 border-r border-black w-24 text-right">Price</th>
            <th className="p-1.5 w-28 text-right">Amount(₹)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {/* Actual Invoice Items */}
          {invoice.items.map((line, idx) => (
            <tr key={idx} className="align-top">
              <td className="p-1.5 border-r border-black text-center font-semibold">{idx + 1}.</td>
              <td className="p-1.5 border-r border-black">
                <div className="font-bold text-[11px] text-black">{line.item?.name || 'Stock Item'}</div>
                <div className="text-[9.5px] italic text-gray-700 font-medium pl-2 mt-0.5">
                  {line.item?.category || 'Peripherals'} Specification / Model Item
                </div>
              </td>
              <td className="p-1.5 border-r border-black text-center font-mono font-semibold">
                {line.item?.sku?.replace('SKU-', '') || '8543'}
              </td>
              <td className="p-1.5 border-r border-black text-center font-bold">
                {Number(line.quantity).toFixed(2)}
              </td>
              <td className="p-1.5 border-r border-black text-center">{line.item?.unit || 'Pcs.'}</td>
              <td className="p-1.5 border-r border-black text-right font-mono">
                {Number(line.unitSellingPrice).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
              <td className="p-1.5 text-right font-mono font-bold">
                {(Number(line.quantity) * Number(line.unitSellingPrice)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </td>
            </tr>
          ))}

          {/* Empty Rows to keep the "Description of Goods" section big & extended like standard Tally bills */}
          {Array.from({ length: emptyRowsCount }).map((_, idx) => (
            <tr key={`empty-${idx}`} className="h-8 align-top">
              <td className="p-1.5 border-r border-black text-center">&nbsp;</td>
              <td className="p-1.5 border-r border-black">&nbsp;</td>
              <td className="p-1.5 border-r border-black">&nbsp;</td>
              <td className="p-1.5 border-r border-black">&nbsp;</td>
              <td className="p-1.5 border-r border-black">&nbsp;</td>
              <td className="p-1.5 border-r border-black">&nbsp;</td>
              <td className="p-1.5">&nbsp;</td>
            </tr>
          ))}
        </tbody>

        {/* Table Summary & Tax Rows */}
        <tfoot>
          <tr className="border-t border-black font-bold">
            <td colSpan={6} className="p-1 text-right border-r border-black">
              Subtotal:
            </td>
            <td className="p-1 text-right font-mono">{formattedSubtotal}</td>
          </tr>
          <tr className="border-t border-black italic">
            <td colSpan={3} className="p-1 text-right font-bold pr-2">
              Add : IGST @ 18.00 %
            </td>
            <td colSpan={3} className="p-1 text-right border-r border-black font-semibold">
              @ 18.00 %
            </td>
            <td className="p-1 text-right font-mono font-bold">{formattedTaxAmount}</td>
          </tr>
          <tr className="border-t-2 border-black font-bold text-xs bg-gray-50">
            <td colSpan={3} className="p-1 text-left font-bold uppercase">
              Grand Total
            </td>
            <td colSpan={3} className="p-1 text-right border-r border-black font-mono font-bold">
              {totalQuantity.toFixed(2)} Pcs.
            </td>
            <td className="p-1 text-right font-mono font-extrabold text-xs">
              ₹ {formattedGrandTotal}
            </td>
          </tr>
        </tfoot>
      </table>

      {/* 6. HSN/SAC Tax Summary Table */}
      <div className="border border-t-0 border-black p-1.5">
        <table className="w-full border-collapse border border-black text-left text-[9px] mb-1">
          <thead>
            <tr className="border-b border-black bg-gray-100 font-bold">
              <th className="p-0.5 border-r border-black">HSN/SAC</th>
              <th className="p-0.5 border-r border-black">Tax Rate</th>
              <th className="p-0.5 border-r border-black text-right">Taxable Amt.</th>
              <th className="p-0.5 border-r border-black text-right">IGST Amt.</th>
              <th className="p-0.5 text-right">Total Tax</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-300">
              <td className="p-0.5 border-r border-black font-mono">321511</td>
              <td className="p-0.5 border-r border-black">18%</td>
              <td className="p-0.5 border-r border-black text-right font-mono">{formattedSubtotal}</td>
              <td className="p-0.5 border-r border-black text-right font-mono">{formattedTaxAmount}</td>
              <td className="p-0.5 text-right font-mono font-bold">{formattedTaxAmount}</td>
            </tr>
          </tbody>
        </table>

        <div className="font-bold italic text-[10px] text-black border-t border-black pt-0.5">
          {numberToWords(Number(invoice.totalAmount))}
        </div>
      </div>

      {/* 7. Declaration Block */}
      <div className="border border-t-0 border-black p-1.5 text-center text-[9px] space-y-0.5">
        <div className="font-bold text-[10px] underline">Declaration</div>
        <div>All Warranties are Direct from Principal Companies or Importer</div>
        <div>Subject to Jurisdiction of Delhi</div>
        <div className="italic">No Software Included Unless Specifically Mentioned</div>
      </div>

      {/* 8. Bank Details Block */}
      <div className="border border-t-0 border-black p-1.5 text-[10px] font-medium">
        <div className="flex flex-wrap items-center justify-between">
          <div>
            <span className="font-bold">Bank Details :</span> A/C No. {settings?.accountNumber || '510101006558273'}
          </div>
          <div>
            <span className="font-bold">IFSC Code</span> {settings?.ifscCode || 'UBIN0915386'}
          </div>
        </div>
        <div className="mt-0.5 text-gray-800 font-semibold">
          {settings?.bankName || 'Union Bank of India'} &nbsp;&nbsp;&nbsp; Branch - {settings?.branchName || 'Chhatarpur New Delhi'}
        </div>
      </div>

      {/* 9. Footer Terms & Signature Grid */}
      <div className="grid grid-cols-2 border border-t-0 border-black text-[9px]">
        <div className="p-1.5 border-r border-black space-y-0.5">
          <div className="font-bold underline text-[10px]">Terms &amp; Conditions</div>
          <div className="italic font-semibold">E.&amp; O.E.</div>
          <div>1. Goods once sold will not be taken back.</div>
          <div>2. Interest @ 18% p.a. will be charged if payment is not made within stipulated time.</div>
          <div>3. Subject to 'Delhi' Jurisdiction only.</div>
        </div>

        <div className="p-1.5 flex flex-col justify-between text-right">
          <div>
            <span className="font-semibold text-left block">Receiver's Signature :</span>
          </div>
          <div className="mt-4 pt-2">
            <div className="font-bold text-[10px]">For {settings?.companyName || 'ATS Technologies'}</div>
            <div className="font-bold text-[10px] mt-4 uppercase">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div id="printable-invoice-modal" className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm p-4 sm:p-6 flex justify-center items-start">
      <div className="bg-tally-card border border-tally-border rounded-2xl max-w-4xl w-full p-6 shadow-2xl relative my-6 sm:my-8">
        {/* Header Actions (No print) */}
        <div className="flex flex-wrap items-center justify-between border-b border-tally-border pb-4 mb-4 gap-4 no-print">
          <div className="flex items-center gap-3 text-emerald-400 font-bold text-sm">
            <CheckCircle2 className="w-5 h-5" />
            <span>Official Tax Invoice Preview</span>
          </div>

          <div className="flex items-center gap-3">
            {/* Copy Print Option Selector */}
            <div className="flex items-center bg-tally-bg border border-tally-border rounded-xl p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setPrintOption('both')}
                className={`px-3 py-1.5 rounded-lg transition-all ${printOption === 'both'
                  ? 'bg-brand-500 text-tally-bg shadow'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Original + Duplicate (Both)
              </button>
              <button
                type="button"
                onClick={() => setPrintOption('original')}
                className={`px-3 py-1.5 rounded-lg transition-all ${printOption === 'original'
                  ? 'bg-brand-500 text-tally-bg shadow'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Original Only
              </button>
              <button
                type="button"
                onClick={() => setPrintOption('duplicate')}
                className={`px-3 py-1.5 rounded-lg transition-all ${printOption === 'duplicate'
                  ? 'bg-brand-500 text-tally-bg shadow'
                  : 'text-gray-400 hover:text-white'
                  }`}
              >
                Duplicate Only
              </button>
            </div>

            {onEdit && invoice && (
              <button
                type="button"
                onClick={() => onEdit(invoice)}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-3.5 rounded-xl text-xs transition-colors shadow-md cursor-pointer"
              >
                <FileEdit className="w-4 h-4" />
                <span>Edit Bill</span>
              </button>
            )}

            {onDelete && invoice && (
              <button
                type="button"
                onClick={() => onDelete(invoice)}
                className="flex items-center gap-1.5 bg-red-600/20 border border-red-500/40 hover:bg-red-600 text-red-300 hover:text-white font-bold py-2 px-3 rounded-xl text-xs transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            )}

            <button
              onClick={handlePrint}
              className="flex items-center gap-2 bg-gradient-to-r from-brand-500 to-emerald-600 hover:from-brand-600 hover:to-emerald-700 text-tally-bg font-bold py-2 px-4 rounded-xl text-xs transition-colors shadow-lg shadow-brand-500/20"
            >
              <Printer className="w-4 h-4" />
              <span>Print Invoice</span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-tally-bg text-gray-400 hover:text-white border border-tally-border transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* PRINTABLE DUAL-COPY INVOICE CONTAINER */}
        <div id="printable-invoice" className="space-y-4">
          {(printOption === 'both' || printOption === 'original') && (
            <div className={`invoice-copy-wrapper ${printOption === 'both' ? 'page-break-after' : ''}`}>
              {renderSingleInvoiceBox('Original Copy')}
            </div>
          )}

          {printOption === 'both' && (
            <div className="my-4 border-b border-dashed border-gray-400 no-print text-center text-xs text-gray-400 font-mono">
              --- Page Break: Duplicate Copy below ---
            </div>
          )}

          {(printOption === 'both' || printOption === 'duplicate') && (
            <div className="invoice-copy-wrapper">
              {renderSingleInvoiceBox('Duplicate Copy')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
