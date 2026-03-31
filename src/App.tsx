import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import React from 'react';
import { doc, getDocFromServer } from 'firebase/firestore';
import { db } from './lib/firebase';
import { useAuth } from './lib/auth';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import StaffManagement from './components/StaffManagement';
import ClientManagement from './components/ClientManagement';
import ProductManagement from './components/ProductManagement';
import ServiceManagement from './components/ServiceManagement';
import AppointmentCalendar from './components/AppointmentCalendar';
import FinancialManagement from './components/FinancialManagement';
import CashRegister from './components/CashRegister';
import Auth from './components/Auth';
import ErrorBoundary from './components/ErrorBoundary';

export default function App() {
  const { isAdmin, isAgente, loading, user } = useAuth();

  React.useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-secondary/30">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route path="/login" element={<Auth />} />
          <Route path="/" element={user ? <Layout /> : <Navigate to="/login" replace />}>
            <Route index element={<Dashboard />} />
            <Route path="agenda" element={<AppointmentCalendar />} />
            <Route path="clientes" element={<ClientManagement />} />
            <Route path="produtos" element={<ProductManagement />} />
            
            <Route 
              path="servicos" 
              element={isAdmin ? <ServiceManagement /> : <Navigate to="/" replace />} 
            />
            <Route 
              path="equipe" 
              element={isAdmin ? <StaffManagement /> : <Navigate to="/" replace />} 
            />
            <Route path="caixa" element={<CashRegister />} />
            <Route 
              path="financeiro" 
              element={isAdmin ? <FinancialManagement /> : <Navigate to="/" replace />} 
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}
