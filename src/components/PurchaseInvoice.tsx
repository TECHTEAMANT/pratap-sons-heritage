import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { FileText, Plus, Trash2, Save, Upload, Printer, Edit2, Eye, X } from 'lucide-react';
import { GSTType } from '../utils/gst';
import { GSTTransactionType } from '../utils/gstBreakdown';
import { encodeCostForVendor } from '../utils/costEncoding';
import { generateBarcodeDataURL } from '../utils/barcodeGenerator';

interface SizeQuantity {
  size: string;
  quantity: number;
}

interface PurchaseItem {
  id?: string;
  design_no: string;
  product_group: string;
  color: string;
  sizes: SizeQuantity[];
  cost_per_item: number;
  mrp_markup_percent: number;
  mrp: number;
  gst_logic: GSTType;
  image_url: string;
  description: string;
  order_number: string;
}

interface BarcodePreview {
  barcode_8digit: string;
  barcode_structured: string;
  design_no: string;
  product_group: string;
  color: string;
  size: string;
  quantity: number;
  cost: number;
  mrp: number;
  order_number: string;
}

export default function PurchaseInvoice() {
  const [vendors, setVendors] = useState<any[]>([]);
  const [productGroups, setProductGroups] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [existingDesigns, setExistingDesigns] = useState<any[]>([]);

  const [selectedVendor, setSelectedVendor] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [vendorInvoiceDate, setVendorInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<PurchaseItem[]>([]);

  const [taxableValue, setTaxableValue] = useState('');
  const [calculatedGST, setCalculatedGST] = useState(0);
  const [manualGST, setManualGST] = useState('');
  const [gstDifferenceReason, setGstDifferenceReason] = useState('');
  const [gstType, setGstType] = useState<GSTTransactionType>('CGST_SGST');

  const [invoiceAttachment, setInvoiceAttachment] = useState('');
  const [invoiceFileName, setInvoiceFileName] = useState('');
  const [uploadingInvoice, setUploadingInvoice] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [savedPOId, setSavedPOId] = useState<string | null>(null);

  const [showItemForm, setShowItemForm] = useState(false);
  const [itemMode, setItemMode] = useState<'new' | 'existing'>('existing');
  const [selectedDesignId, setSelectedDesignId] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const [showBarcodePreview, setShowBarcodePreview] = useState(false);
  const [barcodePreviewList, setBarcodePreviewList] = useState<BarcodePreview[]>([]);

  const [currentItem, setCurrentItem] = useState<any>({
    design_no: '',
    product_group: '',
    color: '',
    sizes: [],
    cost_per_item: '',
    mrp_markup_percent: '',
    mrp: '',
    gst_logic: 'AUTO_5_18',
    image_url: '',
    description: '',
    order_number: '',
  });

  const [newItemSizes, setNewItemSizes] = useState<SizeQuantity[]>([]);
  const [, setUploadingImage] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hiddenCameraInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (selectedVendor) {
      loadExistingDesigns();
    }
  }, [selectedVendor]);

  useEffect(() => {
    if (sizes.length > 0) {
      setNewItemSizes(sizes.map(s => ({ size: s.id, quantity: 0 })));
    }
  }, [sizes]);

  useEffect(() => {
    const total = calculateTotal();
    const totalStr = total > 0 ? total.toFixed(2) : '';
    setTaxableValue(totalStr);
  }, [items]);

  useEffect(() => {
    if (taxableValue && parseFloat(taxableValue) > 0) {
      const gst = calculateGSTFromTaxable(parseFloat(taxableValue));
      setCalculatedGST(gst);
      if (!manualGST) {
        setManualGST(gst.toFixed(2));
      }
    } else {
      setCalculatedGST(0);
      if (!items.length) {
        setManualGST('');
      }
    }
  }, [taxableValue, items.length]);

  useEffect(() => {
    const cost = parseFloat(currentItem.cost_per_item) || 0;
    const markup = parseFloat(currentItem.mrp_markup_percent) || 0;

    if (cost && markup !== undefined) {
      const basePrice = cost * (1 + markup / 100);

      let gstMultiplier = 1.05;
      if (currentItem.gst_logic === 'AUTO_5_18') {
        const estimatedMRP = basePrice * 1.05;
        gstMultiplier = estimatedMRP < 2500 ? 1.05 : 1.18;
      }

      const calculatedMRP = basePrice * gstMultiplier;
      setCurrentItem({ ...currentItem, mrp: calculatedMRP.toFixed(2) });
    }
  }, [currentItem.cost_per_item, currentItem.mrp_markup_percent, currentItem.gst_logic]);

  const loadMasterData = async () => {
    try {
      const [vendorsRes, groupsRes, colorsRes, sizesRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('active', true),
        supabase.from('product_groups').select('*, floors:floor_id(id, name, floor_code)'),
        supabase.from('colors').select('*'),
        supabase.from('sizes').select('*').order('sort_order'),
      ]);

      setVendors(vendorsRes.data || []);
      setProductGroups(groupsRes.data || []);
      setColors(colorsRes.data || []);
      setSizes(sizesRes.data || []);
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  const loadExistingDesigns = async () => {
    try {
      const { data } = await supabase
        .from('product_masters')
        .select(`
          *,
          product_group:product_groups(id, name, group_code),
          color:colors(id, name, color_code),
          vendor:vendors(id, name, vendor_code)
        `)
        .eq('vendor', selectedVendor);

      setExistingDesigns(data || []);
    } catch (err) {
      console.error('Error loading existing designs:', err);
    }
  };

  const calculateGSTFromTaxable = (taxableAmount: number): number => {
    let totalGST = 0;
    items.forEach(item => {
      const itemTotal = item.cost_per_item * getTotalQuantity(item);
      const itemTaxable = (itemTotal / taxableAmount) * taxableAmount;

      if (item.gst_logic === 'AUTO_5_18') {
        const gstRate = item.mrp < 2500 ? 5 : 18;
        totalGST += (itemTaxable * gstRate) / 100;
      } else if (item.gst_logic === 'FLAT_5') {
        totalGST += (itemTaxable * 5) / 100;
      }
    });
    return totalGST;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setUploadingImage(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setCurrentItem({ ...currentItem, image_url: reader.result as string });
        setUploadingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to upload image');
      setUploadingImage(false);
    }
  };

  const openCamera = async () => {
    setCameraError('');

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      hiddenCameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (err) {
      console.error('Error accessing camera:', err);
      hiddenCameraInputRef.current?.click();
    }
  };

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setCurrentItem((prev: any) => ({ ...prev, image_url: dataUrl }));
    }
    closeCamera();
  };

  const clearImage = () => {
    setCurrentItem((prev: any) => ({ ...prev, image_url: '' }));
    if (hiddenCameraInputRef.current) {
      hiddenCameraInputRef.current.value = '';
    }
  };

  useEffect(() => {
    if (cameraOpen && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current;
      const playPromise = videoRef.current.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise.catch(() => {});
      }
    }
  }, [cameraOpen]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  const handleInvoiceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingInvoice(true);
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        setInvoiceAttachment(reader.result as string);
        setInvoiceFileName(file.name);
        setUploadingInvoice(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setError('Failed to upload invoice');
      setUploadingInvoice(false);
    }
  };

  const handleExistingDesignSelect = (designId: string) => {
    const design = existingDesigns.find(d => d.id === designId);
    if (design) {
      setCurrentItem({
        design_no: design.design_no,
        product_group: design.product_group.id,
        color: design.color.id,
        sizes: [],
        cost_per_item: '',
        mrp_markup_percent: '',
        mrp: '',
        gst_logic: design.gst_logic,
        image_url: design.photos?.[0] || '',
        description: design.description || '',
        order_number: '',
      });
    }
  };

  const getTotalQuantity = (item: PurchaseItem | Partial<PurchaseItem>): number => {
    return (item.sizes || []).reduce((sum, sq) => sum + sq.quantity, 0);
  };

  const calculateTotal = (): number => {
    return items.reduce((sum, item) => {
      const qty = getTotalQuantity(item);
      return sum + (item.cost_per_item * qty);
    }, 0);
  };

  const editItem = (index: number) => {
    const item = items[index];
    setCurrentItem(item);
    setNewItemSizes(item.sizes);
    setEditingIndex(index);
    setShowItemForm(true);

    const design = existingDesigns.find(d => d.design_no === item.design_no);
    if (design) {
      setSelectedDesignId(design.id);
      setItemMode('existing');
    } else {
      setItemMode('new');
    }
  };

  const addItemToList = () => {
    if (!currentItem.design_no || !currentItem.product_group) {
      setError('Please fill all required fields except color');
      return;
    }
    if (!currentItem.image_url) {
      setError('Please add a product image for this item');
      return;
    }

    const cost = parseFloat(currentItem.cost_per_item) || 0;
    const mrp = parseFloat(currentItem.mrp) || 0;
    const markup = parseFloat(currentItem.mrp_markup_percent) || 0;

    if (!cost || cost <= 0) {
      setError('Please enter a valid cost per item');
      return;
    }

    if (!mrp || mrp <= 0) {
      setError('Please enter a valid MRP');
      return;
    }

    const sizesWithQty = newItemSizes.filter(s => s.quantity > 0);
    if (sizesWithQty.length === 0) {
      setError('Please add at least one size with quantity');
      return;
    }

    const newItem = {
      ...currentItem,
      cost_per_item: cost,
      mrp: mrp,
      mrp_markup_percent: markup,
      sizes: sizesWithQty,
    } as PurchaseItem;

    if (editingIndex !== null) {
      const updatedItems = [...items];
      updatedItems[editingIndex] = newItem;
      setItems(updatedItems);
      setEditingIndex(null);
    } else {
      setItems([...items, newItem]);
    }

    setCurrentItem({
      design_no: '',
      product_group: '',
      color: '',
      sizes: [],
      cost_per_item: 0,
      mrp_markup_percent: 100,
      mrp: 0,
      gst_logic: 'AUTO_5_18',
      image_url: '',
      description: '',
      order_number: '',
    });
    setSelectedDesignId('');
    setNewItemSizes(sizes.map(s => ({ size: s.id, quantity: 0 })));
    setShowItemForm(false);
    setError('');
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const generateBarcodePreview = async () => {
    if (!selectedVendor || items.length === 0) {
      setError('Please add items before previewing barcodes');
      return;
    }

    try {
      const previews: BarcodePreview[] = [];
      const vendor = vendors.find(v => v.id === selectedVendor);
      const vendorCode = vendor?.vendor_code || 'VND';

      let previewCounter = 1;

      for (const item of items) {
        for (const sizeQty of item.sizes) {
          if (sizeQty.quantity <= 0) continue;

          const productGroup = productGroups.find(g => g.id === item.product_group);
          const color = colors.find(c => c.id === item.color);
          const size = sizes.find(s => s.id === sizeQty.size);

          const mockBarcodeNumber = String(previewCounter).padStart(8, '0');
          previewCounter++;

          const groupCode = productGroup?.group_code || 'PG';
          const colorCode = color?.color_code || '';
          const designPart = colorCode ? `${item.design_no}${colorCode}` : item.design_no;
          const encodedPrice = encodeCostForVendor(item.mrp, 'CRAZY WOMEN');
          const parts = [
            groupCode,
            designPart,
            vendorCode,
            encodedPrice,
            mockBarcodeNumber,
          ].filter(Boolean);
          const structuredBarcode = parts.join('-');

          previews.push({
            barcode_8digit: mockBarcodeNumber,
            barcode_structured: structuredBarcode,
            design_no: item.design_no,
            product_group: productGroup?.name || '',
            color: color?.name || '',
            size: size?.name || '',
            quantity: sizeQty.quantity,
            cost: item.cost_per_item,
            mrp: item.mrp,
            order_number: item.order_number || '',
          });
        }
      }

      setBarcodePreviewList(previews);
      setShowBarcodePreview(true);
      setError('');
    } catch (err: any) {
      console.error('Error generating preview:', err);
      setError('Failed to generate barcode preview: ' + err.message);
    }
  };

  const savePurchaseOrder = async () => {
    if (!selectedVendor) {
      setError('Please select a vendor');
      return;
    }

    if (items.length === 0) {
      setError('Please add at least one item');
      return;
    }

    if (!vendorInvoiceNumber) {
      setError('Please enter vendor invoice number');
      return;
    }

    if (!taxableValue) {
      setError('Please enter taxable value');
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

      const { count } = await supabase
        .from('purchase_orders')
        .select('*', { count: 'exact', head: true });

      const poNumber = `PI${new Date().getFullYear()}${String((count || 0) + 1).padStart(6, '0')}`;

      const totalAmount = calculateTotal();
      const totalItems = items.reduce((sum, item) => sum + getTotalQuantity(item), 0);
      const finalGST = parseFloat(manualGST || '0');

      const { data: po, error: poError } = await supabase
        .from('purchase_orders')
        .insert([{
          po_number: poNumber,
          vendor: selectedVendor,
          order_date: orderDate,
          invoice_number: vendorInvoiceNumber,
          total_items: totalItems,
          total_amount: totalAmount + finalGST,
          status: 'Pending',
          notes: notes,
          taxable_value: parseFloat(taxableValue),
          manual_gst_amount: finalGST !== calculatedGST ? finalGST : null,
          vendor_invoice_attachment: invoiceAttachment || null,
          gst_difference_reason: finalGST !== calculatedGST ? gstDifferenceReason : null,
          gst_type: gstType,
          created_by: userRecord?.id || null,
        }])
        .select()
        .single();

      if (poError) throw poError;

      const vendor = vendors.find(v => v.id === selectedVendor);
      const vendorCode = vendor?.vendor_code || 'VND';

      for (const item of items) {
        for (const sizeQty of item.sizes) {
          if (sizeQty.quantity <= 0) continue;

          const { error: itemError } = await supabase
            .from('purchase_items')
            .insert([{
              po_id: po.id,
              design_no: item.design_no,
              product_group: item.product_group,
              color: item.color,
              size: sizeQty.size,
              quantity: sizeQty.quantity,
              cost_per_item: item.cost_per_item,
              mrp: item.mrp,
              mrp_markup_percent: item.mrp_markup_percent,
              gst_logic: item.gst_logic,
              description: item.description,
              order_number: item.order_number || null,
            }]);

          if (itemError) throw itemError;

          const productGroup = productGroups.find(g => g.id === item.product_group);
          const color = colors.find(c => c.id === item.color);
          const floorId = productGroup?.floor_id;

          const { data: existingBatch } = await supabase
            .from('barcode_batches')
            .select('*')
            .eq('design_no', item.design_no)
            .eq('product_group', item.product_group)
            .eq('color', item.color)
            .eq('size', sizeQty.size)
            .eq('vendor', selectedVendor)
            .eq('cost_actual', item.cost_per_item)
            .eq('mrp', item.mrp)
            .eq('gst_logic', item.gst_logic)
            .maybeSingle();

          if (existingBatch) {
            await supabase
              .from('barcode_batches')
              .update({
                total_quantity: existingBatch.total_quantity + sizeQty.quantity,
                available_quantity: existingBatch.available_quantity + sizeQty.quantity,
                floor: floorId || existingBatch.floor,
                modified_by: userRecord?.id || null,
                updated_at: new Date().toISOString(),
              })
              .eq('id', existingBatch.id);
          } else {
            const { data: barcodeNumber } = await supabase.rpc('get_next_barcode_number');
            const barcodeString = String(barcodeNumber).padStart(8, '0');

            const groupCode = productGroup?.group_code || 'PG';
            const colorCode = color?.color_code || '';
            const designPart = colorCode ? `${item.design_no}${colorCode}` : item.design_no;
            const encodedPrice = encodeCostForVendor(item.mrp, 'CRAZY WOMEN');
            const parts = [
              groupCode,
              designPart,
              vendorCode,
              encodedPrice,
              barcodeString,
            ].filter(Boolean);
            const structuredBarcode = parts.join('-');

            await supabase
              .from('barcode_batches')
              .insert([{
                barcode_alias_8digit: barcodeString,
                barcode_structured: structuredBarcode,
                design_no: item.design_no,
                product_group: item.product_group,
                size: sizeQty.size,
                color: item.color,
                vendor: selectedVendor,
                cost_actual: item.cost_per_item,
                mrp: item.mrp,
                mrp_markup_percent: item.mrp_markup_percent,
                gst_logic: item.gst_logic,
                total_quantity: sizeQty.quantity,
                available_quantity: sizeQty.quantity,
                floor: floorId,
                status: 'active',
                po_id: po.id,
                photos: item.image_url ? [item.image_url] : [],
                description: item.description,
                order_number: item.order_number || null,
                created_by: userRecord?.id || null,
              }]);
          }
        }
      }

      setSuccess(`Purchase Invoice ${poNumber} created successfully! ${totalItems} items added to inventory.`);
      setSavedPOId(po.id);

      setItems([]);
      setTaxableValue('');
      setManualGST('');
      setVendorInvoiceNumber('');
      setInvoiceAttachment('');

      setTimeout(() => setSuccess(''), 5000);
    } catch (err: any) {
      console.error('Error saving purchase invoice:', err);
      setError(err.message || 'Failed to create purchase invoice');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBarcodes = () => {
    if (savedPOId) {
      try {
        sessionStorage.setItem('returnTo', '#purchase-invoice');
      } catch {}
      const printUrl = `${window.location.origin}${window.location.pathname}#barcode-print?po_id=${savedPOId}&auto=1`;
      window.location.assign(printUrl);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <FileText className="w-8 h-8 text-emerald-600 mr-3" />
            <div>
              <h2 className="text-3xl font-bold text-gray-800">Purchase Invoice</h2>
              <p className="text-sm text-gray-600">Create purchase orders and generate barcodes</p>
            </div>
          </div>
          {items.length > 0 && (
            <button
              onClick={generateBarcodePreview}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 flex items-center shadow-md"
            >
              <Eye className="w-5 h-5 mr-2" />
              Preview Barcodes
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="">Select Vendor</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name} ({v.vendor_code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Invoice Number <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={vendorInvoiceNumber}
              onChange={(e) => setVendorInvoiceNumber(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              placeholder="INV-2024-001"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Vendor Invoice Date
            </label>
            <input
              type="date"
              value={vendorInvoiceDate}
              onChange={(e) => setVendorInvoiceDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Order Date
            </label>
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Vendor Invoice Attachment
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={invoiceFileName || (invoiceAttachment ? 'Invoice uploaded' : '')}
              readOnly
              className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-50"
              placeholder="No invoice attached"
            />
            {invoiceAttachment && (
              <a
                href={invoiceAttachment}
                download={invoiceFileName || 'invoice'}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 flex items-center shadow-md"
              >
                <Eye className="w-5 h-5 mr-2" />
                View
              </a>
            )}
            <label className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 cursor-pointer flex items-center shadow-md">
              <Upload className="w-5 h-5 mr-2" />
              Upload
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={handleInvoiceUpload}
                className="hidden"
                disabled={uploadingInvoice}
              />
            </label>
          </div>
        </div>

        <div className="border-t-2 border-gray-200 pt-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold text-gray-800">Purchase Items</h3>
            <button
              onClick={() => {
                setShowItemForm(!showItemForm);
                setEditingIndex(null);
                setCurrentItem({
                  design_no: '',
                  product_group: '',
                  color: '',
                  sizes: [],
                  cost_per_item: 0,
                  mrp_markup_percent: 100,
                  mrp: 0,
                  gst_logic: 'AUTO_5_18',
                  image_url: '',
                  description: '',
                  order_number: '',
                });
                setNewItemSizes(sizes.map(s => ({ size: s.id, quantity: 0 })));
              }}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 flex items-center shadow-md"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Item
            </button>
          </div>

          {showItemForm && (
            <div className="bg-gradient-to-br from-gray-50 to-gray-100 p-6 rounded-lg mb-6 border-2 border-emerald-200 shadow-md">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-lg font-bold text-gray-800">
                  {editingIndex !== null ? 'Edit Item' : 'Add New Item'}
                </h4>
                <button
                  onClick={() => {
                    setShowItemForm(false);
                    setEditingIndex(null);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="mb-4">
                <div className="flex gap-4 mb-4">
                  <label className="flex items-center bg-white px-4 py-2 rounded-lg border-2 border-emerald-300 cursor-pointer hover:bg-emerald-50">
                    <input
                      type="radio"
                      value="existing"
                      checked={itemMode === 'existing'}
                      onChange={(e) => setItemMode(e.target.value as 'existing')}
                      className="mr-2 text-emerald-600"
                    />
                    <span className="font-medium text-gray-700">Select Existing Design</span>
                  </label>
                  <label className="flex items-center bg-white px-4 py-2 rounded-lg border-2 border-purple-300 cursor-pointer hover:bg-purple-50">
                    <input
                      type="radio"
                      value="new"
                      checked={itemMode === 'new'}
                      onChange={(e) => setItemMode(e.target.value as 'new')}
                      className="mr-2 text-purple-600"
                    />
                    <span className="font-medium text-gray-700">Create New Design</span>
                  </label>
                </div>

                {itemMode === 'existing' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Design
                    </label>
                    <select
                      value={selectedDesignId}
                      onChange={(e) => {
                        setSelectedDesignId(e.target.value);
                        handleExistingDesignSelect(e.target.value);
                      }}
                      className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                      disabled={!selectedVendor}
                    >
                      <option value="">Select Design</option>
                      {existingDesigns.map(design => (
                        <option key={design.id} value={design.id}>
                          {design.design_no} - {design.product_group.name} - {design.color.name}
                        </option>
                      ))}
                    </select>
                    {!selectedVendor && (
                      <p className="text-xs text-orange-600 mt-1">Please select a vendor first</p>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Design Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentItem.design_no}
                    onChange={(e) => setCurrentItem({ ...currentItem, design_no: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="DN458"
                    disabled={itemMode === 'existing'}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Group <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={currentItem.product_group}
                    onChange={(e) => setCurrentItem({ ...currentItem, product_group: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    disabled={itemMode === 'existing'}
                  >
                    <option value="">Select</option>
                    {productGroups.map(pg => (
                      <option key={pg.id} value={pg.id}>{pg.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color
                  </label>
                  <select
                    value={currentItem.color}
                    onChange={(e) => setCurrentItem({ ...currentItem, color: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    disabled={itemMode === 'existing'}
                  >
                    <option value="">Select</option>
                    {colors.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Number
                  </label>
                  <input
                    type="text"
                    value={currentItem.order_number}
                    onChange={(e) => setCurrentItem({ ...currentItem, order_number: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="Optional"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cost Per Item <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentItem.cost_per_item}
                    onChange={(e) => setCurrentItem({ ...currentItem, cost_per_item: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    MRP Markup % <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentItem.mrp_markup_percent}
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp_markup_percent: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                    placeholder="100"
                  />
                  <p className="text-xs text-gray-500 mt-1">Markup % before GST</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Calculated MRP (including GST)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={currentItem.mrp}
                    onChange={(e) => setCurrentItem({ ...currentItem, mrp: e.target.value })}
                    className="w-full px-4 py-2 border-2 border-emerald-300 rounded-lg bg-emerald-50 focus:ring-2 focus:ring-emerald-500"
                  />
                  <p className="text-xs text-emerald-600 mt-1">Auto: Cost × (1+Markup%) × (1+GST%)</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    GST Logic
                  </label>
                  <select
                    value={currentItem.gst_logic}
                    onChange={(e) => setCurrentItem({ ...currentItem, gst_logic: e.target.value as GSTType })}
                    className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="AUTO_5_18">AUTO (5% if &lt;2500, else 18%)</option>
                    <option value="FLAT_5">FLAT 5%</option>
                  </select>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description
                </label>
                <textarea
                  value={currentItem.description}
                  onChange={(e) => setCurrentItem({ ...currentItem, description: e.target.value })}
                  className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                  rows={2}
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product Image <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={currentItem.image_url ? 'Image added' : ''}
                      readOnly
                      className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg bg-gray-50"
                      placeholder="No image"
                    />
                    <label className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 cursor-pointer shadow-md flex items-center">
                      <Upload className="w-5 h-5 mr-2" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={openCamera}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-md"
                    >
                      Take Photo
                    </button>
                    <input
                      ref={hiddenCameraInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {currentItem.image_url && (
                    <div className="relative w-32 h-32 border-2 border-gray-300 rounded-lg overflow-hidden">
                      <img
                        src={currentItem.image_url}
                        alt="Product"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={clearImage}
                        title="Remove image"
                        className="absolute top-1 right-1 p-1 bg-white/80 rounded-full shadow hover:bg-white"
                      >
                        <X className="w-4 h-4 text-gray-700" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Size Quantities
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {newItemSizes.map((sq, idx) => {
                    const size = sizes.find(s => s.id === sq.size);
                    return (
                      <div key={sq.size}>
                        <label className="block text-xs font-medium text-gray-600 mb-1">{size?.name}</label>
                        <input
                          type="number"
                          min="0"
                          value={sq.quantity}
                          onChange={(e) => {
                            const updated = [...newItemSizes];
                            updated[idx].quantity = parseInt(e.target.value) || 0;
                            setNewItemSizes(updated);
                          }}
                          className="w-full px-2 py-1 border-2 border-gray-300 rounded focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowItemForm(false);
                    setEditingIndex(null);
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                >
                  Cancel
                </button>
                <button
                  onClick={addItemToList}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 shadow-md"
                >
                  {editingIndex !== null ? 'Update Item' : 'Add to List'}
                </button>
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-2 border-gray-200">
                <thead className="bg-gradient-to-r from-emerald-100 to-teal-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                    <th className="px-3 py-2 text-left text-xs font-bold text-gray-700 uppercase">Details</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Sizes/Qty</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">Cost (Taxable)</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Markup %</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">GST Rate</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                    <th className="px-3 py-2 text-right text-xs font-bold text-gray-700 uppercase">Total Cost</th>
                    <th className="px-3 py-2 text-center text-xs font-bold text-gray-700 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-gray-200">
                  {items.map((item, idx) => {
                    const totalQty = getTotalQuantity(item);
                    const totalCost = item.cost_per_item * totalQty;
                    const gstRate = item.gst_logic === 'FLAT_5' ? '5%' : (item.mrp < 2500 ? '5%' : '18%');

                    return (
                      <tr key={idx} className="hover:bg-emerald-50 transition-colors">
                        <td className="px-3 py-3">
                          <div className="font-bold text-gray-800">{item.design_no}</div>
                          {item.order_number && (
                            <div className="text-xs text-orange-600 font-semibold">Order: {item.order_number}</div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-sm">
                          <div>{productGroups.find(pg => pg.id === item.product_group)?.name}</div>
                          <div className="text-gray-600">{colors.find(c => c.id === item.color)?.name}</div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {item.sizes.map((sq, sqIdx) => (
                              <span key={sqIdx} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-semibold">
                                {sizes.find(s => s.id === sq.size)?.name}: {sq.quantity}
                              </span>
                            ))}
                          </div>
                          <div className="text-sm font-bold text-gray-700 mt-1">Total: {totalQty}</div>
                        </td>
                        <td className="px-3 py-3 text-right font-semibold">₹{item.cost_per_item.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center font-semibold text-purple-700">{item.mrp_markup_percent}%</td>
                        <td className="px-3 py-3 text-center">
                          <span className={`px-2 py-1 rounded text-xs font-bold ${
                            gstRate === '5%' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                          }`}>
                            {gstRate}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-700">₹{item.mrp.toFixed(2)}</td>
                        <td className="px-3 py-3 text-right font-bold text-gray-800">₹{totalCost.toFixed(2)}</td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => editItem(idx)}
                              className="text-emerald-600 hover:text-emerald-700 p-1"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => removeItem(idx)}
                              className="text-red-600 hover:text-red-700 p-1"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="border-t-2 border-gray-200 pt-6 mb-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">GST Calculation</h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GST Type <span className="text-red-500">*</span>
              </label>
              <select
                value={gstType}
                onChange={(e) => setGstType(e.target.value as GSTTransactionType)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                title="Select GST Type: CGST+SGST for same state, IGST for different state"
              >
                <option value="CGST_SGST">CGST + SGST</option>
                <option value="IGST">IGST</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Taxable Value (Auto-Calculated) <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={taxableValue ? `₹${parseFloat(taxableValue).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'}
                readOnly
                className="w-full px-4 py-2 border-2 border-emerald-300 rounded-lg bg-emerald-50 font-bold"
                placeholder="Add items to calculate"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calculated GST
              </label>
              <input
                type="text"
                value={`₹${calculatedGST.toFixed(2)}`}
                readOnly
                className="w-full px-4 py-2 border-2 border-emerald-300 rounded-lg bg-emerald-50 font-bold"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Manual GST Override
              </label>
              <input
                type="number"
                step="0.01"
                value={manualGST}
                onChange={(e) => setManualGST(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                placeholder="Override GST"
              />
            </div>
          </div>

          {parseFloat(manualGST || '0') !== calculatedGST && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for GST Difference
              </label>
              <textarea
                value={gstDifferenceReason}
                onChange={(e) => setGstDifferenceReason(e.target.value)}
                className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                rows={2}
                placeholder="Explain why GST was manually adjusted"
              />
            </div>
          )}
        </div>

        <div className="border-t-2 border-gray-200 pt-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
            rows={3}
          />
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-lg mb-6 border-2 border-emerald-200 shadow-md">
          <div className="flex justify-between text-lg font-semibold text-gray-700">
            <span>Total Items:</span>
            <span className="text-emerald-700">{items.reduce((sum, item) => sum + getTotalQuantity(item), 0)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold text-gray-700 mt-2">
            <span>Subtotal:</span>
            <span className="text-emerald-700">₹{calculateTotal().toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-lg font-semibold text-gray-700 mt-2">
            <span>GST:</span>
            <span className="text-emerald-700">₹{parseFloat(manualGST || '0').toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-2xl font-bold text-emerald-700 border-t-2 border-emerald-300 mt-3 pt-3">
            <span>Grand Total:</span>
            <span>₹{(calculateTotal() + parseFloat(manualGST || '0')).toFixed(2)}</span>
          </div>
        </div>

        {error && (
          <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-300 text-red-700 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-300 text-green-700 p-4 rounded-lg mb-6">
            {success}
            {savedPOId && (
              <button
                onClick={handlePrintBarcodes}
                className="ml-4 px-4 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 inline-flex items-center shadow-md"
              >
                <Printer className="w-4 h-4 mr-2" />
                Print Barcodes
              </button>
            )}
          </div>
        )}

        <div className="flex justify-end gap-4">
          {items.length > 0 && (
            <button
              onClick={generateBarcodePreview}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 flex items-center text-lg font-semibold shadow-lg"
            >
              <Eye className="w-5 h-5 mr-2" />
              Preview Barcodes
            </button>
          )}
          <button
            onClick={savePurchaseOrder}
            disabled={loading}
            className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 disabled:from-gray-400 disabled:to-gray-500 flex items-center text-lg font-semibold shadow-lg"
          >
            <Save className="w-5 h-5 mr-2" />
            {loading ? 'Saving...' : 'Save Purchase Order'}
          </button>
        </div>
      </div>

      {cameraOpen && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 w-[92vw] max-w-md">
            <div className="aspect-video bg-black rounded overflow-hidden">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-3 flex gap-3 justify-center">
              <button
                type="button"
                onClick={capturePhoto}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
              >
                Capture
              </button>
              <button
                type="button"
                onClick={closeCamera}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
            {cameraError && (
              <div className="text-red-600 text-sm mt-2 text-center">
                {cameraError}
              </div>
            )}
          </div>
        </div>
      )}

      {showBarcodePreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6 flex justify-between items-center">
              <h3 className="text-2xl font-bold text-white">Barcode Preview</h3>
              <button
                onClick={() => setShowBarcodePreview(false)}
                className="text-white hover:text-gray-200"
              >
                <X className="w-8 h-8" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-100px)]">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-100 to-gray-200">
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Barcode Image</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">8-Digit Code</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Structured Barcode</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Design</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Details</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Qty</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">Cost</th>
                      <th className="border-2 border-gray-300 p-3 text-left font-bold">MRP</th>
                    </tr>
                  </thead>
                  <tbody>
                    {barcodePreviewList.map((preview, idx) => {
                      const barcodeImageURL = generateBarcodeDataURL(preview.barcode_structured, {
                        width: 2,
                        height: 50,
                        displayValue: false,
                      });

                      return (
                        <tr key={idx} className="hover:bg-purple-50 transition-colors">
                          <td className="border-2 border-gray-300 p-3">
                            <div className="bg-white p-2 rounded border border-gray-200 flex justify-center items-center min-h-[60px]">
                              {barcodeImageURL ? (
                                <img src={barcodeImageURL} alt="Barcode" className="max-w-full h-auto" />
                              ) : (
                                <span className="text-xs text-red-500">Error</span>
                              )}
                            </div>
                          </td>
                          <td className="border-2 border-gray-300 p-3">
                            <span className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1 rounded-lg font-bold text-lg">
                              {preview.barcode_8digit}
                            </span>
                          </td>
                          <td className="border-2 border-gray-300 p-3 text-sm font-mono">{preview.barcode_structured}</td>
                          <td className="border-2 border-gray-300 p-3 font-bold">{preview.design_no}</td>
                          <td className="border-2 border-gray-300 p-3 text-sm">
                            <div>{preview.product_group}</div>
                            <div className="text-gray-600">{preview.color} - {preview.size}</div>
                            {preview.order_number && <div className="text-orange-600 font-semibold">Order: {preview.order_number}</div>}
                          </td>
                          <td className="border-2 border-gray-300 p-3 text-center font-bold">{preview.quantity}</td>
                          <td className="border-2 border-gray-300 p-3 text-right font-semibold">₹{preview.cost}</td>
                          <td className="border-2 border-gray-300 p-3 text-right font-semibold">₹{preview.mrp}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
