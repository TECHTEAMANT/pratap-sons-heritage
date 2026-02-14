import { supabase } from '../lib/supabase';

const CRAZYWOMEN_MAP: Record<string, string> = {
  '0': 'C', '1': 'R', '2': 'A', '3': 'Z', '4': 'Y',
  '5': 'W', '6': 'O', '7': 'M', '8': 'E', '9': 'N'
};

export function encodeCost(cost: number): string {
  const costStr = Math.floor(cost).toString();
  return costStr.split('').map(digit => CRAZYWOMEN_MAP[digit] || digit).join('');
}

export async function generateUniqueOrderNumber(): Promise<string> {
  const { count } = await supabase
    .from('product_items')
    .select('*', { count: 'exact', head: true });

  const orderNum = (count || 0) + 1;
  return `ORD${orderNum.toString().padStart(6, '0')}`;
}

export async function generateBarcodeForItem(itemData: {
  productGroupId: string;
  colorId: string;
  sizeId: string;
  designNo: string;
  vendorId: string;
  cost: number;
  payoutCode?: string;
}): Promise<string> {
  const [pgData, colorData, sizeData, vendorData] = await Promise.all([
    supabase.from('product_groups').select('group_code').eq('id', itemData.productGroupId).single(),
    supabase.from('colors').select('color_code').eq('id', itemData.colorId).single(),
    supabase.from('sizes').select('size_code').eq('id', itemData.sizeId).single(),
    supabase.from('vendors').select('vendor_code').eq('id', itemData.vendorId).single(),
  ]);

  if (pgData.error || colorData.error || sizeData.error || vendorData.error) {
    throw new Error('Failed to fetch master data for barcode generation');
  }

  const costEncoded = encodeCost(itemData.cost);
  const orderNumber = await generateUniqueOrderNumber();

  const parts = [
    pgData.data.group_code,
    colorData.data.color_code,
    sizeData.data.size_code,
    itemData.designNo,
    vendorData.data.vendor_code,
    costEncoded,
    orderNumber,
  ];

  if (itemData.payoutCode) {
    parts.push(itemData.payoutCode);
  }

  return parts.join('-');
}
