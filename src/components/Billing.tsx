import { useState, useRef, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { calculateReverseGST, GSTType } from '../utils/gst';
import { scanBarcode, getAvailableBarcodes, updateBarcodeQuantity } from '../utils/barcodeScanning';
import { calculateGSTBreakdown, GSTTransactionType } from '../utils/gstBreakdown';
import { Scan, Trash2, Save, Search, X, Eye } from 'lucide-react';
import SalesInvoicePDF from './SalesInvoicePDF';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

interface BillingItem {
  barcode_8digit: string;
  product_description: string;
  design_no: string;
  mrp: number;
  discount: number;
  discount_percent: number;
  gst_logic: GSTType;
  order_number: string | null;
  delivered: boolean;
}

export default function Billing() {
  const [items, setItems] = useState<BillingItem[]>([]);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [paymentMode, setPaymentMode] = useState('Cash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showManualSelect, setShowManualSelect] = useState(false);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCustomerPrompt, setShowCustomerPrompt] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState('');
  const [gstType, setGstType] = useState<GSTTransactionType>('CGST_SGST');
  const [showInvoicePDF, setShowInvoicePDF] = useState(false);
  const [lastGeneratedInvoiceId, setLastGeneratedInvoiceId] = useState<string | null>(null);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAvailableItems();
  }, []);

  useEffect(() => {
    if (customerMobile.length === 10) {
      checkCustomerExists(customerMobile);
      loadCustomerBookings();
    } else {
      setCustomerName('');
    }
  }, [customerMobile]);

  const loadAvailableItems = async () => {
    try {
      const items = await getAvailableBarcodes();
      setAvailableItems(items);
    } catch (err: any) {
      console.error('Error loading available items:', err);
    }
  };

  const checkCustomerExists = async (mobile: string) => {
    if (mobile.length !== 10) return;

    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('*')
        .eq('mobile', mobile)
        .maybeSingle();

      if (customer) {
        setCustomerName(customer.name);
        setError('');
      } else {
        setShowCustomerPrompt(true);
      }
    } catch (err: any) {
      console.error('Error checking customer:', err);
    }
  };

  const createNewCustomer = async () => {
    if (!newCustomerName.trim()) {
      setError('Please enter customer name');
      return;
    }

    try {
      const { error } = await supabase
        .from('customers')
        .insert([{
          mobile: customerMobile,
          name: newCustomerName.trim(),
          status: 'active',
        }]);

      if (error) throw error;

      setCustomerName(newCustomerName.trim());
      setShowCustomerPrompt(false);
      setNewCustomerName('');
      setSuccess('New customer created successfully');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const loadCustomerBookings = async () => {
    try {
      const { data: bookings, error } = await supabase
        .from('e_bookings')
        .select('*')
        .eq('customer_mobile', customerMobile)
        .eq('status', 'booked');

      if (error) throw error;

      if (bookings && bookings.length > 0) {
        for (const booking of bookings) {
          if (items.some(i => i.barcode_8digit === booking.barcode_8digit)) {
            continue;
          }

          const itemInfo = await scanBarcode(booking.barcode_8digit);
          if (itemInfo && itemInfo.available_quantity > 0) {
            const productDescription = `${itemInfo.design_no} - ${itemInfo.product_group_name} - ${itemInfo.color_name} - ${itemInfo.size_name}${itemInfo.order_number ? ` (ORD:${itemInfo.order_number})` : ''}`;

            const { autoDiscount, autoDiscountPercent } = calculateAutoDiscount(itemInfo);

            setItems(prevItems => {
              if (prevItems.some(i => i.barcode_8digit === itemInfo.barcode_8digit)) {
                return prevItems;
              }
              return [...prevItems, {
                barcode_8digit: itemInfo.barcode_8digit,
                product_description: productDescription,
                design_no: itemInfo.design_no,
                mrp: itemInfo.mrp,
                discount: autoDiscount,
                discount_percent: autoDiscountPercent,
                gst_logic: itemInfo.gst_logic as GSTType,
                order_number: itemInfo.order_number,
                delivered: true,
              }];
            });
          }
        }

        if (bookings.length > 0) {
          setSuccess(`${bookings.length} booked item(s) added automatically`);
          setTimeout(() => setSuccess(''), 3000);
        }
      }
    } catch (err: any) {
      console.error('Error loading customer bookings:', err);
    }
  };

  const addManualItem = (item: any) => {
    if (items.find(i => i.barcode_8digit === item.barcode_8digit)) {
      setError('Item already added to bill');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const productDescription = `${item.design_no} - ${item.product_group_name} - ${item.color_name} - ${item.size_name}${item.order_number ? ` (ORD:${item.order_number})` : ''}`;

    const { autoDiscount, autoDiscountPercent } = calculateAutoDiscount(item);

    setItems([
      ...items,
      {
        barcode_8digit: item.barcode_8digit,
        product_description: productDescription,
        design_no: item.design_no,
        mrp: item.mrp,
        discount: autoDiscount,
        discount_percent: autoDiscountPercent,
        gst_logic: item.gst_logic as GSTType,
        order_number: item.order_number,
        delivered: true,
      },
    ]);

    setShowManualSelect(false);
    setSearchQuery('');
    setSuccess('Item added successfully');
    setTimeout(() => setSuccess(''), 2000);
  };

  const scanBarcodeCode = async () => {
    if (!barcodeInput.trim()) return;

    setError('');

    try {
      const data = await scanBarcode(barcodeInput.trim());

      if (!data) {
        setError('Item not found');
        return;
      }

      if (data.available_quantity <= 0) {
        setError('Item is out of stock');
        return;
      }

      if (items.find(item => item.barcode_8digit === data.barcode_8digit)) {
        setError('Item already added to bill');
        return;
      }

      const productDescription = `${data.design_no} - ${data.product_group_name} - ${data.color_name} - ${data.size_name}${data.order_number ? ` (ORD:${data.order_number})` : ''}`;

      const { autoDiscount, autoDiscountPercent } = calculateAutoDiscount(data);

      setItems([
        ...items,
        {
          barcode_8digit: data.barcode_8digit,
          product_description: productDescription,
          design_no: data.design_no,
          mrp: data.mrp,
          discount: autoDiscount,
          discount_percent: autoDiscountPercent,
          gst_logic: data.gst_logic as GSTType,
          order_number: data.order_number,
          delivered: true,
        },
      ]);

      setBarcodeInput('');
      barcodeInputRef.current?.focus();
    } catch (err: any) {
      setError(err.message || 'Failed to scan item');
    }
  };

  const calculateAutoDiscount = (data: any) => {
    let autoDiscount = 0;
    let autoDiscountPercent = 0;

    if (data.discount_value && data.discount_value > 0) {
      const today = new Date();
      const startDate = data.discount_start_date ? new Date(data.discount_start_date) : null;
      const endDate = data.discount_end_date ? new Date(data.discount_end_date) : null;

      const isValidDate = (!startDate || today >= startDate) && (!endDate || today <= endDate);

      if (isValidDate) {
        if (data.discount_type === 'percentage') {
          autoDiscountPercent = data.discount_value;
          autoDiscount = (data.mrp * data.discount_value) / 100;
        } else if (data.discount_type === 'flat') {
          autoDiscount = data.discount_value;
          autoDiscountPercent = (data.discount_value / data.mrp) * 100;
        }
      }
    }

    return { autoDiscount, autoDiscountPercent };
  };

  const removeItem = (barcode: string) => {
    setItems(items.filter(item => item.barcode_8digit !== barcode));
  };

  const updateDiscount = (barcode: string, value: number, isPercent: boolean) => {
    setItems(items.map(item => {
      if (item.barcode_8digit === barcode) {
        if (isPercent) {
          const discountAmount = (item.mrp * value) / 100;
          return {
            ...item,
            discount_percent: value,
            discount: discountAmount,
          };
        } else {
          const discountPercent = (value / item.mrp) * 100;
          return {
            ...item,
            discount: value,
            discount_percent: discountPercent,
          };
        }
      }
      return item;
    }));
  };

  const toggleItemDelivery = (barcode: string) => {
    setItems(items.map(item => {
      if (item.barcode_8digit === barcode) {
        return { ...item, delivered: !item.delivered };
      }
      return item;
    }));
  };

  const calculateTotals = () => {
    let totalMrp = 0;
    let totalDiscount = 0;
    let totalBasePrice = 0;
    let totalGst = 0;

    items.forEach(item => {
      totalMrp += item.mrp;
      totalDiscount += item.discount;

      const mrpAfterDiscount = item.mrp - item.discount;
      const reverseGst = calculateReverseGST(mrpAfterDiscount, item.gst_logic);

      totalBasePrice += reverseGst.basePrice;
      totalGst += reverseGst.gstAmount;
    });

    const netPayable = Math.round(totalMrp - totalDiscount);

    return {
      totalMrp,
      totalDiscount,
      taxableValue: totalBasePrice,
      totalGst,
      netPayable,
    };
  };

  const generateInvoice = async () => {
    if (items.length === 0) {
      setError('Please add items to the bill');
      return;
    }

    if (!customerMobile || customerMobile.length !== 10) {
      setError('Please enter valid customer mobile number');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const totals = calculateTotals();

      const { data: userData } = await supabase.auth.getUser();

      const { data: userRecord } = await supabase
        .from('users')
        .select('id, mapped_salesman')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const actualAmountPaid = Math.min(parseFloat(amountPaid) || 0, totals.netPayable);
      const amountPending = totals.netPayable - actualAmountPaid;
      const paymentStatus = amountPending === 0 ? 'paid' : (actualAmountPaid > 0 ? 'partial' : 'pending');

      // 1. Prepare Invoice Data
      const invoiceData = {
        // invoice_number will be generated by RPC
        invoice_date: new Date().toISOString().split('T')[0],
        customer_mobile: customerMobile,
        customer_name: customerName,
        total_mrp: totals.totalMrp,
        total_discount: totals.totalDiscount,
        taxable_value: totals.taxableValue,
        total_gst: totals.totalGst,
        gst_type: gstType,
        cgst_5: 0,
        sgst_5: 0,
        cgst_18: 0,
        sgst_18: 0,
        igst_5: 0,
        igst_18: 0,
        net_payable: totals.netPayable,
        payment_mode: paymentMode,
        amount_paid: actualAmountPaid,
        amount_pending: amountPending,
        payment_status: paymentStatus,
        created_by: userRecord?.id || null,
        // Optional: If you track customer_id in sales_invoices, you'd fetch it first
        customer_id: null 
      };

      // Calculate invoice-level GST totals
      let cgst_5_total = 0, sgst_5_total = 0, cgst_18_total = 0, sgst_18_total = 0;
      let igst_5_total = 0, igst_18_total = 0;

      const invoiceItems = items.map((item, index) => {
        const mrpAfterDiscount = item.mrp - item.discount;
        const reverseGst = calculateReverseGST(mrpAfterDiscount, item.gst_logic);
        const itemGstBreakdown = calculateGSTBreakdown(reverseGst.gstAmount, gstType);

        if (gstType === 'CGST_SGST') {
          if (reverseGst.gstPercentage === 5) {
            cgst_5_total += itemGstBreakdown.cgstAmount;
            sgst_5_total += itemGstBreakdown.sgstAmount;
          } else {
            cgst_18_total += itemGstBreakdown.cgstAmount;
            sgst_18_total += itemGstBreakdown.sgstAmount;
          }
        } else {
          if (reverseGst.gstPercentage === 5) {
            igst_5_total += itemGstBreakdown.igstAmount;
          } else {
            igst_18_total += itemGstBreakdown.igstAmount;
          }
        }

        return {
          sr_no: index + 1,
          barcode_8digit: item.barcode_8digit,
          design_no: item.design_no,
          product_description: item.product_description,
          hsn_code: reverseGst.gstPercentage === 5 ? '6404' : '6403',
          mrp: item.mrp,
          discount: item.discount,
          taxable_value: reverseGst.basePrice,
          gst_percentage: reverseGst.gstPercentage,
          gst_type: gstType,
          cgst_percentage: gstType === 'CGST_SGST' ? reverseGst.gstPercentage / 2 : 0,
          cgst_amount: itemGstBreakdown.cgstAmount,
          sgst_percentage: gstType === 'CGST_SGST' ? reverseGst.gstPercentage / 2 : 0,
          sgst_amount: itemGstBreakdown.sgstAmount,
          igst_percentage: gstType === 'IGST' ? reverseGst.gstPercentage : 0,
          igst_amount: itemGstBreakdown.igstAmount,
          total_value: mrpAfterDiscount,
          selling_price: mrpAfterDiscount,
          salesman_id: userRecord?.mapped_salesman || null,
          delivered: item.delivered,
          delivery_date: item.delivered ? new Date().toISOString().split('T')[0] : null,
          expected_delivery_date: !item.delivered && expectedDeliveryDate ? expectedDeliveryDate : null,
        };
      });

      // Update invoice data with calculated GST totals
      invoiceData.cgst_5 = cgst_5_total;
      invoiceData.sgst_5 = sgst_5_total;
      invoiceData.cgst_18 = cgst_18_total;
      invoiceData.sgst_18 = sgst_18_total;
      invoiceData.igst_5 = igst_5_total;
      invoiceData.igst_18 = igst_18_total;

      // 3. Call Transactional RPC with Fallback
      let newInvoiceNumber = '';
      let newInvoiceId: string | null = null;

      try {
        const { data: rpcResult, error: rpcError } = await supabase.rpc('generate_invoice_transaction', {
          p_invoice_data: invoiceData,
          p_items: invoiceItems
        });

        if (rpcError) throw rpcError;
        newInvoiceNumber = rpcResult.invoice_number;
        newInvoiceId = rpcResult.id ? String(rpcResult.id) : null;

      } catch (rpcErr: any) {
        // Fallback for when RPC is missing (404) or fails
        if (rpcErr.code === '42883' || rpcErr.message?.includes('Could not find the function') || rpcErr.status === 404) {
          console.warn('RPC missing, falling back to client-side transaction logic');
          
          // --- Client-Side Fallback Logic ---
          
          // A. Insert Invoice Header
          const { count } = await supabase
            .from('sales_invoices')
            .select('*', { count: 'exact', head: true });
          
          const fallbackInvoiceNumber = `INV${new Date().getFullYear()}${String((count || 0) + 1).padStart(6, '0')}`;
          
          // Use a new object for insert to avoid modifying the original invoiceData in place if we need to retry
          const insertData = { ...invoiceData, invoice_number: fallbackInvoiceNumber };

          const { data: invoice, error: invoiceError } = await supabase
            .from('sales_invoices')
            .insert([insertData])
            .select()
            .single();

          if (invoiceError) throw invoiceError;
          newInvoiceNumber = fallbackInvoiceNumber;
          newInvoiceId = String(invoice.id);

          // B. Insert Items
          const fallbackItems = invoiceItems.map(item => ({
             invoice_id: newInvoiceId,
             sr_no: item.sr_no,
             barcode_8digit: item.barcode_8digit,
             design_no: item.design_no,
             product_description: item.product_description,
             hsn_code: item.hsn_code,
             quantity: 1,
             mrp: item.mrp,
             discount: item.discount,
             taxable_value: item.taxable_value,
             gst_percentage: item.gst_percentage,
             gst_type: item.gst_type,
             cgst_percentage: item.cgst_percentage,
             cgst_amount: item.cgst_amount,
             sgst_percentage: item.sgst_percentage,
             sgst_amount: item.sgst_amount,
             igst_percentage: item.igst_percentage,
             igst_amount: item.igst_amount,
             total_value: item.total_value,
             selling_price: item.selling_price,
             salesman_id: item.salesman_id,
             delivered: item.delivered,
             delivery_date: item.delivery_date,
             expected_delivery_date: item.expected_delivery_date
          }));

          const { error: itemsError } = await supabase
            .from('sales_invoice_items')
            .insert(fallbackItems);

          if (itemsError) {
            // Rollback Invoice
            await supabase.from('sales_invoices').delete().eq('id', newInvoiceId);
            throw itemsError;
          }

          // C. Deduct Stock (Sequential with Rollback)
          const deductedBarcodes = [];
          for (const item of items) {
            const success = await updateBarcodeQuantity(item.barcode_8digit, -1);
            if (!success) {
              // CRITICAL: Rollback everything
              console.error(`Failed to update quantity for ${item.barcode_8digit}, rolling back...`);
              
              // 1. Revert stock for already deducted items
              for (const deducted of deductedBarcodes) {
                await updateBarcodeQuantity(deducted, 1);
              }
              // 2. Delete invoice (cascades items)
              await supabase.from('sales_invoices').delete().eq('id', newInvoiceId);
              
              throw new Error(`Failed to update quantity for barcode ${item.barcode_8digit}. Transaction cancelled.`);
            }
            deductedBarcodes.push(item.barcode_8digit);
          }

          // D. Update Bookings
          await supabase
            .from('e_bookings')
            .update({
              status: 'invoiced',
              invoice_number: newInvoiceNumber,
            })
            .eq('customer_mobile', customerMobile)
            .eq('status', 'booked')
            .in('barcode_8digit', items.map(item => item.barcode_8digit));

        } else {
          throw rpcErr; // Rethrow other RPC errors (like constraints)
        }
      }

      setSuccess(`Invoice ${newInvoiceNumber} generated successfully! ${amountPending > 0 ? `Pending: ₹${amountPending.toFixed(2)}` : 'Fully Paid'}`);
      setLastGeneratedInvoiceId(newInvoiceId);

      setItems([]);
      setCustomerMobile('');
      setCustomerName('');
      setBarcodeInput('');
      setAmountPaid('');
      setExpectedDeliveryDate('');

      setTimeout(() => {
        setSuccess('');
        setLastGeneratedInvoiceId(null);
        loadAvailableItems();
      }, 10000);
    } catch (err: any) {
      console.error('Error generating invoice:', err);
      setError(err.message || 'Failed to generate invoice');
    } finally {
      setLoading(false);
    }
  };

  const totals = items.length > 0 ? calculateTotals() : null;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center">
            <Scan className="w-8 h-8 text-emerald-600 mr-3" />
            <CardTitle>Billing</CardTitle>
          </div>
        </CardHeader>

        <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <Label className="mb-2 block">
              Customer Mobile <span className="text-red-500">*</span>
            </Label>
            <Input
              type="tel"
              maxLength={10}
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value.replace(/\D/g, ''))}
              placeholder="10-digit mobile"
            />
          </div>

          <div>
            <Label className="mb-2 block">Customer Name</Label>
            <Input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Auto-filled or enter manually"
              readOnly={customerMobile.length === 10 && customerName !== ''}
            />
            {customerName && customerMobile.length === 10 && (
              <p className="mt-1 text-sm text-green-700 font-semibold">✓ Customer found</p>
            )}
          </div>
        </div>

        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <Label className="mb-2 block">
              Scan 8-Digit Barcode <span className="text-emerald-600 text-xs">(Use 8-digit code)</span>
            </Label>
            <Input
              ref={barcodeInputRef}
              type="text"
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  scanBarcodeCode();
                }
              }}
              placeholder="Enter 8-digit code"
              maxLength={8}
            />
          </div>
          <div className="flex items-end gap-2">
            <Button
              onClick={scanBarcodeCode}
              className="px-6 py-2 flex items-center gap-2 shadow-md"
            >
              <Scan className="w-5 h-5" />
              Scan
            </Button>
            <Button
              onClick={() => setShowManualSelect(true)}
              variant="secondary"
              className="px-6 py-2 flex items-center gap-2 shadow-md"
            >
              <Search className="w-5 h-5" />
              Select
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 text-red-700 p-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 text-green-700 p-3 rounded-lg mb-4 flex items-center justify-between">
            <span>{success}</span>
            {lastGeneratedInvoiceId && (
              <Button
                onClick={() => setShowInvoicePDF(true)}
                className="ml-4 flex items-center gap-2 shadow-md"
              >
                <Eye className="w-4 h-4" />
                View Invoice
              </Button>
            )}
          </div>
        )}

        <div className="border-2 border-gray-200 rounded-lg overflow-hidden mb-6">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Sr</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">8-Digit Code</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Description</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discount %</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discount ₹</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">GST</th>
                <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Deliver Now</th>
                <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y-2 divide-gray-200">
              {items.map((item, index) => {
                const mrpAfterDiscount = item.mrp - item.discount;
                const reverseGst = calculateReverseGST(mrpAfterDiscount, item.gst_logic);

                return (
                  <tr key={item.barcode_8digit} className="hover:bg-emerald-50 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium">{index + 1}</td>
                    <td className="px-4 py-3">
                      <span className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-2 py-1 rounded font-bold text-sm">
                        {item.barcode_8digit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{item.product_description}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold">₹{item.mrp.toFixed(2)}</td>
                    <td className="px-4 py-3 text-right">
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={item.discount_percent.toFixed(1)}
                        onChange={(e) => updateDiscount(item.barcode_8digit, parseFloat(e.target.value) || 0, true)}
                        className="w-16 px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Input
                        type="number"
                        min="0"
                        max={item.mrp}
                        step="0.01"
                        value={item.discount.toFixed(2)}
                        onChange={(e) => updateDiscount(item.barcode_8digit, parseFloat(e.target.value) || 0, false)}
                        className="w-20 px-2 py-1 text-sm text-right"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-emerald-700 font-semibold">{reverseGst.gstPercentage}%</td>
                    <td className="px-4 py-3 text-sm text-right font-bold text-emerald-700">₹{mrpAfterDiscount.toFixed(2)}</td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={item.delivered}
                        onChange={() => toggleItemDelivery(item.barcode_8digit)}
                        className="w-5 h-5 text-emerald-600 border-gray-300 rounded focus:ring-emerald-500 cursor-pointer"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <Button
                        onClick={() => removeItem(item.barcode_8digit)}
                        variant="ghost"
                        className="text-red-600 hover:text-red-800 p-1"
                      >
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {items.length === 0 && (
            <div className="py-12 text-center text-gray-500 bg-gray-50">
              <Scan className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No items added yet</p>
              <p className="text-sm">Scan 8-digit barcode code to add items</p>
            </div>
          )}
        </div>

        {totals && (
          <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg border-2 border-emerald-200 shadow-md">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div>
                <p className="text-sm text-gray-600">Total MRP</p>
                <p className="text-lg font-bold text-gray-800">₹{totals.totalMrp.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Discount</p>
                <p className="text-lg font-bold text-orange-600">-₹{totals.totalDiscount.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Taxable Value</p>
                <p className="text-lg font-bold text-gray-800">₹{totals.taxableValue.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Total GST</p>
                <p className="text-lg font-bold text-gray-800">₹{totals.totalGst.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Net Payable</p>
                <p className="text-2xl font-bold text-emerald-700">₹{totals.netPayable.toFixed(2)}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label className="mb-2 block">
                  Amount Paid <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="0"
                  max={totals.netPayable}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full text-lg font-semibold"
                  placeholder="Enter amount paid"
                />
              </div>
              <div>
                <Label className="mb-2 block">Amount Pending</Label>
                <div className={`w-full px-4 py-2 border-2 rounded-lg text-lg font-bold ${
                  totals.netPayable - (parseFloat(amountPaid) || 0) > 0
                    ? 'bg-red-50 border-red-300 text-red-700'
                    : 'bg-green-50 border-green-300 text-green-700'
                }`}>
                  ₹{Math.max(0, totals.netPayable - (parseFloat(amountPaid) || 0)).toFixed(2)}
                </div>
              </div>
            </div>

            {items.some(item => !item.delivered) && (
              <div className="mb-4 p-4 bg-orange-50 border-2 border-orange-200 rounded-lg">
                <Label className="mb-2 block">
                  Expected Delivery Date (for items not delivered immediately)
                </Label>
                <Input
                  type="date"
                  value={expectedDeliveryDate}
                  onChange={(e) => setExpectedDeliveryDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-64 border-orange-300"
                  placeholder="Select expected delivery date"
                />
                <p className="mt-1 text-xs text-orange-600">
                  {items.filter(item => !item.delivered).length} item(s) marked for later delivery
                </p>
              </div>
            )}

            <div className="flex gap-4">
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="UPI">UPI</option>
              </select>

              <select
                value={gstType}
                onChange={(e) => setGstType(e.target.value as GSTTransactionType)}
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                title="Select GST Type: CGST+SGST for same state, IGST for different state"
              >
                <option value="CGST_SGST">CGST + SGST</option>
                <option value="IGST">IGST</option>
              </select>

              <Button
                onClick={generateInvoice}
                disabled={loading || items.length === 0}
                className="flex-1 py-3 flex items-center justify-center shadow-lg font-bold text-lg"
              >
                {loading ? (
                  'Generating Invoice...'
                ) : (
                  <>
                    <Save className="w-5 h-5 mr-2" />
                    Generate Invoice
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
        </CardContent>
      </Card>

      {showManualSelect && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex items-center justify-between">
              <h3 className="text-2xl font-bold text-white">Select Item (Use 8-Digit Code)</h3>
              <button
                onClick={() => {
                  setShowManualSelect(false);
                  setSearchQuery('');
                }}
                className="p-2 hover:bg-white/20 rounded-lg transition text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by 8-digit code, design no, or product name..."
                className="w-full mb-4"
                autoFocus
              />
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-6">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-gray-100 to-gray-200 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">8-Digit Code</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Color</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Size</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Available</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-200">
                  {availableItems
                    .filter(item => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        item.barcode_8digit?.toLowerCase().includes(query) ||
                        item.design_no?.toLowerCase().includes(query) ||
                        item.product_group_name?.toLowerCase().includes(query) ||
                        item.color_name?.toLowerCase().includes(query) ||
                        item.size_name?.toLowerCase().includes(query) ||
                        item.order_number?.toLowerCase().includes(query)
                      );
                    })
                    .slice(0, 100)
                    .map((item) => (
                      <tr key={item.barcode_8digit} className="hover:bg-purple-50 transition-colors">
                        <td className="px-4 py-3">
                          <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-2 py-1 rounded font-bold text-sm">
                            {item.barcode_8digit}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium">{item.design_no}</td>
                        <td className="px-4 py-3 text-sm">{item.product_group_name}</td>
                        <td className="px-4 py-3 text-sm">{item.color_name}</td>
                        <td className="px-4 py-3 text-sm">{item.size_name}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="bg-emerald-100 text-emerald-800 px-2 py-1 rounded font-semibold text-sm">
                            {item.available_quantity}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">₹{item.mrp?.toFixed(2)}</td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            onClick={() => addManualItem(item)}
                            className="px-4 py-1 text-sm font-semibold shadow-md"
                          >
                            Add
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {availableItems.filter(item => {
                if (!searchQuery) return true;
                const query = searchQuery.toLowerCase();
                return (
                  item.barcode_8digit?.toLowerCase().includes(query) ||
                  item.design_no?.toLowerCase().includes(query) ||
                  item.product_group_name?.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  <Search className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                  <p>No items found matching your search</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCustomerPrompt && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="bg-gradient-to-r from-orange-600 to-red-600 p-6">
              <h3 className="text-2xl font-bold text-white">New Customer</h3>
              <p className="text-white text-sm mt-1">Mobile: {customerMobile}</p>
            </div>

            <div className="p-6">
              <Label className="mb-2 block">
                Customer Name <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    createNewCustomer();
                  }
                }}
                placeholder="Enter customer name"
                autoFocus
              />

              <div className="flex justify-end gap-3 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCustomerPrompt(false);
                    setNewCustomerName('');
                    setCustomerMobile('');
                    setCustomerName('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="shadow-md"
                  onClick={createNewCustomer}
                >
                  Create Customer
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInvoicePDF && lastGeneratedInvoiceId && (
        <SalesInvoicePDF
          invoiceId={lastGeneratedInvoiceId}
          onClose={() => setShowInvoicePDF(false)}
        />
      )}
    </div>
  );
}
