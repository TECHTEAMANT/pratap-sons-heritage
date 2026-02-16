import { useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { usePermissions } from './hooks/usePermissions';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Billing from './components/Billing';
import AddItem from './components/AddItem';
import Inventory from './components/Inventory';
import InventoryEdit from './components/InventoryEdit';
import DefectiveStock from './components/DefectiveStock';
import MasterData from './components/MasterData';
import BarcodePrint from './components/BarcodePrint';
import BarcodeManagement from './components/BarcodeManagement';
import PurchaseOrders from './components/PurchaseOrders.tsx';
import SalesOrder from './components/SalesOrder.tsx';
import PurchaseInvoice from './components/PurchaseInvoice';
import PurchaseReturn from './components/PurchaseReturn';
import Reports from './components/Reports';
import TallySync from './components/TallySync';
import UserManagement from './components/UserManagement';
import CustomerManagement from './components/CustomerManagement';
import EBooking from './components/EBooking';
import PendingDeliveries from './components/PendingDeliveries';
import PaymentReceipts from './components/PaymentReceipts';
import SalesReturn from './components/SalesReturn';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { permissions, loading: permissionsLoading } = usePermissions();
  const mapHashToPage = (hash: string): string | null => {
    if (!hash) return null;
    if (hash.startsWith('#barcode-print')) return 'barcode-print';
    const routes: Record<string, string> = {
      '#dashboard': 'dashboard',
      '#sales-orders': 'sales-orders',
      '#billing': 'billing',
      '#payment-receipts': 'payment-receipts',
      '#sales-return': 'sales-return',
      '#pending-deliveries': 'pending-deliveries',
      '#add-item': 'add-item',
      '#inventory': 'inventory',
      '#inventory-edit': 'inventory-edit',
      '#defective-stock': 'defective-stock',
      '#purchase-invoice': 'purchase-invoice',
      '#purchase-return': 'purchase-return',
      '#reports': 'reports',
      '#tally-sync': 'tally-sync',
      '#master-data': 'master-data',
      '#barcode-management': 'barcode-management',
      '#user-management': 'user-management',
      '#customer-management': 'customer-management',
      '#e-booking': 'e-booking',
      '#purchase-orders': 'purchase-orders',
    };
    return routes[hash] || null;
  };

  const [currentPage, setCurrentPage] = useState(() => {
    return mapHashToPage(window.location.hash) || 'dashboard';
  });

  useEffect(() => {
    const handleHashChange = () => {
      const next = mapHashToPage(window.location.hash);
      if (next) setCurrentPage(next);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (authLoading || permissionsLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  const UnauthorizedPage = () => (
    <div className="bg-white rounded-lg shadow-md p-8 text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Access Denied</h2>
      <p className="text-gray-600">You do not have permission to access this page.</p>
    </div>
  );

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <Dashboard />;
      case 'sales-orders':
        return permissions.can_manage_sales ? <SalesOrder /> : <UnauthorizedPage />;
      case 'billing':
        return permissions.can_manage_sales ? <Billing /> : <UnauthorizedPage />;
      case 'payment-receipts':
        return permissions.can_manage_sales ? <PaymentReceipts /> : <UnauthorizedPage />;
      case 'sales-return':
        return permissions.can_manage_sales ? <SalesReturn /> : <UnauthorizedPage />;
      case 'pending-deliveries':
        return permissions.can_manage_sales ? <PendingDeliveries /> : <UnauthorizedPage />;
      case 'add-item':
        return permissions.can_manage_inventory ? <AddItem /> : <UnauthorizedPage />;
      case 'inventory':
        return permissions.can_manage_inventory ? <Inventory /> : <UnauthorizedPage />;
      case 'inventory-edit':
        return permissions.can_manage_inventory ? <InventoryEdit /> : <UnauthorizedPage />;
      case 'defective-stock':
        return permissions.can_manage_inventory ? <DefectiveStock /> : <UnauthorizedPage />;
      case 'purchase-invoice':
        return permissions.can_manage_purchases ? <PurchaseInvoice /> : <UnauthorizedPage />;
      case 'purchase-return':
        return permissions.can_manage_purchases ? <PurchaseReturn /> : <UnauthorizedPage />;
      case 'purchase-orders':
        return permissions.can_manage_purchases ? <PurchaseOrders /> : <UnauthorizedPage />;
      case 'reports':
        return permissions.can_view_reports ? <Reports /> : <UnauthorizedPage />;
      case 'tally-sync':
        return permissions.can_manage_purchases ? <TallySync /> : <UnauthorizedPage />;
      case 'master-data':
        return permissions.can_manage_masters ? <MasterData /> : <UnauthorizedPage />;
      case 'barcode-print':
        return permissions.can_manage_inventory ? <BarcodePrint /> : <UnauthorizedPage />;
      case 'barcode-management':
        return permissions.can_manage_inventory ? <BarcodeManagement /> : <UnauthorizedPage />;
      case 'user-management':
        return permissions.can_manage_users ? <UserManagement /> : <UnauthorizedPage />;
      case 'customer-management':
        return permissions.can_manage_masters ? <CustomerManagement /> : <UnauthorizedPage />;
      case 'e-booking':
        return permissions.can_manage_sales ? <EBooking /> : <UnauthorizedPage />;
      default:
        return <Dashboard />;
    }
  };

  if (currentPage === 'barcode-print') {
    // For barcode-print, we allow access if the user has inventory permissions
    // If permissions are still loading or if they are false, we show a helpful message
    if (permissions.can_manage_inventory) {
      return <BarcodePrint />;
    }
    
    // Fallback: If they are logged in and it's a barcode-print page, 
    // we might want to be slightly more lenient if permissions are failing to load correctly
    // But for now, let's stick to the permission check and just make it clearer
    return <UnauthorizedPage />;
  }

  return (
    <Layout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
