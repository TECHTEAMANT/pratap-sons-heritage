import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { PackageX, Search, X, Plus, FileText, DollarSign, Scan } from 'lucide-react';
import { calculateGSTBreakdown, GSTTransactionType } from '../utils/gstBreakdown';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_mobile: string;
  customer_name: string;
  net_payable: number;
}

interface InvoiceItem {
  id: string;
  barcode_8digit: string;
  design_no: string;
  product_description: string;
  quantity: number;
  selling_price: number;
  total_value: number;
}

interface SalesReturn {
  id: string;
  return_number: string;
  return_date: string;
  invoice_number: string;
  customer_name: string;
  customer_mobile: string;
  return_reason: string;
  total_return_amount: number;
  credit_note_number: string;
  status: string;
  created_at: string;
}

export default function SalesReturn() {
  const [returns, setReturns] = useState<SalesReturn[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceItems, setInvoiceItems] = useState<InvoiceItem[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [gstType, setGstType] = useState<GSTTransactionType>('CGST_SGST');
  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadReturns();
  }, []);

  const loadReturns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_returns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturns(data || []);
    } catch (err: any) {
      console.error('Error loading returns:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const searchInvoices = async () => {
    if (!searchQuery) {
      setError('Please enter invoice number or customer mobile');
      return;
    }

    setLoading(true);
    try {
      let query = supabase
        .from('sales_invoices')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (searchQuery.match(/^\d+$/)) {
        query = query.or(`invoice_number.ilike.%${searchQuery}%,customer_mobile.ilike.%${searchQuery}%`);
      } else {
        query = query.ilike('invoice_number', `%${searchQuery}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInvoices(data || []);

      if (!data || data.length === 0) {
        setError('No invoices found');
      }
    } catch (err: any) {
      console.error('Error searching invoices:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadInvoiceItems = async (invoice: Invoice) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('sr_no');

      if (error) throw error;
      setInvoiceItems(data || []);
      setSelectedInvoice(invoice);
      setSelectedItems(new Set());
    } catch (err: any) {
      console.error('Error loading invoice items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelection = new Set(selectedItems);
    if (newSelection.has(itemId)) {
      newSelection.delete(itemId);
    } else {
      newSelection.add(itemId);
    }
    setSelectedItems(newSelection);
  };

  const handleBarcodeScanning = () => {
    if (!barcodeInput.trim()) {
      setError('Please enter a barcode');
      return;
    }

    const foundItem = invoiceItems.find(item => item.barcode_8digit === barcodeInput.trim());

    if (!foundItem) {
      setError(`Item with barcode ${barcodeInput} not found in this invoice`);
      return;
    }

    const newSelection = new Set(selectedItems);
    if (!newSelection.has(foundItem.id)) {
      newSelection.add(foundItem.id);
      setSelectedItems(newSelection);
      setSuccess(`Item ${foundItem.barcode_8digit} added to return`);
      setTimeout(() => setSuccess(''), 2000);
    } else {
      setError(`Item ${foundItem.barcode_8digit} is already selected`);
    }

    setBarcodeInput('');
    barcodeInputRef.current?.focus();
  };

  const calculateTotalReturnAmount = () => {
    return invoiceItems
      .filter(item => selectedItems.has(item.id))
      .reduce((sum, item) => sum + item.total_value, 0);
  };

  const createSalesReturn = async () => {
    if (!selectedInvoice) {
      setError('Please select an invoice');
      return;
    }

    if (selectedItems.size === 0) {
      setError('Please select at least one item to return');
      return;
    }

    if (!returnReason.trim()) {
      setError('Please provide a return reason');
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

      const returnNumber = `SR${new Date().getFullYear()}${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;
      const totalReturnAmount = calculateTotalReturnAmount();

      const taxableAmount = totalReturnAmount / 1.18;
      const gstAmount = totalReturnAmount - taxableAmount;
      const gstBreakdown = calculateGSTBreakdown(gstAmount, gstType);

      const returnData = {
        return_number: returnNumber,
        return_date: new Date().toISOString().split('T')[0],
        invoice_id: selectedInvoice.id,
        invoice_number: selectedInvoice.invoice_number,
        customer_mobile: selectedInvoice.customer_mobile,
        customer_name: selectedInvoice.customer_name,
        return_reason: returnReason,
        total_return_amount: totalReturnAmount,
        gst_type: gstType,
        cgst_amount: gstBreakdown.cgstAmount,
        sgst_amount: gstBreakdown.sgstAmount,
        igst_amount: gstBreakdown.igstAmount,
        status: 'completed',
        created_by: userRecord?.id || null,
      };

      const { data: salesReturn, error: returnError } = await supabase
        .from('sales_returns')
        .insert([returnData])
        .select()
        .single();

      if (returnError) throw returnError;

      const returnItems = invoiceItems
        .filter(item => selectedItems.has(item.id))
        .map(item => ({
          return_id: salesReturn.id,
          invoice_item_id: item.id,
          barcode_8digit: item.barcode_8digit,
          design_no: item.design_no,
          product_description: item.product_description,
          quantity: item.quantity,
          selling_price: item.selling_price,
          return_amount: item.total_value,
          stock_adjusted: false,
        }));

      const { error: itemsError } = await supabase
        .from('sales_return_items')
        .insert(returnItems);

      if (itemsError) throw itemsError;

      setSuccess(`Sales Return ${returnNumber} created successfully! Credit note generated.`);
      setShowCreateModal(false);
      setSelectedInvoice(null);
      setInvoiceItems([]);
      setSelectedItems(new Set());
      setReturnReason('');
      setSearchQuery('');
      setInvoices([]);
      setBarcodeInput('');

      await loadReturns();

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Error creating sales return:', err);
      setError(err.message || 'Failed to create sales return');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <PackageX className="w-8 h-8 text-red-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Sales Returns</h2>
            <p className="text-sm text-gray-600">Process returns and generate credit notes</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 flex items-center shadow-md"
        >
          <Plus className="w-5 h-5 mr-2" />
          New Return
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
          <p className="mt-4 text-gray-600">Loading returns...</p>
        </div>
      )}

      {!loading && returns.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <PackageX className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg text-gray-600">No sales returns yet</p>
          <p className="text-sm text-gray-500">Click "New Return" to process a return</p>
        </div>
      )}

      {!loading && returns.length > 0 && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Return No.</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Reason</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Credit Note</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {returns.map((ret) => (
                  <tr key={ret.id} className="hover:bg-red-50">
                    <td className="px-4 py-3 font-semibold text-red-600">{ret.return_number}</td>
                    <td className="px-4 py-3 text-sm">{new Date(ret.return_date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 text-sm font-semibold">{ret.invoice_number}</td>
                    <td className="px-4 py-3 text-sm">
                      {ret.customer_name}
                      <br />
                      <span className="text-xs text-gray-500">{ret.customer_mobile}</span>
                    </td>
                    <td className="px-4 py-3 text-sm max-w-xs truncate">{ret.return_reason}</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">
                      -₹{ret.total_return_amount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {ret.credit_note_number ? (
                        <span className="flex items-center text-green-600">
                          <FileText className="w-4 h-4 mr-1" />
                          {ret.credit_note_number}
                        </span>
                      ) : (
                        <span className="text-gray-400">Pending</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        ret.status === 'completed' ? 'bg-green-100 text-green-800' :
                        ret.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {ret.status}
                      </span>
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
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-red-600 to-orange-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Create Sales Return</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setSelectedInvoice(null);
                  setInvoiceItems([]);
                  setSelectedItems(new Set());
                  setReturnReason('');
                  setSearchQuery('');
                  setInvoices([]);
                  setBarcodeInput('');
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
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && searchInvoices()}
                          placeholder="Enter invoice number or customer mobile..."
                          className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <button
                        onClick={searchInvoices}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                      >
                        Search
                      </button>
                    </div>
                  </div>

                  {invoices.length > 0 && (
                    <div className="border-2 border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                      <table className="w-full">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                            <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                            <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                            <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {invoices.map((invoice) => (
                            <tr key={invoice.id} className="hover:bg-red-50">
                              <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                              <td className="px-4 py-3 text-sm">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                              <td className="px-4 py-3 text-sm">
                                {invoice.customer_name}
                                <br />
                                <span className="text-xs text-gray-500">{invoice.customer_mobile}</span>
                              </td>
                              <td className="px-4 py-3 text-right">₹{invoice.net_payable.toLocaleString('en-IN')}</td>
                              <td className="px-4 py-3 text-center">
                                <button
                                  onClick={() => loadInvoiceItems(invoice)}
                                  className="px-4 py-1 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                                >
                                  Select
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-red-600">Invoice Number</p>
                        <p className="text-lg font-bold text-red-800">{selectedInvoice.invoice_number}</p>
                      </div>
                      <div>
                        <p className="text-sm text-red-600">Customer</p>
                        <p className="text-lg font-bold text-red-800">{selectedInvoice.customer_name}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedInvoice(null);
                        setInvoiceItems([]);
                        setSelectedItems(new Set());
                        setBarcodeInput('');
                      }}
                      className="mt-4 text-sm text-red-600 hover:text-red-800 underline"
                    >
                      Change Invoice
                    </button>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Return Reason <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      rows={3}
                      placeholder="Enter reason for return..."
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GST Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={gstType}
                      onChange={(e) => setGstType(e.target.value as GSTTransactionType)}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    >
                      <option value="CGST_SGST">CGST + SGST</option>
                      <option value="IGST">IGST</option>
                    </select>
                  </div>

                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Quick Barcode Scan
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Scan className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          ref={barcodeInputRef}
                          type="text"
                          value={barcodeInput}
                          onChange={(e) => setBarcodeInput(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleBarcodeScanning();
                            }
                          }}
                          placeholder="Scan or enter 8-digit barcode..."
                          className="w-full pl-10 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                        />
                      </div>
                      <button
                        onClick={handleBarcodeScanning}
                        className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                      >
                        <Plus className="w-5 h-5 mr-1" />
                        Add
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Press Enter after scanning or click Add button</p>
                  </div>

                  <div className="mb-4">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">Select Items to Return</h4>
                    <p className="text-sm text-gray-600 mb-4">Click on items to select them for return or scan barcode above</p>
                  </div>

                  <div className="border-2 border-gray-200 rounded-lg max-h-96 overflow-y-auto mb-6">
                    <table className="w-full">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Select</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                          <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Price</th>
                          <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoiceItems.map((item) => (
                          <tr
                            key={item.id}
                            onClick={() => toggleItemSelection(item.id)}
                            className={`cursor-pointer transition ${
                              selectedItems.has(item.id) ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3 text-center">
                              <input
                                type="checkbox"
                                checked={selectedItems.has(item.id)}
                                onChange={() => toggleItemSelection(item.id)}
                                className="w-5 h-5 text-red-600"
                              />
                            </td>
                            <td className="px-4 py-3 font-semibold">{item.barcode_8digit}</td>
                            <td className="px-4 py-3">{item.design_no}</td>
                            <td className="px-4 py-3 text-sm">{item.product_description}</td>
                            <td className="px-4 py-3 text-right">₹{item.selling_price.toLocaleString('en-IN')}</td>
                            <td className="px-4 py-3 text-right font-bold">₹{item.total_value.toLocaleString('en-IN')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-gray-100 p-4 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm text-gray-600">Items Selected</p>
                        <p className="text-2xl font-bold text-gray-800">{selectedItems.size}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-red-600">Total Return Amount</p>
                        <p className="text-3xl font-bold text-red-700">
                          -₹{calculateTotalReturnAmount().toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-end gap-4">
                    <button
                      onClick={() => {
                        setShowCreateModal(false);
                        setSelectedInvoice(null);
                        setInvoiceItems([]);
                        setSelectedItems(new Set());
                        setReturnReason('');
                        setSearchQuery('');
                        setInvoices([]);
                        setError('');
                      }}
                      className="px-6 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={createSalesReturn}
                      disabled={loading || selectedItems.size === 0 || !returnReason.trim()}
                      className="px-6 py-2 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg hover:from-red-700 hover:to-orange-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center"
                    >
                      {loading ? (
                        'Processing...'
                      ) : (
                        <>
                          <PackageX className="w-5 h-5 mr-2" />
                          Process Return
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
