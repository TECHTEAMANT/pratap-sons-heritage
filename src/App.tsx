import { useState } from 'react';
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
  const { user, loading } = useAuth();
  const { permissions } = usePermissions();
  const [currentPage, setCurrentPage] = useState(() => {
    if (window.location.hash.startsWith('#barcode-print')) {
      return 'barcode-print';
    }
    return 'dashboard';
  });

  if (loading) {
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
