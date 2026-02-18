import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Package, Truck, CheckCircle, Printer, AlertCircle } from 'lucide-react';

interface PendingDeliveryItem {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_mobile: string;
  customer_name: string;
  barcode_8digit: string;
  design_no: string;
  product_description: string;
  selling_price: number;
  delivered: boolean;
  delivery_date?: string;
  expected_delivery_date: string | null;
  net_payable: number;
  amount_paid: number;
  amount_pending: number;
  payment_status: string;
}

export default function PendingDeliveries() {
  const [pendingItems, setPendingItems] = useState<PendingDeliveryItem[]>([]);
  const [deliveredItems, setDeliveredItems] = useState<PendingDeliveryItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'delivered'>('pending');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [filterCustomer, setFilterCustomer] = useState('');

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([loadPendingDeliveries(), loadDeliveredItems()]);
    } finally {
      setLoading(false);
    }
  };

  const loadPendingDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          id,
          barcode_8digit,
          design_no,
          product_description,
          selling_price,
          delivered,
          expected_delivery_date,
          sales_invoice:sales_invoices!inner(
            invoice_number,
            invoice_date,
            customer_mobile,
            customer_name,
            net_payable,
            amount_paid,
            amount_pending,
            payment_status
          )
        `)
        .order('expected_delivery_date', { ascending: true, nullsFirst: false });

      if (error) throw error;

      const formattedData: PendingDeliveryItem[] = (data || [])
        .filter((item: any) => item.delivered !== true)
        .map((item: any) => ({
          id: item.id,
          invoice_number: item.sales_invoice.invoice_number,
          invoice_date: item.sales_invoice.invoice_date,
          customer_mobile: item.sales_invoice.customer_mobile,
          customer_name: item.sales_invoice.customer_name,
          barcode_8digit: item.barcode_8digit,
          design_no: item.design_no,
          product_description: item.product_description,
          selling_price: item.selling_price,
          delivered: item.delivered,
          expected_delivery_date: item.expected_delivery_date,
          net_payable: item.sales_invoice.net_payable,
          amount_paid: item.sales_invoice.amount_paid,
          amount_pending: item.sales_invoice.amount_pending,
          payment_status: item.sales_invoice.payment_status,
        }));

      console.log('Loaded pending items:', formattedData.length);
      setPendingItems(formattedData);
    } catch (err: any) {
      console.error('Error loading pending deliveries:', err);
      setError(err.message || 'Failed to load pending deliveries');
    }
  };

  const loadDeliveredItems = async () => {
    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .select(`
          id,
          barcode_8digit,
          design_no,
          product_description,
          selling_price,
          delivered,
          delivery_date,
          expected_delivery_date,
          sales_invoice:sales_invoices!inner(
            invoice_number,
            invoice_date,
            customer_mobile,
            customer_name,
            net_payable,
            amount_paid,
            amount_pending,
            payment_status
          )
        `)
        .eq('delivered', true)
        .order('delivery_date', { ascending: false });

      if (error) throw error;

      const formattedData: PendingDeliveryItem[] = (data || []).map((item: any) => ({
        id: item.id,
        invoice_number: item.sales_invoice.invoice_number,
        invoice_date: item.sales_invoice.invoice_date,
        customer_mobile: item.sales_invoice.customer_mobile,
        customer_name: item.sales_invoice.customer_name,
        barcode_8digit: item.barcode_8digit,
        design_no: item.design_no,
        product_description: item.product_description,
        selling_price: item.selling_price,
        delivered: item.delivered,
        delivery_date: item.delivery_date,
        expected_delivery_date: item.expected_delivery_date,
        net_payable: item.sales_invoice.net_payable,
        amount_paid: item.sales_invoice.amount_paid,
        amount_pending: item.sales_invoice.amount_pending,
        payment_status: item.sales_invoice.payment_status,
      }));

      console.log('Loaded delivered items:', formattedData.length);
      setDeliveredItems(formattedData);
    } catch (err: any) {
      console.error('Error loading delivered items:', err);
    }
  };

  const markAsDelivered = async (itemIds: string[]) => {
    if (itemIds.length === 0) {
      setError('Please select items to mark as delivered');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { data, error } = await supabase
        .from('sales_invoice_items')
        .update({
          delivered: true,
          delivery_date: new Date().toISOString().split('T')[0],
        })
        .in('id', itemIds)
        .select();

      if (error) throw error;

      console.log('Updated items:', data);

      if (!data || data.length === 0) {
        setError('Could not update delivery status for selected items. Please try again.');
        setLoading(false);
        return;
      }

      // Optimistically remove delivered items from pending list
      setPendingItems(prev => prev.filter(item => !itemIds.includes(item.id)));

      setSelectedItems(new Set());

      setTimeout(async () => {
        try {
          await Promise.all([loadPendingDeliveries(), loadDeliveredItems()]);
          setActiveTab('delivered');
          setSuccess(`${itemIds.length} item(s) marked as delivered successfully!`);
          setTimeout(() => setSuccess(''), 3000);
        } finally {
          setLoading(false);
        }
      }, 100);
    } catch (err: any) {
      console.error('Error marking items as delivered:', err);
      setError(err.message || 'Failed to update delivery status');
      setLoading(false);
    }
  };

  const toggleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
  };

  const selectAllForCustomer = (customerMobile: string) => {
    const customerItems = pendingItems
      .filter(item => item.customer_mobile === customerMobile)
      .map(item => item.id);
    setSelectedItems(new Set(customerItems));
  };

  const generateDeliverySlip = () => {
    const selectedItemsData = pendingItems.filter(item => selectedItems.has(item.id));

    if (selectedItemsData.length === 0) {
      setError('Please select items to generate delivery slip');
      return;
    }

    const groupedByInvoice = selectedItemsData.reduce((acc, item) => {
      if (!acc[item.invoice_number]) {
        acc[item.invoice_number] = {
          invoice_number: item.invoice_number,
          invoice_date: item.invoice_date,
          customer_name: item.customer_name,
          customer_mobile: item.customer_mobile,
          items: [],
        };
      }
      acc[item.invoice_number].items.push(item);
      return acc;
    }, {} as any);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Delivery Slip</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { text-align: center; color: #059669; }
          .invoice-section { margin-bottom: 30px; page-break-inside: avoid; }
          .customer-info { margin-bottom: 15px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #059669; color: white; }
          .summary { margin-top: 15px; font-weight: bold; }
        </style>
      </head>
      <body>
        <h1>Delivery Slip</h1>
        <p><strong>Delivery Date:</strong> ${new Date().toLocaleDateString()}</p>
        ${Object.values(groupedByInvoice).map((inv: any) => `
          <div class="invoice-section">
            <div class="customer-info">
              <p><strong>Invoice:</strong> ${inv.invoice_number} (${new Date(inv.invoice_date).toLocaleDateString()})</p>
              <p><strong>Customer:</strong> ${inv.customer_name} (${inv.customer_mobile})</p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>Sr.</th>
                  <th>Barcode</th>
                  <th>Design No.</th>
                  <th>Description</th>
                  <th>Price</th>
                  <th>Expected Delivery</th>
                </tr>
              </thead>
              <tbody>
                ${inv.items.map((item: any, idx: number) => `
                  <tr>
                    <td>${idx + 1}</td>
                    <td>${item.barcode_8digit}</td>
                    <td>${item.design_no}</td>
                    <td>${item.product_description}</td>
                    <td>₹${item.selling_price.toFixed(2)}</td>
                    <td>${item.expected_delivery_date ? new Date(item.expected_delivery_date).toLocaleDateString() : 'Not set'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <div class="summary">
              <p>Total Items: ${inv.items.length}</p>
            </div>
          </div>
        `).join('')}
        <div style="margin-top: 50px; border-top: 2px solid #000; padding-top: 20px;">
          <p><strong>Received By:</strong> _________________________</p>
          <p><strong>Signature:</strong> _________________________</p>
          <p><strong>Date:</strong> _________________________</p>
        </div>
      </body>
      </html>
    `;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const currentItems = activeTab === 'pending' ? pendingItems : deliveredItems;

  const filteredItems = filterCustomer
    ? currentItems.filter(item =>
        item.customer_mobile.includes(filterCustomer) ||
        item.customer_name.toLowerCase().includes(filterCustomer.toLowerCase())
      )
    : currentItems;

  const groupedByCustomer = filteredItems.reduce((acc, item) => {
    const key = `${item.customer_mobile}-${item.customer_name}`;
    if (!acc[key]) {
      acc[key] = {
        customer_mobile: item.customer_mobile,
        customer_name: item.customer_name,
        items: [],
        total_pending_amount: 0,
      };
    }
    acc[key].items.push(item);
    if (!acc[key].invoices) {
      acc[key].invoices = new Set();
    }
    acc[key].invoices.add(item.invoice_number);
    acc[key].total_pending_amount = item.amount_pending;
    return acc;
  }, {} as any);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center">
          <Package className="w-8 h-8 text-orange-600 mr-3" />
          <div>
            <h2 className="text-3xl font-bold text-gray-800">Delivery Management</h2>
            <p className="text-sm text-gray-600">Track pending and completed deliveries</p>
          </div>
        </div>
        {selectedItems.size > 0 && activeTab === 'pending' && (
          <div className="flex gap-2">
            <button
              onClick={generateDeliverySlip}
              className="px-6 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg hover:from-blue-700 hover:to-cyan-700 flex items-center shadow-md"
            >
              <Printer className="w-5 h-5 mr-2" />
              Print Slip
            </button>
            <button
              onClick={() => markAsDelivered(Array.from(selectedItems))}
              disabled={loading}
              className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 flex items-center shadow-md disabled:from-gray-400 disabled:to-gray-500"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              Mark Delivered ({selectedItems.size})
            </button>
          </div>
        )}
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

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b-2 border-gray-200">
          <button
            onClick={() => {
              setActiveTab('pending');
              setSelectedItems(new Set());
              setFilterCustomer('');
            }}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'pending'
                ? 'text-orange-600 border-b-4 border-orange-600 bg-orange-50'
                : 'text-gray-600 hover:text-orange-600 hover:bg-gray-50'
            }`}
          >
            <AlertCircle className="w-5 h-5" />
            Pending Deliveries
            {pendingItems.length > 0 && (
              <span className="bg-orange-600 text-white px-2 py-1 rounded-full text-xs">
                {pendingItems.length}
              </span>
            )}
          </button>
          <button
            onClick={() => {
              setActiveTab('delivered');
              setSelectedItems(new Set());
              setFilterCustomer('');
            }}
            className={`flex-1 px-6 py-4 text-sm font-semibold transition-colors flex items-center justify-center gap-2 ${
              activeTab === 'delivered'
                ? 'text-green-600 border-b-4 border-green-600 bg-green-50'
                : 'text-gray-600 hover:text-green-600 hover:bg-gray-50'
            }`}
          >
            <CheckCircle className="w-5 h-5" />
            Delivered Items
            {deliveredItems.length > 0 && (
              <span className="bg-green-600 text-white px-2 py-1 rounded-full text-xs">
                {deliveredItems.length}
              </span>
            )}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <input
          type="text"
          value={filterCustomer}
          onChange={(e) => setFilterCustomer(e.target.value)}
          placeholder="Search by customer mobile or name..."
          className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
          <p className="mt-4 text-gray-600">Loading pending deliveries...</p>
        </div>
      )}

      {!loading && filteredItems.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          {activeTab === 'pending' ? (
            <>
              <Truck className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg text-gray-600">No pending deliveries</p>
              <p className="text-sm text-gray-500">All items have been delivered</p>
            </>
          ) : (
            <>
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg text-gray-600">No delivered items yet</p>
              <p className="text-sm text-gray-500">Delivered items will appear here</p>
            </>
          )}
        </div>
      )}

      {!loading && filteredItems.length > 0 && (
        <div className="space-y-6">
          {Object.values(groupedByCustomer).map((group: any) => (
            <div key={group.customer_mobile} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className={`bg-gradient-to-r ${
                activeTab === 'pending'
                  ? 'from-orange-500 to-red-500'
                  : 'from-green-500 to-emerald-500'
              } p-4 flex justify-between items-center`}>
                <div className="text-white">
                  <p className="font-bold text-lg">{group.customer_name}</p>
                  <p className="text-sm">{group.customer_mobile}</p>
                  <p className="text-xs mt-1">
                    {group.items.length} {activeTab === 'pending' ? 'pending' : 'delivered'} item(s) from {Array.from(group.invoices).length} invoice(s)
                  </p>
                </div>
                <div className="text-right">
                  {group.total_pending_amount > 0 && activeTab === 'pending' && (
                    <div className="bg-red-700 text-white px-4 py-2 rounded-lg">
                      <p className="text-xs">Pending Payment</p>
                      <p className="text-lg font-bold">₹{group.total_pending_amount.toFixed(2)}</p>
                    </div>
                  )}
                  {activeTab === 'pending' && (
                    <button
                      onClick={() => selectAllForCustomer(group.customer_mobile)}
                      className="mt-2 px-4 py-1 bg-white text-orange-600 rounded text-sm hover:bg-orange-50"
                    >
                      Select All
                    </button>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      {activeTab === 'pending' && (
                        <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Select</th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Price</th>
                      {activeTab === 'pending' ? (
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Expected Delivery</th>
                      ) : (
                        <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Delivered On</th>
                      )}
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {group.items.map((item: PendingDeliveryItem) => (
                      <tr key={item.id} className={`${
                        activeTab === 'pending' ? 'hover:bg-orange-50' : 'hover:bg-green-50'
                      }`}>
                        {activeTab === 'pending' && (
                          <td className="px-4 py-3">
                            <input
                              type="checkbox"
                              checked={selectedItems.has(item.id)}
                              onChange={() => toggleSelectItem(item.id)}
                              className="w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                            />
                          </td>
                        )}
                        <td className="px-4 py-3 font-semibold text-sm">{item.invoice_number}</td>
                        <td className="px-4 py-3 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          <span className={`bg-gradient-to-r ${
                            activeTab === 'pending'
                              ? 'from-orange-600 to-red-600'
                              : 'from-green-600 to-emerald-600'
                          } text-white px-2 py-1 rounded font-mono text-xs`}>
                            {item.barcode_8digit}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-sm">{item.design_no}</td>
                        <td className="px-4 py-3 text-sm">{item.product_description}</td>
                        <td className="px-4 py-3 text-right font-semibold">₹{item.selling_price.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          {activeTab === 'pending' ? (
                            item.expected_delivery_date ? (
                              <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                {new Date(item.expected_delivery_date).toLocaleDateString()}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-xs">Not set</span>
                            )
                          ) : (
                            item.delivery_date && (
                              <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">
                                {new Date(item.delivery_date).toLocaleDateString()}
                              </span>
                            )
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {item.payment_status === 'paid' ? (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">Paid</span>
                          ) : item.payment_status === 'partial' ? (
                            <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">Partial</span>
                          ) : (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
