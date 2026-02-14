import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, TrendingUp, DollarSign, Package } from 'lucide-react';

interface SalesmanSales {
  salesman_id: string;
  salesman_name: string;
  salesman_code: string;
  total_sales: number;
  total_items: number;
  total_invoices: number;
  total_returns: number;
  return_items: number;
  net_sales: number;
}

export default function SalesmanReport() {
  const [salesData, setSalesData] = useState<SalesmanSales[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setStartDate(firstDay.toISOString().split('T')[0]);
    setEndDate(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      loadSalesmanData();
    }
  }, [startDate, endDate]);

  const loadSalesmanData = async () => {
    setLoading(true);
    try {
      const [invoicesRes, itemsRes, returnsRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select(`
            id,
            net_payable,
            invoice_date,
            salesman:salesmen(id, name, salesman_code)
          `)
          .gte('invoice_date', startDate)
          .lte('invoice_date', endDate),
        supabase
          .from('sales_invoice_items')
          .select(`
            id,
            invoice_id,
            selling_price,
            salesman_id,
            salesman:salesmen(id, name, salesman_code)
          `),
        supabase
          .from('sales_returns')
          .select(`
            id,
            total_return_amount,
            return_date,
            return_items:sales_return_items(id)
          `)
          .gte('return_date', startDate)
          .lte('return_date', endDate)
      ]);

      const salesmen = new Map<string, SalesmanSales>();

      invoicesRes.data?.forEach(invoice => {
        if (invoice.salesman) {
          const key = invoice.salesman.id;
          if (!salesmen.has(key)) {
            salesmen.set(key, {
              salesman_id: key,
              salesman_name: invoice.salesman.name,
              salesman_code: invoice.salesman.salesman_code,
              total_sales: 0,
              total_items: 0,
              total_invoices: 0,
              total_returns: 0,
              return_items: 0,
              net_sales: 0,
            });
          }
          const data = salesmen.get(key)!;
          data.total_sales += invoice.net_payable || 0;
          data.total_invoices += 1;
        }
      });

      itemsRes.data?.forEach(item => {
        if (item.salesman) {
          const key = item.salesman.id;
          if (!salesmen.has(key)) {
            salesmen.set(key, {
              salesman_id: key,
              salesman_name: item.salesman.name,
              salesman_code: item.salesman.salesman_code,
              total_sales: 0,
              total_items: 0,
              total_invoices: 0,
              total_returns: 0,
              return_items: 0,
              net_sales: 0,
            });
          }
          const data = salesmen.get(key)!;
          data.total_items += 1;
        }
      });

      returnsRes.data?.forEach(returnItem => {
        const data = salesmen.get(returnItem.id);
        if (data) {
          data.total_returns += returnItem.total_return_amount || 0;
          data.return_items += returnItem.return_items?.length || 0;
        }
      });

      salesmen.forEach(data => {
        data.net_sales = data.total_sales - data.total_returns;
      });

      const sortedData = Array.from(salesmen.values()).sort((a, b) => b.net_sales - a.net_sales);
      setSalesData(sortedData);
    } catch (err: any) {
      console.error('Error loading salesman data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = salesData.reduce((sum, s) => sum + s.total_sales, 0);
  const totalReturns = salesData.reduce((sum, s) => sum + s.total_returns, 0);
  const netTotal = totalSales - totalReturns;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Users className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Salesman-Wise Sales Report</h1>
            <p className="text-sm text-gray-600">Sales and returns by salesman</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-green-50 to-emerald-100 border-2 border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Sales</p>
                <p className="text-2xl font-bold text-green-700">₹{totalSales.toFixed(2)}</p>
              </div>
              <DollarSign className="w-10 h-10 text-green-600" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-rose-100 border-2 border-red-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Total Returns</p>
                <p className="text-2xl font-bold text-red-700">₹{totalReturns.toFixed(2)}</p>
              </div>
              <TrendingUp className="w-10 h-10 text-red-600 transform rotate-180" />
            </div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 font-medium">Net Sales</p>
                <p className="text-2xl font-bold text-blue-700">₹{netTotal.toFixed(2)}</p>
              </div>
              <Package className="w-10 h-10 text-blue-600" />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border-2 border-gray-300 px-4 py-3 text-left">Salesman Code</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-left">Salesman Name</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-right">Total Invoices</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-right">Items Sold</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-right">Total Sales (₹)</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-right">Returns (₹)</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-right">Return Items</th>
                  <th className="border-2 border-gray-300 px-4 py-3 text-right font-bold">Net Sales (₹)</th>
                </tr>
              </thead>
              <tbody>
                {salesData.map((salesman, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="border-2 border-gray-300 px-4 py-3">{salesman.salesman_code}</td>
                    <td className="border-2 border-gray-300 px-4 py-3 font-medium">{salesman.salesman_name}</td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right">{salesman.total_invoices}</td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right">{salesman.total_items}</td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-green-700 font-semibold">
                      {salesman.total_sales.toFixed(2)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-red-700">
                      {salesman.total_returns.toFixed(2)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-red-700">
                      {salesman.return_items}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right font-bold text-blue-700">
                      {salesman.net_sales.toFixed(2)}
                    </td>
                  </tr>
                ))}
                {salesData.length === 0 && (
                  <tr>
                    <td colSpan={8} className="border-2 border-gray-300 px-4 py-8 text-center text-gray-500">
                      No sales data found for the selected period
                    </td>
                  </tr>
                )}
              </tbody>
              {salesData.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-200 font-bold">
                    <td colSpan={2} className="border-2 border-gray-300 px-4 py-3 text-right">TOTAL:</td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right">
                      {salesData.reduce((sum, s) => sum + s.total_invoices, 0)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right">
                      {salesData.reduce((sum, s) => sum + s.total_items, 0)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-green-700">
                      {totalSales.toFixed(2)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-red-700">
                      {totalReturns.toFixed(2)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-red-700">
                      {salesData.reduce((sum, s) => sum + s.return_items, 0)}
                    </td>
                    <td className="border-2 border-gray-300 px-4 py-3 text-right text-blue-700">
                      {netTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
