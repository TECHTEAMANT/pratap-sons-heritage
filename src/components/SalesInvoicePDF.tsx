import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, Printer, Download } from 'lucide-react';

interface SalesInvoicePDFProps {
  invoiceId: string;
  onClose: () => void;
}

export default function SalesInvoicePDF({ invoiceId, onClose }: SalesInvoicePDFProps) {
  const [invoice, setInvoice] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoiceData();
  }, [invoiceId]);

  const loadInvoiceData = async () => {
    try {
      const [invoiceRes, itemsRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select(`
            *,
            created_by_user:users!sales_invoices_created_by_fkey(name),
            salesman:salesmen(name, salesman_code)
          `)
          .eq('id', invoiceId)
          .single(),
        supabase
          .from('sales_invoice_items')
          .select(`
            *,
            salesman:salesmen(name, salesman_code)
          `)
          .eq('invoice_id', invoiceId)
          .order('sr_no')
      ]);

      if (invoiceRes.error) throw invoiceRes.error;
      if (itemsRes.error) throw itemsRes.error;

      setInvoice(invoiceRes.data);
      setItems(itemsRes.data);
    } catch (err: any) {
      console.error('Error loading invoice:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  if (!invoice) {
    return null;
  }

  const gstType = invoice.gst_type || 'CGST_SGST';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white w-full max-w-md my-8 shadow-2xl">
        {/* Non-printable header with controls */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-4 flex justify-between items-center print:hidden">
          <h3 className="text-xl font-bold text-white">Invoice Preview</h3>
          <div className="flex gap-2">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-white text-emerald-600 rounded-lg hover:bg-gray-100 flex items-center"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200"
            >
              <X className="w-8 h-8" />
            </button>
          </div>
        </div>

        {/* Printable invoice content - Half A4 size (148mm x 210mm) */}
        <div className="p-6 text-sm bg-white" style={{ width: '148mm', minHeight: '210mm' }}>
          {/* Header */}
          <div className="text-center border-b-2 border-gray-800 pb-3 mb-3">
            <h1 className="text-2xl font-bold">YOUR COMPANY NAME</h1>
            <p className="text-xs mt-1">Address Line 1, Address Line 2</p>
            <p className="text-xs">Phone: +91 XXXXXXXXXX | GSTIN: XXXXXXXXXXXX</p>
          </div>

          {/* Invoice Details */}
          <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
            <div>
              <p><strong>Invoice #:</strong> {invoice.invoice_number}</p>
              <p><strong>Date:</strong> {new Date(invoice.invoice_date).toLocaleDateString()}</p>
            </div>
            <div className="text-right">
              <p><strong>Payment:</strong> {invoice.payment_mode}</p>
              <p><strong>Status:</strong> {invoice.payment_status?.toUpperCase()}</p>
            </div>
          </div>

          {/* Customer Details */}
          <div className="border border-gray-300 p-2 mb-3 text-xs">
            <p><strong>Customer:</strong> {invoice.customer_name}</p>
            <p><strong>Mobile:</strong> {invoice.customer_mobile}</p>
            {invoice.place_of_supply && (
              <p><strong>Place of Supply:</strong> {invoice.place_of_supply}</p>
            )}
          </div>

          {/* Items Table */}
          <table className="w-full text-xs mb-3 border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="text-left py-1">#</th>
                <th className="text-left py-1">Item</th>
                <th className="text-right py-1">MRP</th>
                <th className="text-right py-1">Disc</th>
                <th className="text-right py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, idx) => (
                <tr key={idx} className="border-b border-gray-200">
                  <td className="py-1">{item.sr_no}</td>
                  <td className="py-1">
                    <div>{item.design_no}</div>
                    <div className="text-xs text-gray-600">{item.product_description}</div>
                    {item.salesman && (
                      <div className="text-xs text-blue-600">By: {item.salesman.name}</div>
                    )}
                  </td>
                  <td className="text-right py-1">₹{item.mrp.toFixed(2)}</td>
                  <td className="text-right py-1">₹{item.discount.toFixed(2)}</td>
                  <td className="text-right py-1">₹{item.selling_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t-2 border-gray-800 pt-2">
            <div className="flex justify-between text-xs mb-1">
              <span>Subtotal (MRP):</span>
              <span>₹{invoice.total_mrp?.toFixed(2)}</span>
            </div>
            {invoice.total_discount > 0 && (
              <div className="flex justify-between text-xs mb-1">
                <span>Discount:</span>
                <span>- ₹{invoice.total_discount?.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs mb-1">
              <span>Taxable Value:</span>
              <span>₹{invoice.taxable_value?.toFixed(2)}</span>
            </div>

            {/* GST Breakdown */}
            {gstType === 'CGST_SGST' ? (
              <>
                {invoice.cgst_5 > 0 && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>CGST @ 2.5%:</span>
                      <span>₹{invoice.cgst_5?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>SGST @ 2.5%:</span>
                      <span>₹{invoice.sgst_5?.toFixed(2)}</span>
                    </div>
                  </>
                )}
                {invoice.cgst_18 > 0 && (
                  <>
                    <div className="flex justify-between text-xs">
                      <span>CGST @ 9%:</span>
                      <span>₹{invoice.cgst_18?.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs mb-1">
                      <span>SGST @ 9%:</span>
                      <span>₹{invoice.sgst_18?.toFixed(2)}</span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {invoice.igst_5 > 0 && (
                  <div className="flex justify-between text-xs mb-1">
                    <span>IGST @ 5%:</span>
                    <span>₹{invoice.igst_5?.toFixed(2)}</span>
                  </div>
                )}
                {invoice.igst_18 > 0 && (
                  <div className="flex justify-between text-xs mb-1">
                    <span>IGST @ 18%:</span>
                    <span>₹{invoice.igst_18?.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}

            <div className="flex justify-between font-bold text-base border-t-2 border-gray-800 pt-2 mt-2">
              <span>Net Payable:</span>
              <span>₹{invoice.net_payable?.toFixed(2)}</span>
            </div>

            {/* Payment Details */}
            {invoice.amount_paid > 0 && (
              <>
                <div className="flex justify-between text-xs mt-2">
                  <span>Amount Paid:</span>
                  <span>₹{invoice.amount_paid?.toFixed(2)}</span>
                </div>
                {invoice.amount_pending > 0 && (
                  <div className="flex justify-between text-xs text-red-600 font-bold">
                    <span>Balance Due:</span>
                    <span>₹{invoice.amount_pending?.toFixed(2)}</span>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="mt-4 pt-3 border-t border-gray-300 text-center text-xs">
            <p className="font-semibold">Thank you for your business!</p>
            <p className="text-xs text-gray-600 mt-1">
              This is a computer-generated invoice
            </p>
            {invoice.created_by_user && (
              <p className="text-xs text-gray-600">
                Billed by: {invoice.created_by_user.name}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
