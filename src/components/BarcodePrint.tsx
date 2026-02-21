import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Barcode as BarcodeIcon, Search, Printer, RefreshCw, Download } from 'lucide-react';
import { generateBarcodeDataURL } from '../utils/barcodeGenerator';
import { encodeCostForVendor } from '../utils/costEncoding';

const ENABLE_BARCODE_PRINT_AUDIT_LOGS = true;

export default function BarcodePrint() {
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [printSize, setPrintSize] = useState<'small' | 'medium' | 'large'>('small');
  const [poData, setPOData] = useState<any>(null);
  const [selectedSizeFilter, setSelectedSizeFilter] = useState<string>('all');
  const [availableSizes, setAvailableSizes] = useState<any[]>([]);
  const [autoPrint, setAutoPrint] = useState(false);
  const [autoPrintTriggered, setAutoPrintTriggered] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    const params = new URLSearchParams(hash.split('?')[1] || '');
    const poId = params.get('po_id');
    const invoice = params.get('invoice');
    const order = params.get('order');
    const barcodeId = params.get('barcode_id');
    const batchId = params.get('batch_id');
    const quantity = params.get('quantity');
    const alias = params.get('alias') || '';
    const design = params.get('design') || '';
    const mrp = params.get('mrp') || '0';
    const product = params.get('product') || '';
    const groupCode = params.get('group_code') || '';
    const color = params.get('color') || '';
    const size = params.get('size') || '';
    const costActual = params.get('cost_actual') || '';
    const vendorCode = params.get('vendor_code') || '';
    const discountType = params.get('discount_type') || '';
    const discountValue = params.get('discount_value') || '';
    const auto = params.get('auto') || '';
    setAutoPrint(auto === '1' || auto.toLowerCase() === 'true');

    if (poId) {
      loadPOItems(poId, invoice || '', order || '');
    } else if (batchId) {
      loadBatchItems(
        batchId, 
        parseInt(quantity || '1', 10), 
        alias, 
        design, 
        mrp, 
        product, 
        color, 
        size, 
        vendorCode, 
        discountType, 
        discountValue, 
        groupCode, 
        costActual
      );
    } else if (barcodeId) {
      loadSingleItem(barcodeId, parseInt(quantity || '1', 10));
    } else {
      loadItems();
    }
  }, []);

  useEffect(() => {
    const uniqueSizes = Array.from(
      new Set(items.map(item => item.size?.name).filter(Boolean))
    ).map(name => {
      const item = items.find(i => i.size?.name === name);
      return {
        name,
        id: item?.size?.id || item?.size_id,
      };
    });
    setAvailableSizes(uniqueSizes);
  }, [items]);

  useEffect(() => {
    if (autoPrint && !autoPrintTriggered && items.length > 0 && selectedItems.size > 0) {
      setAutoPrintTriggered(true);
      // Defer slightly to ensure DOM is ready
      setTimeout(() => handlePrint(), 0);
    }
  }, [autoPrint, autoPrintTriggered, items, selectedItems]);

  const loadPOItems = async (poId: string, invoiceNumber: string, orderNumber: string) => {
    setLoading(true);
    try {
      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          vendors:vendor(name, vendor_code)
        `)
        .eq('id', poId)
        .single();

      if (poError) throw poError;

      const { data: batches, error: batchError } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(name, group_code, hsn_code),
          color:colors(name, color_code),
          size:sizes(name, size_code)
        `)
        .eq('po_id', poId);

      if (batchError) throw batchError;

      const itemsWithQuantity: any[] = [];
      batches?.forEach((batch: any) => {
        const qty = batch.print_quantity !== null && batch.print_quantity !== undefined 
          ? batch.print_quantity 
          : (batch.total_quantity || 0);
        for (let i = 0; i < qty; i++) {
          itemsWithQuantity.push({
            ...batch,
            barcode_id: batch.barcode_alias_8digit,
            product_group: batch.product_group,
            color: batch.color,
            size: batch.size,
            mrp: batch.mrp,
            vendor: po.vendors,
            po_id: poId,
            invoice_number: invoiceNumber,
            order_number: orderNumber,
          });
        }
      });

      setPOData({
        id: poId,
        po_number: po.po_number,
        invoice_number: invoiceNumber,
        order_number: orderNumber,
        vendor: po.vendors,
      });

      setItems(itemsWithQuantity);
      setSelectedItems(new Set(itemsWithQuantity.map(item => item.barcode_id)));
    } catch (err) {
      console.error('Error loading PO items:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadBatchItems = async (
    batchId: string, 
    quantity: number, 
    aliasFallback?: string, 
    designFallback?: string,
    mrpFallback?: string,
    productFallback?: string,
    colorFallback?: string,
    sizeFallback?: string,
    vendorFallback?: string,
    discountTypeFallback?: string,
    discountValueFallback?: string,
    groupCodeFallback?: string,
    costActualFallback?: string
  ) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(name, group_code, hsn_code),
          color:colors(name, color_code),
          size:sizes(name, size_code),
          vendor:vendors(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .eq('id', batchId)
        .single();

      if (error) throw error;

      if (data) {
        const item = {
          barcode_id: data.barcode_alias_8digit,
          product_group: data.product_group,
          design_no: data.design_no,
          color: data.color,
          size: data.size,
          mrp: data.mrp,
          cost_actual: data.cost_actual,
          vendor: data.vendor,
          vendor_code: data.vendor?.vendor_code || vendorFallback || '',
          status: data.status,
          purchase_orders: data.purchase_orders,
          discount_type: data.discount_type,
          discount_value: data.discount_value
        };

        const itemsToPrint = Array(quantity).fill(item);
        setItems(itemsToPrint);
        setSelectedItems(new Set([item.barcode_id]));
      } else if (aliasFallback) {
        const item = {
          barcode_id: aliasFallback,
          product_group: { 
            name: productFallback || '',
            group_code: groupCodeFallback || ''
          },
          design_no: designFallback || '',
          color: { name: colorFallback || '' },
          size: { name: sizeFallback || '' },
          mrp: parseFloat(mrpFallback || '0'),
          cost_actual: parseFloat(costActualFallback || '0'),
          vendor_code: vendorFallback || '',
          status: 'New',
          purchase_orders: null,
          discount_type: discountTypeFallback || null,
          discount_value: discountValueFallback ? parseFloat(discountValueFallback) : null
        };
        const itemsToPrint = Array(quantity).fill(item);
        setItems(itemsToPrint);
        setSelectedItems(new Set([item.barcode_id]));
      }
    } catch (err) {
      console.error('Error loading batch:', err);
      if (aliasFallback) {
        const item = {
          barcode_id: aliasFallback,
          product_group: { 
            name: productFallback || '',
            group_code: groupCodeFallback || ''
          },
          design_no: designFallback || '',
          color: { name: colorFallback || '' },
          size: { name: sizeFallback || '' },
          mrp: parseFloat(mrpFallback || '0'),
          cost_actual: parseFloat(costActualFallback || '0'),
          vendor_code: vendorFallback || '',
          status: 'New',
          purchase_orders: null,
          discount_type: discountTypeFallback || null,
          discount_value: discountValueFallback ? parseFloat(discountValueFallback) : null
        };
        const itemsToPrint = Array(quantity).fill(item);
        setItems(itemsToPrint);
        setSelectedItems(new Set([aliasFallback]));
      }
    } finally {
      setLoading(false);
    }
  };

  const loadSingleItem = async (barcodeId: string, quantity: number) => {
    setLoading(true);
    try {
      // Try to find in barcode_batches first (new system)
      const { data: batchData } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(name, group_code, hsn_code),
          color:colors(name, color_code),
          size:sizes(name, size_code),
          vendor:vendors(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .eq('barcode_alias_8digit', barcodeId)
        .maybeSingle();

      if (batchData) {
        const item = {
          ...batchData,
          barcode_id: batchData.barcode_alias_8digit,
        };
        const itemsToPrint = Array(quantity).fill(item);
        setItems(itemsToPrint);
        setSelectedItems(new Set([barcodeId]));
        return;
      }

      // Fallback to product_items (old system)
      const { data, error } = await supabase
        .from('product_items')
        .select(`
          *,
          product_group:product_groups(name, group_code, hsn_code),
          color:colors(name, color_code),
          size:sizes(name, size_code),
          vendor:vendors(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .eq('barcode_id', barcodeId)
        .single();

      if (error) throw error;

      if (data) {
        const itemsToPrint = Array(quantity).fill(data);
        setItems(itemsToPrint);
        setSelectedItems(new Set([barcodeId]));
      }
    } catch (err) {
      console.error('Error loading item:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      // Load from barcode_batches (New System)
      const { data, error } = await supabase
        .from('barcode_batches')
        .select(`
          *,
          product_group:product_groups(name, group_code, hsn_code),
          color:colors(name, color_code),
          size:sizes(name, size_code),
          vendor:vendors(name, vendor_code),
          purchase_orders:po_id(id, po_number, invoice_number, order_number)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const mappedItems = data?.map(item => ({
        ...item,
        barcode_id: item.barcode_alias_8digit
      })) || [];

      setItems(mappedItems);
    } catch (err) {
      console.error('Error loading items:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredItems = items.filter(item => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = (
      item.barcode_id?.toLowerCase().includes(searchLower) ||
      item.design_no?.toLowerCase().includes(searchLower) ||
      item.product_group?.name?.toLowerCase().includes(searchLower)
    );

    const matchesSize = selectedSizeFilter === 'all' ||
      item.size?.id === selectedSizeFilter ||
      item.size_id === selectedSizeFilter;

    return matchesSearch && matchesSize;
  });

  const toggleItem = (barcodeId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(barcodeId)) {
      newSelected.delete(barcodeId);
    } else {
      newSelected.add(barcodeId);
    }
    setSelectedItems(newSelected);
  };

  const selectAll = () => {
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredItems.map(item => item.barcode_id)));
    }
  };

  const saveAuditLog = async (printedItems: any[]) => {
    if (!ENABLE_BARCODE_PRINT_AUDIT_LOGS) {
      return;
    }
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: userRecord } = await supabase
        .from('users')
        .select('id')
        .eq('auth_user_id', userData?.user?.id)
        .maybeSingle();

      const auditData: any = {
        items_printed: printedItems.map(item => ({
          barcode_id: item.barcode_id,
          design_no: item.design_no,
          product_group: item.product_group?.name,
          color: item.color?.name,
          size: item.size?.name,
          mrp: item.mrp,
        })),
        printed_by: userRecord?.id || null,
        printed_at: new Date().toISOString(),
      };

      if (poData) {
        auditData.po_id = poData.id;
        auditData.invoice_number = poData.invoice_number;
        auditData.order_number = poData.order_number;
      }

      // Try inserting into the old schema first (since this component seems to rely on items_printed)
      // Or better, check for errors and handle them gracefully
      const { error } = await supabase
        .from('barcode_print_logs')
        .insert([auditData]);

      if (error) {
         // If error is PGRST204 (column missing), it implies we might be trying to insert into a new schema structure
         // We should attempt to insert using the old schema format as a fallback
         if (error.code === 'PGRST204') {
             console.warn('New schema columns missing in BarcodePrint, falling back to old schema');
             await supabase.from('barcode_print_logs').insert([{
                 items_printed: auditData.items_printed,
                 printed_by: auditData.printed_by,
                 invoice_number: auditData.invoice_number,
                 order_number: auditData.order_number,
                 po_id: auditData.po_id
             }]);
         } else {
             // Log other errors but don't disturb the user since printing is more important
             console.warn('Audit log failed (non-blocking):', error);
         }
      }
    } catch (err) {
      console.error('Error saving audit log:', err);
    }
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const selectedItemsData = items.filter(item => selectedItems.has(item.barcode_id));

    // Log in background, don't await
    if (ENABLE_BARCODE_PRINT_AUDIT_LOGS) {
      saveAuditLog(selectedItemsData).catch(err => console.error('Background log error:', err));
    }

    const sizeStyles = {
      small: { 
        width: '2.25in', 
        height: '1.5in',
        minHeight: '1.5in', 
        fontSize: '10px', 
        padding: '2mm', 
        barcodeWidth: 1.5, 
        barcodeHeight: 30 
      },
      medium: { width: '70mm', height: '40mm', minHeight: '40mm', fontSize: '10px', padding: '1mm', barcodeWidth: 2, barcodeHeight: 50 },
      large: { width: '100mm', height: '60mm', minHeight: '60mm', fontSize: '12px', padding: '1mm', barcodeWidth: 3, barcodeHeight: 70 }
    };

    const size = sizeStyles[printSize];

    const barcodeHTML = selectedItemsData.map(item => {
      const design = item.design_no || '';
      const priceValue = (() => {
        const primaryPrice = item.cost_actual ?? item.cost_per_item ?? item.mrp ?? 0;
        if (item.discount_type && item.discount_value && item.discount_value > 0) {
          if (item.discount_type === 'percentage') {
            return primaryPrice - (primaryPrice * item.discount_value / 100);
          } else {
            return primaryPrice - item.discount_value;
          }
        }
        return primaryPrice;
      })();
      const encodedCost = encodeCostForVendor(priceValue, 'CRAZY WOMEN');
      
      const groupCode = item.product_group?.group_code || '';
      const colorCode = item.color?.color_code || '';
      const vendorCode = item.vendor?.vendor_code || item.vendor_code || '';
      const secondLine = [groupCode, design, colorCode, vendorCode, encodedCost].filter(Boolean).join('-');

      const barcodeDataURL = generateBarcodeDataURL(item.barcode_id, {
        width: size.barcodeWidth,
        height: size.barcodeHeight,
        displayValue: false,
      });

      const topLine = item.product_group?.name || '';

      const mrp = parseFloat(item.mrp) || 0;
      let finalPrice = mrp;
      if (item.discount_type && item.discount_value && item.discount_value > 0) {
        if (item.discount_type === 'percentage') {
          finalPrice = mrp - (mrp * item.discount_value / 100);
        } else {
          finalPrice = mrp - item.discount_value;
        }
      }
      finalPrice = Math.max(0, finalPrice);

      return `
      <div style="
        width: ${size.width};
        min-height: ${size.minHeight};
        border-bottom: 2px solid #000;
        padding: ${size.padding};
        padding-bottom: 2mm;
        margin: 0;
        page-break-before: always;
        page-break-inside: avoid;
        display: flex;
        flex-direction: column;
        justify-content: space-around;
        align-items: center;
        font-family: 'Lato', sans-serif;
        box-sizing: border-box;
        background: #fff;
        color: #000;
      ">
        <div style="text-align: center; margin-bottom: 0.5mm;">
          <strong style=" font-weight: 950; font-size: calc(${size.fontSize} + 1px); text-transform: uppercase;">${topLine}</strong>
        </div>
        <div style="text-align: center; font-family: 'Lato', sans-serif; font-size: calc(${size.fontSize} - 1px); margin-bottom: 0.3mm; font-weight: 900; letter-spacing: 0.3px;">
          ${secondLine}
        </div>
        <div style="text-align: center; margin: 0.5mm 0; width: 100%;">
          <img src="${barcodeDataURL}" style="width: 98%; height: auto; display: block; margin: 0 auto;" alt="Barcode" />
        </div>
        <div style="text-align: center; font-family: 'Lato', sans-serif; font-size: calc(${size.fontSize} + 2px); font-weight: 950; margin-top: 0.3mm; letter-spacing: 1px;">
          ${item.barcode_id || ''}
        </div>
        <div style="text-align: center; border-top: 2px solid #000; width: 100%; font-size: calc(${size.fontSize} + 1px); font-weight: 950; margin-top: 0.5mm; padding-top: 1.5mm; display: flex; justify-content: space-around; align-items: center; letter-spacing: 0.5px;">
          <span style="white-space: nowrap;">SIZE: ${(item.size?.name || '').toUpperCase()}</span>
          <span style="font-weight: 500; opacity: 0.8;">|</span>
          <span style="white-space: nowrap;">MRP: ₹${finalPrice.toFixed(0)}</span>
        </div>
      </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Print Barcodes</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap');
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 0;
            font-family: 'Lato', sans-serif;
          }
          @media print {
            body { -webkit-print-color-adjust: exact; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        ${barcodeHTML}
        <script>
          window.onload = function() {
            window.print();
            setTimeout(() => window.close(), 100);
          }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  const downloadCSV = () => {
    const selectedItemsData = items.filter(item => selectedItems.has(item.barcode_id));

    const headers = ['Barcode ID', 'Product Group', 'Design No', 'Color', 'Size', 'MRP', 'Invoice No', 'Order No', 'Status'];
    const rows = selectedItemsData.map(item => [
      item.barcode_id,
      item.product_group?.name || '',
      item.design_no,
      item.color?.name || '',
      item.size?.name || '',
      item.mrp,
      item.invoice_number || item.purchase_orders?.invoice_number || '',
      item.order_number || item.purchase_orders?.order_number || '',
      item.status || 'New'
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `barcodes-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <BarcodeIcon className="w-8 h-8 text-blue-600 mr-3" />
            <h2 className="text-3xl font-bold text-gray-800">Barcode Management</h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                const target = sessionStorage.getItem('returnTo') || '#dashboard';
                window.location.hash = target;
              }}
              className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
              title="Back"
            >
              Back
            </button>
          <button
            onClick={loadItems}
            className="p-3 bg-gray-100 rounded-lg hover:bg-gray-200"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5 text-gray-700" />
          </button>
          </div>
        </div>

        {poData && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h3 className="font-semibold text-blue-900 mb-2">Purchase Invoice Details</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-blue-700">Invoice Number:</span>
                <span className="ml-2 font-medium">{poData.po_number}</span>
              </div>
              {poData.invoice_number && (
                <div>
                  <span className="text-blue-700">Invoice:</span>
                  <span className="ml-2 font-medium">{poData.invoice_number}</span>
                </div>
              )}
              {poData.order_number && (
                <div>
                  <span className="text-blue-700">Order:</span>
                  <span className="ml-2 font-medium">{poData.order_number}</span>
                </div>
              )}
              <div>
                <span className="text-blue-700">Vendor:</span>
                <span className="ml-2 font-medium">{poData.vendor.name}</span>
              </div>
            </div>
          </div>
        )}

        <div className="mb-6 space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by barcode, design number, or product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-700">Size:</span>
            <button
              onClick={() => setSelectedSizeFilter('all')}
              className={`px-3 py-1 rounded-full text-sm transition ${
                selectedSizeFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All ({items.length})
            </button>
            {availableSizes.map((size) => {
              const count = items.filter(item =>
                item.sizes?.id === size.id || item.size === size.id
              ).length;
              return (
                <button
                  key={size.id}
                  onClick={() => setSelectedSizeFilter(size.id)}
                  className={`px-3 py-1 rounded-full text-sm transition ${
                    selectedSizeFilter === size.id
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {size.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Print Size:</label>
            <div className="flex gap-2">
              {(['small', 'medium', 'large'] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => setPrintSize(size)}
                  className={`px-4 py-2 rounded-lg font-medium transition ${
                    printSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {size.charAt(0).toUpperCase() + size.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {selectedItems.size > 0 && (
            <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
              <span className="text-blue-900 font-medium">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <button
                onClick={handlePrint}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Printer className="w-5 h-5 mr-2" />
                Print Labels
              </button>
              <button
                onClick={downloadCSV}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Download className="w-5 h-5 mr-2" />
                Export CSV
              </button>
              <button
                onClick={() => setSelectedItems(new Set())}
                className="px-4 py-2 text-gray-700 hover:text-gray-900"
              >
                Clear Selection
              </button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-4 text-left">
                    <input
                      type="checkbox"
                      checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                      onChange={selectAll}
                      className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                  </th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">PREVIEW</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">BARCODE ID</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">PRODUCT</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">DESIGN</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">COLOR</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">SIZE</th>
                   <th className="p-4 text-left text-sm font-semibold text-gray-700">MRP</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">INVOICE/ORDER</th>
                  <th className="p-4 text-left text-sm font-semibold text-gray-700">STATUS</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-8 text-center text-gray-500">
                      {searchTerm ? 'No items found matching your search.' : 'No items available.'}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, index) => {
                    const barcodeImageURL = generateBarcodeDataURL(item.barcode_id, {
                      width: 2,
                      height: 40,
                      displayValue: false,
                    });

                    const design = item.design_no || '';
                    const priceValue = (() => {
                      const primaryPrice = item.cost_actual ?? item.cost_per_item ?? item.mrp ?? 0;
                      if (item.discount_type && item.discount_value && item.discount_value > 0) {
                        if (item.discount_type === 'percentage') {
                          return primaryPrice - (primaryPrice * item.discount_value / 100);
                        } else {
                          return primaryPrice - item.discount_value;
                        }
                      }
                      return primaryPrice;
                    })();
                    const encodedCost = encodeCostForVendor(priceValue, 'CRAZY WOMEN');
                    
                    const groupCode = item.product_group?.group_code || '';
                    const colorCode = item.color?.color_code || '';
                    const vendorCode = item.vendor?.vendor_code || item.vendor_code || '';
                    const secondLine = [groupCode, design, colorCode, vendorCode, encodedCost].filter(Boolean).join('-');

                    const topLine = item.product_group?.name || '';

                    return (
                      <tr key={`${item.barcode_id}-${index}`} className="border-b hover:bg-gray-50">
                        <td className="p-4">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.barcode_id)}
                            onChange={() => toggleItem(item.barcode_id)}
                            className="w-5 h-5 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                        <td className="p-4">
                          <div className="bg-white p-2 rounded border-2 border-gray-800 flex flex-col items-center gap-0.5" style={{ minWidth: '140px' }}>
                            <div className="text-[8px] font-extrabold uppercase truncate w-full text-center">
                              {topLine}
                            </div>
                            <div className="text-[7px] font-mono font-black truncate w-full text-center">
                              {secondLine}
                            </div>
                            {barcodeImageURL ? (
                              <img src={barcodeImageURL} alt="Barcode" className="h-8 object-contain" />
                            ) : (
                              <span className="text-[8px] text-red-500">Error</span>
                            )}
                            <div className="text-[8px] font-mono font-bold">
                              {item.barcode_id}
                            </div>
                             <div className="text-[8px] font-black border-t border-gray-200 w-full text-center pt-0.5">
                               Size: {item.size?.name || ''} | {(() => {
                                 const mrp = parseFloat(item.mrp) || 0;
                                 let finalPrice = mrp;
                                 if (item.discount_type && item.discount_value && item.discount_value > 0) {
                                   if (item.discount_type === 'percentage') {
                                     finalPrice = mrp - (mrp * item.discount_value / 100);
                                   } else {
                                     finalPrice = mrp - item.discount_value;
                                   }
                                 }
                                 return (
                                   <>
                                     MRP : <span className="text-gray-900 font-extrabold">₹{Math.max(0, finalPrice).toFixed(0)}</span>
                                   </>
                                 );
                               })()}
                             </div>
                          </div>
                        </td>
                        <td className="p-4 font-mono text-sm">{item.barcode_id}</td>
                        <td className="p-4 text-sm">{item.product_group?.name || 'N/A'}</td>
                        <td className="p-4 text-sm">{item.design_no}</td>
                        <td className="p-4 text-sm">{item.color?.name || 'N/A'}</td>
                        <td className="p-4 text-sm">{item.size?.name || 'N/A'}</td>
                         <td className="p-4 text-sm font-semibold">
                            {(() => {
                              const mrp = parseFloat(item.mrp) || 0;
                              if (item.discount_type && item.discount_value && item.discount_value > 0) {
                                let finalPrice = mrp;
                                if (item.discount_type === 'percentage') {
                                  finalPrice = mrp - (mrp * item.discount_value / 100);
                                } else {
                                  finalPrice = mrp - item.discount_value;
                                }
                                return (
                                  <div>
                                    <span className="line-through text-gray-400 text-xs block">₹{mrp.toFixed(2)}</span>
                                    <span className="text-red-600">₹{finalPrice.toFixed(2)}</span>
                                  </div>
                                );
                              }
                              return `₹${mrp.toFixed(2)}`;
                            })()}
                         </td>
                        <td className="p-4 text-xs text-gray-600">
                          {(() => {
                            const orderNo = item.order_number || item.purchase_orders?.order_number;
                            const invoiceNo = item.invoice_number || item.purchase_orders?.invoice_number;
                            if (orderNo) return <div>Ord: {orderNo}</div>;
                            if (invoiceNo) return <div>Inv: {invoiceNo}</div>;
                            return '-';
                          })()}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            item.status === 'Available' ? 'bg-green-100 text-green-800' :
                            item.status === 'Sold' ? 'bg-gray-100 text-gray-800' :
                            item.status === 'Booked' ? 'bg-yellow-100 text-yellow-800' :
                            item.status ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {item.status || 'New'}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
