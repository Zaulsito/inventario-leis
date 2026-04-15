// src/pages/Inventario.jsx
import { useState } from 'react'

// Datos de ejemplo — se reemplazarán con Firestore
const productosIniciales = [
  { id: 1, nombre: 'Aceite de Oro Rosa',          sku: 'INV-001', coleccion: 'Premium',  stock: 428,  precio: 85,   estado: 'disponible' },
  { id: 2, nombre: 'Sérum Regenerador Nocturno',   sku: 'INV-014', coleccion: 'Premium',  stock: 8,    precio: 120,  estado: 'bajo' },
  { id: 3, nombre: 'Crema Hidratante Esencial',    sku: 'INV-089', coleccion: 'Esencial', stock: 1120, precio: 45,   estado: 'disponible' },
  { id: 4, nombre: 'Tónico Esencial Rosas',        sku: 'INV-022', coleccion: 'Esencial', stock: 24,   precio: 38,   estado: 'bajo' },
  { id: 5, nombre: 'Bálsamo Labial Heritage',      sku: 'INV-044', coleccion: 'Premium',  stock: 5,    precio: 25,   estado: 'critico' },
  { id: 6, nombre: 'Mascarilla Renovadora',        sku: 'INV-067', coleccion: 'Esencial', stock: 92,   precio: 55,   estado: 'disponible' },
  { id: 7, nombre: 'Agua Micelar Purificante',     sku: 'INV-033', coleccion: 'Base',     stock: 310,  precio: 22,   estado: 'disponible' },
]

const estadoConfig = {
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  bajo:       { label: 'Stock bajo', cls: 'bg-error-container text-error' },
  critico:    { label: 'Crítico',    cls: 'bg-error/15 text-error font-extrabold' },
}

export default function Inventario() {
  const [busqueda, setBusqueda]   = useState('')
  const [filtroCol, setFiltroCol] = useState('Todos')

  const colecciones = ['Todos', ...new Set(productosIniciales.map(p => p.coleccion))]

  const filtrados = productosIniciales.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.sku.toLowerCase().includes(busqueda.toLowerCase())
    const matchCol  = filtroCol === 'Todos' || p.coleccion === filtroCol
    return matchBusq && matchCol
  })

  const totalSKUs    = productosIniciales.length
  const bajosDeStock = productosIniciales.filter(p => p.estado === 'bajo' || p.estado === 'critico').length
  const valorTotal   = productosIniciales.reduce((acc, p) => acc + p.stock * p.precio, 0)
  const stockTotal   = productosIniciales.reduce((acc, p) => acc + p.stock, 0)

  function porcBarra(stock) {
    const max = Math.max(...productosIniciales.map(p => p.stock))
    return Math.round((stock / max) * 100)
  }

  return (
    <div className="flex flex-col h-full">

      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-8 md:px-10 py-7 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-outline-variant/20">
        <div>
          <h1 className="font-headline text-4xl text-secondary font-bold italic leading-tight">Inventario Maestro</h1>
          <p className="text-primary font-label text-xs uppercase tracking-[0.2em] font-bold mt-1">Control de Existencias</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar productos..."
              className="bg-surface-container-low rounded-full pl-10 pr-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container w-56 border border-outline-variant/20"
            />
          </div>
          <button className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-label font-bold uppercase text-[11px] tracking-widest hover:shadow-xl transition-shadow shadow-md">
            <span className="material-symbols-outlined text-sm">add</span>
            Nuevo Producto
          </button>
        </div>
      </header>

      <div className="p-8 md:p-10 space-y-8">

        {/* Métricas bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between h-36">
            <span className="material-symbols-outlined text-primary text-3xl">deployed_code</span>
            <div>
              <p className="text-3xl font-headline italic font-bold">{totalSKUs.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-outline">Total SKUs</p>
            </div>
          </div>
          <div className="bg-primary-container p-6 rounded-xl flex flex-col justify-between h-36 shadow-lg border border-primary/10">
            <span className="material-symbols-outlined text-on-primary-container text-3xl">priority_high</span>
            <div>
              <p className="text-3xl font-headline italic font-bold text-on-primary-container">{bajosDeStock}</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-on-primary-container">Stock Bajo</p>
            </div>
          </div>
          <div className="bg-surface-container-highest p-6 rounded-xl flex flex-col justify-between h-36">
            <span className="material-symbols-outlined text-secondary text-3xl">payments</span>
            <div>
              <p className="text-3xl font-headline italic font-bold">${(valorTotal / 1000).toFixed(0)}k</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-outline">Valor Inventario</p>
            </div>
          </div>
          <div className="bg-secondary-container/20 p-6 rounded-xl flex flex-col justify-between h-36 border border-secondary-container/30">
            <span className="material-symbols-outlined text-secondary text-3xl">inventory_2</span>
            <div>
              <p className="text-3xl font-headline italic font-bold text-secondary">{stockTotal.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-secondary">Unidades totales</p>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-surface-container-low rounded-3xl overflow-hidden shadow-sm">
          {/* Toolbar tabla */}
          <div className="px-7 py-5 border-b border-outline-variant/20 bg-surface-container/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {colecciones.map(c => (
                <button
                  key={c}
                  onClick={() => setFiltroCol(c)}
                  className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                    filtroCol === c
                      ? 'bg-secondary text-white border-secondary'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-outline-variant rounded-lg hover:bg-surface transition-colors">
                Exportar PDF
              </button>
              <button className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-outline-variant rounded-lg hover:bg-surface transition-colors">
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container">
                  {['Producto', 'Colección', 'Stock', 'Precio unit.', 'Estado', ''].map(h => (
                    <th key={h} className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtrados.map(p => {
                  const est = estadoConfig[p.estado]
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-7 py-5">
                        <p className="font-headline font-bold text-base text-on-surface">{p.nombre}</p>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest">SKU: {p.sku}</p>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant text-on-surface-variant text-[10px] font-bold uppercase rounded-full">
                          {p.coleccion}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        <p className={`text-sm font-bold mb-1 ${p.estado !== 'disponible' ? 'text-error' : ''}`}>
                          {p.stock.toLocaleString()} u.
                        </p>
                        <div className="w-24 bg-outline-variant/20 h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.estado === 'disponible' ? 'bg-primary' : 'bg-error'}`}
                            style={{ width: `${porcBarra(p.stock)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <p className="text-sm font-bold text-secondary">${p.precio.toFixed(2)}</p>
                      </td>
                      <td className="px-7 py-5">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-lg ${est.cls}`}>
                          {est.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5 text-right">
                        <button className="text-outline hover:text-secondary p-2 transition-colors opacity-0 group-hover:opacity-100">
                          <span className="material-symbols-outlined">more_vert</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-7 py-12 text-center text-on-surface-variant text-sm">
                      No se encontraron productos.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          <div className="px-7 py-5 bg-surface-container/30 flex justify-between items-center border-t border-outline-variant/10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
              Mostrando {filtrados.length} de {productosIniciales.length} productos
            </p>
            <div className="flex gap-1">
              {[1, 2, 3].map(n => (
                <button
                  key={n}
                  className={`w-9 h-9 rounded-lg text-xs font-bold transition-colors ${n === 1 ? 'bg-secondary text-white' : 'hover:bg-surface-container-highest'}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
