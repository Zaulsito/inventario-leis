import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, doc, writeBatch } from 'firebase/firestore'
import { db } from '../config/firebase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLocalDateString } from '../utils/date'
import { calcularEstado } from '../utils/date'
import Footer from '../components/Footer'

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
  const [chartMode, setChartMode] = useState('ambas')
  const [fechaInicio, setFechaInicio] = useState(getLocalDateString())
  const [fechaFin, setFechaFin] = useState(getLocalDateString())
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  
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
  
  // Estados para búsqueda
  const [searchVenta, setSearchVenta] = useState('')
  const [searchMerma, setSearchMerma] = useState('')

  // Estados para confirmación personalizada
  const [mostrarResumenVenta, setMostrarResumenVenta] = useState(false)
  const [mostrarResumenMerma, setMostrarResumenMerma] = useState(false)

  // Estado para deshacer
  const [registroADeshacer, setRegistroADeshacer] = useState(null)

  useEffect(() => {
    const unsubProd = onSnapshot(collection(db, 'productos'), snap => {
      const prods = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      setProductos(prods)
      
      // Sincronizar stockIni de los productos que ya están en las listas temporales
      setConteo(prev => prev.map(item => {
        const p = prods.find(x => x.id === item.id)
        if (!p) return item
        return {
          ...item,
          stockIni: p.stock,
          stockFin: p.stock - item.vendido
        }
      }))

      setConteoMerma(prev => prev.map(item => {
        const p = prods.find(x => x.id === item.id)
        if (!p) return item
        return {
          ...item,
          stockIni: p.stock,
          stockFin: p.stock - item.vendido
        }
      }))
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
        if (prod) {
          const precio = Number(prod.precio) || 0;
          const cant = Number(item.cantidad) || 1;
          sum += precio * cant;
        }
      })
      if (map[dateStr] === undefined) map[dateStr] = { Ganancia: 0, Pérdida: 0 }
      
      if (p._tipo === 'venta') {
        // Usamos el total de la venta para calcular las ganancias brutas,
        // independientemente de si el estado es 'sin pagar', 'parcial' o 'pagado'
        let gananciaReal = p.total || sum;
        map[dateStr].Ganancia += gananciaReal;
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
        Pérdida: -map[dateStr].Pérdida, // Mostramos en el gráfico como negativo para visualizarlas hacia abajo o separadas
        Total: map[dateStr].Ganancia - map[dateStr].Pérdida
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
      const vSafe = Math.min(v, item.stockIni)
      return { ...item, vendido: vSafe, stockFin: item.stockIni - vSafe }
    }))
  }

  function addItemVenta(p) {
    setConteo(prev => {
      const exists = prev.find(x => x.id === p.id)
      if (exists) return prev
      return [...prev, {
        id: p.id,
        producto: p.nombre,
        stockIni: p.stock,
        vendido: 1,
        stockFin: p.stock - 1,
        precio: p.precio || 0
      }]
    })
    setSearchVenta('')
  }

  function removeItemVenta(id) {
    setConteo(prev => prev.filter(x => x.id !== id))
  }

  async function guardar() {
    if (procesando) return
    const itemsAVender = conteo.filter(item => item.vendido > 0)
    if (itemsAVender.length === 0) return alert('No hay ventas manuales que registrar.')
    
    // Si no se está mostrando el resumen, lo mostramos
    if (!mostrarResumenVenta) {
      setMostrarResumenVenta(true)
      return
    }

    setProcesando(true)
    try {
      const batch = writeBatch(db)
      
      itemsAVender.forEach(item => {
        const ref = doc(db, 'productos', item.id)
        const nuevoEstado = calcularEstado(item.stockFin)
        batch.update(ref, { stock: item.stockFin, estado: nuevoEstado })
      })

      const ventaRef = doc(collection(db, 'pedidos'))
      const payloadProductos = itemsAVender.map(i => ({ productoId: i.id, nombre: i.producto, cantidad: i.vendido }))

      batch.set(ventaRef, {
        cliente: 'Venta Directa',
        fechaEntrega: getLocalDateString(),
        productos: payloadProductos,
        fechaCreacion: new Date().toISOString(),
        estado: 'completado'
      })

      await batch.commit()
      setGuardado(true)
      setConteo([]) // Limpiar lista después de guardar
      setMostrarResumenVenta(false)
      
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

  function addItemMerma(p) {
    setConteoMerma(prev => {
      const exists = prev.find(x => x.id === p.id)
      if (exists) return prev
      return [...prev, {
        id: p.id,
        producto: p.nombre,
        stockIni: p.stock,
        vendido: 1,
        stockFin: p.stock - 1,
        precio: p.precio || 0
      }]
    })
    setSearchMerma('')
  }

  function removeItemMerma(id) {
    setConteoMerma(prev => prev.filter(x => x.id !== id))
  }

  async function guardarMerma() {
    if (procesando) return
    const itemsAMermar = conteoMerma.filter(item => item.vendido > 0)
    if (itemsAMermar.length === 0) return alert('No hay mermas que registrar.')
    
    // Si no se está mostrando el resumen, lo mostramos
    if (!mostrarResumenMerma) {
      setMostrarResumenMerma(true)
      return
    }

    setProcesando(true)
    try {
      const batch = writeBatch(db)
      
      itemsAMermar.forEach(item => {
        const ref = doc(db, 'productos', item.id)
        const nuevoEstado = calcularEstado(item.stockFin)
        batch.update(ref, { stock: item.stockFin, estado: nuevoEstado })
      })

      const mermaRef = doc(collection(db, 'mermas'))
      const payloadProductos = itemsAMermar.map(i => ({ productoId: i.id, nombre: i.producto, cantidad: i.vendido }))

      batch.set(mermaRef, {
        motivo: 'Producto Mermado',
        fechaEntrega: getLocalDateString(),
        productos: payloadProductos,
        fechaCreacion: new Date().toISOString(),
      })

      await batch.commit()
      setGuardadoMerma(true)
      setConteoMerma([]) // Limpiar lista
      setMostrarResumenMerma(false)
      
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
    if (!registro) return

    // Si no es el paso final de confirmación, activamos el modal
    if (!registroADeshacer || registroADeshacer.id !== registro.id) {
      setRegistroADeshacer(registro)
      return
    }
    
    setProcesando(true)
    try {
      const batch = writeBatch(db)

      registro.productos.forEach(itemInfo => {
        const pLoc = productos.find(p => p.id === itemInfo.productoId)
        if (pLoc) {
          const ref = doc(db, 'productos', itemInfo.productoId)
          const nuevoStock = Number(pLoc.stock) + Number(itemInfo.cantidad)
          const nuevoEstado = calcularEstado(nuevoStock)
          batch.update(ref, { stock: nuevoStock, estado: nuevoEstado })
        }
      })

      const colName = registro._tipo === 'merma' ? 'mermas' : 'pedidos'
      const docRef = doc(db, colName, registro.id)
      batch.delete(docRef)

      await batch.commit()
      setRegistroADeshacer(null)
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
    <div className="p-8 md:p-10 relative flex flex-col min-h-full overflow-y-auto transition-colors duration-500">

      <header className="sticky top-0 z-30 bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-md px-8 md:px-10 py-10 flex flex-col items-center justify-center border-b border-outline-variant/20 dark:border-white/5 mb-12">
        <div className="relative text-center mx-auto">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 dark:text-[#e2bd6c]/60 mb-2">Centro de Control Financiero</p>
          <h1 className="font-headline text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter">Métricas y Mermas</h1>
          <p className="mt-4 text-outline dark:text-gray-400 font-body max-w-lg mx-auto leading-relaxed text-[11px] uppercase tracking-widest font-bold">
            Supervisa el crecimiento, exporta reportes y sincroniza salidas y pérdidas de stock.
          </p>
          <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>
      </header>

      {/* Gráfico principal */}
      <section className="mb-10 w-full h-auto md:h-[550px] bg-surface-container-low dark:bg-[#1e1e1e] rounded-[2.5rem] p-6 md:p-10 border border-outline-variant/10 dark:border-white/5 flex flex-col relative z-0 tour-reportes-grafico shadow-xl">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 w-full gap-6">
          <div className="flex-1">
            <h3 className="font-headline text-3xl text-on-tertiary-fixed-variant dark:text-white/90 italic">Gráfica Comercial</h3>
            <p className="text-[10px] text-outline dark:text-gray-500 font-label uppercase tracking-[0.2em] mt-1 font-extrabold">Evolución de Ganancias vs Pérdidas</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Custom Mode Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowModeMenu(!showModeMenu)}
                  className="bg-surface-container-highest dark:bg-[#1e1e1e] px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-colors flex items-center gap-2 min-w-[140px] justify-between border border-transparent dark:border-white/10"
                >
                  {chartMode === 'ambas' ? 'Total Neto' : chartMode === 'ventas' ? 'Solo Ventas' : 'Solo Mermas'}
                  <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                </button>

                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowModeMenu(false)} />
                    <div className="absolute left-0 top-full mt-2 w-full min-w-[160px] bg-surface-container-highest dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {[
                        { id: 'ambas', label: 'Total Neto' },
                        { id: 'ventas', label: 'Solo Ventas' },
                        { id: 'mermas', label: 'Solo Mermas' }
                      ].map((mode, i) => (
                        <button 
                          key={mode.id}
                          onClick={() => { setChartMode(mode.id); setShowModeMenu(false); }}
                          className={`w-full px-5 py-3 text-xs font-headline italic tracking-wide transition-colors text-left flex items-center justify-between
                            ${chartMode === mode.id ? 'bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c]' : 'text-on-surface dark:text-white/70 hover:bg-surface-variant dark:hover:bg-white/5'}
                            ${i !== 2 ? 'border-b border-outline-variant/5 dark:border-white/5' : ''}
                          `}
                        >
                          {mode.label}
                          {chartMode === mode.id && <span className="material-symbols-outlined text-sm">check</span>}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              
              <div className="w-px h-6 bg-outline-variant/20 dark:bg-white/10 mx-1"></div>

              {/* Custom Period Dropdown */}
              <div className="relative">
                <button 
                  onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                  className="bg-surface-container-highest dark:bg-[#1e1e1e] px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-colors flex items-center gap-2 min-w-[140px] justify-between border border-transparent dark:border-white/10"
                >
                  {PERIODOS[periodo]}
                  <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                </button>

                {showPeriodMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowPeriodMenu(false)} />
                    <div className="absolute left-0 top-full mt-2 w-full min-w-[160px] bg-surface dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      {PERIODOS.map((label, i) => (
                        <button 
                          key={label}
                          onClick={() => { setPeriodo(i); setShowPeriodMenu(false); }}
                          className={`w-full px-5 py-3 text-xs font-headline italic tracking-wide transition-colors text-left flex items-center justify-between
                            ${periodo === i ? 'bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c]' : 'text-on-surface dark:text-white/70 hover:bg-surface-variant dark:hover:bg-white/5'}
                            ${i !== PERIODOS.length - 1 ? 'border-b border-outline-variant/5 dark:border-white/5' : ''}
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
                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-highest dark:bg-[#121212] text-on-surface dark:text-white/60 hover:bg-surface-variant dark:hover:bg-white/10 transition-colors border border-transparent dark:border-white/10"
                >
                  <span className="material-symbols-outlined text-xl font-bold">more_vert</span>
                </button>

                {showExportMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-48 bg-surface dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <button 
                        onClick={() => { exportarPDF(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-on-surface dark:text-white/80 hover:bg-primary/10 dark:hover:bg-[#e2bd6c]/10 transition-colors text-left border-b border-outline-variant/10 dark:border-white/5"
                      >
                        <span className="material-symbols-outlined text-base text-error">picture_as_pdf</span>
                        Exportar PDF
                      </button>
                      <button 
                        onClick={() => { exportarCSV(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-3 px-5 py-4 text-[10px] font-extrabold uppercase tracking-[0.2em] text-on-surface dark:text-white/80 hover:bg-primary/10 dark:hover:bg-[#e2bd6c]/10 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-base text-secondary">csv</span>
                        Generar Excel
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          <div className="flex flex-row md:gap-4 gap-2 w-full xl:w-auto">
            {chartMode === 'ventas' && (
              <div className="bg-surface-container dark:bg-[#e2bd6c]/10 px-3 md:px-5 py-3 rounded-2xl flex flex-col items-start xl:items-end border border-outline-variant/20 dark:border-[#e2bd6c]/20 flex-1 xl:flex-none animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-outline dark:text-[#e2bd6c]/60 mb-1">Ganancias Brutas</span>
                <span className="font-headline font-bold text-lg md:text-2xl text-secondary dark:text-[#e2bd6c]">+${totalMonetario.toLocaleString('es-CL')}</span>
              </div>
            )}
            {chartMode === 'mermas' && (
              <div className="bg-error/10 px-3 md:px-5 py-3 rounded-2xl flex flex-col items-start xl:items-end border border-error/20 flex-1 xl:flex-none overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-error mb-1 truncate w-full">Mermas / Pérdidas</span>
                <span className="font-headline font-bold text-lg md:text-2xl text-error">-${totalPerdidaMonetario.toLocaleString('es-CL')}</span>
              </div>
            )}
            {chartMode === 'ambas' && (
              <div className="bg-surface-container dark:bg-white/5 px-3 md:px-5 py-3 rounded-2xl flex flex-col items-start xl:items-end border border-outline-variant/20 dark:border-white/10 flex-1 xl:flex-none animate-in fade-in zoom-in-95 duration-200">
                <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">Total Neto</span>
                <span className={`font-headline font-bold text-lg md:text-2xl ${totalMonetario - totalPerdidaMonetario < 0 ? 'text-error' : 'text-secondary dark:text-[#e2bd6c]'}`}>
                  {totalMonetario - totalPerdidaMonetario < 0 ? '-' : '+'}${Math.abs(totalMonetario - totalPerdidaMonetario).toLocaleString('es-CL')}
                </span>
              </div>
            )}
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
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#333" opacity={0.5} />
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
                  if (name === 'Total') return [value < 0 ? `-$${Math.abs(value).toLocaleString('es-CL')}` : `+$${value.toLocaleString('es-CL')}`, 'Total Neto']
                  return [`+$${value.toLocaleString('es-CL')}`, 'Ingresos Venta']
                }}
                labelStyle={{ fontWeight: 'bold', color: '#e2bd6c' }}
                contentStyle={{ borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: '#1e1e1e', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}
              />
              {(chartMode === 'ambas' || chartMode === 'ventas') && (
                <Area type="monotone" dataKey={chartMode === 'ambas' ? 'Total' : 'Ganancia'} stroke="#e2bd6c" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
              )}
              {chartMode === 'mermas' && (
                <Area type="monotone" dataKey="Pérdida" stroke="#ba1a1a" strokeWidth={3} fillOpacity={1} fill="url(#colorPerdida)" />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Formularios manuales de stock paralelos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10 relative z-10 w-full">
        
        {/* Conteo semanal MANUAL (para Venta Directa) */}
        <section className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-[2rem] p-8 border border-outline-variant/10 dark:border-white/5 flex flex-col h-[480px]">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant dark:text-white/90">Registrar Venta Directa</h3>
              <p className="text-[10px] text-outline dark:text-gray-500 font-label uppercase tracking-widest mt-1">Registra salidas al cliente final.</p>
            </div>
          </div>

          {/* Buscador de productos */}
          <div className="mb-4 relative z-50">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar producto para vender..."
                value={searchVenta}
                onChange={e => setSearchVenta(e.target.value)}
                className="w-full bg-surface-container-highest dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] transition-all dark:text-white"
              />
            </div>
            {searchVenta && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-surface dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                {productos
                  .filter(p => p.nombre.toLowerCase().includes(searchVenta.toLowerCase()))
                  .map(p => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); addItemVenta(p); }}
                      className="w-full px-5 py-4 text-left text-[11px] font-bold hover:bg-primary/10 dark:hover:bg-[#e2bd6c]/10 transition-colors flex justify-between items-center border-b border-outline-variant/5 dark:border-white/5 dark:text-white/80 group"
                    >
                      <span className="group-hover:text-primary dark:group-hover:text-[#e2bd6c] transition-colors">{p.nombre}</span>
                      <span className="text-[10px] opacity-60 bg-outline-variant/10 dark:bg-white/5 px-2 py-0.5 rounded-full">Stock: {p.stock}</span>
                    </button>
                  ))
                }
                {productos.filter(p => p.nombre.toLowerCase().includes(searchVenta.toLowerCase())).length === 0 && (
                  <div className="px-5 py-6 text-[10px] text-outline dark:text-gray-500 italic text-center font-bold uppercase tracking-widest">No se encontraron productos</div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-y-auto flex-1 bg-surface-container-highest/20 dark:bg-[#121212]/40 rounded-3xl border border-outline-variant/20 dark:border-white/5 relative z-10 p-1">
            {/* Overlay de Resumen de Confirmación */}
            {mostrarResumenVenta && (
              <div className="absolute inset-0 z-50 bg-surface-container-low/95 dark:bg-[#1e1e1e]/95 backdrop-blur-sm p-6 flex flex-col animate-in fade-in duration-200">
                <h4 className="font-headline text-xl text-primary dark:text-[#e2bd6c] mb-4">Confirmar Registro</h4>
                <div className="flex-1 overflow-y-auto pr-2">
                  <p className="text-[10px] text-outline dark:text-gray-500 font-label uppercase tracking-widest mb-3">Vas a registrar lo siguiente:</p>
                  <ul className="space-y-2">
                    {conteo.filter(i => i.vendido > 0).map(i => (
                      <li key={i.id} className="flex justify-between items-center text-[11px] font-bold bg-surface dark:bg-white/5 p-3 rounded-xl border border-outline-variant/10 dark:border-white/5 dark:text-white/80">
                        <span>{i.producto}</span>
                        <span className="text-secondary dark:text-[#e2bd6c]">{i.vendido} unidades</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => setMostrarResumenVenta(false)}
                    className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-outline hover:bg-surface-variant transition-colors rounded-xl border border-outline-variant/20"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={guardar}
                    className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black hover:scale-[1.02] active:scale-[0.98] transition-all rounded-xl shadow-md"
                  >
                    Confirmar Todo
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-container-low dark:bg-[#1e1e1e] px-2 z-20 overflow-hidden">
                <tr className="overflow-hidden rounded-t-2xl">
                  <th className="py-4 pl-5 font-label text-[9px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-500 rounded-tl-2xl">Producto</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-500">Stock Disp.</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-500">Cant.</th>
                  <th className="py-4 pr-4 rounded-tr-2xl"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10 dark:divide-white/5">
                {conteo.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-high dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 pl-5 text-[11px] font-bold truncate max-w-[120px] dark:text-white/80">{p.producto}</td>
                    <td className="py-3 text-center font-body text-[11px] font-bold dark:text-white/70">{p.stockFin.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <input
                        type="number" min="0" max={p.stockIni} value={p.vendido}
                        onChange={e => handleVendido(p.id, e.target.value)}
                        className="w-14 bg-surface dark:bg-[#121212] border border-outline-variant/30 dark:border-white/10 rounded-md px-2 py-1 text-[11px] font-bold text-on-surface dark:text-white focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] text-center"
                      />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button 
                        onClick={() => removeItemVenta(p.id)}
                        className="text-outline/40 hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {conteo.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-[10px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest opacity-50 italic">
                      Busca productos para agregar a la venta
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between items-center shrink-0">
            <div>
              {guardado && (
                <span className="flex items-center gap-1 text-[10px] text-green-700 font-bold uppercase tracking-widest animate-pulse">
                  <span className="material-symbols-outlined text-green-700 text-[14px]">check_circle</span>
                  Registro Exitoso
                </span>
              )}
            </div>
            <button
              onClick={guardar}
              disabled={conteo.length === 0 || procesando}
              className={`bg-primary-container dark:bg-[#e2bd6c] text-on-primary-container dark:text-black px-6 py-3 rounded-xl font-label text-[11px] font-bold uppercase tracking-widest transition-all shadow-sm flex items-center gap-2 ${conteo.length === 0 || procesando ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
            >
              <span className="material-symbols-outlined text-lg">save</span>
              Guardar Venta
            </button>
          </div>
        </section>

        {/* Mermas MANUAL */}
        <section className="bg-error/5 dark:bg-error/5 rounded-[2rem] p-8 border border-error/20 dark:border-error/20 flex flex-col h-[480px] tour-reportes-mermas">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-error dark:text-red-400">Registrar Pérdida</h3>
              <p className="text-[10px] text-error/70 dark:text-red-400/60 font-label uppercase tracking-widest mt-1">Registra productos dañados o mermas.</p>
            </div>
          </div>

          {/* Buscador de mermas */}
          <div className="mb-4 relative z-50">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-error/50 text-lg">search</span>
              <input
                type="text"
                placeholder="Buscar producto dañado..."
                value={searchMerma}
                onChange={e => setSearchMerma(e.target.value)}
                className="w-full bg-surface-container-lowest dark:bg-[#121212] border border-error/20 dark:border-error/30 rounded-xl pl-10 pr-4 py-2.5 text-xs font-bold focus:outline-none focus:border-error transition-all dark:text-white"
              />
            </div>
            {searchMerma && (
              <div className="absolute top-full left-0 right-0 mt-3 bg-surface dark:bg-[#1e1e1e] border border-error/20 dark:border-error/30 rounded-2xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
                {productos
                  .filter(p => p.nombre.toLowerCase().includes(searchMerma.toLowerCase()))
                  .map(p => (
                    <button
                      key={p.id}
                      onMouseDown={(e) => { e.preventDefault(); addItemMerma(p); }}
                      className="w-full px-5 py-4 text-left text-[11px] font-bold hover:bg-error/10 dark:hover:bg-error/20 transition-colors flex justify-between items-center border-b border-error/5 dark:border-error/10 group"
                    >
                      <span className="text-error dark:text-red-400 group-hover:scale-105 transition-transform origin-left">{p.nombre}</span>
                      <span className="text-[10px] text-error dark:text-red-400/60 opacity-60 bg-error/5 px-2 py-0.5 rounded-full font-extrabold">Stock: {p.stock}</span>
                    </button>
                  ))
                }
                {productos.filter(p => p.nombre.toLowerCase().includes(searchMerma.toLowerCase())).length === 0 && (
                  <div className="px-5 py-6 text-[10px] text-error/50 italic text-center font-bold uppercase tracking-widest">No se encontraron productos</div>
                )}
              </div>
            )}
          </div>

          <div className="overflow-y-auto flex-1 bg-surface-container-lowest/50 dark:bg-[#121212]/40 rounded-3xl border border-error/10 dark:border-error/20 relative z-10 p-1">
            {/* Overlay de Resumen de Confirmación Mermas */}
            {mostrarResumenMerma && (
              <div className="absolute inset-0 z-50 bg-error-container/95 dark:bg-red-950/90 backdrop-blur-sm p-6 flex flex-col animate-in fade-in duration-200">
                <h4 className="font-headline text-xl text-error dark:text-red-400 mb-4">Confirmar Pérdida</h4>
                <div className="flex-1 overflow-y-auto pr-2">
                  <p className="text-[10px] text-error/70 dark:text-red-400/60 font-label uppercase tracking-widest mb-3">Se restará del inventario:</p>
                  <ul className="space-y-2">
                    {conteoMerma.filter(i => i.vendido > 0).map(i => (
                      <li key={i.id} className="flex justify-between items-center text-[11px] font-bold bg-surface dark:bg-white/5 p-3 rounded-xl border border-error/10 dark:border-white/5">
                        <span className="text-error dark:text-red-400">{i.producto}</span>
                        <span className="text-error dark:text-red-400">{i.vendido} unidades</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-6 flex gap-3">
                  <button 
                    onClick={() => setMostrarResumenMerma(false)}
                    className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-error/60 hover:bg-error/10 transition-colors rounded-xl border border-error/20"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={guardarMerma}
                    className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-error text-on-error hover:scale-[1.02] active:scale-[0.98] transition-all rounded-xl shadow-md"
                  >
                    Confirmar Pérdida
                  </button>
                </div>
              </div>
            )}

            <table className="w-full text-left">
              <thead className="sticky top-0 bg-error/5 dark:bg-red-950/20 backdrop-blur-md px-2 z-20">
                <tr className="rounded-t-2xl overflow-hidden">
                  <th className="py-4 pl-5 font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c] rounded-tl-2xl">Producto</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c]">Stock Disp.</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c]">Cant.</th>
                  <th className="py-4 pr-4 rounded-tr-2xl"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-error/5">
                {conteoMerma.map((p) => (
                  <tr key={p.id} className="hover:bg-error/5 transition-colors">
                    <td className="py-3 pl-5 text-[11px] font-bold truncate max-w-[120px] text-[#5e2220] dark:text-red-400/80">{p.producto}</td>
                    <td className="py-3 text-center font-body text-[11px] font-bold text-[#5e2220] dark:text-red-400/70">{p.stockFin.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <input
                        type="number" min="0" max={p.stockIni} value={p.vendido}
                        onChange={e => handleMermado(p.id, e.target.value)}
                        className="w-14 bg-surface dark:bg-[#121212] border border-error/30 dark:border-white/10 rounded-md px-2 py-1 text-[11px] font-bold text-error dark:text-red-400 focus:outline-none focus:border-error text-center"
                      />
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <button 
                        onClick={() => removeItemMerma(p.id)}
                        className="text-error/30 hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </td>
                  </tr>
                ))}
                {conteoMerma.length === 0 && (
                  <tr>
                    <td colSpan="4" className="py-10 text-center text-[10px] text-error/60 dark:text-red-400/60 font-bold uppercase tracking-widest italic">
                      Busca productos para registrar mermas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-between items-center shrink-0">
            <div>
              {guardadoMerma && (
                <span className="flex items-center gap-1 text-[10px] text-error font-bold uppercase tracking-widest animate-pulse">
                  <span className="material-symbols-outlined text-error text-[14px]">check_circle</span>
                  Stock Eliminado
                </span>
              )}
            </div>
            <button
              onClick={guardarMerma}
              disabled={conteoMerma.length === 0 || procesando}
              className={`bg-error text-on-error px-6 py-3 rounded-xl font-label text-[11px] font-bold uppercase tracking-widest transition-all shadow-md flex items-center gap-2 ${conteoMerma.length === 0 || procesando ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
            >
              <span className="material-symbols-outlined text-lg">remove_shopping_cart</span>
              Eliminar Stock
            </button>
          </div>
        </section>
      </div>

      {/* HISTORIAL GENERAL (ANCHO COMPLETO) */}
      <section className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-[2rem] p-8 border border-outline-variant/10 dark:border-white/5 flex flex-col mb-16 relative z-10">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant dark:text-white/90">Historial Consolidado del Periodo</h3>
            <p className="text-[10px] text-outline dark:text-gray-500 font-label uppercase tracking-widest mt-1">
              Eventos totales: <strong className="text-secondary dark:text-[#e2bd6c]">{registrosFiltrados.length} registros</strong>
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
              if(prod) {
                const precio = Number(prod.precio) || 0;
                const cant = Number(item.cantidad) || 1;
                flujoMonetario += precio * cant;
              }
            })

            return (
              <div 
                key={v.id} 
                className={`p-5 rounded-2xl shadow-sm border flex flex-col gap-3 transition-colors hover:shadow-md ${isMerma ? 'bg-error/5 dark:bg-error/10 border-error/20 dark:border-error/30' : 'bg-surface dark:bg-[#121212] border-outline-variant/10 dark:border-white/5'}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                     <span className={`material-symbols-outlined text-[16px] ${isMerma ? 'text-error dark:text-red-400' : (esVentaDirecta ? 'text-primary dark:text-[#e2bd6c]' : 'text-secondary dark:text-[#e2bd6c]')}`}>
                       {isMerma ? 'remove_shopping_cart' : (esVentaDirecta ? 'storefront' : 'local_shipping')}
                     </span>
                     <span className={`font-bold text-[11px] uppercase tracking-widest ${isMerma ? 'text-error dark:text-red-400' : 'text-on-surface-variant dark:text-white/80'}`}>
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

                <ul className="text-xs space-y-1 pl-6 mt-1 mb-2">
                  {v.productos.map((prodItem, idx) => {
                    const baseProd = productos.find(xd => xd.id === prodItem.productoId)
                    const unitPrice = baseProd ? (Number(baseProd.precio) || 0) : 0
                    return (
                      <li key={idx} className={`${isMerma ? 'text-[#82322e] dark:text-red-300/80' : 'text-on-surface/80 dark:text-white/70'}`}>
                        <strong className={isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-[#e2bd6c]'}>{prodItem.cantidad}x</strong> {prodItem.nombre} <span className="opacity-60 text-[10px] ml-1">(${unitPrice.toLocaleString('es-CL')} c/u)</span>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-auto flex justify-end">
                   <span className={`font-headline font-bold text-lg ${isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-[#e2bd6c]'}`}>
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

      {/* Modal de Confirmación para Deshacer */}
      {registroADeshacer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-sm" onClick={() => setRegistroADeshacer(null)} />
          <div className="bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-[2rem] p-8 max-w-md w-full shadow-2xl relative z-10 animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 mb-4 text-error">
              <span className="material-symbols-outlined">warning</span>
              <h3 className="font-headline text-2xl">¿Deshacer Registro?</h3>
            </div>
            <p className="text-sm text-outline dark:text-gray-400 mb-6 leading-relaxed">
              Esta acción eliminará el registro de <strong>{registroADeshacer._tipo === 'merma' ? 'merma' : 'venta'}</strong> y devolverá los productos al inventario original.
            </p>
            <div className="bg-surface-container dark:bg-white/5 rounded-2xl p-4 mb-6">
              <ul className="space-y-2">
                {registroADeshacer.productos.map((p, idx) => (
                  <li key={idx} className="text-xs font-bold flex justify-between dark:text-white/80">
                    <span>{p.nombre}</span>
                    <span className="text-secondary dark:text-[#e2bd6c]">+{p.cantidad} unidades</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setRegistroADeshacer(null)}
                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest text-outline hover:bg-surface-variant transition-colors rounded-xl border border-outline-variant/20"
              >
                Cancelar
              </button>
              <button 
                onClick={() => deshacerRegistro(registroADeshacer)}
                disabled={procesando}
                className="flex-1 py-3 text-[10px] font-bold uppercase tracking-widest bg-error text-on-error hover:scale-[1.02] active:scale-[0.98] transition-all rounded-xl shadow-md disabled:opacity-50"
              >
                {procesando ? 'Procesando...' : 'Sí, deshacer'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
