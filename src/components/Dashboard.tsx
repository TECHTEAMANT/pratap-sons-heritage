import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { TrendingUp, Package, Users, IndianRupee } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    todayInvoices: 0,
    availableItems: 0,
    totalCustomers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const [todayInvoicesRes, itemsRes, customersRes] = await Promise.all([
        supabase
          .from('sales_invoices')
          .select('net_payable')
          .eq('invoice_date', today),
        supabase
          .from('product_items')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'Available'),
        supabase
          .from('customers')
          .select('id', { count: 'exact', head: true }),
      ]);

      const todaySales = todayInvoicesRes.data?.reduce((sum, inv) => sum + inv.net_payable, 0) || 0;

      setStats({
        todaySales,
        todayInvoices: todayInvoicesRes.data?.length || 0,
        availableItems: itemsRes.count || 0,
        totalCustomers: customersRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
        <button
          onClick={loadDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-500 p-3 rounded-lg">
              <IndianRupee className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Today's Sales</h3>
          <p className="text-3xl font-bold text-gray-800">₹{stats.todaySales.toLocaleString('en-IN')}</p>
          <p className="text-sm text-gray-500 mt-1">{stats.todayInvoices} invoices</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-green-500 p-3 rounded-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Available Items</h3>
          <p className="text-3xl font-bold text-gray-800">{stats.availableItems}</p>
          <p className="text-sm text-gray-500 mt-1">In stock</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-orange-500 p-3 rounded-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Total Customers</h3>
          <p className="text-3xl font-bold text-gray-800">{stats.totalCustomers}</p>
          <p className="text-sm text-gray-500 mt-1">Registered</p>
        </div>

        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="bg-pink-500 p-3 rounded-lg">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
          <h3 className="text-gray-600 text-sm font-medium mb-1">Performance</h3>
          <p className="text-3xl font-bold text-gray-800">Excellent</p>
          <p className="text-sm text-gray-500 mt-1">System Status</p>
        </div>
      </div>

      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-8 text-white">
        <h3 className="text-2xl font-bold mb-4">Welcome to INVENTO ERP</h3>
        <p className="text-blue-100 mb-4">
          Complete inventory management system for ladies garment showroom
        </p>
        <ul className="space-y-2">
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            <span>Barcode-driven inventory management</span>
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            <span>Auto GST calculation (5% / 18%)</span>
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            <span>Loyalty points system</span>
          </li>
          <li className="flex items-center">
            <span className="mr-2">✓</span>
            <span>Multi-floor operations</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
