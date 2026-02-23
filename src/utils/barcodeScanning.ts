import { supabase } from '../lib/supabase';

export interface BarcodeInfo {
  barcode_8digit: string;
  barcode_structured: string;
  design_no: string;
  product_group: string;
  product_group_name: string;
  color: string;
  color_name: string;
  size: string;
  size_name: string;
  vendor: string;
  vendor_name: string;
  vendor_code: string;
  cost_actual: number;
  mrp: number;
  mrp_markup_percent: number;
  gst_logic: string;
  available_quantity: number;
  total_quantity: number;
  floor: string;
  floor_name: string;
  order_number: string | null;
  photos: string[];
  description: string;
  status: string;
  discount_type: string | null;
  discount_value: number | null;
  discount_start_date: string | null;
  discount_end_date: string | null;
  hsn_code: string | null;
}

export async function scanBarcode(code: string): Promise<BarcodeInfo | null> {
  try {
    const { data, error } = await supabase
      .from('barcode_batches')
      .select(`
        *,
        product_group:product_groups(id, name, group_code, hsn_code),
        color:colors(id, name, color_code),
        size:sizes(id, name, size_code),
        vendor:vendors(id, name, vendor_code),
        floor:floors(id, name, floor_code),
        hsn_code
      `)
      .eq('barcode_alias_8digit', code)
      .eq('status', 'active')
      .maybeSingle();

    if (error) {
      console.error('Error scanning barcode:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      barcode_8digit: data.barcode_alias_8digit,
      barcode_structured: data.barcode_structured,
      design_no: data.design_no,
      product_group: data.product_group,
      product_group_name: data.product_group?.name || '',
      color: data.color,
      color_name: data.color?.name || '',
      size: data.size,
      size_name: data.size?.name || '',
      vendor: data.vendor,
      vendor_name: data.vendor?.name || '',
      vendor_code: data.vendor?.vendor_code || '',
      cost_actual: data.cost_actual,
      mrp: data.mrp,
      mrp_markup_percent: data.mrp_markup_percent || 100,
      gst_logic: data.gst_logic,
      available_quantity: data.available_quantity,
      total_quantity: data.total_quantity,
      floor: data.floor?.id,
      floor_name: data.floor?.name || '',
      order_number: data.order_number,
      photos: data.photos || [],
      description: data.description || '',
      status: data.status,
      discount_type: data.discount_type || null,
      discount_value: data.discount_value || null,
      discount_start_date: data.discount_start_date || null,
      discount_end_date: data.discount_end_date || null,
      hsn_code: data.hsn_code || data.product_group?.hsn_code || null,
    };
  } catch (err) {
    console.error('Error in scanBarcode:', err);
    return null;
  }
}

export async function updateBarcodeQuantity(barcode_8digit: string, quantityChange: number): Promise<boolean> {
  try {
    const { data: batch } = await supabase
      .from('barcode_batches')
      .select('available_quantity')
      .eq('barcode_alias_8digit', barcode_8digit)
      .maybeSingle();

    if (!batch) return false;

    const newQuantity = batch.available_quantity + quantityChange;

    if (newQuantity < 0) {
      console.error('Insufficient quantity');
      return false;
    }

    const { error } = await supabase
      .from('barcode_batches')
      .update({ available_quantity: newQuantity })
      .eq('barcode_alias_8digit', barcode_8digit);

    return !error;
  } catch (err) {
    console.error('Error updating quantity:', err);
    return false;
  }
}

export async function getAvailableBarcodes(filters?: {
  vendor?: string;
  product_group?: string;
  design_no?: string;
  order_number?: string;
  floor?: string;
}): Promise<BarcodeInfo[]> {
  try {
    let query = supabase
      .from('barcode_batches')
      .select(`
        *,
        product_group:product_groups(id, name, group_code, hsn_code),
        color:colors(id, name, color_code),
        size:sizes(id, name, size_code),
        vendor:vendors(id, name, vendor_code),
        floor:floors(id, name, floor_code),
        hsn_code
      `)
      .eq('status', 'active')
      .gt('available_quantity', 0);

    if (filters?.vendor) {
      query = query.eq('vendor', filters.vendor);
    }
    if (filters?.product_group) {
      query = query.eq('product_group', filters.product_group);
    }
    if (filters?.design_no) {
      query = query.eq('design_no', filters.design_no);
    }
    if (filters?.order_number) {
      query = query.eq('order_number', filters.order_number);
    }
    if (filters?.floor) {
      query = query.eq('floor', filters.floor);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching barcodes:', error);
      return [];
    }

    return (data || []).map(item => ({
      barcode_8digit: item.barcode_alias_8digit,
      barcode_structured: item.barcode_structured,
      design_no: item.design_no,
      product_group: item.product_group,
      product_group_name: item.product_group?.name || '',
      color: item.color,
      color_name: item.color?.name || '',
      size: item.size,
      size_name: item.size?.name || '',
      vendor: item.vendor,
      vendor_name: item.vendor?.name || '',
      vendor_code: item.vendor?.vendor_code || '',
      cost_actual: item.cost_actual,
      mrp: item.mrp,
      mrp_markup_percent: item.mrp_markup_percent || 100,
      gst_logic: item.gst_logic,
      available_quantity: item.available_quantity,
      total_quantity: item.total_quantity,
      floor: item.floor?.id,
      floor_name: item.floor?.name || '',
      order_number: item.order_number,
      photos: item.photos || [],
      description: item.description || '',
      status: item.status,
      discount_type: item.discount_type || null,
      discount_value: item.discount_value || null,
      discount_start_date: item.discount_start_date || null,
      discount_end_date: item.discount_end_date || null,
      hsn_code: item.hsn_code || item.product_group?.hsn_code || null,
    }));
  } catch (err) {
    console.error('Error in getAvailableBarcodes:', err);
    return [];
  }
}
