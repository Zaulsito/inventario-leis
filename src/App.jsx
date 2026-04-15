import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Inventario from './pages/Inventario'
import Registro from './pages/Registro'
import Reportes from './pages/Reportes'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"  element={<Dashboard />} />
        <Route path="inventario" element={<Inventario />} />
        <Route path="registro"   element={<Registro />} />
        <Route path="reportes"   element={<Reportes />} />
      </Route>
    </Routes>
  )
}
