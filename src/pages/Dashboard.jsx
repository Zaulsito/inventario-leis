// src/pages/Dashboard.jsx
import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Link } from 'react-router-dom'

function BadgeStock({ nivel }) {
  const cls = nivel === 'critico'
    ? 'bg-error/10 text-error'
    : 'bg-secondary-container/20 text-secondary'
  return (
    <span 
      className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${cls} ${nivel === 'critico' ? 'cursor-help' : ''}`}
      title={nivel === 'critico' ? 'El producto debe tener mínimo 10 para no estar bajo de stock' : ''}
    >
      {nivel === 'critico' ? 'Crítico' : 'Stock bajo'}
    </span>
  )
}

export default function Dashboard() {
  const [productos, setProductos] = useState([])
  const [showAlerta, setShowAlerta] = useState(true)
  const prevCriticos = useRef(0)

  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, 'productos'), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    return () => unsubProd()
  }, [])

  // Calculos
  const stockActual = productos.reduce((acc, p) => acc + p.stock, 0)
  const productCount = productos.length
  const valorTotal = productos.reduce((acc, p) => acc + (p.stock * p.precio), 0)

  const bajosDeStock = productos.filter(p => (p.estado === 'bajo' || p.estado === 'critico'))
  const criticos = bajosDeStock.filter(p => p.estado === 'critico').length

  useEffect(() => {
    if (criticos > 0 && criticos !== prevCriticos.current) {
      setShowAlerta(true)
    }
    prevCriticos.current = criticos
  }, [criticos])

  const metricas = [
    { icon: 'trending_up',  label: 'Valor inventario', valor: `$${valorTotal.toLocaleString()}`, sub: 'Actual' },
    { icon: 'inventory',    label: 'Stock actual',     valor: stockActual.toLocaleString(), sub: 'unidades' },
    { icon: 'deployed_code',label: 'Productos (SKUs)', valor: productCount.toLocaleString(), sub: 'Registrados' },
    { icon: 'priority_high',label: 'Elementos críticos', valor: criticos, sub: 'Requieren atención' },
  ]

  const diasSemana = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
  const entradas   = [35, 55, 45, 80, 60, 75]
  const salidas    = [50, 30, 60, 20, 45, 35]

  const getPoints = (dataArray) => {
    return dataArray.map((val, i) => {
      const x = (i / (diasSemana.length - 1)) * 100
      const y = 100 - (val / 100 * 100)
      return `${x},${y}`
    }).join(' ')
  }

  return (
    <div className="p-6 md:p-12">

      {/* Header */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end mb-10 gap-4">
        <div>
          <p className="text-secondary font-label text-xs font-bold uppercase tracking-[0.2em] mb-1">Resumen General</p>
          <h1 className="font-headline italic text-4xl md:text-5xl text-primary leading-tight">Este es tu resumen actual.</h1>
        </div>
        <div className="flex gap-3">
          {/* <Link to="/registro" className="flex items-center gap-2 px-5 py-3 bg-primary-container text-on-primary-container rounded-xl font-bold text-xs tracking-wide shadow-lg hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">add</span>
            Nuevo Registro
          </Link> */}
        </div>
      </header>

      {/* Métricas */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {metricas.map((m) => (
          <div key={m.label} className="p-6 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-between h-40">
            <span className="material-symbols-outlined text-secondary text-3xl">{m.icon}</span>
            <div>
              <p className="text-on-surface-variant font-label text-[10px] uppercase tracking-widest mb-1">{m.label}</p>
              <p className="text-2xl font-headline font-bold text-primary">{m.valor}</p>
              <p className="text-[10px] text-on-surface-variant">{m.sub}</p>
            </div>
          </div>
        ))}
      </section>

      {/* Gráfico + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

        {/* Gráfico lineal */}
        <div className="lg:col-span-2 p-8 rounded-3xl bg-surface-container-lowest border border-outline-variant/20 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline italic text-2xl text-primary">Movimientos Recientes</h2>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary inline-block" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" /> Salidas</span>
            </div>
          </div>

          <div className="flex-1 w-full relative mb-4 min-h-[150px]">
            <svg viewBox="0 -5 100 110" preserveAspectRatio="none" className="absolute inset-0 w-full h-full overflow-visible">
              <polyline points={getPoints(entradas)} fill="none" stroke="#a78b5e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <polyline points={getPoints(salidas)} fill="none" stroke="#524430" strokeWidth="2.5" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex justify-between w-full text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
            {diasSemana.map(d => <span key={d}>{d}</span>)}
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          {/* Alerta */}
          {criticos > 0 && showAlerta && (
            <div className="p-7 rounded-3xl bg-secondary text-white relative overflow-hidden">
              <div className="flex justify-between items-start relative z-10">
                <h3 className="font-headline text-xl mb-3">Alerta de Stock</h3>
                <button onClick={() => setShowAlerta(false)} className="text-white/60 hover:text-white transition-colors" title="Cerrar alerta">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <p className="text-sm opacity-80 mb-5 relative z-10">{criticos} {criticos === 1 ? 'producto ha' : 'productos han'} alcanzado el nivel crítico de reposición.</p>
              <Link to="/inventario" className="inline-block px-5 py-2 bg-primary-container text-on-primary-container rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform relative z-10 shadow-lg">
                Gestionar
              </Link>
              <div className="absolute -right-6 -bottom-6 opacity-10 pointer-events-none">
                <span className="material-symbols-outlined text-[120px]">warning</span>
              </div>
            </div>
          )}

          {/* Próximas entregas */}
          <div className="p-7 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col justify-center items-center min-h-[180px]">
            <h4 className="font-label font-bold text-[10px] uppercase tracking-[0.15em] text-on-surface-variant mb-4 self-start">Próximas Entregas</h4>
            <div className="flex flex-col items-center justify-center opacity-60 flex-1 w-full text-center">
              <span className="material-symbols-outlined text-4xl mb-2 text-outline">hourglass_empty</span>
              <p className="text-xs font-bold text-on-surface-variant mb-3">Próximamente...</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla stock bajo */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-6">
          <h2 className="font-headline italic text-3xl md:text-3xl text-primary leading-tight">Inventario Bajo en Stock</h2>
          <Link to="/inventario" className="text-secondary font-label text-xs font-bold uppercase tracking-widest hover:underline decoration-2 underline-offset-8 self-start md:self-auto pb-1 block">
            Ver todo el catálogo
          </Link>
        </div>
        <div className="overflow-x-auto rounded-3xl border border-outline-variant/20 bg-surface-container-lowest shadow-sm">
          <table className="w-full text-left border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-surface-container-high/50">
                {['Producto', 'Categoría', 'Stock actual', 'Umbral mín.', 'Acción'].map(h => (
                  <th key={h} className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/10">
              {bajosDeStock.map(p => (
                <tr key={p.id} className="hover:bg-surface-container-low transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      {p.fotoUrl ? (
                        <img src={p.fotoUrl} alt={p.nombre} className="w-10 h-10 rounded-xl object-cover bg-surface-variant flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center flex-shrink-0">
                          <span className="material-symbols-outlined text-primary text-sm">inventory_2</span>
                        </div>
                      )}
                      <span className="font-headline font-bold text-on-surface">{p.nombre}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">{(p.coleccion || '').toUpperCase()}</td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 whitespace-nowrap">
                      <BadgeStock nivel={p.estado} />
                      <span className="text-sm font-bold">{p.stock} u.</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-on-surface-variant">10</td>
                  <td className="px-6 py-5">
                    <Link to="/inventario" className="material-symbols-outlined text-primary opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-primary-container/20 rounded-full inline-block" title="Modificar">
                      edit
                    </Link>
                  </td>
                </tr>
              ))}
              {bajosDeStock.length === 0 && (
                <tr><td colSpan="5" className="text-center py-6 text-sm text-on-surface-variant">No hay inventario bajo.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Últimos ingresos */}
      <section>
        <h2 className="font-headline italic text-2xl text-primary mb-5">Productos Agregados Recientemente</h2>
        <div className="space-y-3">
          {[...productos]
            .sort((a, b) => new Date(b.fechaIngreso || 0) - new Date(a.fechaIngreso || 0))
            .slice(0, 10).map(p => (
            <div key={p.id} className="flex items-center justify-between p-5 bg-surface-container-low rounded-2xl border border-outline-variant/20 hover:bg-surface-container transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-variant flex items-center justify-center shrink-0 overflow-hidden">
                  {p.fotoUrl ? (
                    <img src={p.fotoUrl} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-primary text-sm">inventory_2</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-on-surface">{p.nombre}</p>
                  <p className="text-xs text-on-surface-variant">Agregado: {p.fechaIngreso || 'Semana actual'} · {(p.coleccion || '').toUpperCase()}</p>
                </div>
              </div>
              <Link to="/inventario" className="material-symbols-outlined text-outline group-hover:text-primary transition-colors" title="Modificar">
                edit
              </Link>
            </div>
          ))}
          {productos.length === 0 && (
            <p className="text-sm text-on-surface-variant">No hay productos en tu inventario aún.</p>
          )}
        </div>
      </section>
    </div>
  )
}
