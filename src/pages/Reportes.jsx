import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore'
import { db } from '../config/firebase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

const PERIODOS = ['Semana Actual', 'Mes Actual', 'Personalizado']

function getStartOfWeek() {
  const d = new Date()
  const day = d.getDay() || 7
  d.setDate(d.getDate() - day + 1)
  d.setHours(0,0,0,0)
  return d
}

function getStartOfMonth() {
  const d = new Date()
  d.setDate(1)
  d.setHours(0,0,0,0)
  return d
}

function getLocalStr(p) {
  if (p.fechaCreacion) {
    const cDate = new Date(p.fechaCreacion)
    return cDate.getFullYear() + '-' + String(cDate.getMonth() + 1).padStart(2, '0') + '-' + String(cDate.getDate()).padStart(2, '0')
  }
  return p.fechaEntrega
}

function formatMoney(value) {
  // Manejo de valores negativos
  const neg = value < 0
  const abs = Math.abs(value)
  let f = ''
  if (abs >= 1000) {
    f = '$' + (abs / 1000).toFixed(0) + 'k'
  } else {
    f = '$' + abs
  }
  return neg ? '-' + f : f
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState(0)
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0])
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [mermas, setMermas] = useState([])
  
  // Para la tabla manual "Conteo Semanal de Ventas"
  const [conteo, setConteo] = useState([])
  const [guardado, setGuardado] = useState(false)
  
  // Para el módulo de "Mermas"
  const [conteoMerma, setConteoMerma] = useState([])
  const [guardadoMerma, setGuardadoMerma] = useState(false)

  const [procesando, setProcesando] = useState(false)

  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, 'productos'), snap => {
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setProductos(prods)
      
      // Update conteo manually only if not already initialized
      setConteo(prev => {
        return prods.map(p => {
          const exists = prev.find(xp => xp.id === p.id)
          return {
            id: p.id,
            producto: p.nombre,
            stockIni: p.stock,
            vendido: exists ? exists.vendido : 0,
            stockFin: p.stock - (exists ? exists.vendido : 0),
            precio: p.precio || 0
          }
        })
      })

      setConteoMerma(prev => {
        return prods.map(p => {
          const exists = prev.find(xp => xp.id === p.id)
          return {
            id: p.id,
            producto: p.nombre,
            stockIni: p.stock,
            vendido: exists ? exists.vendido : 0,
            stockFin: p.stock - (exists ? exists.vendido : 0),
            precio: p.precio || 0
          }
        })
      })
    })

    const unsubPed = onSnapshot(collection(db, 'pedidos'), snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPedidos(data)
    })

    const unsubMerma = onSnapshot(collection(db, 'mermas'), snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setMermas(data)
    })

    return () => { unsubProd(); unsubPed(); unsubMerma(); }
  }, [])

  // Filtrado de pedidos y mermas combinados
  const registrosFiltrados = useMemo(() => {
    const combinados = [
      ...pedidos.map(p => ({ ...p, _tipo: 'venta' })),
      ...mermas.map(m => ({ ...m, _tipo: 'merma' }))
    ]

    return combinados.filter(p => {
      const fString = p.fechaCreacion || p.fechaEntrega
      if (!fString) return false
      
      const pxDate = new Date(fString)
      pxDate.setHours(0,0,0,0)

      if (periodo === 0) { // Semana Actual
        const start = getStartOfWeek()
        return pxDate >= start
      } else if (periodo === 1) { // Mes Actual
        const start = getStartOfMonth()
        return pxDate >= start
      } else { // Personalizado
        const start = new Date(fechaInicio + 'T00:00:00')
        const end = new Date(fechaFin + 'T23:59:59')
        return pxDate >= start && pxDate <= end
      }
    }).sort((a,b) => {
      const fA = new Date(a.fechaCreacion || a.fechaEntrega)
      const fB = new Date(b.fechaCreacion || b.fechaEntrega)
      return fB - fA // Más recientes primero
    })
  }, [pedidos, mermas, periodo, fechaInicio, fechaFin])

  // Cálculo del gráfico
  const chartData = useMemo(() => {
    const map = {}
    
    // Preparar dominios vacíos
    if (periodo === 0) {
      const start = getStartOfWeek()
      for(let i=0; i<7; i++) {
        const temp = new Date(start)
        temp.setDate(temp.getDate() + i)
        map[temp.getFullYear() + '-' + String(temp.getMonth() + 1).padStart(2, '0') + '-' + String(temp.getDate()).padStart(2, '0')] = { Ganancia: 0, Pérdida: 0 }
      }
    }

    registrosFiltrados.forEach(p => {
      const dateStr = getLocalStr(p)
      let sum = 0
      p.productos.forEach(item => {
        const prod = productos.find(x => x.id === item.productoId)
        if (prod) sum += (prod.precio || 0) * item.cantidad
      })
      if (map[dateStr] === undefined) map[dateStr] = { Ganancia: 0, Pérdida: 0 }
      
      if (p._tipo === 'venta') {
        map[dateStr].Ganancia += sum
      } else {
        map[dateStr].Pérdida += sum
      }
    })

    return Object.keys(map).sort().map(dateStr => {
      const d = new Date(dateStr + 'T12:00:00')
      const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'short' })
      return {
        fechaReal: dateStr,
        label: periodo === 0 ? nombreDia.toUpperCase() : dateStr.split('-').slice(1).reverse().join('/'),
        Ganancia: map[dateStr].Ganancia,
        Pérdida: -map[dateStr].Pérdida // Mostramos en el gráfico como negativo para visualizarlas hacia abajo o separadas
      }
    })
  }, [registrosFiltrados, productos, periodo])

  const totalMonetario = chartData.reduce((acc, curr) => acc + curr.Ganancia, 0)
  const totalPerdidaMonetario = chartData.reduce((acc, curr) => acc + Math.abs(curr.Pérdida), 0)

  // Metricas extraídas
  const totalVendidosUnidades = useMemo(() => {
    let cant = 0
    registrosFiltrados.filter(x => x._tipo === 'venta').forEach(ped => {
      ped.productos.forEach(prod => { cant += Number(prod.cantidad) })
    })
    return cant
  }, [registrosFiltrados])

  // --- Handlers de Venta Directa ---
  function handleVendido(idProd, val) {
    setConteo(prev => prev.map(item => {
      if (item.id !== idProd) return item
      const v = Math.max(0, Number(val))
      // Considerar inventario real. Limitamos por su stock ini.
      const vSafe = Math.min(v, item.stockIni)
      return { ...item, vendido: vSafe, stockFin: item.stockIni - vSafe }
    }))
  }

  async function guardar() {
    if (procesando) return
    const itemsAVender = conteo.filter(item => item.vendido > 0)
    if (itemsAVender.length === 0) return alert('No hay ventas manuales que registrar.')
    
    setProcesando(true)
    try {
      const batch = writeBatch(db)
      
      itemsAVender.forEach(item => {
        const ref = doc(db, 'productos', item.id)
        const nuevoEstado = item.stockFin <= 10 ? (item.stockFin <= 5 ? 'critico' : 'bajo') : 'disponible'
        batch.update(ref, { stock: item.stockFin, estado: nuevoEstado })
      })

      const ventaRef = doc(collection(db, 'pedidos'))
      const payloadProductos = itemsAVender.map(i => ({ productoId: i.id, nombre: i.producto, cantidad: i.vendido }))

      batch.set(ventaRef, {
        cliente: 'Venta Directa',
        fechaEntrega: new Date().toISOString().split('T')[0],
        productos: payloadProductos,
        fechaCreacion: new Date().toISOString(),
        estado: 'completado'
      })

      await batch.commit()
      setGuardado(true)
      setConteo(prev => prev.map(item => ({...item, vendido: 0, stockIni: item.stockFin})))
      
      // Sincronizar el otro formulario de merma
      setConteoMerma(prev => prev.map(item => ({
        ...item, 
        stockIni: item.id ? (productos.find(p=>p.id===item.id)?.stock - (itemsAVender.find(x=>x.id===item.id)?.vendido || 0)) : item.stockIni
      })))

      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      console.error(e)
      alert('Error guardando venta')
    } finally {
      setProcesando(false)
    }
  }

  // --- Handlers de Mermas ---
  function handleMermado(idProd, val) {
    setConteoMerma(prev => prev.map(item => {
      if (item.id !== idProd) return item
      const v = Math.max(0, Number(val))
      const vSafe = Math.min(v, item.stockIni)
      return { ...item, vendido: vSafe, stockFin: item.stockIni - vSafe }
    }))
  }

  async function guardarMerma() {
    if (procesando) return
    const itemsAMermar = conteoMerma.filter(item => item.vendido > 0)
    if (itemsAMermar.length === 0) return alert('No hay mermas que registrar.')
    
    setProcesando(true)
    try {
      const batch = writeBatch(db)
      
      itemsAMermar.forEach(item => {
        const ref = doc(db, 'productos', item.id)
        const nuevoEstado = item.stockFin <= 10 ? (item.stockFin <= 5 ? 'critico' : 'bajo') : 'disponible'
        batch.update(ref, { stock: item.stockFin, estado: nuevoEstado })
      })

      const mermaRef = doc(collection(db, 'mermas'))
      const payloadProductos = itemsAMermar.map(i => ({ productoId: i.id, nombre: i.producto, cantidad: i.vendido }))

      batch.set(mermaRef, {
        motivo: 'Producto Mermado',
        fechaEntrega: new Date().toISOString().split('T')[0],
        productos: payloadProductos,
        fechaCreacion: new Date().toISOString(),
      })

      await batch.commit()
      setGuardadoMerma(true)
      setConteoMerma(prev => prev.map(item => ({...item, vendido: 0, stockIni: item.stockFin})))
      
      // Sincronizar conteo principal
      setConteo(prev => prev.map(item => ({
        ...item, 
        stockIni: item.id ? (productos.find(p=>p.id===item.id)?.stock - (itemsAMermar.find(x=>x.id===item.id)?.vendido || 0)) : item.stockIni
      })))

      setTimeout(() => setGuardadoMerma(false), 2500)
    } catch (e) {
      console.error(e)
      alert('Error guardando merma')
    } finally {
      setProcesando(false)
    }
  }

  // --- Deshacer Registro ---
  async function deshacerRegistro(registro) {
    if (!window.confirm(`¿Seguro que deseas deshacer este movimiento de ${registro._tipo} y devolver los productos al inventario?`)) return
    
    setProcesando(true)
    try {
      const batch = writeBatch(db)

      registro.productos.forEach(itemInfo => {
        const pLoc = productos.find(p => p.id === itemInfo.productoId)
        if (pLoc) {
          const ref = doc(db, 'productos', itemInfo.productoId)
          const nuevoStock = pLoc.stock + itemInfo.cantidad
          const nuevoEstado = nuevoStock <= 10 ? (nuevoStock <= 5 ? 'critico' : 'bajo') : 'disponible'
          batch.update(ref, { stock: nuevoStock, estado: nuevoEstado })
        }
      })

      const colName = registro._tipo === 'merma' ? 'mermas' : 'pedidos'
      const docRef = doc(db, colName, registro.id)
      batch.delete(docRef)

      await batch.commit()
    } catch (e) {
      console.error(e)
      alert('Error al intentar deshacer el registro.')
    } finally {
      setProcesando(false)
    }
  }

  // --- Reporte y PDF ---
  function exportarPDF() {
    const docPdf = new jsPDF()
    docPdf.text("Reporte de Desempeño Leis", 14, 15)
    docPdf.setFontSize(10)
    docPdf.text(`Periodo: ${PERIODOS[periodo]} (${fechaInicio} - ${fechaFin})`, 14, 22)
    docPdf.text(`Ganancia Generada: $${totalMonetario.toLocaleString('es-CL')} | Pérdidas: -$${totalPerdidaMonetario.toLocaleString('es-CL')}`, 14, 28)
    
    const tableData = registrosFiltrados.map(p => {
      const fecha = getLocalStr(p)
      const desc = p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(', ')
      let gananciaVenta = 0
      p.productos.forEach(item => {
        const pr = productos.find(xd => xd.id === item.productoId)
        if(pr) gananciaVenta += (pr.precio || 0) * item.cantidad
      })
      const isMerma = p._tipo === 'merma'
      return [fecha, isMerma ? p.motivo : p.cliente, desc, isMerma ? `-$${gananciaVenta.toLocaleString('es-CL')}` : `$${gananciaVenta.toLocaleString('es-CL')}`]
    })

    autoTable(docPdf, {
      startY: 35,
      head: [['Fecha', 'Tipo/Cliente', 'Productos', 'Flujo ($)']],
      body: tableData,
    })

    docPdf.save("reporte_ventas_leis.pdf")
  }

  function exportarCSV() {
    const encabezados = ['Fecha', 'Cliente/Tipo', 'Detalle Productos', 'Flujo de Dinero ($)']
    const filas = registrosFiltrados.map(p => {
      const fecha = getLocalStr(p)
      const desc = p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(' | ')
      let gananciaVenta = 0
      p.productos.forEach(item => {
        const pr = productos.find(xd => xd.id === item.productoId)
        if(pr) gananciaVenta += (pr.precio || 0) * item.cantidad
      })
      const isMerma = p._tipo === 'merma'
      return [
        `"${fecha}"`, 
        `"${isMerma ? p.motivo : p.cliente}"`, 
        `"${desc}"`, 
        isMerma ? -gananciaVenta : gananciaVenta
      ]
    })

    const csvContent = "\uFEFF" + encabezados.join(";") + "\n" + filas.map(e => e.join(";")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", "reporte_ventas.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-8 md:p-10 relative h-full overflow-y-auto">

      <header className="mb-10 flex flex-col xl:flex-row xl:justify-between xl:items-end gap-5">
        <div>
          <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">Centro de Control Financiero</span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-tertiary-fixed-variant leading-tight">Métricas y Mermas</h2>
          <p className="mt-3 text-outline font-body max-w-lg leading-relaxed text-sm">
            Supervisa el crecimiento, exporta reportes y sincroniza salidas y pérdidas de stock.
          </p>
        </div>
      </header>

      {/* Gráfico principal */}
      <section className="mb-10 w-full h-[400px] md:h-[450px] bg-surface-container-low rounded-[2rem] p-6 md:p-8 border border-outline-variant/10 flex flex-col relative z-0 tour-reportes-grafico">
        <div className="flex flex-col xl:flex-row justify-between items-start mb-6 w-full gap-4">
          <div>
            <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Gráfica Comercial</h3>
            <p className="text-xs text-outline font-label uppercase tracking-widest mt-1 mb-4">Evolución de Ganancias vs Pérdidas</p>
            
            {/* Selector de periodo y Menu de Exportación (Moved here) */}
            <div className="flex items-center gap-2 bg-surface-container-highest/20 p-1.5 rounded-2xl border border-outline-variant/10 relative w-fit mb-4">
              {/* Custom Period Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                  className="bg-surface-container-highest px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface hover:bg-surface-variant transition-colors flex items-center gap-2 min-w-[140px] justify-between"
                >
                  {PERIODOS[periodo]}
                  <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                </button>

                {showPeriodMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPeriodMenu(false)} />
                    <div className="absolute left-0 top-full mt-2 w-full min-w-[160px] bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {PERIODOS.map((label, i) => (
                        <button 
                          key={label}
                          onClick={() => { setPeriodo(i); setShowPeriodMenu(false); }}
                          className={`w-full px-5 py-3 text-xs font-headline italic tracking-wide transition-colors text-left flex items-center justify-between
                            ${periodo === i ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-variant'}
                            ${i !== PERIODOS.length - 1 ? 'border-b border-outline-variant/5' : ''}
                          `}
                        >
                          {label}
                          {periodo === i && <span className="material-symbols-outlined text-sm">check</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {periodo === 2 && (
                <div className="flex gap-2">
                  <input 
                    type="date" 
                    value={fechaInicio} 
                    onChange={e => setFechaInicio(e.target.value)} 
                    className="bg-surface-container-highest px-2 py-1.5 text-[10px] font-bold uppercase rounded-lg focus:outline-none border border-outline-variant/10" 
                  />
                  <input 
                    type="date" 
                    value={fechaFin} 
                    onChange={e => setFechaFin(e.target.value)} 
                    className="bg-surface-container-highest px-2 py-1.5 text-[10px] font-bold uppercase rounded-lg focus:outline-none border border-outline-variant/10" 
                  />
                </div>
              )}

              <div className="relative">
                <button 
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-surface-container-highest text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-xl">more_vert</span>
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute left-0 top-full mt-2 w-48 bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button 
                        onClick={() => { exportarPDF(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:bg-primary/10 hover:text-primary transition-colors text-left border-b border-outline-variant/10"
                      >
                        <span className="material-symbols-outlined text-sm text-error">picture_as_pdf</span>
                        Exportar PDF
                      </button>
                      <button 
                        onClick={() => { exportarCSV(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:bg-primary/10 hover:text-primary transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-sm text-secondary">csv</span>
                        Generar Excel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex flex-row md:gap-4 gap-2 w-full xl:w-auto">
            <div className="bg-surface-container px-3 md:px-5 py-3 rounded-2xl flex flex-col items-start xl:items-end border border-outline-variant/20 flex-1 xl:flex-none">
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Ganancias Brutas</span>
              <span className="font-headline font-bold text-lg md:text-2xl text-secondary">+${totalMonetario.toLocaleString('es-CL')}</span>
            </div>
            <div className="bg-error/10 px-3 md:px-5 py-3 rounded-2xl flex flex-col items-start xl:items-end border border-error/20 flex-1 xl:flex-none overflow-hidden">
              <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-error mb-1 truncate w-full">Mermas / Pérdidas</span>
              <span className="font-headline font-bold text-lg md:text-2xl text-error">-${totalPerdidaMonetario.toLocaleString('es-CL')}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 w-full relative z-0 -ml-4 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 20, right: 0, left: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#a78b5e" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#a78b5e" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPerdida" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" opacity={0.5} />
              <XAxis 
                dataKey="label" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#808080', fontWeight: 'bold' }} 
                dy={10} 
              />
              <YAxis 
                type="number" 
                tickFormatter={formatMoney} 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#808080', fontWeight: 'bold' }} 
                dx={-5} 
              />
              <Tooltip 
                formatter={(value, name) => {
                  if (name === 'Pérdida') return [`-$${Math.abs(value).toLocaleString('es-CL')}`, 'Pérdida Mermas']
                  return [`+$${value.toLocaleString('es-CL')}`, 'Ingresos Venta']
                }}
                labelStyle={{ fontWeight: 'bold', color: '#524430' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="Ganancia" stroke="#524430" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
              <Area type="monotone" dataKey="Pérdida" stroke="#ba1a1a" strokeWidth={3} fillOpacity={1} fill="url(#colorPerdida)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Formularios manuales de stock paralelos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 relative z-10 w-full">
        
        {/* Conteo semanal MANUAL (para Venta Directa) */}
        <section className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col h-[400px]">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Registrar Venta Directa</h3>
              <p className="text-[10px] text-outline font-label uppercase tracking-widest mt-1">Registra salidas al cliente final.</p>
            </div>
            <div className="flex items-center gap-3">
              {guardado && (
                <span className="flex items-center gap-1 text-[10px] text-green-700 font-bold uppercase tracking-widest animate-pulse">
                  <span className="material-symbols-outlined text-green-700 text-[14px]">check_circle</span>
                  Guardado
                </span>
              )}
              <button
                onClick={guardar}
                className="bg-primary-container text-on-primary-container px-5 py-2.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-sm"
              >
                Guardar conteo
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 bg-surface-container-highest/20 rounded-2xl border border-outline-variant/20 relative z-10 p-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#f1efe9]/90 backdrop-blur-md px-2 z-20">
                <tr>
                  <th className="py-4 pl-5 font-label text-[9px] font-extrabold uppercase tracking-widest text-outline">Producto</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-outline">Stock Disp.</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-outline">Cant. Extraída</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {conteo.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="py-3 pl-5 text-[11px] font-bold truncate max-w-[120px]">{p.producto}</td>
                    <td className="py-3 text-center font-body text-[11px] font-bold">{p.stockFin.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <input
                        type="number" min="0" max={p.stockIni} value={p.vendido}
                        onChange={e => handleVendido(p.id, e.target.value)}
                        className="w-14 bg-surface border border-outline-variant/30 rounded-md px-2 py-1 text-[11px] font-bold text-on-surface focus:outline-none focus:border-primary text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Mermas MANUAL */}
        <section className="bg-error/5 rounded-[2rem] p-8 border border-error/20 flex flex-col h-[400px] tour-reportes-mermas">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-error">Registrar Pérdida</h3>
              <p className="text-[10px] text-error/70 font-label uppercase tracking-widest mt-1">Registra productos dañados o mermas.</p>
            </div>
            <div className="flex items-center gap-3">
              {guardadoMerma && (
                <span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase tracking-widest animate-pulse">
                  <span className="material-symbols-outlined text-error text-[14px]">check_circle</span>
                  Restado
                </span>
              )}
              <button
                onClick={guardarMerma}
                className="bg-error text-on-error px-5 py-2.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-md"
              >
                Eliminar Stock
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 bg-surface-container-lowest/50 rounded-2xl border border-error/10 relative z-10 p-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-[#faeeed]/90 backdrop-blur-md px-2 z-20">
                <tr>
                  <th className="py-4 pl-5 font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c]">Producto</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c]">Stock Disp.</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c]">Cant. Perdida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-error/5">
                {conteoMerma.map((p) => (
                  <tr key={p.id} className="hover:bg-error/5 transition-colors">
                    <td className="py-3 pl-5 text-[11px] font-bold truncate max-w-[120px] text-[#5e2220]">{p.producto}</td>
                    <td className="py-3 text-center font-body text-[11px] font-bold text-[#5e2220]">{p.stockFin.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <input
                        type="number" min="0" max={p.stockIni} value={p.vendido}
                        onChange={e => handleMermado(p.id, e.target.value)}
                        className="w-14 bg-surface border border-error/30 rounded-md px-2 py-1 text-[11px] font-bold text-error focus:outline-none focus:border-error text-center"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* HISTORIAL GENERAL (ANCHO COMPLETO) */}
      <section className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col mb-16 relative z-10">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Historial Consolidado del Periodo</h3>
            <p className="text-[10px] text-outline font-label uppercase tracking-widest mt-1">
              Eventos totales: <strong className="text-secondary">{registrosFiltrados.length} registros</strong>
            </p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 auto-rows-max">
          {registrosFiltrados.map((v) => {
            const isMerma = v._tipo === 'merma'
            const esVentaDirecta = v.cliente === "Venta Directa" && !isMerma
            
            let flujoMonetario = 0
            v.productos.forEach(item => {
              const prod = productos.find(xd => xd.id === item.productoId)
              if(prod) flujoMonetario += (prod.precio || 0) * item.cantidad
            })

            return (
              <div 
                key={v.id} 
                className={`p-5 rounded-2xl shadow-sm border flex flex-col gap-3 transition-colors hover:shadow-md ${isMerma ? 'bg-error/5 border-error/20' : 'bg-surface border-outline-variant/10'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                     <span className={`material-symbols-outlined text-[16px] ${isMerma ? 'text-error' : (esVentaDirecta ? 'text-primary' : 'text-secondary')}`}>
                       {isMerma ? 'remove_shopping_cart' : (esVentaDirecta ? 'storefront' : 'local_shipping')}
                     </span>
                     <span className={`font-bold text-[11px] uppercase tracking-widest ${isMerma ? 'text-error' : 'text-on-surface-variant'}`}>
                       {isMerma ? v.motivo : (esVentaDirecta ? 'Venta Directa' : v.cliente)}
                     </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase text-outline/80">
                       {getLocalStr(v)}
                    </span>
                    <button 
                      onClick={() => deshacerRegistro(v)}
                      disabled={procesando}
                      className={`transition-colors focus:outline-none ${procesando ? 'opacity-50 cursor-not-allowed' : 'text-outline/40 hover:text-error'}`}
                      title="Deshacer registro y devolver al inventario"
                    >
                      <span className="material-symbols-outlined text-[14px]">undo</span>
                    </button>
                  </div>
                </div>

                <ul className="text-xs space-y-1 opacity-80 pl-6 mt-1 mb-2">
                  {v.productos.map((prod, idx) => (
                    <li key={idx} className={isMerma ? 'text-[#82322e]' : ''}>
                      <strong className={isMerma ? 'text-error' : 'text-secondary'}>{prod.cantidad}x</strong> {prod.nombre}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex justify-end">
                   <span className={`font-headline font-bold text-lg ${isMerma ? 'text-error' : 'text-secondary'}`}>
                     {isMerma ? `-$${flujoMonetario.toLocaleString('es-CL')}` : `+$${flujoMonetario.toLocaleString('es-CL')}`}
                   </span>
                </div>
              </div>
            )
          })}
        </div>
        
        {registrosFiltrados.length === 0 && (
          <div className="flex flex-col items-center justify-center opacity-60 w-full text-center py-20">
            <span className="material-symbols-outlined text-4xl mb-4 text-outline/60">pending_actions</span>
            <p className="text-[11px] font-bold text-outline uppercase tracking-widest">No hay historial de movimientos</p>
          </div>
        )}
      </section>

    </div>
  )
}
