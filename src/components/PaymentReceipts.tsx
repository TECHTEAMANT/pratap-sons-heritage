import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DollarSign, Receipt, X, Plus, Trash2, Search } from 'lucide-react';

interface PaymentReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  invoice_id: string;
  invoice_number: string;
  customer_mobile: string;
  customer_name: string;
  amount_received: number;
  payment_mode: string;
  reference_number: string | null;
  notes: string | null;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_mobile: string;
  customer_name: string;
  net_payable: number;
  amount_paid: number;
  amount_pending: number;
  payment_status: string;
}

export default function PaymentReceipts() {
  const [receipts, setReceipts] = useState<PaymentReceipt[]>([]);
  const [pendingInvoices, setPendingInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);

  const [formData, setFormData] = useState({
    receipt_date: new Date().toISOString().split('T')[0],
    amount_received: 0,
    payment_mode: 'Cash',
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [receiptsRes, invoicesRes] = await Promise.all([
        supabase
          .from('payment_receipts')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase
          .from('sales_invoices')
          .select('*')
          .gt('amount_pending', 0)
          .order('invoice_date', { ascending: false }),
      ]);

      setReceipts(receiptsRes.data || []);
      setPendingInvoices(invoicesRes.data || []);
    } catch (err: any) {
      console.error('Error loading data:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateReceiptNumber = async () => {
    const { count } = await supabase
      .from('payment_receipts')
      .select('*', { count: 'exact', head: true });

    return `RCP${new Date().getFullYear()}${String((count || 0) + 1).padStart(6, '0')}`;
  };

  const createReceipt = async () => {
    if (!selectedInvoice) {
      setError('Please select an invoice');
      return;
    }

    if (formData.amount_received <= 0) {
      setError('Amount must be greater than 0');
      return;
    }

    if (formData.amount_received > selectedInvoice.amount_pending) {
      setError(`Amount cannot exceed pending amount of ₹${selectedInvoice.amount_pending.toFixed(2)}`);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const receiptNumber = await generateReceiptNumber();

      const receiptData = {
        receipt_number: receiptNumber,
        receipt_date: formData.receipt_date,
        invoice_id: selectedInvoice.id,
        invoice_number: selectedInvoice.invoice_number,
        customer_mobile: selectedInvoice.customer_mobile,
        customer_name: selectedInvoice.customer_name,
        amount_received: formData.amount_received,
        payment_mode: formData.payment_mode,
        reference_number: formData.reference_number || null,
        notes: formData.notes || null,
        created_by: userRecord?.id || null,
      };

      const { error: insertError } = await supabase
        .from('payment_receipts')
        .insert([receiptData]);

      if (insertError) throw insertError;

      setSuccess(`Receipt ${receiptNumber} created successfully!`);
      setShowCreateModal(false);
      setSelectedInvoice(null);
      setFormData({
        receipt_date: new Date().toISOString().split('T')[0],
        amount_received: 0,
        payment_mode: 'Cash',
        reference_number: '',
        notes: '',
      });

      await loadData();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error creating receipt:', err);
      setError(err.message || 'Failed to create receipt');
    } finally {
      setLoading(false);
    }
  };

  const deleteReceipt = async (receiptId: string) => {
    if (!confirm('Are you sure you want to delete this receipt? This will update the invoice payment status.')) {
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error: deleteError } = await supabase
        .from('payment_receipts')
        .delete()
        .eq('id', receiptId);

      if (deleteError) throw deleteError;

      setSuccess('Receipt deleted successfully!');
      await loadData();

      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error('Error deleting receipt:', err);
      setError(err.message || 'Failed to delete receipt');
    } finally {
      setLoading(false);
    }
  };

  const filteredInvoices = searchQuery
    ? pendingInvoices.filter(
        (inv) =>
          inv.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          inv.customer_mobile.includes(searchQuery) ||
          inv.customer_name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : pendingInvoices;

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Receipt className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Payment Receipts</h2>
            <p className="text-sm text-gray-600">Record and manage payment receipts</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 flex items-center shadow-md"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Receipt
        </button>
      </div>

      {error && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 text-red-700 p-3 rounded-lg mb-4">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 text-green-700 p-3 rounded-lg mb-4">
          {success}
        </div>
      )}

      {loading && !showCreateModal && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading receipts...</p>
        </div>
      )}

      {!loading && receipts.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600">No payment receipts yet</p>
          <p className="text-sm text-gray-500">Click "New Receipt" to record a payment</p>
        </div>
      )}

      {!loading && receipts.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Receipt No.</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Mobile</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Payment Mode</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Reference</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {receipts.map((receipt) => (
                  <tr key={receipt.id} className="hover:bg-blue-50">
                    <td className="px-4 py-3 font-semibold text-blue-600">{receipt.receipt_number}</td>
                    <td className="px-4 py-3 text-sm">{new Date(receipt.receipt_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{receipt.invoice_number}</td>
                    <td className="px-4 py-3 text-sm">{receipt.customer_name}</td>
                    <td className="px-4 py-3 text-sm">{receipt.customer_mobile}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">
                      ₹{receipt.amount_received.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                        {receipt.payment_mode}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{receipt.reference_number || '-'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => deleteReceipt(receipt.id)}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete receipt"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Create Payment Receipt</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedInvoice(null);
                  setError('');
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {!selectedInvoice ? (
                <>
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Search Invoice
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by invoice number, customer name or mobile..."
                        className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="max-h-96 overflow-y-auto border-2 border-gray-200 rounded-lg">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Net Amount</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Pending</th>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {filteredInvoices.map((invoice) => (
                          <tr key={invoice.id} className="hover:bg-blue-50">
                            <td className="px-4 py-3 font-semibold text-sm">{invoice.invoice_number}</td>
                            <td className="px-4 py-3 text-sm">
                              {invoice.customer_name}
                              <br />
                              <span className="text-xs text-gray-500">{invoice.customer_mobile}</span>
                            </td>
                            <td className="px-4 py-3 text-right">₹{invoice.net_payable.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right font-bold text-red-600">
                              ₹{invoice.amount_pending.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => {
                                  setSelectedInvoice(invoice);
                                  setFormData({
                                    ...formData,
                                    amount_received: invoice.amount_pending,
                                  });
                                }}
                                className="px-4 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                              >
                                Select
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-blue-600">Invoice Number</p>
                        <p className="text-lg font-bold text-blue-800">{selectedInvoice.invoice_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600">Customer</p>
                        <p className="text-lg font-bold text-blue-800">{selectedInvoice.customer_name}</p>
                      </div>
                      <div>
                        <p className="text-sm text-blue-600">Net Amount</p>
                        <p className="text-lg font-bold text-blue-800">
                          ₹{selectedInvoice.net_payable.toLocaleString('en-IN')}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-red-600">Pending Amount</p>
                        <p className="text-lg font-bold text-red-700">
                          ₹{selectedInvoice.amount_pending.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedInvoice(null)}
                      className="mt-4 text-sm text-blue-600 hover:text-blue-800 underline"
                    >
                      Change Invoice
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Receipt Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={formData.receipt_date}
                        onChange={(e) => setFormData({ ...formData, receipt_date: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount Received <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={selectedInvoice.amount_pending}
                        step="0.01"
                        value={formData.amount_received}
                        onChange={(e) => setFormData({ ...formData, amount_received: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Mode <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={formData.payment_mode}
                        onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="UPI">UPI</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Bank Transfer">Bank Transfer</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reference Number
                      </label>
                      <input
                        type="text"
                        value={formData.reference_number}
                        onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                        placeholder="Cheque/Transaction ref"
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Notes
                      </label>
                      <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows={3}
                        placeholder="Additional notes..."
                        className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-4">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setSelectedInvoice(null);
                        setError('');
                      }}
                      className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createReceipt}
                      disabled={loading}
                      className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center"
                    >
                      {loading ? (
                        'Creating...'
                      ) : (
                        <>
                          <Receipt className="w-5 h-5 mr-2" />
                          Create Receipt
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
