import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, Plus, Save, X, Loader, DollarSign, Trash2, Download, UserPlus, Scan, Upload, Eye, FileDown } from 'lucide-react';
import { scanBarcode } from '../utils/barcodeScanning';

interface Customer {
  id: string;
  mobile: string;
  name: string;
  email: string;
}

interface OrderItem {
  id?: string;
  barcode_8digit: string;
  design_no: string;
  product_description: string;
  quantity: number;
  delivered_quantity: number;
  selling_price: number;
  discount_percentage: number;
  gst_percentage: number;
  total: number;
}

interface Advance {
  id?: string;
  amount: number;
  payment_mode: string;
  payment_date: string;
  reference_number: string;
  notes: string;
}

interface SalesOrder {
  id: string;
  order_number: string;
  customer_id: string;
  order_date: string;
  expected_delivery_date: string;
  status: string;
  total_amount: number;
  advance_received: number;
  balance_amount: number;
  notes: string;
  attachment_url: string;
  customers?: Customer;
}

export default function SalesOrder() {
  const [orders, setOrders] = useState<SalesOrder[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showAdvanceForm, setShowAdvanceForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [showQuickCustomer, setShowQuickCustomer] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [quickCustomer, setQuickCustomer] = useState({
    mobile: '',
    name: '',
    email: '',
  });

  const [formData, setFormData] = useState({
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_delivery_date: '',
    notes: '',
    attachment_url: '',
  });

  const [items, setItems] = useState<OrderItem[]>([
    {
      barcode_8digit: '',
      design_no: '',
      product_description: '',
      quantity: 1,
      delivered_quantity: 0,
      selling_price: 0,
      discount_percentage: 0,
      gst_percentage: 5,
      total: 0,
    },
  ]);

  const [advanceData, setAdvanceData] = useState<Advance>({
    amount: 0,
    payment_mode: 'Cash',
    payment_date: new Date().toISOString().split('T')[0],
    reference_number: '',
    notes: '',
  });

  useEffect(() => {
    loadOrders();
    loadCustomers();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('sales_orders')
        .select('*, customers(id, mobile, name, email)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, mobile, name, email')
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      setCustomers(data || []);
    } catch (err: any) {
      console.error('Error loading customers:', err);
    }
  };

  const createQuickCustomer = async () => {
    if (!quickCustomer.mobile || !quickCustomer.name) {
      setError('Mobile and name are required');
      return;
    }

    if (quickCustomer.mobile.length !== 10) {
      setError('Mobile number must be 10 digits');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .insert([{
          mobile: quickCustomer.mobile,
          name: quickCustomer.name,
          email: quickCustomer.email || null,
          status: 'active',
        }])
        .select()
        .single();

      if (error) throw error;

      setSuccess('Customer created successfully!');
      setShowQuickCustomer(false);
      setQuickCustomer({ mobile: '', name: '', email: '' });
      await loadCustomers();
      setFormData({ ...formData, customer_id: data.id });
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBarcodeScanning = async () => {
    if (!barcodeInput.trim()) return;

    setError('');
    try {
      const data = await scanBarcode(barcodeInput.trim());

      if (!data) {
        setError('Barcode not found or item not available');
        return;
      }

      if (data.available_quantity === 0) {
        setError('This item is not available in stock');
        return;
      }

      const productDescription = `${data.design_no} - ${data.product_group_name} - ${data.color_name} - ${data.size_name}`;

      const newItem: OrderItem = {
        barcode_8digit: data.barcode_8digit,
        design_no: data.design_no,
        product_description: productDescription,
        quantity: 1,
        delivered_quantity: 0,
        selling_price: data.mrp,
        discount_percentage: 0,
        gst_percentage: 5,
        total: 0,
      };

      newItem.total = calculateItemTotal(newItem);
      setItems([...items, newItem]);
      setBarcodeInput('');
      setSuccess('Item added successfully!');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Only image files are allowed');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('File size must be less than 5MB');
      return;
    }

    setUploadingAttachment(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `order-attachments/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('attachments')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('attachments')
        .getPublicUrl(filePath);

      setFormData({ ...formData, attachment_url: publicUrl });
      setSuccess('Attachment uploaded successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUploadingAttachment(false);
    }
  };

  const calculateItemTotal = (item: OrderItem) => {
    const subtotal = item.quantity * item.selling_price;
    const discountAmount = (subtotal * item.discount_percentage) / 100;
    const taxableValue = subtotal - discountAmount;
    const gstAmount = (taxableValue * item.gst_percentage) / 100;
    return taxableValue + gstAmount;
  };

  const handleItemChange = (index: number, field: keyof OrderItem, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    newItems[index].total = calculateItemTotal(newItems[index]);
    setItems(newItems);
  };

  const addItem = () => {
    setItems([
      ...items,
      {
        barcode_8digit: '',
        design_no: '',
        product_description: '',
        quantity: 1,
        delivered_quantity: 0,
        selling_price: 0,
        discount_percentage: 0,
        gst_percentage: 5,
        total: 0,
      },
    ]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_id) {
      setError('Please select a customer');
      return;
    }

    if (items.some(item => !item.product_description || item.quantity <= 0)) {
      setError('Please fill in all item details');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { data: user } = await supabase.auth.getUser();

      const orderNumber = await generateOrderNumber();
      const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

      const { data: orderData, error: orderError } = await supabase
        .from('sales_orders')
        .insert([
          {
            order_number: orderNumber,
            customer_id: formData.customer_id,
            order_date: formData.order_date,
            expected_delivery_date: formData.expected_delivery_date || null,
            total_amount: totalAmount,
            notes: formData.notes,
            attachment_url: formData.attachment_url || null,
            created_by: user?.user?.id,
          },
        ])
        .select()
        .single();

      if (orderError) throw orderError;

      const itemsToInsert = items.map((item) => ({
        sales_order_id: orderData.id,
        barcode_8digit: item.barcode_8digit,
        design_no: item.design_no,
        product_description: item.product_description,
        quantity: item.quantity,
        selling_price: item.selling_price,
        discount_percentage: item.discount_percentage,
        gst_percentage: item.gst_percentage,
        total: item.total,
      }));

      const { error: itemsError } = await supabase
        .from('sales_order_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      setSuccess(`Sales Order ${orderNumber} created successfully!`);
      resetForm();
      await loadOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateOrderNumber = async () => {
    const { data, error } = await supabase.rpc('generate_sales_order_number');
    if (error) throw error;
    return data;
  };

  const handleAdvancePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedOrder || advanceData.amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase
        .from('sales_order_advances')
        .insert([
          {
            sales_order_id: selectedOrder,
            amount: advanceData.amount,
            payment_mode: advanceData.payment_mode,
            payment_date: advanceData.payment_date,
            reference_number: advanceData.reference_number,
            notes: advanceData.notes,
          },
        ]);

      if (error) throw error;

      setSuccess('Advance payment recorded successfully!');
      setShowAdvanceForm(false);
      setSelectedOrder(null);
      setAdvanceData({
        amount: 0,
        payment_mode: 'Cash',
        payment_date: new Date().toISOString().split('T')[0],
        reference_number: '',
        notes: '',
      });
      await loadOrders();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadSalesOrder = async (orderId: string, includeMRP: boolean = true) => {
    try {
      const { data: order, error: orderError } = await supabase
        .from('sales_orders')
        .select('*, customers(mobile, name, email)')
        .eq('id', orderId)
        .single();

      if (orderError) throw orderError;

      const { data: orderItems, error: itemsError } = await supabase
        .from('sales_order_items')
        .select('*')
        .eq('sales_order_id', orderId);

      if (itemsError) throw itemsError;

      generatePDF(order, orderItems, includeMRP);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const generatePDF = (order: any, items: any[], includeMRP: boolean) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const itemsHTML = items.map((item, index) => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${index + 1}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.barcode_8digit}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.design_no}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${item.product_description}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${item.quantity}</td>
        ${includeMRP ? `<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.selling_price.toFixed(2)}</td>` : ''}
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.discount_percentage}%</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${item.gst_percentage}%</td>
        ${includeMRP ? `<td style="border: 1px solid #ddd; padding: 8px; text-align: right;">₹${item.total.toFixed(2)}</td>` : ''}
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sales Order - ${order.order_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { margin: 0; color: #333; }
          .info-section { margin-bottom: 20px; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
          .info-label { font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th { background-color: #4a5568; color: white; padding: 10px; text-align: left; border: 1px solid #ddd; }
          td { border: 1px solid #ddd; padding: 8px; }
          .totals { margin-top: 20px; text-align: right; }
          .totals-row { margin: 5px 0; }
          .total-label { font-weight: bold; display: inline-block; width: 150px; }
          .notes { margin-top: 30px; padding: 15px; background-color: #f7fafc; border-left: 4px solid #4299e1; }
          @media print {
            body { margin: 0; }
            button { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>SALES ORDER</h1>
          <p>Order #: ${order.order_number}</p>
        </div>

        <div class="info-section">
          <div class="info-row">
            <div><span class="info-label">Customer:</span> ${order.customers.name}</div>
            <div><span class="info-label">Order Date:</span> ${new Date(order.order_date).toLocaleDateString()}</div>
          </div>
          <div class="info-row">
            <div><span class="info-label">Mobile:</span> ${order.customers.mobile}</div>
            <div><span class="info-label">Expected Delivery:</span> ${order.expected_delivery_date ? new Date(order.expected_delivery_date).toLocaleDateString() : 'N/A'}</div>
          </div>
          <div class="info-row">
            <div><span class="info-label">Status:</span> ${order.status.toUpperCase()}</div>
            <div></div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Sr</th>
              <th>Barcode</th>
              <th>Design</th>
              <th>Description</th>
              <th>Qty</th>
              ${includeMRP ? '<th>Price</th>' : ''}
              <th>Disc %</th>
              <th>GST %</th>
              ${includeMRP ? '<th>Total</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        ${includeMRP ? `
        <div class="totals">
          <div class="totals-row">
            <span class="total-label">Total Amount:</span>
            <strong>₹${order.total_amount.toFixed(2)}</strong>
          </div>
          <div class="totals-row">
            <span class="total-label">Advance Received:</span>
            <span style="color: green;">₹${order.advance_received.toFixed(2)}</span>
          </div>
          <div class="totals-row">
            <span class="total-label">Balance:</span>
            <span style="color: orange;">₹${order.balance_amount.toFixed(2)}</span>
          </div>
        </div>
        ` : ''}

        ${order.notes ? `
        <div class="notes">
          <strong>Notes:</strong><br>
          ${order.notes}
        </div>
        ` : ''}

        <div style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 20px; background-color: #4299e1; color: white; border: none; border-radius: 5px; cursor: pointer; margin-right: 10px;">Print</button>
          <button onclick="window.close()" style="padding: 10px 20px; background-color: #718096; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const resetForm = () => {
    setFormData({
      customer_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_delivery_date: '',
      notes: '',
      attachment_url: '',
    });
    setItems([
      {
        barcode_8digit: '',
        design_no: '',
        product_description: '',
        quantity: 1,
        delivered_quantity: 0,
        selling_price: 0,
        discount_percentage: 0,
        gst_percentage: 5,
        total: 0,
      },
    ]);
    setShowForm(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'partial':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <ShoppingCart className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-800">Sales Orders</h2>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
          >
            {showForm ? <X className="w-5 h-5 mr-2" /> : <Plus className="w-5 h-5 mr-2" />}
            {showForm ? 'Cancel' : 'New Order'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 text-green-600 p-4 rounded-lg mb-6">
            {success}
          </div>
        )}

        {showQuickCustomer && (
          <div className="bg-blue-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Quick Add Customer</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mobile Number *
                </label>
                <input
                  type="text"
                  value={quickCustomer.mobile}
                  onChange={(e) => setQuickCustomer({ ...quickCustomer, mobile: e.target.value })}
                  placeholder="10-digit mobile"
                  maxLength={10}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Name *
                </label>
                <input
                  type="text"
                  value={quickCustomer.name}
                  onChange={(e) => setQuickCustomer({ ...quickCustomer, name: e.target.value })}
                  placeholder="Enter name"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email (Optional)
                </label>
                <input
                  type="email"
                  value={quickCustomer.email}
                  onChange={(e) => setQuickCustomer({ ...quickCustomer, email: e.target.value })}
                  placeholder="Enter email"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowQuickCustomer(false);
                  setQuickCustomer({ mobile: '', name: '', email: '' });
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={createQuickCustomer}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
              >
                {loading ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Create New Sales Order</h3>
            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer *
                  </label>
                  <div className="flex space-x-2">
                    <select
                      value={formData.customer_id}
                      onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">Select Customer</option>
                      {customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>
                          {customer.name} - {customer.mobile}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowQuickCustomer(true)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                      title="Quick Add Customer"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Date *
                  </label>
                  <input
                    type="date"
                    value={formData.order_date}
                    onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Delivery Date
                  </label>
                  <input
                    type="date"
                    value={formData.expected_delivery_date}
                    onChange={(e) => setFormData({ ...formData, expected_delivery_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Attachment (Image)
                  </label>
                  <div className="flex space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleAttachmentUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAttachment}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center disabled:bg-gray-400"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      {uploadingAttachment ? 'Uploading...' : 'Upload'}
                    </button>
                    {formData.attachment_url && (
                      <a
                        href={formData.attachment_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                      >
                        <Eye className="w-5 h-5 mr-2" />
                        View
                      </a>
                    )}
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Order Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Enter order notes, special instructions, terms, etc."
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-md font-semibold text-gray-700">Order Items</h4>
                  <div className="flex space-x-2">
                    <div className="flex items-center space-x-2">
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
                        placeholder="Scan/Enter Barcode"
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <button
                        type="button"
                        onClick={handleBarcodeScanning}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center"
                      >
                        <Scan className="w-4 h-4 mr-1" />
                        Scan
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={addItem}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center text-sm"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Item
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full border border-gray-300">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="p-2 text-left text-xs">Barcode</th>
                        <th className="p-2 text-left text-xs">Design No</th>
                        <th className="p-2 text-left text-xs">Description *</th>
                        <th className="p-2 text-left text-xs">Qty *</th>
                        <th className="p-2 text-left text-xs">Price *</th>
                        <th className="p-2 text-left text-xs">Disc %</th>
                        <th className="p-2 text-left text-xs">GST %</th>
                        <th className="p-2 text-left text-xs">Total</th>
                        <th className="p-2 text-left text-xs">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item, index) => (
                        <tr key={index} className="border-t">
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.barcode_8digit}
                              onChange={(e) => handleItemChange(index, 'barcode_8digit', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.design_no}
                              onChange={(e) => handleItemChange(index, 'design_no', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="text"
                              value={item.product_description}
                              onChange={(e) => handleItemChange(index, 'product_description', e.target.value)}
                              className="w-full px-2 py-1 border rounded text-sm"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value) || 0)}
                              className="w-20 px-2 py-1 border rounded text-sm"
                              min="1"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.selling_price}
                              onChange={(e) => handleItemChange(index, 'selling_price', parseFloat(e.target.value) || 0)}
                              className="w-24 px-2 py-1 border rounded text-sm"
                              step="0.01"
                              required
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              value={item.discount_percentage}
                              onChange={(e) => handleItemChange(index, 'discount_percentage', parseFloat(e.target.value) || 0)}
                              className="w-16 px-2 py-1 border rounded text-sm"
                              step="0.01"
                            />
                          </td>
                          <td className="p-2">
                            <select
                              value={item.gst_percentage}
                              onChange={(e) => handleItemChange(index, 'gst_percentage', parseFloat(e.target.value))}
                              className="w-16 px-2 py-1 border rounded text-sm"
                            >
                              <option value="5">5%</option>
                              <option value="12">12%</option>
                              <option value="18">18%</option>
                            </select>
                          </td>
                          <td className="p-2 text-sm font-semibold">
                            ₹{item.total.toFixed(2)}
                          </td>
                          <td className="p-2">
                            <button
                              type="button"
                              onClick={() => removeItem(index)}
                              className="text-red-600 hover:text-red-800"
                              disabled={items.length === 1}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-4 flex justify-end">
                  <div className="text-xl font-bold text-gray-800">
                    Total: ₹{items.reduce((sum, item) => sum + item.total, 0).toFixed(2)}
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Create Order
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {showAdvanceForm && selectedOrder && (
          <div className="bg-gray-50 p-6 rounded-lg mb-6">
            <h3 className="text-lg font-semibold mb-4">Record Advance Payment</h3>
            <form onSubmit={handleAdvancePayment}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount *
                  </label>
                  <input
                    type="number"
                    value={advanceData.amount}
                    onChange={(e) => setAdvanceData({ ...advanceData, amount: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Mode
                  </label>
                  <select
                    value={advanceData.payment_mode}
                    onChange={(e) => setAdvanceData({ ...advanceData, payment_mode: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={advanceData.payment_date}
                    onChange={(e) => setAdvanceData({ ...advanceData, payment_date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reference Number
                  </label>
                  <input
                    type="text"
                    value={advanceData.reference_number}
                    onChange={(e) => setAdvanceData({ ...advanceData, reference_number: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Transaction reference"
                  />
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes
                </label>
                <textarea
                  value={advanceData.notes}
                  onChange={(e) => setAdvanceData({ ...advanceData, notes: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAdvanceForm(false);
                    setSelectedOrder(null);
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 flex items-center"
                >
                  {loading ? (
                    <>
                      <Loader className="w-5 h-5 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Record Advance
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-gray-800">Recent Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Order #</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Date</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Customer</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Amount</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Advance</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Balance</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-gray-500">
                      No sales orders found. Click "New Order" to create one.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-sm font-semibold text-blue-600">
                        {order.order_number}
                      </td>
                      <td className="p-4 text-sm text-gray-700">
                        {new Date(order.order_date).toLocaleDateString()}
                      </td>
                      <td className="p-4 text-sm text-gray-700">
                        {order.customers?.name || 'N/A'}
                        <div className="text-xs text-gray-500">{order.customers?.mobile}</div>
                      </td>
                      <td className="p-4 text-sm font-semibold text-gray-700">
                        ₹{(order.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-sm text-green-700">
                        ₹{(order.advance_received || 0).toFixed(2)}
                      </td>
                      <td className="p-4 text-sm text-orange-700">
                        ₹{(order.balance_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() => downloadSalesOrder(order.id, true)}
                            className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100"
                            title="Download with MRP"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => downloadSalesOrder(order.id, false)}
                            className="p-2 rounded-full bg-gray-50 text-gray-600 hover:bg-gray-100"
                            title="Download without MRP"
                          >
                            <FileDown className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrder(order.id);
                              setShowAdvanceForm(true);
                            }}
                            className="p-2 rounded-full bg-green-50 text-green-600 hover:bg-green-100"
                            title="Record Advance"
                          >
                            <DollarSign className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
