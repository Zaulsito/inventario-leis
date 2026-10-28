import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import UpdateNotification from './components/UpdateNotification'
import SplashScreen from './components/SplashScreen'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Historial from './pages/Historial'
import Pedidos from './pages/Pedidos'
import Registro from './pages/Registro'
import Reportes from './pages/Reportes'
import Login from './pages/Login'

function PrivateRoute({ children }) {
  const { currentUser, loading } = useAuth();
  if (loading) return null;
  return currentUser ? children : <Navigate to="/login" />;
}

function AppContent() {
  const { loading: authLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && (
        <SplashScreen
          title="LEIS INVENTARIO"
          subtitle="Gestión & Control de Stock"
          isLoading={authLoading}
          duration={1800}
          onFinish={() => setShowSplash(false)}
        />
      )}
      <UpdateNotification />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard />} />
          <Route path="inventario" element={<Inventario />} />
          <Route path="historial"  element={<Historial />} />
          <Route path="pedidos"    element={<Pedidos />} />
          <Route path="registro"   element={<Registro />} />
          <Route path="reportes"   element={<Reportes />} />
        </Route>
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
