// src/pages/Dashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Link } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'

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
  const [pedidos, setPedidos] = useState([])
  const [showAlerta, setShowAlerta] = useState(true)
  const prevCriticos = useRef(0)

  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, 'productos'), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    const unsubPed = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    return () => { unsubProd(); unsubPed(); }
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
    { icon: 'priority_high',label: 'Stock Bajo',       valor: bajosDeStock.length, sub: 'Elementos críticos', isAlert: true },
  ]

  // Generar datos reales para los últimos 7 días basado en 'pedidos'
  const chartData = useMemo(() => {
    const last7Days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const locStr = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
      last7Days.push(locStr)
    }

    return last7Days.map(dateStr => {
      const pedidosDay = pedidos.filter(p => {
        let pDateStr = p.fechaEntrega
        if (p.fechaCreacion) {
          const cDate = new Date(p.fechaCreacion)
          pDateStr = cDate.getFullYear() + '-' + String(cDate.getMonth() + 1).padStart(2, '0') + '-' + String(cDate.getDate()).padStart(2, '0')
        }
        return pDateStr === dateStr
      })

      let sumVentas = 0
      pedidosDay.forEach(ped => {
        ped.productos.forEach(prod => { sumVentas += Number(prod.cantidad) })
      })

      const ingresosDay = productos.filter(p => p.fechaIngreso === dateStr)
      let sumEntradas = 0
      ingresosDay.forEach(prod => { sumEntradas += Number(prod.stock) })

      const dObj = new Date(dateStr + 'T12:00:00')
      const nombreDia = dObj.toLocaleDateString('es-ES', { weekday: 'short' })

      return {
        name: nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1),
        Ventas: sumVentas,
        Entradas: sumEntradas
      }
    })
  }, [pedidos, productos])

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
          <div 
            key={m.label} 
            className={`p-6 rounded-3xl border flex flex-col justify-between h-40 transition-colors ${
              m.isAlert && m.valor > 0 
                ? 'bg-error text-on-error border-error' 
                : 'bg-surface-container-low border-outline-variant/20'
            }`}
          >
            <span className={`material-symbols-outlined text-3xl ${m.isAlert && m.valor > 0 ? 'opacity-90' : 'text-secondary'}`}>
              {m.icon}
            </span>
            <div>
              <p className={`font-label text-[10px] uppercase tracking-widest mb-1 ${m.isAlert && m.valor > 0 ? 'opacity-80' : 'text-on-surface-variant'}`}>
                {m.label}
              </p>
              <p className={`text-2xl font-headline font-bold ${m.isAlert && m.valor > 0 ? '' : 'text-primary'}`}>
                {m.valor}
              </p>
              <p className={`text-[10px] ${m.isAlert && m.valor > 0 ? 'opacity-70' : 'text-on-surface-variant'}`}>
                {m.sub}
              </p>
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
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary inline-block" /> Ventas</span>
            </div>
          </div>

          <div className="flex-1 w-full relative mb-4 min-h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#808080', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#808080', fontWeight: 'bold' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#524430', marginBottom: '4px' }}
                />
                <Bar dataKey="Ventas" fill="#524430" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Entradas" fill="#a78b5e" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
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
          <div className="p-7 rounded-3xl bg-surface-container-low border border-outline-variant/20 flex flex-col min-h-[180px]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-label font-bold text-[10px] uppercase tracking-[0.15em] text-on-surface-variant">Próximas Entregas</h4>
              <Link to="/pedidos" className="text-secondary hover:text-primary transition-colors tooltip flex items-center justify-center" title="Ver todos">
                <span className="material-symbols-outlined text-sm">open_in_new</span>
              </Link>
            </div>
            
            <div className="overflow-y-auto flex-1 pr-2 space-y-3">
              {pedidos
                .filter(p => {
                  // +1 to count today effectively as within exactly the difference of days plus the margin
                  const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1
                  return diasFaltantes >= 0 && diasFaltantes <= 3 // Entregas en los próximos 3 días
                })
                .sort((a, b) => new Date(a.fechaEntrega) - new Date(b.fechaEntrega))
                .map(p => {
                  const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1
                  return (
                    <div key={p.id} className="bg-surface-container p-3 rounded-xl border border-outline-variant/20 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-on-surface truncate pr-2 max-w-[150px]">{p.cliente}</p>
                        <p className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest mt-0.5">{p.productos.length} items</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span className="px-2 py-0.5 bg-error/10 text-error text-[9px] font-extrabold uppercase rounded-full tracking-widest animate-pulse inline-block mb-1">
                          ¡Faltan {diasFaltantes} d!
                        </span>
                        <p className="text-[10px] font-bold text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">calendar_month</span>
                          {p.fechaEntrega.split('-').slice(1).join('/')}
                        </p>
                      </div>
                    </div>
                  )
                })}

              {pedidos.filter(p => {
                const df = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1
                return df >= 0 && df <= 3
              }).length === 0 && (
                <div className="flex flex-col items-center justify-center opacity-60 h-full w-full text-center mt-6">
                  <span className="material-symbols-outlined text-3xl mb-2 text-outline">done_all</span>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant">Libre de entregas</p>
                </div>
              )}
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
