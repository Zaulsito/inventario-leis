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

function formatMoney(value) {
  if (value >= 1000) {
    return '$' + (value / 1000).toFixed(0) + 'k'
  }
  return '$' + value
}

export default function Reportes() {
  const [periodo, setPeriodo] = useState(0)
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0])
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0])
  
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  
  // Para la tabla manual "Conteo Semanal de Ventas"
  const [conteo, setConteo] = useState([])
  const [guardado, setGuardado] = useState(false)
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
    })

    const unsubPed = onSnapshot(collection(db, 'pedidos'), snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setPedidos(data)
    })

    return () => { unsubProd(); unsubPed(); }
  }, [])

  // Filtrado de pedidos según periodo
  const ventasFiltradas = useMemo(() => {
    return pedidos.filter(p => {
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
  }, [pedidos, periodo, fechaInicio, fechaFin])

  // Cálculo del gráfico
  const chartData = useMemo(() => {
    const map = {}
    
    // Preparar dominios vacíos para que la gráfica no se vea pelona
    if (periodo === 0) {
      const start = getStartOfWeek()
      for(let i=0; i<7; i++) {
        const temp = new Date(start)
        temp.setDate(temp.getDate() + i)
        map[temp.toISOString().split('T')[0]] = 0
      }
    }

    ventasFiltradas.forEach(p => {
      const dateStr = (p.fechaCreacion ? p.fechaCreacion.split('T')[0] : p.fechaEntrega)
      let sum = 0
      p.productos.forEach(item => {
        const prod = productos.find(x => x.id === item.productoId)
        if (prod) sum += (prod.precio || 0) * item.cantidad
      })
      if (map[dateStr] === undefined) map[dateStr] = 0
      map[dateStr] += sum
    })

    return Object.keys(map).sort().map(dateStr => {
      // Intentar sacar un nombre corto (ej: "Lun", "Mar")
      const d = new Date(dateStr + 'T12:00:00')
      const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'short' })
      return {
        fechaReal: dateStr,
        label: periodo === 0 ? nombreDia.toUpperCase() : dateStr.split('-').slice(1).reverse().join('/'),
        Ganancia: map[dateStr]
      }
    })
  }, [ventasFiltradas, productos, periodo])

  const totalMonetario = chartData.reduce((acc, curr) => acc + curr.Ganancia, 0)

  // Metricas extraídas de ventasFiltradas (los productos totales de esas órdenes)
  const totalVendidosUnidades = useMemo(() => {
    let cant = 0
    ventasFiltradas.forEach(ped => {
      ped.productos.forEach(prod => { cant += Number(prod.cantidad) })
    })
    return cant
  }, [ventasFiltradas])

  // --- Handlers de la tabla de Conteo Semanal (Manual) ---
  function handleVendido(idProd, val) {
    setConteo(prev => prev.map(item => {
      if (item.id !== idProd) return item
      const v = Math.max(0, Number(val))
      return { ...item, vendido: v, stockFin: item.stockIni - v }
    }))
  }

  async function guardar() {
    if (procesando) return
    const itemsAVender = conteo.filter(item => item.vendido > 0)
    if (itemsAVender.length === 0) return alert('No hay ventas manuales que registrar.')
    
    setProcesando(true)
    try {
      const batch = writeBatch(db)
      
      // 1. Restar stock
      itemsAVender.forEach(item => {
        const ref = doc(db, 'productos', item.id)
        const nuevoEstado = item.stockFin <= 10 ? (item.stockFin <= 5 ? 'critico' : 'bajo') : 'disponible'
        batch.update(ref, { 
          stock: item.stockFin,
          estado: nuevoEstado
        })
      })

      // 2. Registrar Venta Directa ficticia
      const ventaRef = doc(collection(db, 'pedidos'))
      const payloadProductos = itemsAVender.map(i => ({
        productoId: i.id,
        nombre: i.producto,
        cantidad: i.vendido
      }))

      batch.set(ventaRef, {
        cliente: 'Venta Directa',
        fechaEntrega: new Date().toISOString().split('T')[0],
        productos: payloadProductos,
        fechaCreacion: new Date().toISOString(),
        estado: 'completado'
      })

      await batch.commit()
      setGuardado(true)

      // Limpiar inputs
      setConteo(prev => prev.map(item => ({...item, vendido: 0, stockIni: item.stockFin})))
      
      setTimeout(() => setGuardado(false), 2500)
    } catch (e) {
      console.error(e)
      alert('Error guardando')
    } finally {
      setProcesando(false)
    }
  }

  // --- Reporte y PDF ---
  function exportarPDF() {
    const doc = new jsPDF()
    doc.text("Reporte de Desempeño Leis", 14, 15)
    doc.setFontSize(10)
    doc.text(`Periodo: ${PERIODOS[periodo]} (${fechaInicio} - ${fechaFin})`, 14, 22)
    doc.text(`Total Unidades: ${totalVendidosUnidades} | Ganancia: $${totalMonetario.toLocaleString('es-CL')}`, 14, 28)
    
    const tableData = ventasFiltradas.map(p => {
      const fecha = (p.fechaCreacion || p.fechaEntrega).split('T')[0]
      const desc = p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(', ')
      let gananciaVenta = 0
      p.productos.forEach(item => {
        const pr = productos.find(xd => xd.id === item.productoId)
        if(pr) gananciaVenta += (pr.precio || 0) * item.cantidad
      })
      return [fecha, p.cliente, desc, `$${gananciaVenta.toLocaleString('es-CL')}`]
    })

    autoTable(doc, {
      startY: 35,
      head: [['Fecha', 'Tipo/Cliente', 'Productos', 'Monto ($)']],
      body: tableData,
    })

    doc.save("reporte_ventas_leis.pdf")
  }

  function exportarCSV() {
    const encabezados = ['Fecha', 'Cliente/Tipo', 'Detalle Productos', 'Monto Generado ($)']
    const filas = ventasFiltradas.map(p => {
      const fecha = (p.fechaCreacion || p.fechaEntrega).split('T')[0]
      const desc = p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(' | ')
      let gananciaVenta = 0
      p.productos.forEach(item => {
        const pr = productos.find(xd => xd.id === item.productoId)
        if(pr) gananciaVenta += (pr.precio || 0) * item.cantidad
      })
      return [
        `"${fecha}"`, 
        `"${p.cliente}"`, 
        `"${desc}"`, 
        gananciaVenta
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

      {/* Header */}
      <header className="mb-10 flex flex-col xl:flex-row xl:justify-between xl:items-end gap-5">
        <div>
          <span className="font-label text-xs uppercase tracking-[0.2em] text-secondary font-bold mb-1 block">Análisis Financiero</span>
          <h2 className="font-headline text-4xl md:text-5xl text-on-tertiary-fixed-variant leading-tight">Métricas de Ventas</h2>
          <p className="mt-3 text-outline font-body max-w-lg leading-relaxed text-sm">
            Supervisa el crecimiento, exporta reportes y sincroniza salidas.
          </p>
        </div>
        
        <div className="flex flex-col md:flex-row md:items-end gap-3 self-start xl:self-auto">
          {/* Selector de periodo y controles Date */}
          <div className="flex gap-2 bg-surface-container-[0.2] p-2 rounded-2xl border border-outline-variant/10">
            <select
              value={periodo}
              onChange={e => setPeriodo(Number(e.target.value))}
              className="bg-surface-container-highest px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest border-0 text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-container"
            >
              {PERIODOS.map((s, i) => <option key={s} value={i}>{s}</option>)}
            </select>

            {periodo === 2 && (
              <div className="flex gap-2">
                <input 
                  type="date" 
                  value={fechaInicio} 
                  onChange={e => setFechaInicio(e.target.value)} 
                  className="bg-surface-container-highest px-3 py-2 text-xs font-bold uppercase rounded-xl focus:outline-none" 
                  title="Fecha de Inicio"
                />
                <input 
                  type="date" 
                  value={fechaFin} 
                  onChange={e => setFechaFin(e.target.value)} 
                  className="bg-surface-container-highest px-3 py-2 text-xs font-bold uppercase rounded-xl focus:outline-none" 
                  title="Fecha Fin"
                />
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            <button onClick={exportarPDF} className="bg-surface-container-highest px-5 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest text-on-surface hover:bg-surface-variant transition-colors flex items-center gap-2 relative z-10">
              <span className="material-symbols-outlined text-sm text-error">picture_as_pdf</span>
              Exportar PDF
            </button>
            <button onClick={exportarCSV} className="bg-primary-container text-on-primary-container px-6 py-3 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest shadow-lg hover:scale-105 transition-all flex items-center gap-2 relative z-10">
              <span className="material-symbols-outlined text-sm">csv</span>
              Generar Excel
            </button>
          </div>
        </div>
      </header>

      {/* Gráfico principal */}
      <section className="mb-10 w-full h-[400px] bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col relative z-0">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Gráfica de Ganancias</h3>
            <p className="text-xs text-outline font-label uppercase tracking-widest mt-1">Evolución de ingresos en el periodo</p>
          </div>
          <div className="bg-surface-container px-5 py-3 rounded-2xl flex flex-col items-end border border-outline-variant/20">
            <span className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Cálculo Total Neto</span>
            <span className="font-headline font-bold text-2xl text-secondary">${totalMonetario.toLocaleString('es-CL')}</span>
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
                formatter={(value) => [`$${value.toLocaleString('es-CL')}`, 'Ganancias']}
                labelStyle={{ fontWeight: 'bold', color: '#524430' }}
                contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Area type="monotone" dataKey="Ganancia" stroke="#524430" strokeWidth={3} fillOpacity={1} fill="url(#colorGanancia)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Tabla Manual y Historial unificados */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16 relative z-10">
        
        {/* Conteo semanal MANUAL (para Venta Directa) */}
        <section className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Registrar Venta Directa</h3>
              <p className="text-[10px] text-outline font-label uppercase tracking-widest mt-1">
                Registra ventas manuales.
              </p>
            </div>
            <div className="flex items-center gap-3">
              {guardado && (
                <span className="flex items-center gap-1 text-xs text-green-700 font-bold animate-pulse">
                  <span className="material-symbols-outlined text-green-700 text-sm">check_circle</span>
                  Guardado
                </span>
              )}
              <button
                onClick={guardar}
                className="bg-primary-container text-on-primary-container px-6 py-2.5 rounded-xl font-label text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-all shadow-sm"
              >
                Guardar conteo
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 bg-surface-container-highest/20 rounded-2xl border border-outline-variant/20 relative z-10 p-1">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-container-low/90 backdrop-blur-md px-2 z-20">
                <tr>
                  <th className="py-4 pl-5 font-label text-[9px] font-extrabold uppercase tracking-widest text-outline">Producto</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-outline">Stock Disp.</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-outline">Cant. Extendida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {conteo.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container-high transition-colors">
                    <td className="py-3 pl-5 text-[11px] font-bold truncate max-w-[120px]">{p.producto}</td>
                    <td className="py-3 text-center font-body text-[11px] font-bold">{p.stockFin.toLocaleString()}</td>
                    <td className="py-3 text-center">
                      <input
                        type="number"
                        min="0"
                        max={p.stockIni}
                        value={p.vendido}
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

        {/* HISTORIAL GENERAL */}
        <section className="bg-surface-container-low rounded-[2rem] p-8 border border-outline-variant/10 flex flex-col h-[500px]">
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-on-tertiary-fixed-variant">Historial Periodo</h3>
              <p className="text-[10px] text-outline font-label uppercase tracking-widest mt-1">
                Total sincronizado: <strong className="text-secondary">{totalVendidosUnidades} unidades</strong>
              </p>
            </div>
          </div>
          
          <div className="overflow-y-auto flex-1 bg-surface-container-highest/20 rounded-2xl border border-outline-variant/20 relative z-10 px-4 py-2 space-y-3">
            {ventasFiltradas.map((v) => {
              const esVentaDirecta = v.cliente === "Venta Directa"
              let gananciaVenta = 0
              v.productos.forEach(item => {
                const prod = productos.find(xd => xd.id === item.productoId)
                if(prod) gananciaVenta += (prod.precio || 0) * item.cantidad
              })

              return (
                <div key={v.id} className="bg-surface p-4 rounded-2xl shadow-sm border border-outline-variant/10 flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                       <span className={`material-symbols-outlined text-sm ${esVentaDirecta ? 'text-primary' : 'text-secondary'}`}>
                         {esVentaDirecta ? 'storefront' : 'local_shipping'}
                       </span>
                       <span className="font-bold text-xs uppercase tracking-widest text-on-surface-variant">
                         {esVentaDirecta ? 'Ajuste / Venta Directa' : v.cliente}
                       </span>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase text-outline">
                       {(v.fechaCreacion || v.fechaEntrega).split('T')[0]}
                    </span>
                  </div>
                  <div className="flex justify-between items-end">
                     <ul className="text-xs space-y-0.5 opacity-80">
                        {v.productos.map((prod, idx) => (
                           <li key={idx}><strong className="text-secondary">{prod.cantidad}x</strong> {prod.nombre}</li>
                        ))}
                     </ul>
                     <span className="font-headline font-bold text-lg text-secondary">+${gananciaVenta.toLocaleString('es-CL')}</span>
                  </div>
                </div>
              )
            })}
            
            {ventasFiltradas.length === 0 && (
              <div className="flex flex-col items-center justify-center opacity-60 h-full w-full text-center mt-10">
                <span className="material-symbols-outlined text-4xl mb-2 text-outline">analytics</span>
                <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Aún no hay reportes de ventas para esta fecha</p>
              </div>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
