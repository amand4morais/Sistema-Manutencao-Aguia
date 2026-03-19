import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { Toaster } from 'react-hot-toast';
import { Layout } from './components/layout/Layout';
import { AuthProvider, useAuth } from './hooks/useAuth';

// Pages
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Equipments from './pages/Equipments';
import Profile from './pages/Profile';
import Maintenance from './pages/Maintenance';
import Dashboard from './pages/Dashboard';
import MaintenanceOrders from './pages/MaintenanceOrders';
import MaintenanceOrderForm from './pages/MaintenanceOrderForm';
import MaintenanceSchedule from './pages/MaintenanceSchedule';

import EmployeesAdmin from './pages/admin/Employees';

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode, adminOnly?: boolean }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  
  if (profile?.must_change_password && window.location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  if (adminOnly && profile?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ProtectedRoute><ChangePassword /></ProtectedRoute>} />
            
            <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="equipments" element={<Equipments />} />
              <Route path="maintenance" element={<Maintenance />} />
              <Route path="maintenance-orders" element={<MaintenanceOrders />} />
              <Route path="maintenance-orders/new" element={<MaintenanceOrderForm />} />
              <Route path="maintenance-orders/:id" element={<MaintenanceOrderForm />} />
              <Route path="maintenance-schedule" element={<MaintenanceSchedule />} />
              <Route path="profile" element={<Profile />} />
              
              {/* Admin Routes */}
              <Route path="admin/employees" element={<ProtectedRoute adminOnly><EmployeesAdmin /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AnimatePresence>
      </Router>
    </AuthProvider>
  );
}
