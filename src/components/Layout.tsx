import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import logo from '../utils/A NT Logo2.png';
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
  const { permissions, roleName } = usePermissions();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const displayName = user?.name || user?.mobile || user?.email || '';
  const userInitial = displayName ? displayName[0]?.toUpperCase() : '';
  const roleLabel = roleName || user?.role || '';

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
      <div
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-gradient-to-b from-white via-slate-50 to-slate-100 shadow-xl transform transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <div className="py-2 px-4 border-b border-gray-200 bg-white/80 backdrop-blur">
            <div className="flex flex-col items-center">
              {/* <img
                src={logo}
                alt="accountsNtax logo"
                className="h-28 w-auto object-contain"
              /> */}
              <div className="text-center">
                <h1 className="-mt-10 text-xl font-bold tracking-tight text-blue-700">INVENTO ERP</h1>
                <p className="text-xs font-medium text-gray-500">{roleLabel}</p>
              </div>
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-4 py-5">
            <ul className="space-y-1.5">
              {navigation.map((item) => (
                <li key={item.name}>
                  <button
                    onClick={() => onNavigate(item.page)}
                    className={`group w-full flex items-center px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      currentPage === item.page
                        ? 'bg-blue-600/10 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:text-blue-600 hover:bg-blue-50'
                    }`}
                  >
                    <span
                      className={`mr-3 flex h-9 w-9 items-center justify-center rounded-lg border text-gray-500 transition-colors ${
                        currentPage === item.page
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white/80 border-gray-200 group-hover:border-blue-300 group-hover:text-blue-600'
                      }`}
                    >
                      <item.icon className="w-4 h-4" />
                    </span>
                    <span className="truncate">{item.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="p-4 border-t border-gray-200 bg-white/80 backdrop-blur">
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-gray-200 bg-white/80 p-3 shadow-sm">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                {userInitial}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-gray-800">{displayName}</p>
                <p className="truncate text-xs text-gray-500">{user?.mobile || user?.email}</p>
              </div>
            </div>
            <button
              onClick={signOut}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50/70 px-4 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-100 hover:border-red-200"
            >
              <LogOut className="w-5 h-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>

      <div className={`transition-all duration-300 ${sidebarOpen ? 'ml-72' : 'ml-0'}`}>
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
