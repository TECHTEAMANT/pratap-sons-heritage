import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BarChart3, Package, TrendingDown, DollarSign, FileText, Download, ShoppingCart, Users, TrendingUp, Archive, AlertTriangle, UserCheck, ArrowUp, ArrowDown } from 'lucide-react';
import SalesmanReport from './SalesmanReport';
import SalesInvoicePDF from './SalesInvoicePDF';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('sales-summary');
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedVendor, setSelectedVendor] = useState('');
  const [selectedFloor, setSelectedFloor] = useState('');
  const [sortField, setSortField] = useState<string>('invoice_date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const [vendors, setVendors] = useState<any[]>([]);
  const [floors, setFloors] = useState<any[]>([]);

  const [salesSummary, setSalesSummary] = useState<any>(null);
  const [purchaseSummary, setPurchaseSummary] = useState<any>(null);
  const [inventoryAnalysis, setInventoryAnalysis] = useState<any[]>([]);
  const [profitabilityData, setProfitabilityData] = useState<any>(null);
  const [profitabilityDetails, setProfitabilityDetails] = useState<any[]>([]);
  const [topSellingItems, setTopSellingItems] = useState<any[]>([]);
  const [slowMovingStock, setSlowMovingStock] = useState<any[]>([]);
  const [customerAnalysis, setCustomerAnalysis] = useState<any[]>([]);
  const [floorwiseSales, setFloorwiseSales] = useState<any[]>([]);
  const [pendingPayments, setPendingPayments] = useState<any[]>([]);
  const [salesDetails, setSalesDetails] = useState<any[]>([]);
  const [purchaseDetails, setPurchaseDetails] = useState<any[]>([]);
  const [paymentReceipts, setPaymentReceipts] = useState<Record<string, any[]>>({});
  const [defectiveStock, setDefectiveStock] = useState<any[]>([]);
  const [productGroupAnalysis, setProductGroupAnalysis] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    loadReportData();
  }, [activeTab, startDate, endDate, selectedVendor, selectedFloor, sortField, sortDirection]);

  const loadMasterData = async () => {
    try {
      const [vendorsRes, floorsRes] = await Promise.all([
        supabase.from('vendors').select('*').eq('active', true).order('name'),
        supabase.from('floors').select('*').eq('active', true).order('name'),
      ]);

      setVendors(vendorsRes.data || []);
      setFloors(floorsRes.data || []);
    } catch (err) {
      console.error('Error loading master data:', err);
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'sales-summary':
          await loadSalesSummary();
          break;
        case 'purchase-summary':
          await loadPurchaseSummary();
          break;
        case 'inventory-analysis':
          await loadInventoryAnalysis();
          break;
        case 'profitability':
          await loadProfitability();
          break;
        case 'top-selling':
          await loadTopSellingItems();
          break;
        case 'slow-moving':
          await loadSlowMovingStock();
          break;
        case 'customer-analysis':
          await loadCustomerAnalysis();
          break;
        case 'floorwise-sales':
          await loadFloorwiseSales();
          break;
        case 'pending-payments':
          await loadPendingPayments();
          break;
        case 'defective-stock':
          await loadDefectiveStock();
          break;
        case 'product-group-analysis':
          await loadProductGroupAnalysis();
          break;
      }
    } catch (err) {
      console.error('Error loading report data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadSalesSummary = async () => {
    const { data: salesData } = await supabase
      .from('sales_invoices')
      .select('*')
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate);

    if (!salesData) {
      setSalesSummary(null);
      setSalesDetails([]);
      return;
    }

    const sortedData = sortData(salesData, sortField, sortDirection);

    const totalSales = salesData.reduce((sum, inv) => sum + (inv.net_payable || 0), 0);
    const totalMRP = salesData.reduce((sum, inv) => sum + (inv.total_mrp || 0), 0);
    const totalDiscount = salesData.reduce((sum, inv) => sum + (inv.total_discount || 0), 0);
    const totalGST = salesData.reduce((sum, inv) => sum + (inv.total_gst || 0), 0);
    const taxableValue = salesData.reduce((sum, inv) => sum + (inv.taxable_value || 0), 0);

    setSalesSummary({
      totalSales,
      totalMRP,
      totalDiscount,
      totalGST,
      taxableValue,
      invoiceCount: salesData.length,
      avgInvoiceValue: salesData.length > 0 ? totalSales / salesData.length : 0,
      cgst_5: salesData.reduce((sum, inv) => sum + (inv.cgst_5 || 0), 0),
      sgst_5: salesData.reduce((sum, inv) => sum + (inv.sgst_5 || 0), 0),
      cgst_18: salesData.reduce((sum, inv) => sum + (inv.cgst_18 || 0), 0),
      sgst_18: salesData.reduce((sum, inv) => sum + (inv.sgst_18 || 0), 0),
    });

    setSalesDetails(sortedData);
  };

  const sortData = (data: any[], field: string, direction: 'asc' | 'desc') => {
    return [...data].sort((a, b) => {
      let aVal = a[field];
      let bVal = b[field];

      if (field === 'invoice_date') {
        aVal = new Date(aVal).getTime();
        bVal = new Date(bVal).getTime();
      } else if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal.toLowerCase();
      }

      if (direction === 'asc') {
        return aVal > bVal ? 1 : -1;
      } else {
        return aVal < bVal ? 1 : -1;
      }
    });
  };

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const downloadInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
  };

  const loadPurchaseSummary = async () => {
    let query = supabase
      .from('purchase_orders')
      .select(`
        *,
        vendor:vendors(name)
      `)
      .gte('order_date', startDate)
      .lte('order_date', endDate)
      .neq('status', 'Pending') // Exclude pending/unsaved orders
      .order('order_date', { ascending: false });

    if (selectedVendor) {
      query = query.eq('vendor', selectedVendor);
    }

    const { data: purchaseData } = await query;

    if (!purchaseData) {
      setPurchaseSummary(null);
      setPurchaseDetails([]);
      return;
    }

    const totalPurchase = purchaseData.reduce(
      (sum, po) => sum + (po.total_amount || 0),
      0
    );
    const totalItems = purchaseData.reduce(
      (sum, po) => sum + (po.total_items || 0),
      0
    );
    const totalGST = purchaseData.reduce((sum, po) => {
      const taxable = po.taxable_value || 0;
      const total = po.total_amount || 0;
      const gst = Math.max(0, total - taxable);
      return sum + gst;
    }, 0);

    setPurchaseSummary({
      totalPurchase,
      totalItems,
      totalGST,
      poCount: purchaseData.length,
      avgPOValue: purchaseData.length > 0 ? totalPurchase / purchaseData.length : 0,
    });

    setPurchaseDetails(purchaseData);
  };

  const loadInventoryAnalysis = async () => {
    let query = supabase
      .from('barcode_batches')
      .select(`
        *,
        product_group:product_groups(name),
        vendor:vendors(name),
        floor:floors(name)
      `)
      .eq('status', 'active');

    if (selectedVendor) {
      query = query.eq('vendor', selectedVendor);
    }

    if (selectedFloor) {
      query = query.eq('floor', selectedFloor);
    }

    const { data } = await query;

    if (!data) {
      setInventoryAnalysis([]);
      return;
    }

    const analysis = data.map(item => ({
      barcode: item.barcode_alias_8digit,
      design: item.design_no,
      productGroup: item.product_group?.name || '',
      vendor: item.vendor?.name || '',
      floor: item.floor?.name || '',
      totalQty: item.total_quantity,
      availableQty: item.available_quantity,
      soldQty: item.total_quantity - item.available_quantity,
      cost: item.cost_actual,
      mrp: item.mrp,
      inventoryValue: item.available_quantity * item.cost_actual,
      potentialRevenue: item.available_quantity * item.mrp,
      profit: item.available_quantity * (item.mrp - item.cost_actual),
    }));

    setInventoryAnalysis(analysis);
  };

  const loadProfitability = async () => {
    const { data: salesData } = await supabase
      .from('sales_invoice_items')
      .select(`
        *,
        sales_invoice:sales_invoices!inner(invoice_number, invoice_date, customer_name, net_payable)
      `)
      .gte('sales_invoice.invoice_date', startDate)
      .lte('sales_invoice.invoice_date', endDate);

    if (!salesData || salesData.length === 0) {
      setProfitabilityData(null);
      setProfitabilityDetails([]);
      return;
    }

    let totalCost = 0;
    let totalRevenue = 0;
    let totalMRP = 0;
    let totalDiscount = 0;
    const detailsList = [];

    for (const item of salesData) {
      const { data: barcodeData } = await supabase
        .from('barcode_batches')
        .select('cost_actual')
        .eq('barcode_alias_8digit', item.barcode_8digit)
        .maybeSingle();

      const cost = barcodeData?.cost_actual || 0;
      const itemCost = cost * (item.quantity || 1);
      const revenue = item.selling_price || 0;
      const mrp = item.mrp || 0;
      const discount = item.discount || 0;
      const profit = revenue - itemCost;
      const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

      totalCost += itemCost;
      totalRevenue += revenue;
      totalMRP += mrp;
      totalDiscount += discount;

      detailsList.push({
        invoice_number: item.sales_invoice?.invoice_number || 'N/A',
        invoice_date: item.sales_invoice?.invoice_date || '',
        customer_name: item.sales_invoice?.customer_name || 'N/A',
        barcode: item.barcode_8digit,
        design_no: item.design_no,
        product_description: item.product_description,
        quantity: item.quantity || 1,
        cost: cost,
        totalCost: itemCost,
        mrp: mrp,
        discount: discount,
        selling_price: revenue,
        profit: profit,
        profitMargin: profitMargin,
      });
    }

    const grossProfit = totalRevenue - totalCost;
    const profitMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    setProfitabilityData({
      totalRevenue,
      totalCost,
      grossProfit,
      profitMargin,
      totalMRP,
      totalDiscount,
      itemsSold: salesData.length,
    });

    setProfitabilityDetails(detailsList);
  };

  const loadTopSellingItems = async () => {
    const { data: salesItems } = await supabase
      .from('sales_invoice_items')
      .select(`
        *,
        sales_invoice:sales_invoices!inner(invoice_date)
      `)
      .gte('sales_invoice.invoice_date', startDate)
      .lte('sales_invoice.invoice_date', endDate);

    if (!salesItems) {
      setTopSellingItems([]);
      return;
    }

    const itemMap = new Map<string, any>();

    for (const item of salesItems) {
      const key = item.barcode_8digit;
      if (itemMap.has(key)) {
        const existing = itemMap.get(key);
        existing.quantity += item.quantity || 1;
        existing.revenue += item.selling_price || 0;
      } else {
        const { data: barcodeData } = await supabase
          .from('barcode_batches')
          .select(`
            *,
            product_group:product_groups(name)
          `)
          .eq('barcode_alias_8digit', item.barcode_8digit)
          .maybeSingle();

        itemMap.set(key, {
          barcode: item.barcode_8digit,
          design: item.design_no || barcodeData?.design_no || '',
          productGroup: barcodeData?.product_group?.name || '',
          quantity: item.quantity || 1,
          revenue: item.selling_price || 0,
          mrp: item.mrp || barcodeData?.mrp || 0,
        });
      }
    }

    const topItems = Array.from(itemMap.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 20);

    setTopSellingItems(topItems);
  };

  const loadSlowMovingStock = async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const { data: inventoryData } = await supabase
      .from('barcode_batches')
      .select(`
        *,
        product_group:product_groups(name),
        vendor:vendors(name)
      `)
      .eq('status', 'active')
      .gt('available_quantity', 0)
      .lte('created_at', thirtyDaysAgo);

    if (!inventoryData) {
      setSlowMovingStock([]);
      return;
    }

    const slowMoving = inventoryData.map(item => ({
      barcode: item.barcode_alias_8digit,
      design: item.design_no,
      productGroup: item.product_group?.name || '',
      vendor: item.vendor?.name || '',
      availableQty: item.available_quantity,
      cost: item.cost_actual,
      mrp: item.mrp,
      inventoryValue: item.available_quantity * item.cost_actual,
      daysInStock: Math.floor((Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24)),
    }))
    .sort((a, b) => b.daysInStock - a.daysInStock)
    .slice(0, 20);

    setSlowMovingStock(slowMoving);
  };

  const loadCustomerAnalysis = async () => {
    const { data: customersData } = await supabase
      .from('customers')
      .select('*')
      .order('total_purchases', { ascending: false })
      .limit(20);

    setCustomerAnalysis(customersData || []);
  };

  const loadFloorwiseSales = async () => {
    const { data: salesData } = await supabase
      .from('sales_invoices')
      .select(`
        *,
        floor:floors(name)
      `)
      .gte('invoice_date', startDate)
      .lte('invoice_date', endDate);

    if (!salesData) {
      setFloorwiseSales([]);
      return;
    }

    const floorMap = new Map<string, any>();

    salesData.forEach(sale => {
      const floorName = sale.floor?.name || 'Unknown';
      if (floorMap.has(floorName)) {
        const existing = floorMap.get(floorName);
        existing.totalSales += sale.net_payable || 0;
        existing.invoiceCount += 1;
        existing.totalDiscount += sale.total_discount || 0;
      } else {
        floorMap.set(floorName, {
          floor: floorName,
          totalSales: sale.net_payable || 0,
          invoiceCount: 1,
          totalDiscount: sale.total_discount || 0,
        });
      }
    });

    const floorData = Array.from(floorMap.values())
      .sort((a, b) => b.totalSales - a.totalSales);

    setFloorwiseSales(floorData);
  };

  const loadPendingPayments = async () => {
    const { data: invoicesData } = await supabase
      .from('sales_invoices')
      .select('*')
      .gt('amount_pending', 0)
      .order('invoice_date', { ascending: false });

    setPendingPayments(invoicesData || []);

    if (invoicesData && invoicesData.length > 0) {
      const invoiceIds = invoicesData.map(inv => inv.id);
      const { data: receiptsData } = await supabase
        .from('payment_receipts')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('receipt_date', { ascending: false });

      const receiptsMap: Record<string, any[]> = {};
      (receiptsData || []).forEach(receipt => {
        if (!receiptsMap[receipt.invoice_id]) {
          receiptsMap[receipt.invoice_id] = [];
        }
        receiptsMap[receipt.invoice_id].push(receipt);
      });

      setPaymentReceipts(receiptsMap);
    }
  };

  const loadDefectiveStock = async () => {
    const { data } = await supabase
      .from('defective_stock')
      .select(`
        *,
        item:product_items(
          barcode_id,
          design_no,
          product_group:product_groups(name),
          color:colors(name),
          size:sizes(name)
        ),
        marked_by:users(name)
      `)
      .gte('marked_at', startDate)
      .lte('marked_at', endDate)
      .order('marked_at', { ascending: false });

    setDefectiveStock(data || []);
  };
  
  const loadProductGroupAnalysis = async () => {
    let query = supabase
      .from('barcode_batches')
      .select(`
        *,
        product_group:product_groups(name)
      `)
      .eq('status', 'active');

    if (selectedVendor) {
      query = query.eq('vendor', selectedVendor);
    }

    if (selectedFloor) {
      query = query.eq('floor', selectedFloor);
    }

    const { data } = await query;

    if (!data) {
      setProductGroupAnalysis([]);
      return;
    }

    const groupMap = new Map<string, any>();

    data.forEach(item => {
      const groupName = item.product_group?.name || 'Unknown';
      if (groupMap.has(groupName)) {
        const existing = groupMap.get(groupName);
        existing.totalIn += item.total_quantity || 0;
        existing.totalOut += (item.total_quantity || 0) - (item.available_quantity || 0);
        existing.remaining += item.available_quantity || 0;
      } else {
        groupMap.set(groupName, {
          name: groupName,
          totalIn: item.total_quantity || 0,
          totalOut: (item.total_quantity || 0) - (item.available_quantity || 0),
          remaining: item.available_quantity || 0,
        });
      }
    });

    const analysis = Array.from(groupMap.values())
      .sort((a, b) => a.name.localeCompare(b.name));

    setProductGroupAnalysis(analysis);
  };

  const tabs = [
    { id: 'sales-summary', name: 'Sales Summary', icon: DollarSign },
    { id: 'purchase-summary', name: 'Purchase Summary', icon: ShoppingCart },
    { id: 'inventory-analysis', name: 'Inventory Analysis', icon: Package },
    { id: 'profitability', name: 'Profitability', icon: TrendingUp },
    { id: 'top-selling', name: 'Top Selling Items', icon: BarChart3 },
    { id: 'slow-moving', name: 'Slow Moving Stock', icon: Archive },
    { id: 'defective-stock', name: 'Defective Stock', icon: AlertTriangle },
    { id: 'customer-analysis', name: 'Customer Analysis', icon: Users },
    { id: 'floorwise-sales', name: 'Floor-wise Sales', icon: FileText },
    { id: 'pending-payments', name: 'Pending Payments', icon: TrendingDown },
    { id: 'salesman-report', name: 'Salesman Report', icon: UserCheck },
    { id: 'product-group-analysis', name: 'Product Group Analysis', icon: Archive },
  ];

  return (
    <div className="p-8">
      <Card className="mb-6">
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center">
            <BarChart3 className="w-8 h-8 text-blue-600 mr-3" />
            <div>
              <CardTitle>Reports & Analytics</CardTitle>
            </div>
          </div>
        </CardHeader>

        <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div>
            <Label className="mb-2 block">Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-2 block">End Date</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          <div>
            <Label className="mb-2 block">Vendor</Label>
            <select
              value={selectedVendor}
              onChange={(e) => setSelectedVendor(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Vendors</option>
              {vendors.map(v => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="mb-2 block">Floor</Label>
            <select
              value={selectedFloor}
              onChange={(e) => setSelectedFloor(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Floors</option>
              {floors.map(f => (
                <option key={f.id} value={f.id}>{f.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex overflow-x-auto gap-2 pb-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <Button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                variant={activeTab === tab.id ? 'default' : 'outline'}
                className="px-4 py-2 flex items-center whitespace-nowrap"
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.name}
              </Button>
            );
          })}
        </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading report data...</p>
        </div>
      )}

      {!loading && activeTab === 'sales-summary' && salesSummary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Sales Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Total Sales</p>
              <p className="text-3xl font-bold">₹{salesSummary.totalSales.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Invoice Count</p>
              <p className="text-3xl font-bold">{salesSummary.invoiceCount}</p>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-red-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Avg Invoice Value</p>
              <p className="text-3xl font-bold">₹{salesSummary.avgInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border-2 border-gray-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-700 mb-3">Financial Breakdown</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total MRP:</span>
                  <span className="font-semibold">₹{salesSummary.totalMRP.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Discount:</span>
                  <span className="font-semibold text-red-600">-₹{salesSummary.totalDiscount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Taxable Value:</span>
                  <span className="font-semibold">₹{salesSummary.taxableValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total GST:</span>
                  <span className="font-semibold">₹{salesSummary.totalGST.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>

            <div className="border-2 border-gray-200 rounded-lg p-4">
              <h4 className="font-bold text-gray-700 mb-3">GST Breakdown</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">CGST @ 2.5%:</span>
                  <span className="font-semibold">₹{salesSummary.cgst_5.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">SGST @ 2.5%:</span>
                  <span className="font-semibold">₹{salesSummary.sgst_5.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">CGST @ 9%:</span>
                  <span className="font-semibold">₹{salesSummary.cgst_18.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">SGST @ 9%:</span>
                  <span className="font-semibold">₹{salesSummary.sgst_18.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-xl font-bold text-gray-800 mb-4">Detailed Sales Records</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                      <button onClick={() => toggleSort('invoice_number')} className="flex items-center gap-1 hover:text-blue-600">
                        Invoice
                        {sortField === 'invoice_number' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                      <button onClick={() => toggleSort('invoice_date')} className="flex items-center gap-1 hover:text-blue-600">
                        Date
                        {sortField === 'invoice_date' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">
                      <button onClick={() => toggleSort('customer_name')} className="flex items-center gap-1 hover:text-blue-600">
                        Customer
                        {sortField === 'customer_name' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Mobile</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                      <button onClick={() => toggleSort('total_mrp')} className="flex items-center gap-1 hover:text-blue-600 ml-auto">
                        MRP
                        {sortField === 'total_mrp' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">GST</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">
                      <button onClick={() => toggleSort('net_payable')} className="flex items-center gap-1 hover:text-blue-600 ml-auto">
                        Net Amount
                        {sortField === 'net_payable' && (sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />)}
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Payment</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {salesDetails.map((sale) => (
                    <tr key={sale.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-sm">{sale.invoice_number}</td>
                      <td className="px-4 py-3 text-sm">{new Date(sale.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{sale.customer_name}</td>
                      <td className="px-4 py-3 text-sm">{sale.customer_mobile}</td>
                      <td className="px-4 py-3 text-right">₹{(sale.total_mrp || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{(sale.total_discount || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">₹{(sale.total_gst || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">₹{(sale.net_payable || 0).toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-center">
                        {sale.payment_status === 'paid' ? (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-semibold">Paid</span>
                        ) : sale.payment_status === 'partial' ? (
                          <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">Partial</span>
                        ) : (
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => downloadInvoice(sale.id)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50"
                          title="View/Print Invoice"
                        >
                          <Download size={18} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'purchase-summary' && purchaseSummary && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Purchase Summary</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Total Purchase</p>
              <p className="text-3xl font-bold">₹{purchaseSummary.totalPurchase.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">PO Count</p>
              <p className="text-3xl font-bold">{purchaseSummary.poCount}</p>
            </div>
            <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Total Items</p>
              <p className="text-3xl font-bold">{purchaseSummary.totalItems}</p>
            </div>
            <div className="bg-gradient-to-r from-red-500 to-pink-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Avg PO Value</p>
              <p className="text-3xl font-bold">₹{purchaseSummary.avgPOValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-xl font-bold text-gray-800 mb-4">Detailed Purchase Records</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">PO Number</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Order Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Vendor</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Items</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Base Amount</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">GST</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Amount</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Attachment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {purchaseDetails.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-sm">{po.po_number || po.order_number || 'N/A'}</td>
                      <td className="px-4 py-3 text-sm">{new Date(po.order_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{po.vendor?.name || 'N/A'}</td>
                      <td className="px-4 py-3 text-center">{po.total_items || 0}</td>
                      <td className="px-4 py-3 text-right">
                        ₹{(po.taxable_value || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        ₹{(((po.total_amount || 0) - (po.taxable_value || 0)) || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">
                        ₹{(po.total_amount || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {po.vendor_invoice_attachment ? (
                          <a
                            href={po.vendor_invoice_attachment}
                            download={`invoice-${po.po_number || po.order_number || po.id}`}
                            className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 text-xs"
                          >
                            <Download className="w-4 h-4 mr-1" />
                            Download
                          </a>
                        ) : (
                          <span className="text-gray-400 text-xs">No file</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'inventory-analysis' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Inventory Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product Group</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Available</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Cost</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Stock Value</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Potential Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inventoryAnalysis.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{item.barcode}</td>
                    <td className="px-4 py-3 font-semibold">{item.design}</td>
                    <td className="px-4 py-3">{item.productGroup}</td>
                    <td className="px-4 py-3 text-center">{item.availableQty}</td>
                    <td className="px-4 py-3 text-center">{item.soldQty}</td>
                    <td className="px-4 py-3 text-right">₹{item.cost.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right">₹{item.mrp.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{item.inventoryValue.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-600">₹{item.profit.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'profitability' && profitabilityData && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Profitability Analysis</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Total Revenue</p>
              <p className="text-3xl font-bold">₹{profitabilityData.totalRevenue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-r from-red-500 to-orange-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Total Cost</p>
              <p className="text-3xl font-bold">₹{profitabilityData.totalCost.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-lg text-white">
              <p className="text-sm opacity-90">Gross Profit</p>
              <p className="text-3xl font-bold">₹{profitabilityData.grossProfit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
          </div>
          <div className="border-2 border-gray-200 rounded-lg p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Profit Margin:</span>
                <span className="text-2xl font-bold text-green-600">{profitabilityData.profitMargin.toFixed(2)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Items Sold:</span>
                <span className="text-2xl font-bold">{profitabilityData.itemsSold}</span>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-xl font-bold text-gray-800 mb-4">Detailed Profitability Breakdown</h4>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                    <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                    <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Qty</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Unit Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Cost</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">MRP</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Discount</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Selling Price</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Profit</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Margin %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {profitabilityDetails.map((item, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-semibold text-sm">{item.invoice_number}</td>
                      <td className="px-4 py-3 text-sm">{new Date(item.invoice_date).toLocaleDateString()}</td>
                      <td className="px-4 py-3 text-sm">{item.customer_name}</td>
                      <td className="px-4 py-3 font-mono text-xs">{item.barcode}</td>
                      <td className="px-4 py-3 text-sm">{item.design_no}</td>
                      <td className="px-4 py-3 text-center">{item.quantity}</td>
                      <td className="px-4 py-3 text-right">₹{item.cost.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-red-600">₹{item.totalCost.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right">₹{item.mrp.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right text-orange-600">-₹{item.discount.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{item.selling_price.toLocaleString('en-IN')}</td>
                      <td className={`px-4 py-3 text-right font-bold ${item.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ₹{item.profit.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${item.profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {item.profitMargin.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'top-selling' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Top Selling Items</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product Group</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Quantity Sold</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {topSellingItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-mono text-sm">{item.barcode}</td>
                    <td className="px-4 py-3 font-semibold">{item.design}</td>
                    <td className="px-4 py-3">{item.productGroup}</td>
                    <td className="px-4 py-3 text-center font-bold text-green-600">{item.quantity}</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{item.revenue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'slow-moving' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Slow Moving Stock</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Design</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product Group</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Available Qty</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Days in Stock</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Inventory Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {slowMovingStock.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-sm">{item.barcode}</td>
                    <td className="px-4 py-3 font-semibold">{item.design}</td>
                    <td className="px-4 py-3">{item.productGroup}</td>
                    <td className="px-4 py-3 text-center">{item.availableQty}</td>
                    <td className="px-4 py-3 text-center font-bold text-red-600">{item.daysInStock} days</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{item.inventoryValue.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'customer-analysis' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Top Customers</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Mobile</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Purchases</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Total Visits</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Loyalty Points</th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {customerAnalysis.map((customer, idx) => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-gray-600">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold">{customer.name}</td>
                    <td className="px-4 py-3">{customer.mobile}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">₹{(customer.total_purchases || 0).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">{customer.total_visits || 0}</td>
                    <td className="px-4 py-3 text-center font-semibold text-blue-600">{(customer.loyalty_points_balance || 0).toFixed(0)}</td>
                    <td className="px-4 py-3">{customer.last_purchase_date ? new Date(customer.last_purchase_date).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'floorwise-sales' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Floor-wise Sales Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Floor</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Sales</th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Invoice Count</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Avg Invoice Value</th>
                  <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Total Discount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {floorwiseSales.map((floor, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-semibold">{floor.floor}</td>
                    <td className="px-4 py-3 text-right font-bold text-green-600">₹{floor.totalSales.toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3 text-center">{floor.invoiceCount}</td>
                    <td className="px-4 py-3 text-right">₹{(floor.totalSales / floor.invoiceCount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</td>
                    <td className="px-4 py-3 text-right text-red-600">₹{floor.totalDiscount.toLocaleString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && activeTab === 'pending-payments' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Pending Payments</h3>
          {pendingPayments.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No pending payments</p>
              <p className="text-sm">All invoices are fully paid</p>
            </div>
          ) : (
            <>
              <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">Total Pending Amount</p>
                <p className="text-3xl font-bold text-red-700">
                  ₹{pendingPayments.reduce((sum, inv) => sum + (inv.amount_pending || 0), 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Invoice</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Mobile</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Net Amount</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Paid</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Pending</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {pendingPayments.map((invoice) => (
                      <React.Fragment key={invoice.id}>
                        <tr className="hover:bg-red-50">
                          <td className="px-4 py-3 font-semibold">{invoice.invoice_number}</td>
                          <td className="px-4 py-3">{new Date(invoice.invoice_date).toLocaleDateString()}</td>
                          <td className="px-4 py-3">{invoice.customer_name}</td>
                          <td className="px-4 py-3">{invoice.customer_mobile}</td>
                          <td className="px-4 py-3 text-right">₹{(invoice.net_payable || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right text-green-600">₹{(invoice.amount_paid || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-right font-bold text-red-600">₹{(invoice.amount_pending || 0).toLocaleString('en-IN')}</td>
                          <td className="px-4 py-3 text-center">
                            {invoice.payment_status === 'partial' ? (
                              <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-semibold">Partial</span>
                            ) : (
                              <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">Pending</span>
                            )}
                          </td>
                        </tr>
                        {paymentReceipts[invoice.id] && paymentReceipts[invoice.id].length > 0 && (
                          <tr>
                            <td colSpan={8} className="px-4 py-2 bg-blue-50">
                              <div className="text-sm">
                                <p className="font-semibold text-blue-800 mb-2">Payment History:</p>
                                <div className="space-y-1">
                                  {paymentReceipts[invoice.id].map((receipt: any) => (
                                    <div key={receipt.id} className="flex justify-between items-center bg-white p-2 rounded border border-blue-200">
                                      <div className="flex gap-4">
                                        <span className="font-semibold text-blue-600">{receipt.receipt_number}</span>
                                        <span className="text-gray-600">{new Date(receipt.receipt_date).toLocaleDateString()}</span>
                                        <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs">{receipt.payment_mode}</span>
                                        {receipt.reference_number && (
                                          <span className="text-gray-500 text-xs">Ref: {receipt.reference_number}</span>
                                        )}
                                      </div>
                                      <span className="font-bold text-green-600">₹{receipt.amount_received.toLocaleString('en-IN')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {!loading && activeTab === 'defective-stock' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Defective Stock Report</h3>
          {defectiveStock.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No defective stock records</p>
              <p className="text-sm">All inventory is in good condition</p>
            </div>
          ) : (
            <>
              <div className="mb-6 bg-red-50 border-2 border-red-200 rounded-lg p-4">
                <p className="text-sm text-red-600">Total Defective Items</p>
                <p className="text-3xl font-bold text-red-700">
                  {defectiveStock.reduce((sum, item) => sum + (item.quantity || 0), 0)} units
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <p className="text-sm text-orange-600">Unique Items</p>
                  <p className="text-2xl font-bold text-orange-700">{defectiveStock.length}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-600">Most Common Reason</p>
                  <p className="text-lg font-bold text-red-700">
                    {defectiveStock.length > 0
                      ? (() => {
                          const reasonCounts = defectiveStock.reduce((acc: any, item: any) => {
                            acc[item.reason] = (acc[item.reason] || 0) + 1;
                            return acc;
                          }, {});
                          const mostCommon = Object.entries(reasonCounts).sort((a: any, b: any) => b[1] - a[1])[0];
                          return mostCommon ? mostCommon[0] : 'N/A';
                        })()
                      : 'N/A'}
                  </p>
                </div>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-600">Date Range</p>
                  <p className="text-sm font-bold text-yellow-700">
                    {new Date(startDate).toLocaleDateString()} - {new Date(endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Barcode</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Quantity</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Reason</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {defectiveStock.map((item) => (
                      <tr key={item.id} className="hover:bg-red-50">
                        <td className="px-4 py-3">{new Date(item.marked_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3 font-semibold">{item.barcode}</td>
                        <td className="px-4 py-3 text-center font-bold text-red-600">{item.quantity}</td>
                        <td className="px-4 py-3">
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                            {item.reason}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{item.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    const csvContent = [
                      ['Date', 'Barcode', 'Quantity', 'Reason', 'Notes'],
                      ...defectiveStock.map(item => [
                        new Date(item.marked_at).toLocaleDateString(),
                        item.barcode,
                        item.quantity,
                        item.reason,
                        item.notes || ''
                      ])
                    ].map(row => row.join(',')).join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `defective-stock-${startDate}-to-${endDate}.csv`;
                    a.click();
                  }}
                  className="px-4 py-2 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'salesman-report' && (
        <SalesmanReport />
      )}

      {!loading && activeTab === 'product-group-analysis' && (
        <div className="bg-white rounded-lg shadow-md p-6">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">Product Group Analysis</h3>
          {productGroupAnalysis.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No data available for the selected filters</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-6 rounded-lg text-white">
                  <p className="text-sm opacity-90">Total Inward Units</p>
                  <p className="text-3xl font-bold">
                    {productGroupAnalysis.reduce((sum, g) => sum + g.totalIn, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-lg text-white">
                  <p className="text-sm opacity-90">Total Sold Units</p>
                  <p className="text-3xl font-bold">
                    {productGroupAnalysis.reduce((sum, g) => sum + g.totalOut, 0).toLocaleString()}
                  </p>
                </div>
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 p-6 rounded-lg text-white">
                  <p className="text-sm opacity-90">Remaining Balance</p>
                  <p className="text-3xl font-bold">
                    {productGroupAnalysis.reduce((sum, g) => sum + g.remaining, 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-700 uppercase">Product Group</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Total Come (In)</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Total Sail (Out)</th>
                      <th className="px-4 py-3 text-center text-xs font-bold text-gray-700 uppercase">Remaining Stock</th>
                      <th className="px-4 py-3 text-right text-xs font-bold text-gray-700 uppercase">Stock %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {productGroupAnalysis.map((group, idx) => {
                      const stockPercentage = group.totalIn > 0 ? (group.remaining / group.totalIn) * 100 : 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-semibold text-gray-800">{group.name}</td>
                          <td className="px-4 py-3 text-center font-bold text-blue-600">{group.totalIn.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center font-bold text-green-600">{group.totalOut.toLocaleString()}</td>
                          <td className="px-4 py-3 text-center font-bold text-orange-600">{group.remaining.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${stockPercentage > 20 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${Math.min(100, stockPercentage)}%` }}
                                ></div>
                              </div>
                              <span className="text-xs font-medium text-gray-600">{stockPercentage.toFixed(1)}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  type="button"
                  onClick={() => {
                    const csvContent = [
                      ['Product Group', 'Total Come (In)', 'Total Sail (Out)', 'Remaining Stock', 'Stock %'],
                      ...productGroupAnalysis.map(g => [
                        g.name,
                        g.totalIn,
                        g.totalOut,
                        g.remaining,
                        g.totalIn > 0 ? ((g.remaining / g.totalIn) * 100).toFixed(2) + '%' : '0%'
                      ])
                    ].map(row => row.join(',')).join('\n');

                    const blob = new Blob([csvContent], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `product-group-analysis-${new Date().toISOString().split('T')[0]}.csv`;
                    a.click();
                  }}
                  className="px-4 py-2 flex items-center"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Export to CSV
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {selectedInvoiceId && (
        <SalesInvoicePDF
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
        />
      )}
    </div>
  );
}
