// src/pages/Dashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Link, useOutletContext } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Footer from '../components/Footer'

function BadgeStock({ nivel }) {
  const cls = nivel === 'critico'
    ? 'bg-error/10 text-error border border-error/20 backdrop-blur-sm shadow-sm animate-pulse'
    : 'bg-[#e2bd6c]/10 text-[#e2bd6c] border border-[#e2bd6c]/20 backdrop-blur-sm shadow-sm'
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
  const { isDark } = useOutletContext()
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [showAlerta, setShowAlerta] = useState(true)
  const [showMoreBajos, setShowMoreBajos] = useState(false)
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
    <div className="p-8 md:p-10 relative flex flex-col min-h-full overflow-y-auto transition-colors duration-500">

      {/* Header adaptable */}
      <header className="py-8 flex flex-col md:flex-row md:justify-between md:items-end gap-4 shrink-0 tour-inicio-header">
        <div className="relative text-center mx-auto">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.4em] text-primary/40 dark:text-[#e2bd6c]/40 mb-2">Plataforma de Control</p>
          <h2 className="font-headline text-5xl md:text-7xl text-primary dark:text-white italic leading-tight tracking-tighter">
            Leis <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary dark:from-[#e2bd6c] dark:to-[#f3d692]">Administración</span>
          </h2>
          <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>
        <div className="flex gap-3">
          {/* <Link to="/registro" className="flex items-center gap-2 px-5 py-3 bg-primary-container text-on-primary-container rounded-xl font-bold text-xs tracking-wide shadow-lg hover:scale-105 transition-transform">
            <span className="material-symbols-outlined text-xl">add</span>
            Nuevo Registro
          </Link> */}
        </div>
      </header>
      
      {/* Acciones Rápidas - Estilo Glassmorphism */}
      <section className="mb-10 tour-inicio-compartir">
        <div className="p-8 rounded-[2.5rem] bg-surface-container-low/40 dark:bg-[#1e1e1e]/60 backdrop-blur-xl border border-outline-variant/30 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 group relative overflow-hidden shadow-sm">
          <div className="flex flex-col md:flex-row items-center gap-6 relative z-10 text-center md:text-left">
            <div className="w-16 h-16 rounded-3xl bg-primary/10 dark:bg-[#e2bd6c]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-3xl">share_windows</span>
            </div>
            <div>
              <p className="font-label text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 dark:text-[#e2bd6c]/60 mb-1">Catálogo Público</p>
              <h3 className="font-headline text-2xl italic text-primary dark:text-[#e2bd6c] leading-none">Listo para compartir con tus clientes</h3>
            </div>
          </div>
          
          <div className="flex gap-3 relative z-10 w-full md:w-auto">
            <button 
              onClick={() => {
                const url = window.location.origin.includes('localhost') ? "http://localhost:5175" : "https://inventario-leis-catalogo.vercel.app";
                navigator.clipboard.writeText(url);
                alert("✅ Enlace copiado");
              }}
              className="flex-1 md:flex-none px-6 py-3.5 bg-surface-container-high/60 dark:bg-white/5 hover:bg-primary/10 dark:hover:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-outline-variant/20 dark:border-white/10"
            >
              <span className="material-symbols-outlined text-lg">content_copy</span>
              Copiar Link
            </button>
            <button 
              onClick={() => {
                const url = window.location.origin.includes('localhost') ? "http://localhost:5175" : "https://inventario-leis-catalogo.vercel.app";
                const msg = `¡Hola! Te comparto mi catálogo actualizado de Leis Belleza ✨: ${url}`;
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
              }}
              className="flex-1 md:flex-none px-6 py-3.5 bg-primary dark:bg-[#e2bd6c] text-white dark:text-black hover:scale-105 rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20 dark:shadow-[#e2bd6c]/10"
            >
              <span className="material-symbols-outlined text-lg text-white dark:text-black">send</span>
              WhatsApp
            </button>
          </div>
          
          {/* Decoración sutil de fondo */}
          <div className="absolute -right-10 -bottom-10 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700">
            <span className="material-symbols-outlined text-[200px]">auto_awesome</span>
          </div>
        </div>
      </section>

      {/* Métricas */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10 tour-inicio-metricas">
        {metricas.map((m) => (
          <div 
            key={m.label} 
            className={`p-6 rounded-3xl border border-outline-variant/30 dark:border-white/5 bg-surface-container-low/40 dark:bg-[#1e1e1e] backdrop-blur-xl flex flex-col justify-between h-40 transition-all hover:bg-surface-container-low/60 dark:hover:bg-[#252525] ${
              m.isAlert && m.valor > 0 ? 'shadow-lg shadow-error/5 border-error/30 dark:border-error/40' : 'shadow-sm'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className={`material-symbols-outlined text-2xl transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error animate-pulse' : 'text-primary/60 dark:text-[#e2bd6c]'
              }`}>
                {m.icon}
              </span>
              <p className={`font-label text-[10px] font-bold uppercase tracking-widest leading-none transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error' : 'text-primary/60 dark:text-[#e2bd6c]/80'
              }`}>
                {m.label}
              </p>
            </div>
            
            <div className="mt-auto">
              <p className={`font-headline font-bold mb-0.5 transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error' : 'text-primary dark:text-white'
              } ${m.valor.toString().length > 10 ? 'text-lg' : 'text-2xl'}`}>
                {m.valor}
              </p>
              <p className={`text-[9px] font-bold uppercase tracking-widest transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error/60' : 'text-primary/40 dark:text-white/40'
              }`}>
                {m.sub}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Gráfico + Alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">

        {/* Gráfico lineal */}
        <div className="lg:col-span-2 p-8 rounded-3xl bg-surface-container-lowest dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/5 shadow-sm flex flex-col">
          <div className="flex justify-between items-center mb-8">
            <h2 className="font-headline italic text-2xl text-primary dark:text-[#e2bd6c]">Movimientos Recientes</h2>
            <div className="flex items-center gap-4 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-primary dark:bg-[#e2bd6c]/60 inline-block" /> Entradas</span>
              <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-secondary dark:bg-[#e2bd6c] inline-block" /> Ventas</span>
            </div>
          </div>

          <div className="flex-1 w-full relative mb-4 min-h-[250px] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,0.05)" : "#e5e5e5"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#e2bd6c88' : '#808080', fontWeight: 'bold' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: isDark ? '#e2bd6c88' : '#808080', fontWeight: 'bold' }} dx={-10} />
                <Tooltip 
                  cursor={{ fill: 'transparent' }} 
                  contentStyle={{ borderRadius: '16px', border: 'none', backgroundColor: isDark ? '#252525' : '#fff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: isDark ? '#e2bd6c' : '#524430', marginBottom: '4px' }}
                />
                <Bar dataKey="Ventas" fill={isDark ? "#e2bd6c" : "#524430"} radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="Entradas" fill={isDark ? "#e2bd6c44" : "#a78b5e"} radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="space-y-4">
          {/* Alerta - Estilo Cristal */}
          {criticos > 0 && showAlerta && (
            <div className="p-7 rounded-3xl bg-error/10 backdrop-blur-xl border border-error/20 text-error relative overflow-hidden shadow-xl shadow-error/5">
              <div className="flex justify-between items-start relative z-10">
                <h3 className="font-headline text-xl mb-3">Alerta de Stock</h3>
                <button onClick={() => setShowAlerta(false)} className="text-error/40 hover:text-error transition-colors" title="Cerrar alerta">
                  <span className="material-symbols-outlined text-sm">close</span>
                </button>
              </div>
              <p className="text-sm text-error/80 mb-5 relative z-10 font-bold">{criticos} {criticos === 1 ? 'producto ha' : 'productos han'} alcanzado el nivel crítico.</p>
              <Link to="/inventario" className="inline-block px-5 py-2 bg-error text-white rounded-full font-bold text-xs uppercase tracking-widest hover:scale-105 transition-transform relative z-10 shadow-lg shadow-error/20">
                Gestionar
              </Link>
              <div className="absolute -right-6 -bottom-6 opacity-[0.05] pointer-events-none">
                <span className="material-symbols-outlined text-[120px]">warning</span>
              </div>
            </div>
          )}

          {/* Próximas entregas */}
          <div className="p-7 rounded-3xl bg-surface-container-low dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/5 flex flex-col min-h-[180px]">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-label font-bold text-[10px] uppercase tracking-[0.15em] text-on-surface-variant dark:text-[#e2bd6c]/80">Próximas Entregas</h4>
              <Link to="/pedidos" className="text-secondary dark:text-[#e2bd6c] hover:text-primary transition-colors tooltip flex items-center justify-center" title="Ver todos">
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
                    <div key={p.id} className="bg-surface-container dark:bg-white/5 p-3 rounded-xl border border-outline-variant/20 dark:border-white/10 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-sm text-on-surface dark:text-white/90 truncate pr-2 max-w-[150px]">{p.cliente}</p>
                        <p className="text-[10px] text-on-surface-variant dark:text-gray-500 font-bold uppercase tracking-widest mt-0.5">{p.productos.length} items</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end">
                        <span className="px-2 py-0.5 bg-error/10 text-error text-[9px] font-extrabold uppercase rounded-full tracking-widest animate-pulse inline-block mb-1">
                          ¡Faltan {diasFaltantes} d!
                        </span>
                        <p className="text-[10px] font-bold text-on-surface-variant dark:text-gray-400 flex items-center gap-1">
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
                  <span className="material-symbols-outlined text-3xl mb-2 text-outline dark:text-gray-600">done_all</span>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant dark:text-gray-400">Libre de entregas</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla stock bajo */}
      <section className="mb-10">
        <div className="flex flex-col md:flex-row md:justify-between md:items-end gap-3 mb-6">
          <h2 className="font-headline italic text-3xl md:text-3xl text-primary dark:text-[#e2bd6c] leading-tight">Inventario Bajo en Stock</h2>
          <Link to="/inventario" className="text-secondary dark:text-[#e2bd6c] font-label text-xs font-bold uppercase tracking-widest hover:underline decoration-2 underline-offset-8 self-start md:self-auto pb-1 block">
            Ver todo el catálogo
          </Link>
        </div>
        <div className="space-y-4">
          {bajosDeStock.slice(0, showMoreBajos ? undefined : 10).map(p => (
            <details key={p.id} className="group bg-surface-container-low dark:bg-[#1e1e1e] rounded-[2rem] border border-outline-variant/20 dark:border-white/5 shadow-sm overflow-hidden transition-all duration-300">
              <summary className="list-none cursor-pointer p-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-white/5 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-xl">inventory_2</span>
                  </div>
                  <div>
                    <h4 className="font-headline font-bold text-lg text-on-surface dark:text-white/90 leading-tight">{p.nombre}</h4>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant dark:text-gray-500 mt-0.5">{(p.coleccion || 'S/C')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-bold dark:text-white/80">{p.stock} u.</p>
                    <BadgeStock nivel={p.estado} />
                  </div>
                  <span className="material-symbols-outlined text-outline dark:text-gray-500 group-open:rotate-180 transition-transform">expand_more</span>
                </div>
              </summary>
              <div className="px-6 pb-6 pt-2 border-t border-outline-variant/10 dark:border-white/5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-surface dark:bg-white/5 rounded-2xl">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">Stock Actual</p>
                    <p className="text-sm font-bold dark:text-white/90">{p.stock} unidades</p>
                  </div>
                  <div className="p-4 bg-surface dark:bg-white/5 rounded-2xl">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">Umbral Mínimo</p>
                    <p className="text-sm font-bold dark:text-white/90">10 unidades</p>
                  </div>
                </div>
                <div className="flex">
                  <Link 
                    to="/inventario" 
                    className="w-full py-4 bg-primary dark:bg-[#e2bd6c] text-white dark:text-black rounded-xl font-bold text-[11px] uppercase tracking-widest text-center shadow-lg shadow-primary/20 dark:shadow-[#e2bd6c]/10 active:scale-[0.98] transition-transform"
                  >
                    Actualizar Stock
                  </Link>
                </div>
              </div>
            </details>
          ))}
          {bajosDeStock.length === 0 && (
            <div className="p-10 text-center bg-surface-container-low dark:bg-[#1e1e1e] rounded-[2.5rem] border border-outline-variant/10 dark:border-white/5 opacity-60">
              <span className="material-symbols-outlined text-4xl mb-2 text-outline dark:text-gray-600">check_circle</span>
              <p className="text-[10px] uppercase tracking-widest font-bold">Todo el inventario está en niveles óptimos</p>
            </div>
          )}
        </div>
        {bajosDeStock.length > 10 && (
          <div className="mt-4 flex justify-center">
            <button 
              onClick={() => setShowMoreBajos(!showMoreBajos)}
              className="flex items-center gap-2 px-6 py-3 bg-surface-container-low dark:bg-white/5 hover:bg-surface-container-high dark:hover:bg-white/10 text-primary dark:text-[#e2bd6c] rounded-2xl font-bold text-xs uppercase tracking-widest transition-all shadow-sm border border-outline-variant/10 dark:border-white/10"
            >
              <span className="material-symbols-outlined text-lg">
                {showMoreBajos ? 'keyboard_arrow_up' : 'expand_more'}
              </span>
              {showMoreBajos 
                ? 'Ver menos productos' 
                : `Ver ${bajosDeStock.length - 10} productos más`
              }
            </button>
          </div>
        )}
      </section>

      {/* Últimos ingresos */}
      <section>
        <h2 className="font-headline italic text-2xl text-primary dark:text-[#e2bd6c] mb-5">Productos Agregados Recientemente</h2>
        <div className="space-y-3">
          {[...productos]
            .sort((a, b) => new Date(b.fechaIngreso || 0) - new Date(a.fechaIngreso || 0))
            .slice(0, 10).map(p => (
            <div key={p.id} className="flex items-center justify-between p-5 bg-surface-container-low dark:bg-[#1e1e1e] rounded-2xl border border-outline-variant/20 dark:border-white/5 hover:bg-surface-container dark:hover:bg-white/5 transition-colors group">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-surface-variant dark:bg-white/5 flex items-center justify-center shrink-0 overflow-hidden">
                  {p.fotoUrl ? (
                    <img src={p.fotoUrl} alt={p.nombre} className="w-full h-full object-cover" />
                  ) : (
                    <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-sm">inventory_2</span>
                  )}
                </div>
                <div>
                  <p className="font-bold text-sm text-on-surface dark:text-white/90">{p.nombre}</p>
                  <p className="text-xs text-on-surface-variant dark:text-gray-400">Agregado: {p.fechaIngreso || 'Semana actual'} · {(p.coleccion || '').toUpperCase()}</p>
                </div>
              </div>
              <Link to="/inventario" className="material-symbols-outlined text-outline dark:text-gray-500 group-hover:text-primary dark:group-hover:text-[#e2bd6c] transition-colors" title="Modificar">
                edit
              </Link>
            </div>
          ))}
          {productos.length === 0 && (
            <p className="text-sm text-on-surface-variant">No hay productos en tu inventario aún.</p>
          )}
        </div>
      </section>
      <Footer />
    </div>
  )
}
