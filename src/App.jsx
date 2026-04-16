import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Registro from './pages/Registro'
import Reportes from './pages/Reportes'
import Login from './pages/Login'

function PrivateRoute({ children }) {
  const { currentUser } = useAuth();
  return currentUser ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
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
          <Route path="registro"   element={<Registro />} />
          <Route path="reportes"   element={<Reportes />} />
        </Route>
      </Routes>
    </AuthProvider>
  )
}
