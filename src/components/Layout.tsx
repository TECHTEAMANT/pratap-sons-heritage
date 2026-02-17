import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  LogOut,
  Menu,
  X,
  Barcode,
  Database,
  Printer,
  FileText,
  BarChart3,
  FileJson,
  PackageX,
  Users,
  Calendar,
  UserPlus,
  Truck,
  Receipt,
  AlertTriangle,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  currentPage: string;
  onNavigate: (page: string) => void;
}

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { user, signOut } = useAuth();
  const { permissions } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const allNavigation = [
    { name: 'Dashboard', icon: LayoutDashboard, page: 'dashboard', requiresPermission: null },
    { name: 'Sales Orders', icon: ShoppingCart, page: 'sales-orders', requiresPermission: 'can_manage_sales' },
    { name: 'Billing', icon: ShoppingCart, page: 'billing', requiresPermission: 'can_manage_sales' },
    { name: 'Sales Return', icon: PackageX, page: 'sales-return', requiresPermission: 'can_manage_sales' },
    { name: 'Payment Receipts', icon: Receipt, page: 'payment-receipts', requiresPermission: 'can_manage_sales' },
    { name: 'Pending Deliveries', icon: Truck, page: 'pending-deliveries', requiresPermission: 'can_manage_sales' },
    { name: 'E-Booking', icon: Calendar, page: 'e-booking', requiresPermission: 'can_manage_sales' },
    { name: 'Purchase Orders', icon: FileText, page: 'purchase-orders', requiresPermission: 'can_manage_purchases' },
    { name: 'Purchase Invoice', icon: FileText, page: 'purchase-invoice', requiresPermission: 'can_manage_purchases' },
    { name: 'Purchase Return', icon: PackageX, page: 'purchase-return', requiresPermission: 'can_manage_purchases' },
    { name: 'Add Item', icon: Barcode, page: 'add-item', requiresPermission: 'can_manage_inventory' },
    { name: 'Inventory', icon: Package, page: 'inventory', requiresPermission: 'can_manage_inventory' },
    { name: 'Defective Stock', icon: AlertTriangle, page: 'defective-stock', requiresPermission: 'can_manage_inventory' },
    { name: 'Barcode Management', icon: Printer, page: 'barcode-management', requiresPermission: 'can_manage_inventory' },
    { name: 'Reports', icon: BarChart3, page: 'reports', requiresPermission: 'can_view_reports' },
    { name: 'Tally Sync', icon: FileJson, page: 'tally-sync', requiresPermission: 'can_manage_purchases' },
    { name: 'Customer Management', icon: UserPlus, page: 'customer-management', requiresPermission: 'can_manage_masters' },
    { name: 'Master Data', icon: Database, page: 'master-data', requiresPermission: 'can_manage_masters' },
    { name: 'User Management', icon: Users, page: 'user-management', requiresPermission: 'can_manage_users' },
  ];

  const navigation = allNavigation.filter(item => {
    if (item.requiresPermission === null) return true;
    return permissions[item.requiresPermission as keyof typeof permissions];
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-blue-600">Retail ERP</h1>
            <p className="text-sm text-gray-600 mt-1">{user?.role}</p>
          </div>

          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <button
                    onClick={() => onNavigate(item.page)}
                    className={`w-full flex items-center px-4 py-3 text-gray-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition ${
                      currentPage === item.page ? 'bg-blue-50 text-blue-600' : ''
                    }`}
                  >
                    <item.icon className="w-5 h-5 mr-3" />
                    <span className="font-medium">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-200">
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">{user?.name || user?.email}</p>
              <p className="text-xs text-gray-500 mt-1">{user?.email}</p>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition"
            >
              <LogOut className="w-5 h-5 mr-2" />
              <span className="font-medium">Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-0'}`}>
        <header className="bg-white shadow-sm sticky top-0 z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-gray-100 transition"
            >
              {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {new Date().toLocaleDateString('en-IN', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
            </div>
          </div>
        </header>

        <main className="p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
