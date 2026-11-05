// src/pages/Dashboard.jsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../config/firebase'
import { Link, useOutletContext } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { formatDateDMA } from '../utils/date'
import Footer from '../components/Footer'
import { getOptimizedImageUrl } from '../utils/image'
import HeroBannerModal from '../components/HeroBannerModal'

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
  const [registrosEnvios, setRegistrosEnvios] = useState([])
  const [tabDeudas, setTabDeudas] = useState('cobrar') // 'cobrar' | 'pagar'
  const [showMoreBajos, setShowMoreBajos] = useState(false)
  const [showHeroModal, setShowHeroModal] = useState(false)

  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, 'productos'), (snapshot) => {
      setProductos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })
    const unsubPed = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      setPedidos(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    })

    let listReg = []
    let listGas = []
    const updateRegistros = () => {
      const map = new Map()
      ;[...listReg, ...listGas].forEach(item => {
        if (!map.has(item.id)) map.set(item.id, item)
      })
      setRegistrosEnvios(Array.from(map.values()))
    }
    const unsubReg = onSnapshot(collection(db, 'registros_envios'), (snap) => {
      listReg = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      updateRegistros()
    })
    const unsubGas = onSnapshot(collection(db, 'gastos_envios'), (snap) => {
      listGas = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      updateRegistros()
    })

    return () => {
      unsubProd();
      unsubPed();
      unsubReg();
      unsubGas();
    }
  }, [])

  // Calculos
  const stockActual = productos.reduce((acc, p) => acc + p.stock, 0)
  const productCount = productos.length
  const valorTotal = productos.reduce((acc, p) => acc + (p.stock * p.precio), 0)
  const valorTotalCosto = productos.reduce((acc, p) => acc + (p.stock * (p.precioCosto || 0)), 0)

  const bajosDeStock = productos.filter(p => (p.estado === 'bajo' || p.estado === 'critico'))
  const criticos = bajosDeStock.filter(p => p.estado === 'critico').length

  // Deudas por cobrar (Pedidos de clientes sin pagar o saldo parcial)
  const deudasClientes = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    return pedidos
      .filter(p => p.pagoEstado !== 'pagado')
      .map(p => {
        const total = Number(p.total) || 0
        const abono = Number(p.abono) || 0
        const saldo = p.saldoPendiente !== undefined ? Number(p.saldoPendiente) : Math.max(0, total - abono)
        const montoDeuda = saldo > 0 ? saldo : total

        let diasFaltantes = 0
        if (p.fechaEntrega) {
          const [y, m, d] = p.fechaEntrega.split('-').map(Number)
          const fEntrega = new Date(y, m - 1, d)
          fEntrega.setHours(0, 0, 0, 0)
          diasFaltantes = Math.round((fEntrega - hoy) / (1000 * 60 * 60 * 24))
        }

        const telefono = p.telefono || p.clienteTelefono || ''
        const waClean = telefono.replace(/\D/g, '')
        const waLink = waClean
          ? `https://wa.me/${waClean.startsWith('56') ? waClean : '56' + waClean}?text=${encodeURIComponent(
              `Hola ${p.cliente || ''}, te saludamos de LEY'S. Te recordamos el saldo pendiente de tu pedido por ${montoDeuda.toLocaleString('es-CL')}. ¡Muchas gracias!`
            )}`
          : null

        return {
          ...p,
          montoDeuda,
          diasFaltantes,
          isAtrasado: diasFaltantes < 0,
          isHoy: diasFaltantes === 0,
          waLink
        }
      })
      .sort((a, b) => a.diasFaltantes - b.diasFaltantes)
  }, [pedidos])

  const totalPorCobrar = useMemo(() => {
    return deudasClientes.reduce((acc, p) => acc + (p.montoDeuda || 0), 0)
  }, [deudasClientes])

  // Cuotas de compras a crédito de boletas/registros por pagar
  const cuotasPorPagar = useMemo(() => {
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const list = []

    registrosEnvios.forEach(reg => {
      if (reg.medioPago === 'credito' && Array.isArray(reg.cuotas)) {
        reg.cuotas.forEach((c, idx) => {
          if (!c.pagada && c.fecha) {
            const [y, m, d] = c.fecha.split('-').map(Number)
            const fCuota = new Date(y, m - 1, d)
            fCuota.setHours(0, 0, 0, 0)
            const diasFaltantes = Math.round((fCuota - hoy) / (1000 * 60 * 60 * 24))

            list.push({
              id: `${reg.id}_${idx}`,
              registroId: reg.id,
              nombreRegistro: reg.nombreRegistro || reg.nombreBoleta || 'Registro',
              proveedor: reg.proveedor || 'Proveedor General',
              tarjeta: reg.nombreTarjeta || 'Tarjeta de Crédito',
              numeroCuota: c.numero || (idx + 1),
              totalCuotas: reg.cuotas.length,
              monto: Number(c.monto) || 0,
              fecha: c.fecha,
              fechaLabel: c.fechaLabel || formatDateDMA(c.fecha),
              diasFaltantes,
              isAtrasado: diasFaltantes < 0,
              isHoy: diasFaltantes === 0
            })
          }
        })
      }
    })

    return list.sort((a, b) => a.diasFaltantes - b.diasFaltantes)
  }, [registrosEnvios])

  const totalPorPagar = useMemo(() => {
    return cuotasPorPagar.reduce((acc, c) => acc + (c.monto || 0), 0)
  }, [cuotasPorPagar])


  const metricas = [
    { icon: 'trending_up',  label: 'Valor inventario', valor: `$${valorTotal.toLocaleString('es-CL')}`, sub: `COSTO: $${valorTotalCosto.toLocaleString('es-CL')} | GANANCIA: +$${(valorTotal - valorTotalCosto).toLocaleString('es-CL')}` },
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
          <h2 className="font-headline text-5xl md:text-7xl italic leading-tight tracking-tighter text-primary dark:text-white luxe-reveal">
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
          
          <div className="flex flex-wrap gap-3 relative z-10 w-full md:w-auto">
            <button 
              onClick={() => setShowHeroModal(true)}
              className="flex-1 md:flex-none px-5 py-3.5 bg-[#e2bd6c]/15 hover:bg-[#e2bd6c]/25 text-[#e2bd6c] rounded-2xl font-bold text-[11px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 border border-[#e2bd6c]/30 shadow-md cursor-pointer"
              title="Personalizar Banner Hero del Catálogo"
            >
              <span className="material-symbols-outlined text-lg">auto_awesome</span>
              Banner Hero
            </button>
            <button 
              onClick={() => {
                const url = window.location.origin.includes('localhost') ? "http://localhost:5174" : "https://inventario-leis-catalogo.vercel.app";
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
                const url = window.location.origin.includes('localhost') ? "http://localhost:5174" : "https://inventario-leis-catalogo.vercel.app";
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
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8 tour-inicio-metricas">
        {metricas.map((m) => (
          <div 
            key={m.label} 
            className={`p-3.5 md:p-4 rounded-2xl border backdrop-blur-2xl flex flex-col justify-between min-h-[105px] transition-all duration-500 shadow-sm
              ${!isDark 
                ? 'bg-primary/[0.04] border-primary/10 hover:bg-primary/[0.08] shadow-[0_8px_30px_rgb(142,109,60,0.05)]' 
                : 'bg-[#1e1e1e]/60 border-white/5 shadow-sm hover:bg-[#252525]/80'}
              ${m.isAlert && m.valor > 0 ? 'shadow-lg shadow-error/10 border-error/30 dark:border-error/40' : ''}`}
          >
            <div className="flex items-center gap-2">
              <span className={`material-symbols-outlined text-xl transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error animate-pulse' : 'text-primary/60 dark:text-[#e2bd6c]'
              }`}>
                {m.icon}
              </span>
              <p className={`font-label text-[9px] font-bold uppercase tracking-widest leading-none transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error' : 'text-primary/60 dark:text-[#e2bd6c]/80'
              }`}>
                {m.label}
              </p>
            </div>
            
            <div className="mt-2">
              <p className={`font-headline font-bold mb-0.5 transition-colors duration-500 ${
                m.isAlert && m.valor > 0 ? 'text-error' : 'text-primary dark:text-white'
              } ${m.valor.toString().length > 10 ? 'text-base md:text-lg' : 'text-xl md:text-2xl'}`}>
                {m.valor}
              </p>
              <p className={`text-[8px] font-bold uppercase tracking-widest transition-colors duration-500 ${
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

        {/* Panel derecho: Centro de Control de Deudas y Vencimientos */}
        <div className="space-y-4">
          <div className="p-6 md:p-7 rounded-3xl bg-surface-container-low dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/5 flex flex-col min-h-[380px] shadow-sm">
            
            {/* Cabecera del Módulo */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-headline font-bold text-base md:text-lg text-secondary dark:text-white leading-tight flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-xl">payments</span>
                  <span>Deudas & Vencimientos</span>
                </h4>
                <p className="text-[10px] text-outline dark:text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                  {tabDeudas === 'cobrar'
                    ? `Por Cobrar: ${totalPorCobrar.toLocaleString('es-CL')}`
                    : `Por Pagar: ${totalPorPagar.toLocaleString('es-CL')}`}
                </p>
              </div>

              <Link 
                to={tabDeudas === 'cobrar' ? "/pedidos" : "/registro"} 
                className="text-secondary dark:text-[#e2bd6c] hover:text-primary transition-colors p-1.5 rounded-xl hover:bg-surface-container dark:hover:bg-white/5 flex items-center justify-center" 
                title={tabDeudas === 'cobrar' ? "Ir a Pedidos" : "Ir a Registros"}
              >
                <span className="material-symbols-outlined text-base">open_in_new</span>
              </Link>
            </div>

            {/* Selector de Pestañas: Por Cobrar vs Por Pagar */}
            <div className="flex gap-2 p-1 bg-surface-container dark:bg-white/5 rounded-2xl mb-4 border border-outline-variant/15 dark:border-white/5">
              <button
                type="button"
                onClick={() => setTabDeudas('cobrar')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  tabDeudas === 'cobrar'
                    ? 'bg-primary text-white dark:bg-[#e2bd6c] dark:text-black shadow-md'
                    : 'text-outline hover:text-on-surface dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">attach_money</span>
                <span>Por Cobrar</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  tabDeudas === 'cobrar'
                    ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                    : 'bg-outline-variant/20 dark:bg-white/10'
                }`}>
                  {deudasClientes.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setTabDeudas('pagar')}
                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  tabDeudas === 'pagar'
                    ? 'bg-primary text-white dark:bg-[#e2bd6c] dark:text-black shadow-md'
                    : 'text-outline hover:text-on-surface dark:text-gray-400 dark:hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-sm">credit_card</span>
                <span>Por Pagar</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  tabDeudas === 'pagar'
                    ? 'bg-white/20 text-white dark:bg-black/20 dark:text-black'
                    : 'bg-outline-variant/20 dark:bg-white/10'
                }`}>
                  {cuotasPorPagar.length}
                </span>
              </button>
            </div>
            
            {/* Contenido según pestaña activa */}
            <div className="overflow-y-auto flex-1 pr-1 space-y-2.5 max-h-[300px] custom-scrollbar">
              
              {/* TAB 1: POR COBRAR A CLIENTES */}
              {tabDeudas === 'cobrar' && (
                <>
                  {deudasClientes.length === 0 ? (
                    <div className="flex flex-col items-center justify-center opacity-60 h-full w-full text-center py-8">
                      <span className="material-symbols-outlined text-3xl mb-2 text-emerald-500">verified</span>
                      <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant dark:text-gray-400">
                        ¡Al día! No hay cobros pendientes a clientes
                      </p>
                    </div>
                  ) : (
                    deudasClientes.map(p => (
                      <div 
                        key={p.id}
                        className={`p-3.5 rounded-2xl border transition-all hover:scale-[1.01] flex items-center justify-between gap-3 ${
                          p.isAtrasado 
                            ? 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400' 
                            : p.isHoy 
                              ? 'bg-amber-500/10 border-amber-500/30' 
                              : 'bg-surface-container dark:bg-white/5 border-outline-variant/20 dark:border-white/10'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {p.isAtrasado && (
                              <span className="material-symbols-outlined text-red-500 text-sm animate-pulse">warning</span>
                            )}
                            <p className="font-headline font-black text-xs md:text-sm text-secondary dark:text-white uppercase truncate">
                              {p.cliente || 'Cliente sin nombre'}
                            </p>
                          </div>
                          
                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="font-headline font-black text-sm text-emerald-600 dark:text-emerald-400">
                              ${(p.montoDeuda || 0).toLocaleString('es-CL')}
                            </span>
                            <span className="text-[9px] text-outline dark:text-gray-400 font-bold uppercase tracking-wider">
                              Deuda
                            </span>
                          </div>

                          <p className="text-[9px] text-outline dark:text-gray-400 font-medium mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">calendar_month</span>
                            <span>{p.fechaEntrega ? formatDateDMA(p.fechaEntrega) : 'Fecha no definida'}</span>
                          </p>
                        </div>

                        {/* Estado de tiempo y acción de cobro por WhatsApp */}
                        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
                          {p.isAtrasado ? (
                            <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase rounded-full tracking-wider animate-pulse inline-block">
                              Atrasado ({Math.abs(p.diasFaltantes)}d)
                            </span>
                          ) : p.isHoy ? (
                            <span className="px-2 py-0.5 bg-amber-500 text-black text-[9px] font-black uppercase rounded-full tracking-wider inline-block">
                              ¡Cobrar Hoy!
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-[#e2bd6c] border border-amber-500/30 text-[9px] font-black uppercase rounded-full tracking-wider inline-block">
                              Cobrar en {p.diasFaltantes}d
                            </span>
                          )}

                          {p.waLink ? (
                            <a
                              href={p.waLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-2 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9px] font-black uppercase tracking-wider flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                              title="Recordar cobro por WhatsApp"
                            >
                              <span className="material-symbols-outlined text-[12px]">chat</span>
                              <span>Cobrar</span>
                            </a>
                          ) : (
                            <Link
                              to="/pedidos"
                              className="px-2 py-1 rounded-xl bg-surface-container-highest dark:bg-white/10 hover:bg-primary hover:text-white dark:hover:bg-[#e2bd6c] dark:hover:text-black text-on-surface-variant dark:text-gray-300 text-[9px] font-black uppercase tracking-wider transition-all"
                            >
                              Ver Pedido
                            </Link>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </>
              )}

              {/* TAB 2: POR PAGAR (CUOTAS DE COMPRAS A CRÉDITO) */}
              {tabDeudas === 'pagar' && (
                <>
                  {cuotasPorPagar.length === 0 ? (
                    <div className="flex flex-col items-center justify-center opacity-60 h-full w-full text-center py-8">
                      <span className="material-symbols-outlined text-3xl mb-2 text-emerald-500">task_alt</span>
                      <p className="text-[11px] uppercase tracking-widest font-bold text-on-surface-variant dark:text-gray-400">
                        ¡Excelente! No tienes cuotas pendientes de pago
                      </p>
                    </div>
                  ) : (
                    cuotasPorPagar.map(c => (
                      <Link
                        key={c.id}
                        to="/registro"
                        className={`p-3.5 rounded-2xl border transition-all hover:scale-[1.01] flex items-center justify-between gap-3 block ${
                          c.isAtrasado
                            ? 'bg-red-500/10 border-red-500/30'
                            : c.isHoy
                              ? 'bg-amber-500/10 border-amber-500/30'
                              : 'bg-surface-container dark:bg-white/5 border-outline-variant/20 dark:border-white/10'
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-black uppercase tracking-wider text-primary dark:text-[#e2bd6c]">
                              {c.nombreRegistro}
                            </span>
                            <span className="text-[9px] text-outline font-bold truncate">
                              • {c.tarjeta}
                            </span>
                          </div>

                          <div className="flex items-baseline gap-2 mt-0.5">
                            <span className="font-headline font-black text-sm text-amber-600 dark:text-amber-400">
                              ${c.monto.toLocaleString('es-CL')}
                            </span>
                            <span className="text-[9px] text-outline dark:text-gray-400 font-bold uppercase tracking-wider">
                              Cuota #{c.numeroCuota} de {c.totalCuotas}
                            </span>
                          </div>

                          <p className="text-[9px] text-outline dark:text-gray-400 font-medium mt-1 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">event</span>
                            <span>Vence: {c.fechaLabel}</span>
                          </p>
                        </div>

                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          {c.isAtrasado ? (
                            <span className="px-2 py-0.5 bg-red-600 text-white text-[9px] font-black uppercase rounded-full tracking-wider animate-pulse inline-block">
                              Vencida ({Math.abs(c.diasFaltantes)}d)
                            </span>
                          ) : c.isHoy ? (
                            <span className="px-2 py-0.5 bg-amber-500 text-black text-[9px] font-black uppercase rounded-full tracking-wider inline-block">
                              ¡Pagar Hoy!
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-700 dark:text-[#e2bd6c] border border-amber-500/30 text-[9px] font-black uppercase rounded-full tracking-wider inline-block">
                              Vence en {c.diasFaltantes}d
                            </span>
                          )}
                          <span className="text-[9px] text-primary dark:text-[#e2bd6c] font-black uppercase tracking-wider flex items-center gap-0.5">
                            <span>Gestionar</span>
                            <span className="material-symbols-outlined text-[10px]">arrow_forward</span>
                          </span>
                        </div>
                      </Link>
                    ))
                  )}
                </>
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
                    <img src={getOptimizedImageUrl(p.fotoUrl, 150)} alt={p.nombre} className="w-full h-full object-cover" />
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
      <HeroBannerModal 
        isOpen={showHeroModal} 
        onClose={() => setShowHeroModal(false)} 
        isDark={isDark} 
      />
    </div>
  )
}
