export interface TallyInvoiceItem {
  item_id: string;
  barcode_id: string;
  description: string;
  hsn_code: string;
  quantity: number;
  mrp: number;
  discount: number;
  taxable_value: number;
  gst_percentage: number;
  cgst_amount: number;
  sgst_amount: number;
  total_value: number;
}

export interface TallyProductGroup {
  product_group_id: string;
  product_group_code: string;
  product_group_name: string;
  hsn_code: string;
  items: TallyInvoiceItem[];
  total_quantity: number;
  total_taxable_value: number;
  total_cgst: number;
  total_sgst: number;
  total_value: number;
}

export interface TallyInvoiceExport {
  invoice_id: string;
  invoice_number: string;
  invoice_date: string;
  customer: {
    name: string;
    mobile: string;
    gstin?: string;
    place_of_supply?: string;
  };
  product_groups: TallyProductGroup[];
  totals: {
    total_mrp: number;
    total_discount: number;
    total_taxable_value: number;
    total_cgst_5: number;
    total_sgst_5: number;
    total_cgst_18: number;
    total_sgst_18: number;
    total_gst: number;
    round_off: number;
    net_payable: number;
  };
  payment: {
    mode: string;
    loyalty_points_redeemed: number;
    loyalty_amount_redeemed: number;
  };
}

export async function generateTallyExportData(invoiceData: any): Promise<TallyInvoiceExport> {
  const productGroupsMap: { [key: string]: TallyProductGroup } = {};

  invoiceData.sales_invoice_items.forEach((item: any) => {
    const productGroupId = item.product_items?.product_group || '';
    const productGroupCode = item.product_items?.product_groups?.group_code || '';
    const productGroupName = item.product_items?.product_groups?.name || '';
    const hsnCode = item.hsn_code || item.product_items?.product_groups?.hsn_code || '';

    if (!productGroupsMap[productGroupId]) {
      productGroupsMap[productGroupId] = {
        product_group_id: productGroupId,
        product_group_code: productGroupCode,
        product_group_name: productGroupName,
        hsn_code: hsnCode,
        items: [],
        total_quantity: 0,
        total_taxable_value: 0,
        total_cgst: 0,
        total_sgst: 0,
        total_value: 0,
      };
    }

    const tallyItem: TallyInvoiceItem = {
      item_id: item.item_id,
      barcode_id: item.product_items?.barcode_id || '',
      description: item.product_description || '',
      hsn_code: hsnCode,
      quantity: item.quantity || 1,
      mrp: parseFloat(item.mrp || 0),
      discount: parseFloat(item.discount || 0),
      taxable_value: parseFloat(item.taxable_value || 0),
      gst_percentage: parseFloat(item.gst_percentage || 0),
      cgst_amount: parseFloat(item.cgst_amount || 0),
      sgst_amount: parseFloat(item.sgst_amount || 0),
      total_value: parseFloat(item.total_value || 0),
    };

    productGroupsMap[productGroupId].items.push(tallyItem);
    productGroupsMap[productGroupId].total_quantity += tallyItem.quantity;
    productGroupsMap[productGroupId].total_taxable_value += tallyItem.taxable_value;
    productGroupsMap[productGroupId].total_cgst += tallyItem.cgst_amount;
    productGroupsMap[productGroupId].total_sgst += tallyItem.sgst_amount;
    productGroupsMap[productGroupId].total_value += tallyItem.total_value;
  });

  const productGroups = Object.values(productGroupsMap);

  const tallyExport: TallyInvoiceExport = {
    invoice_id: invoiceData.id,
    invoice_number: invoiceData.invoice_number,
    invoice_date: invoiceData.invoice_date,
    customer: {
      name: invoiceData.customer_name || '',
      mobile: invoiceData.customer_mobile || '',
      gstin: invoiceData.customer_gstin || undefined,
      place_of_supply: invoiceData.place_of_supply || undefined,
    },
    product_groups: productGroups,
    totals: {
      total_mrp: parseFloat(invoiceData.total_mrp || 0),
      total_discount: parseFloat(invoiceData.total_discount || 0),
      total_taxable_value: parseFloat(invoiceData.taxable_value || 0),
      total_cgst_5: parseFloat(invoiceData.cgst_5 || 0),
      total_sgst_5: parseFloat(invoiceData.sgst_5 || 0),
      total_cgst_18: parseFloat(invoiceData.cgst_18 || 0),
      total_sgst_18: parseFloat(invoiceData.sgst_18 || 0),
      total_gst: parseFloat(invoiceData.total_gst || 0),
      round_off: parseFloat(invoiceData.round_off || 0),
      net_payable: parseFloat(invoiceData.net_payable || 0),
    },
    payment: {
      mode: invoiceData.payment_mode || '',
      loyalty_points_redeemed: parseFloat(invoiceData.loyalty_points_redeemed || 0),
      loyalty_amount_redeemed: parseFloat(invoiceData.loyalty_amount_redeemed || 0),
    },
  };

  return tallyExport;
}

export interface TallyPurchaseItem {
  _id: string;
  name: string;
  ledger: string;
  hsn: string;
  quantity: number;
  rate: number;
  tax: number;
  discount: number;
  godown: string;
  amount: number;
  uqc: string;
  cess: number | null;
  description: string | null;
}

export interface TallyPurchaseExport {
  data: {
    conversionRate: {
      conversionType: string;
      rate: number | null;
    };
    createdBy: {
      role: string;
      _id: string;
    };
    isOptional: boolean;
    currency: string;
    currencySymbol: string;
    tallySync: boolean;
    isTdsSynced: null;
    syncSource: null;
    status: string;
    isDeleted: boolean;
    uploadUrl: string;
    originSource: string;
    _id: string;
    company: string;
    amount: number;
    invoiceType: string;
    voucherType: string;
    invoiceNumber: string;
    invoiceDate: string;
    dueDate: string;
    placeOfSupply: string;
    supplier: string;
    supplierGst: string;
    items: TallyPurchaseItem[];
    additionalItems: any[];
    otherLedger: any[];
    referenceNumber: string;
    referenceDate: string | null;
    otherReference: string;
    purchaseOrderNumber: string;
    purchaseOrderDate: string | null;
    termsOfPayment: string;
    deliveryDocNo: string;
    deliveryDocDate: string | null;
    dispatchDocDate: string | null;
    dispatchedDocNumber: string;
    dispatchedThrough: string;
    destination: string;
    termsOfDelivery: string;
    vesselFlightNo: string;
    billEntryNo: string;
    billEntryDate: string | null;
    portCode: string;
    portLoading: string;
    portDischarge: string;
    countryTo: string;
    placeOfReceiptByShipper: string;
    pincodeConsignor: number | null;
    pincodeConsignee: number | null;
    eWayBillNo: string;
    distance: number;
    dispatchFrom: string;
    shipTo: string;
    mode: string;
    transporterName: string;
    transporterId: string;
    vehicleNo: string;
    narration: string;
    termsAndCondition: string;
    BillAllocation: any[];
    createdAt: string;
    updatedAt: string;
    __v: number;
  };
  success: boolean;
  msg: string;
}

export async function generatePurchaseTallyExportData(purchaseOrderData: any): Promise<TallyPurchaseExport> {
  const itemsGroupedByProductGroup: { [key: string]: any } = {};

  if (purchaseOrderData.purchase_items) {
    purchaseOrderData.purchase_items.forEach((item: any) => {
      // Support both pre-mapped items (from purchase_items table with joins)
      // and raw items (from purchase_order_items table)
      const productGroupId = item.product_group || item.product_groups?.name || 'unknown';
      const productGroupName = item.product_groups?.name || item.product_description || 'Unknown';
      const hsnCode = item.product_groups?.hsn_code || '';

      if (!itemsGroupedByProductGroup[productGroupId]) {
        itemsGroupedByProductGroup[productGroupId] = {
          name: productGroupName,
          hsn: hsnCode,
          quantity: 0,
          totalCost: 0,
          items: [],
        };
      }

      itemsGroupedByProductGroup[productGroupId].quantity += item.quantity || 0;
      itemsGroupedByProductGroup[productGroupId].totalCost += parseFloat(item.total_cost || 0);
      itemsGroupedByProductGroup[productGroupId].items.push(item);
    });
  }

  const tallyItems: TallyPurchaseItem[] = Object.values(itemsGroupedByProductGroup).map((group: any) => {
    const avgRate = group.quantity > 0 ? group.totalCost / group.quantity : 0;

    return {
      _id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: group.name,
      ledger: purchaseOrderData.vendors?.name || '',
      hsn: group.hsn || '',
      quantity: group.quantity,
      rate: parseFloat(avgRate.toFixed(2)),
      tax: 0,
      discount: 0,
      godown: 'Main Location',
      amount: parseFloat(group.totalCost.toFixed(2)),
      uqc: 'PCS',
      cess: null,
      description: null,
    };
  });

  const totalAmount = parseFloat(purchaseOrderData.total_amount || 0);

  const tallyExport: TallyPurchaseExport = {
    data: {
      conversionRate: {
        conversionType: '$',
        rate: null,
      },
      createdBy: {
        role: 'client',
        _id: purchaseOrderData.created_by || '',
      },
      isOptional: false,
      currency: '$',
      currencySymbol: 'INR',
      tallySync: false,
      isTdsSynced: null,
      syncSource: null,
      status: 'pending',
      isDeleted: false,
      uploadUrl: '',
      originSource: 'Manual',
      _id: purchaseOrderData.id,
      company: '',
      amount: totalAmount,
      invoiceType: 'goods',
      voucherType: 'Purchase',
      invoiceNumber: purchaseOrderData.invoice_number || purchaseOrderData.po_number,
      invoiceDate: purchaseOrderData.order_date,
      dueDate: purchaseOrderData.order_date,
      placeOfSupply: '',
      supplier: purchaseOrderData.vendors?.name || '',
      supplierGst: '',
      items: tallyItems,
      additionalItems: [],
      otherLedger: [],
      referenceNumber: purchaseOrderData.po_number || '',
      referenceDate: null,
      otherReference: '',
      purchaseOrderNumber: purchaseOrderData.po_number || '',
      purchaseOrderDate: purchaseOrderData.order_date,
      termsOfPayment: '',
      deliveryDocNo: '',
      deliveryDocDate: null,
      dispatchDocDate: null,
      dispatchedDocNumber: '',
      dispatchedThrough: '',
      destination: '',
      termsOfDelivery: '',
      vesselFlightNo: '',
      billEntryNo: '',
      billEntryDate: null,
      portCode: '',
      portLoading: '',
      portDischarge: '',
      countryTo: '',
      placeOfReceiptByShipper: '',
      pincodeConsignor: null,
      pincodeConsignee: null,
      eWayBillNo: '',
      distance: 0,
      dispatchFrom: '',
      shipTo: '',
      mode: '',
      transporterName: '',
      transporterId: '',
      vehicleNo: '',
      narration: '',
      termsAndCondition: '',
      BillAllocation: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      __v: 0,
    },
    success: true,
    msg: 'Invoice created succesfully',
  };

  return tallyExport;
}

export function downloadTallyJSON(data: any, filename?: string) {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `tally-export.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
