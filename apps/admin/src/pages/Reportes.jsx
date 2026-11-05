import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, doc, writeBatch, addDoc, deleteDoc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLocalDateString } from '../utils/date'
import { calcularEstado } from '../utils/date'
import Footer from '../components/Footer'
import { useAuth } from '../context/AuthContext'

const PERIODOS = ['Semana Actual', 'Mes Actual', 'Seleccionar Mes', 'Histórico Anual', 'Personalizado']

function getNombreMesActual() {
  const d = new Date()
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${meses[d.getMonth()]} ${d.getFullYear()}`
}

function getNombreMesSeleccionado(mesISO) {
  if (!mesISO) return ''
  const parts = mesISO.split('-')
  if (parts.length < 2) return ''
  const y = Number(parts[0])
  const m = Number(parts[1]) - 1
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${meses[m]} ${y}`
}


function parseLocalDate(fString) {
  if (!fString) return null
  if (typeof fString === 'string') {
    const clean = fString.trim()
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      const [y, m, d] = clean.split('-').map(Number)
      return new Date(y, m - 1, d, 0, 0, 0, 0)
    }
    if (clean.includes('T') || clean.includes(' ')) {
      const datePart = clean.split(/[T ]/)[0]
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        const [y, m, d] = datePart.split('-').map(Number)
        return new Date(y, m - 1, d, 0, 0, 0, 0)
      }
    }
  }
  const d = new Date(fString)
  return isNaN(d.getTime()) ? null : d
}

function getStartOfWeek() {
  const d = new Date()
  const day = d.getDay() // 0 = Domingo, 1 = Lunes
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Lunes como inicio
  return new Date(d.getFullYear(), d.getMonth(), diff, 0, 0, 0, 0)
}

function getStartOfMonth() {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
}

function getLocalDateISO(p) {
  if (!p) return ''
  const f = p.fechaEntrega || p.fecha || p.fechaCreacion
  if (!f) return ''
  try {
    if (typeof f === 'string') {
      const clean = f.trim()
      if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean
      if (clean.includes('T') || clean.includes(' ')) {
        const datePart = clean.split(/[T ]/)[0]
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart
      }
    }
    const d = parseLocalDate(f)
    if (!d) return ''
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  } catch (e) {
    return ''
  }
}

function getLocalStr(p) {
  const iso = getLocalDateISO(p)
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}-${m}-${y}`
}

function formatMoney(value) {
  if (value === undefined || value === null || isNaN(value)) return '$0';
  // Manejo de valores negativos
  const neg = value < 0
  const abs = Math.abs(value)
  let f = ''
  if (abs >= 1000) {
    f = '$' + (abs / 1000).toFixed(abs >= 10000 ? 0 : 1) + 'k'
  } else {
    f = '$' + abs.toLocaleString('es-CL')
  }
  return neg ? '-' + f : f
}

const getHexColor = (name) => {
  if (!name) return null;
  const colors = {
    'azul': '#3b82f6',
    'rosado': '#ec4899',
    'rosa': '#ec4899',
    'burdeo': '#800020',
    'burdeos': '#800020',
    'verde': '#22c55e',
    'amarillo': '#eab308',
    'morado': '#a855f7',
    'púrpura': '#a855f7',
    'rojo': '#ef4444',
    'negro': '#000000',
    'blanco': '#ffffff',
    'gris': '#6b7280',
    'naranja': '#f97316',
    'celeste': '#0ea5e9',
    'café': '#78350f',
    'marrón': '#78350f',
    'beige': '#f5f5dc',
    'fucsia': '#d946ef',
    'cian': '#06b6d4',
    'esmeralda': '#10b981',
    'turquesa': '#14b8a6',
    'lila': '#d8b4fe',
    'lavanda': '#e9d5ff',
    'crema': '#fffdd0',
    'dorado': '#ffd700',
    'plata': '#c0c0c0',
    'bronce': '#cd7f32'
  };
  return colors[name.toLowerCase()] || null;
};

// Utilidad para normalizar texto (quitar acentos y convertir a minúsculas)
const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

export default function Reportes() {
  const { currentUser, operatorName } = useAuth() || {}
  const currentOperator = operatorName || 'Por sistema'
  const [periodo, setPeriodo] = useState(1) // Por defecto: Mes Actual
  const [chartMode, setChartMode] = useState('ambas')
  const [mesSeleccionado, setMesSeleccionado] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [anoSeleccionado, setAnoSeleccionado] = useState(() => new Date().getFullYear())
  const [fechaInicio, setFechaInicio] = useState(getLocalDateString())
  const [fechaFin, setFechaFin] = useState(getLocalDateString())
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [showPeriodMenu, setShowPeriodMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const [showYearPicker, setShowYearPicker] = useState(false)
  const [pickerYear, setPickerYear] = useState(() => new Date().getFullYear())
  const [showInicioPicker, setShowInicioPicker] = useState(false)
  const [showFinPicker, setShowFinPicker] = useState(false)
  const [inicioCalMonth, setInicioCalMonth] = useState(() => new Date().getMonth())
  const [inicioCalYear, setInicioCalYear] = useState(() => new Date().getFullYear())
  const [finCalMonth, setFinCalMonth] = useState(() => new Date().getMonth())
  const [finCalYear, setFinCalYear] = useState(() => new Date().getFullYear())
  
  const [productos, setProductos] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [mermas, setMermas] = useState([])
  const [historialInventario, setHistorialInventario] = useState([])

  // Para la tabla manual "Conteo Semanal de Ventas"
  const [conteo, setConteo] = useState([])
  const [guardado, setGuardado] = useState(false)
  
  // Para el módulo de "Mermas"
  const [conteoMerma, setConteoMerma] = useState([])
  const [guardadoMerma, setGuardadoMerma] = useState(false)
  const [motivoMerma, setMotivoMerma] = useState('Dañado')
  const [fechaMerma, setFechaMerma] = useState(getLocalDateString()) // Estado para la fecha de merma

  const [procesando, setProcesando] = useState(false)
  
  // Estados para búsqueda
  const [searchVenta, setSearchVenta] = useState('')
  const [searchMerma, setSearchMerma] = useState('')

  // Estados para confirmación personalizada
  const [mostrarResumenVenta, setMostrarResumenVenta] = useState(false)
  const [mostrarResumenMerma, setMostrarResumenMerma] = useState(false)

  // Estado para deshacer
  const [registroADeshacer, setRegistroADeshacer] = useState(null)

  // Paginación para el Historial Consolidado
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 20

  useEffect(() => {
    setCurrentPage(1)
  }, [periodo, fechaInicio, fechaFin, mesSeleccionado, anoSeleccionado])

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

    const unsubHist = onSnapshot(collection(db, 'historial_inventario'), snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setHistorialInventario(data)
    })

    return () => { unsubProd(); unsubPed(); unsubMerma(); unsubHist(); }
  }, [])



  // Filtrado de pedidos, mermas y gastos combinados
  const registrosFiltrados = useMemo(() => {
    // Mermas registradas directamente en historial_inventario que no estén en la colección 'mermas'
    const mermasFromHistorial = historialInventario.filter(log => {
      if (log.mermaId && mermas.some(m => m.id === log.mermaId)) return false

      const cambioNum = Number(log.cambio) || 0
      const motivoStr = (log.motivo || '').toLowerCase()
      const accionStr = (log.accion || '').toLowerCase()

      const esMerma = log.esMermaReal || (
        cambioNum < 0 && (
          motivoStr.includes('merma') ||
          motivoStr.includes('dañad') ||
          motivoStr.includes('danad') ||
          motivoStr.includes('rotura') ||
          motivoStr.includes('pérdida') ||
          motivoStr.includes('perdida') ||
          accionStr.includes('merma')
        )
      )
      return esMerma
    }).map(log => {
      const prod = productos.find(p => p.id === log.productoId)
      const cant = Math.abs(Number(log.cambio) || 1)
      const costUnit = Number(log.precioCosto) || Number(prod?.precioCosto) || Number(prod?.precio) || 0
      const fechaDoc = log.fecha || getLocalDateString()
      const fechaEntrega = fechaDoc.includes('T') ? fechaDoc.split('T')[0] : (fechaDoc.includes(' ') ? fechaDoc.split(' ')[0] : fechaDoc)

      return {
        id: log.id,
        _tipo: 'merma',
        _fromHistorial: true,
        historialDocId: log.id,
        mermaId: log.mermaId || null,
        motivo: log.motivoMerma || log.motivo || 'Merma / Producto Dañado',
        fecha: fechaDoc,
        fechaCreacion: fechaDoc,
        fechaEntrega: fechaEntrega,
        productos: [
          {
            productoId: log.productoId,
            nombre: prod?.nombre || 'Producto',
            cantidad: cant,
            variante: log.varianteNombre || null,
            precioCosto: costUnit
          }
        ]
      }
    })

    const combinados = [
      ...pedidos.map(p => ({ ...p, _tipo: 'venta' })),
      ...mermas.map(m => ({ ...m, _tipo: 'merma' })),
      ...mermasFromHistorial
    ]

    return combinados.filter(p => {
      const fString = p.fechaEntrega || p.fecha || p.fechaCreacion
      if (!fString) return false
      
      const pxDate = parseLocalDate(fString)
      if (!pxDate) return false
      pxDate.setHours(0,0,0,0)

      if (periodo === 0) { // Semana Actual (Lunes a Domingo)
        const start = getStartOfWeek()
        const end = new Date(start)
        end.setDate(end.getDate() + 6)
        end.setHours(23,59,59,999)
        return pxDate >= start && pxDate <= end
      } else if (periodo === 1) { // Mes Actual
        const start = getStartOfMonth()
        const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59, 999)
        return pxDate >= start && pxDate <= end
      } else if (periodo === 2) { // Seleccionar Mes
        if (!mesSeleccionado) return true
        const [yStr, mStr] = mesSeleccionado.split('-')
        const y = Number(yStr)
        const m = Number(mStr) - 1
        const start = new Date(y, m, 1, 0, 0, 0, 0)
        const end = new Date(y, m + 1, 0, 23, 59, 59, 999)
        return pxDate >= start && pxDate <= end
      } else if (periodo === 3) { // Histórico Anual
        const y = Number(anoSeleccionado) || new Date().getFullYear()
        const start = new Date(y, 0, 1, 0, 0, 0, 0)
        const end = new Date(y, 11, 31, 23, 59, 59, 999)
        return pxDate >= start && pxDate <= end
      } else { // Personalizado (periodo === 4)
        const start = parseLocalDate(fechaInicio) || new Date()
        start.setHours(0,0,0,0)
        const end = parseLocalDate(fechaFin) || new Date()
        end.setHours(23,59,59,999)
        return pxDate >= start && pxDate <= end
      }
    }).sort((a,b) => {
      const fA = parseLocalDate(a.fechaEntrega || a.fecha || a.fechaCreacion) || new Date(0)
      const fB = parseLocalDate(b.fechaEntrega || b.fecha || b.fechaCreacion) || new Date(0)
      return fB - fA // Más recientes primero
    })
  }, [pedidos, mermas, historialInventario, productos, periodo, fechaInicio, fechaFin, mesSeleccionado, anoSeleccionado])

  // Cálculo del gráfico
  const chartData = useMemo(() => {
    const map = {}
    
    // Preparar dominios vacíos según el período seleccionado
    if (periodo === 0) {
      // Semana Actual: de Lunes a Domingo
      const start = getStartOfWeek()
      for (let i = 0; i < 7; i++) {
        const temp = new Date(start)
        temp.setDate(temp.getDate() + i)
        const iso = temp.getFullYear() + '-' + String(temp.getMonth() + 1).padStart(2, '0') + '-' + String(temp.getDate()).padStart(2, '0')
        map[iso] = { Ganancia: 0, Pérdida: 0 }
      }
    } else if (periodo === 1) {
      // Mes Actual: de día 1 a fin de mes
      const start = getStartOfMonth()
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0)
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
        map[iso] = { Ganancia: 0, Pérdida: 0 }
      }
    } else if (periodo === 2) {
      // Seleccionar Mes
      if (mesSeleccionado) {
        const [yStr, mStr] = mesSeleccionado.split('-')
        const y = Number(yStr)
        const m = Number(mStr) - 1
        const start = new Date(y, m, 1)
        const end = new Date(y, m + 1, 0)
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
          map[iso] = { Ganancia: 0, Pérdida: 0 }
        }
      }
    } else if (periodo === 3) {
      // Histórico Anual: 12 meses del año seleccionado
      const y = Number(anoSeleccionado) || new Date().getFullYear()
      const mesesLabels = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
      for (let m = 0; m < 12; m++) {
        const mKey = `${y}-${String(m + 1).padStart(2, '0')}`
        map[mKey] = { label: mesesLabels[m], Ganancia: 0, Pérdida: 0 }
      }
    } else if (periodo === 4) {
      // Personalizado: de fechaInicio a fechaFin
      const start = parseLocalDate(fechaInicio)
      const end = parseLocalDate(fechaFin)
      if (start && end && start <= end) {
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const iso = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
          map[iso] = { Ganancia: 0, Pérdida: 0 }
        }
      }
    }

    registrosFiltrados.forEach(p => {
      const dateStr = getLocalDateISO(p)
      if (!dateStr) return;
      const targetKey = (periodo === 3) ? dateStr.slice(0, 7) : dateStr;

      let sum = 0
      if (p.productos && Array.isArray(p.productos)) {
        p.productos.forEach(item => {
          const prod = productos.find(x => x.id === item.productoId)
          const precio = prod ? (Number(prod.precio) || Number(prod.precioCosto) || 0) : (Number(item.precioCosto) || Number(item.precio) || 0);
          const cant = Number(item.cantidad) || 1;
          sum += precio * cant;
        })
      }
      if (map[targetKey] === undefined) {
        map[targetKey] = { Ganancia: 0, Pérdida: 0 }
      }
      
      if (p._tipo === 'venta') {
        let gananciaReal = Number(p.total) || sum;
        map[targetKey].Ganancia += gananciaReal;
      } else {
        map[targetKey].Pérdida += sum;
      }
    })

    if (periodo === 3) {
      return Object.keys(map).sort().map(mKey => {
        return {
          fechaReal: mKey,
          label: map[mKey].label || mKey,
          Ganancia: map[mKey].Ganancia,
          Pérdida: -map[mKey].Pérdida,
                    Total: map[mKey].Ganancia - map[mKey].Pérdida
        }
      })
    }

    return Object.keys(map).sort().map(dateStr => {
      const d = parseLocalDate(dateStr)
      const nombreDia = d ? d.toLocaleDateString('es-ES', { weekday: 'short' }) : ''
      const [y, m, day] = dateStr.split('-')
      return {
        fechaReal: dateStr,
        label: periodo === 0 ? nombreDia.toUpperCase() : `${day}-${m}-${y}`,
        Ganancia: map[dateStr].Ganancia,
        Pérdida: -map[dateStr].Pérdida,
                Total: map[dateStr].Ganancia - map[dateStr].Pérdida
      }
    })
  }, [registrosFiltrados, productos, periodo, fechaInicio, fechaFin, mesSeleccionado, anoSeleccionado])

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

  function addItemVenta(p, variantName = null) {
    const itemId = variantName ? `${p.id}-${variantName}` : p.id
    setConteo(prev => {
      const exists = prev.find(x => x.id === itemId)
      if (exists) return prev
      
      let stockIni = Number(p.stock) || 0
      let variantLabel = ''
      
      if (variantName && p.variantes) {
        const v = p.variantes.find(vx => vx.nombre === variantName)
        if (v) {
          stockIni = Number(v.stock) || 0
          variantLabel = ` (${variantName})`
        }
      }

      return [...prev, {
        id: itemId,
        productoId: p.id,
        producto: p.nombre + variantLabel,
        variante: variantName,
        stockIni: stockIni,
        vendido: 1,
        stockFin: stockIni - 1,
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
        estado: 'completado',
        usuario: currentOperator,
        usuarioEmail: currentUser?.email || null
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

  function addItemMerma(p, variantName = null) {
    const itemId = variantName ? `${p.id}-${variantName}` : p.id
    setConteoMerma(prev => {
      const exists = prev.find(x => x.id === itemId)
      if (exists) return prev
      
      let stockIni = Number(p.stock) || 0
      let variantLabel = ''
      
      if (variantName && p.variantes) {
        const v = p.variantes.find(vx => vx.nombre === variantName)
        if (v) {
          stockIni = Number(v.stock) || 0
          variantLabel = ` (${variantName})`
        }
      }

      return [...prev, {
        id: itemId,
        productoId: p.id,
        producto: p.nombre + variantLabel,
        variante: variantName,
        stockIni: stockIni,
        vendido: 1,
        stockFin: stockIni - 1,
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
      
      // Consolidar actualizaciones por productoId (agrupando variantes)
      const updatesMap = {}; // productoId -> { globalStock: number, variantes: [] }

      itemsAMermar.forEach(item => {
        const pId = item.productoId || item.id; // Fallback por si acaso
        if (!updatesMap[pId]) {
          const pOrig = productos.find(p => p.id === pId);
          if (pOrig) {
            updatesMap[pId] = {
              globalStock: Number(pOrig.stock),
              variantes: pOrig.variantes ? JSON.parse(JSON.stringify(pOrig.variantes)) : null
            };
          }
        }

        const u = updatesMap[pId];
        if (u) {
          u.globalStock -= Number(item.vendido);
          if (item.variante && u.variantes) {
            const v = u.variantes.find(vx => vx.nombre === item.variante);
            if (v) v.stock = Math.max(0, Number(v.stock) - Number(item.vendido));
          }
        }
      });

      // Aplicar actualizaciones al batch
      for (const pId in updatesMap) {
        const u = updatesMap[pId];
        const ref = doc(db, 'productos', pId);
        const nuevoEstado = calcularEstado(u.globalStock);
        
        let payload = { 
          stock: u.globalStock, 
          estado: nuevoEstado 
        };
        if (u.variantes) payload.variantes = u.variantes;
        
        batch.update(ref, payload);
      }

      const mermaRef = doc(collection(db, 'mermas'))
      const payloadProductos = itemsAMermar.map(i => ({ 
        productoId: i.productoId || i.id, 
        nombre: i.producto, 
        cantidad: i.vendido,
        variante: i.variante || null
      }))

      batch.set(mermaRef, {
        motivo: motivoMerma,
        fechaEntrega: fechaMerma,
        productos: payloadProductos,
        fechaCreacion: new Date().toISOString(),
        _tipo: 'merma',
        usuario: currentOperator,
        usuarioEmail: currentUser?.email || null
      })

      // Registrar eventos individuales en historial_inventario para sincronización en Kardex
      payloadProductos.forEach(i => {
        const hRef = doc(collection(db, 'historial_inventario'))
        batch.set(hRef, {
          productoId: i.productoId,
          accion: `Merma / ${motivoMerma}`,
          motivo: `Pérdida por ${motivoMerma}${i.variante ? ' (' + i.variante + ')' : ''}`,
          cambio: -Number(i.cantidad),
          fecha: fechaMerma || getLocalDateString(),
          esMermaReal: true,
          mermaId: mermaRef.id,
          motivoMerma: motivoMerma,
          usuario: currentOperator,
          usuarioEmail: currentUser?.email || null
        })
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

      // 1. Consolidar Stock para devolver
      const productosMap = {}; // productoId -> { stock: number, variantes: [] }

      registro.productos.forEach(itemInfo => {
        if (!productosMap[itemInfo.productoId]) {
          const pM = productos.find(p => p.id === itemInfo.productoId);
          if (pM) {
            productosMap[itemInfo.productoId] = {
              stock: Number(pM.stock),
              variantes: pM.variantes ? JSON.parse(JSON.stringify(pM.variantes)) : null
            };
          }
        }

        const pData = productosMap[itemInfo.productoId];
        if (pData) {
          pData.stock += Number(itemInfo.cantidad);
          if (itemInfo.variante && pData.variantes) {
            const v = pData.variantes.find(v => (v.nombre || null) === (itemInfo.variante || null));
            if (v) v.stock = Number(v.stock) + Number(itemInfo.cantidad);
          }
        }
      });

      // Aplicar todos los cambios al batch
      for (const id in productosMap) {
        const pData = productosMap[id];
        const prodRef = doc(db, 'productos', id);
        let payload = { 
          stock: pData.stock, 
          estado: calcularEstado(pData.stock) 
        };
        if (pData.variantes) payload.variantes = pData.variantes;
        batch.update(prodRef, payload);
      }

      if (registro._fromHistorial) {
        batch.delete(doc(db, 'historial_inventario', registro.id));
        if (registro.mermaId) {
          batch.delete(doc(db, 'mermas', registro.mermaId));
        }
      } else {
        const colName = registro._tipo === 'merma' ? 'mermas' : 'pedidos'
        const docRef = doc(db, colName, registro.id)
        batch.delete(docRef)

        // Eliminar también cualquier registro vinculado en historial_inventario
        const fieldId = registro._tipo === 'merma' ? 'mermaId' : 'pedidoId'
        const qHist = query(collection(db, 'historial_inventario'), where(fieldId, '==', registro.id))
        const snapHist = await getDocs(qHist)
        snapHist.docs.forEach(hDoc => {
          batch.delete(hDoc.ref)
        })
      }

      await batch.commit()
      setRegistroADeshacer(null)
    } catch (e) {
      console.error(e)
      alert('Error al intentar deshacer el registro.')
    } finally {
      setProcesando(false)
    }
  }

  // --- Reporte y PDF (Estilo Luxe Ejecutivo) ---
  function exportarPDF() {
    const docPdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const totalNetoReal = totalMonetario - totalPerdidaMonetario
    const labelPeriodo = PERIODOS[periodo] || 'Reporte'
    let infoPeriodo = labelPeriodo
    if (periodo === 2 && mesSeleccionado) {
      infoPeriodo += ` (${getNombreMesSeleccionado(mesSeleccionado)})`
    } else if (periodo === 3) {
      infoPeriodo += ` (Año ${anoSeleccionado})`
    } else if (periodo === 4) {
      infoPeriodo += ` (${fechaInicio ? fechaInicio.split('-').reverse().join('/') : ''} - ${fechaFin ? fechaFin.split('-').reverse().join('/') : ''})`
    }

    // 1. Banner Superior Oscuro y Dorado
    docPdf.setFillColor(30, 30, 30) // #1e1e1e
    docPdf.rect(0, 0, 210, 34, 'F')

    docPdf.setFillColor(226, 189, 108) // #e2bd6c (Luxe Gold)
    docPdf.rect(0, 34, 210, 2, 'F')

    // Título y Subtítulo Corporativo
    docPdf.setTextColor(226, 189, 108)
    docPdf.setFont('helvetica', 'bold')
    docPdf.setFontSize(16)
    docPdf.text("INVENTARIO LEIS", 14, 15)

    docPdf.setTextColor(255, 255, 255)
    docPdf.setFontSize(9)
    docPdf.setFont('helvetica', 'normal')
    docPdf.text("INFORME EJECUTIVO DE CONTROL FINANCIERO Y COMERCIAL", 14, 24)

    // Sello Fecha/Hora en Banner (Alineado a la derecha)
    const fechaHoraHora = `${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
    docPdf.setFontSize(8)
    docPdf.setTextColor(200, 200, 200)
    docPdf.text(`Generado: ${fechaHoraHora}`, 196, 15, { align: 'right' })
    docPdf.setTextColor(226, 189, 108)
    docPdf.setFont('helvetica', 'bold')
    docPdf.text(`Rango: ${infoPeriodo}`, 196, 24, { align: 'right' })

    // 2. Tarjetas de Resumen KPI (3 cuadros ejecutivos)
    const cardY = 42
    const cardH = 18
    const cardW = 58
    const gap = 4
    let startX = 14

    // KPI 1: Ventas Totales
    docPdf.setFillColor(240, 253, 244)
    docPdf.setDrawColor(187, 247, 208)
    docPdf.roundedRect(startX, cardY, cardW, cardH, 2, 2, 'FD')
    docPdf.setFontSize(7)
    docPdf.setTextColor(22, 101, 52)
    docPdf.setFont('helvetica', 'bold')
    docPdf.text("VENTAS TOTALES", startX + 4, cardY + 6)
    docPdf.setFontSize(11)
    docPdf.text(`+${totalMonetario.toLocaleString('es-CL')}`, startX + 4, cardY + 13)

    // KPI 2: Mermas / Pérdidas
    startX += cardW + gap
    docPdf.setFillColor(254, 242, 242)
    docPdf.setDrawColor(254, 202, 202)
    docPdf.roundedRect(startX, cardY, cardW, cardH, 2, 2, 'FD')
    docPdf.setFontSize(7)
    docPdf.setTextColor(185, 28, 28)
    docPdf.setFont('helvetica', 'bold')
    docPdf.text("MERMAS Y PÉRDIDAS", startX + 4, cardY + 6)
    docPdf.setFontSize(11)
    docPdf.text(`-${totalPerdidaMonetario.toLocaleString('es-CL')}`, startX + 4, cardY + 13)

    // KPI 3: Balance Neto Real
    startX += cardW + gap
    docPdf.setFillColor(30, 30, 30)
    docPdf.setDrawColor(226, 189, 108)
    docPdf.roundedRect(startX, cardY, cardW, cardH, 2, 2, 'FD')
    docPdf.setFontSize(7)
    docPdf.setTextColor(226, 189, 108)
    docPdf.setFont('helvetica', 'bold')
    docPdf.text("BALANCE NETO REAL", startX + 4, cardY + 6)
    docPdf.setFontSize(11)
    docPdf.setTextColor(totalNetoReal < 0 ? 239 : 226, totalNetoReal < 0 ? 68 : 189, totalNetoReal < 0 ? 68 : 108)
    docPdf.text(`${totalNetoReal < 0 ? '-' : '+'}${Math.abs(totalNetoReal).toLocaleString('es-CL')}`, startX + 4, cardY + 13)

    // 3. Tabla Estilizada de Registro de Movimientos
    const tableData = registrosFiltrados.map(p => {
      const fecha = getLocalStr(p)
      const desc = p.productos ? p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(', ') : ''
      let gananciaVenta = 0
      if (p.productos && Array.isArray(p.productos)) {
        p.productos.forEach(item => {
          const pr = productos.find(xd => xd.id === item.productoId)
          const precioUnit = pr ? (Number(pr.precio) || Number(pr.precioCosto) || 0) : (Number(item.precioCosto) || Number(item.precio) || 0)
          gananciaVenta += precioUnit * Number(item.cantidad || 1)
        })
      }
      const isMerma = p._tipo === 'merma'
      if (isMerma) {
        return [
          fecha, 
          'MERMA DE STOCK', 
          `[${p.motivo || 'Dañado'}] ${desc}`, 
          '-', 
          `-$${gananciaVenta.toLocaleString('es-CL')}`,
          `-$${gananciaVenta.toLocaleString('es-CL')}`
        ]
      }
      return [
        fecha, 
        'VENTA REGISTRADA', 
        `${p.cliente || 'Cliente'} — ${desc}`, 
        `+$${gananciaVenta.toLocaleString('es-CL')}`, 
        '-', 
        `+$${gananciaVenta.toLocaleString('es-CL')}`
      ]
    })

    autoTable(docPdf, {
      startY: 66,
      head: [['FECHA', 'TIPO / CATEGORÍA', 'CLIENTE / DETALLE DE PRODUCTOS', 'INGRESO', 'EGRESO', 'NETO']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [226, 189, 108],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'left',
        cellPadding: 3
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [50, 50, 50],
        cellPadding: 3
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      columnStyles: {
        0: { cellWidth: 22 },
        1: { cellWidth: 32, fontStyle: 'bold' },
        2: { cellWidth: 72 },
        3: { cellWidth: 22, halign: 'right', textColor: [22, 163, 74] },
        4: { cellWidth: 22, halign: 'right', textColor: [220, 38, 38] },
        5: { cellWidth: 22, halign: 'right', fontStyle: 'bold' }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 5) {
          const valStr = data.cell.raw || ''
          if (valStr.startsWith('-')) {
            data.cell.styles.textColor = [220, 38, 38]
          } else if (valStr.startsWith('+')) {
            data.cell.styles.textColor = [22, 163, 74]
          }
        }
      },
      didDrawPage: function(data) {
        // Pie de página en cada página
        const pageSize = docPdf.internal.pageSize
        const pageHeight = pageSize.height || pageSize.getHeight()
        
        docPdf.setDrawColor(230, 230, 230)
        docPdf.line(14, pageHeight - 12, 196, pageHeight - 12)
        
        docPdf.setFontSize(7)
        docPdf.setFont('helvetica', 'normal')
        docPdf.setTextColor(150, 150, 150)
        docPdf.text("Inventario Leis © Documento Confidencial de Control Financiero y Comercial", 14, pageHeight - 7)
        docPdf.text(`Página ${data.pageNumber} de ${docPdf.internal.getNumberOfPages()}`, 196, pageHeight - 7, { align: 'right' })
      }
    })

    docPdf.save(`Reporte_Financiero_Leis_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  // --- Exportar Excel Estructurado (.csv con UTF-8 BOM y Cabecera Ejecutiva) ---
  function exportarCSV() {
    const fechaHora = `${new Date().toLocaleDateString('es-CL')} ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
    const totalNetoReal = totalMonetario - totalPerdidaMonetario
    let infoPeriodo = PERIODOS[periodo] || 'Reporte'
    if (periodo === 2 && mesSeleccionado) infoPeriodo += ` (${getNombreMesSeleccionado(mesSeleccionado)})`
    else if (periodo === 3) infoPeriodo += ` (Año ${anoSeleccionado})`
    else if (periodo === 4) infoPeriodo += ` (${fechaInicio ? fechaInicio.split('-').reverse().join('/') : ''} a ${fechaFin ? fechaFin.split('-').reverse().join('/') : ''})`

    // Encabezado de la Hoja de Cálculo (Bloque Resumen Ejecutivo)
    const lineas = [
      '=====================================================================================',
      'INVENTARIO LEIS — REPORTES Y BALANCE FINANCIERO EJECUTIVO',
      '=====================================================================================',
      `Fecha de Emisión:;${fechaHora}`,
      `Periodo de Análisis:;${infoPeriodo}`,
      `Total Ventas Brutas:;$${totalMonetario.toLocaleString('es-CL')}`,
      `Total Mermas y Pérdidas:;-$${totalPerdidaMonetario.toLocaleString('es-CL')}`,
      `Balance Neto Real:;${totalNetoReal < 0 ? '-' : '+'}$${Math.abs(totalNetoReal).toLocaleString('es-CL')}`,
      '=====================================================================================',
      '',
      // Cabecera de la Tabla
      'FECHA;TIPO DE REGISTRO;CLIENTE / CATEGORÍA;DETALLE DE PRODUCTOS / NOTAS;INGRESO ($);EGRESO ($);FLUJO NETO ($)'
    ]

    registrosFiltrados.forEach(p => {
      const fecha = getLocalStr(p)
        const desc = p.productos ? p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(' | ') : ''
        let gananciaVenta = 0
        if (p.productos && Array.isArray(p.productos)) {
          p.productos.forEach(item => {
            const pr = productos.find(xd => xd.id === item.productoId)
            const precioUnit = pr ? (Number(pr.precio) || Number(pr.precioCosto) || 0) : (Number(item.precioCosto) || Number(item.precio) || 0)
            gananciaVenta += precioUnit * Number(item.cantidad || 1)
          })
        }
        const isMerma = p._tipo === 'merma'
        if (isMerma) {
          lineas.push(`"${fecha}";"MERMA DE STOCK";"[MERMA] ${p.motivo || 'Dañado'}";"${desc}";0;${gananciaVenta};${-gananciaVenta}`)
        } else {
          lineas.push(`"${fecha}";"VENTA REGISTRADA";"${p.cliente || 'Cliente'}";"${desc}";${gananciaVenta};0;${gananciaVenta}`)
        }
    })

    const csvContent = "\uFEFF" + lineas.join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.setAttribute("download", `Reporte_Financiero_Leis_${new Date().toISOString().slice(0, 10)}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="p-8 md:p-10 relative flex flex-col min-h-full overflow-y-auto transition-colors duration-500">

      <header className="sticky top-0 z-30 bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-md px-8 md:px-10 py-10 flex flex-col items-center justify-center border-b border-outline-variant/20 dark:border-white/5 mb-12">
        <div className="relative text-center mx-auto">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 dark:text-[#e2bd6c]/60 mb-2">
            Centro de Control Financiero
          </p>
          <h1 className="font-headline text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter luxe-reveal">
            Métricas y Mermas
          </h1>
          <p className="mt-4 text-outline dark:text-gray-400 font-body max-w-lg mx-auto leading-relaxed text-[11px] uppercase tracking-widest font-bold">
            Supervisa el crecimiento, exporta reportes y sincroniza salidas y pérdidas de stock.
          </p>
          <div className="absolute left-1/2 -bottom-6 -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>
      </header>

      {/* Gráfico principal - Luxe Glass Redesign */}
      <section className="mb-10 w-full min-h-[600px] md:min-h-[650px] bg-surface-container-low dark:bg-[#1e1e1e] rounded-[2.5rem] p-6 md:p-10 border border-outline-variant/10 dark:border-white/5 flex flex-col relative z-10 tour-reportes-grafico shadow-xl overflow-hidden">
        {/* Decoración de fondo */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 blur-[120px] rounded-full pointer-events-none" />

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 w-full gap-4 relative z-20">
          <div>
            <h3 className="font-headline text-3xl text-on-tertiary-fixed-variant dark:text-white/90 italic">Gráfica Comercial</h3>
            <p className="text-[10px] text-outline dark:text-gray-500 font-label uppercase tracking-[0.2em] mt-0.5 font-extrabold">Evolución de Ganancias vs Pérdidas</p>
          </div>
          
          {/* Cuadros Resumen (Movidos a la derecha y más pequeños) */}
          <div className="flex items-center gap-2.5 ml-auto shrink-0">
            {chartMode === 'ventas' && (
              <div className="bg-surface-container dark:bg-[#e2bd6c]/10 px-3.5 py-1.5 rounded-xl flex flex-col items-end border border-outline-variant/20 dark:border-[#e2bd6c]/20 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-widest text-outline dark:text-[#e2bd6c]/70">Ganancias Brutas</span>
                <span className="font-headline font-extrabold text-sm md:text-base text-secondary dark:text-[#e2bd6c]">+${totalMonetario.toLocaleString('es-CL')}</span>
              </div>
            )}
            {chartMode === 'mermas' && (
              <div className="bg-error/10 px-3.5 py-1.5 rounded-xl flex flex-col items-end border border-error/20 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-widest text-error">Mermas / Pérdidas</span>
                <span className="font-headline font-extrabold text-sm md:text-base text-error">-${totalPerdidaMonetario.toLocaleString('es-CL')}</span>
              </div>
            )}
            {chartMode === 'ambas' && (
              <div className="bg-surface-container dark:bg-white/5 px-3.5 py-1.5 rounded-xl flex flex-col items-end border border-outline-variant/20 dark:border-white/10 shadow-sm">
                <span className="text-[9px] font-bold uppercase tracking-widest text-outline dark:text-gray-400">Total Neto Real</span>
                <span className={`font-headline font-extrabold text-sm md:text-base ${totalMonetario - totalPerdidaMonetario < 0 ? 'text-error' : 'text-secondary dark:text-[#e2bd6c]'}`}>
                  {totalMonetario - totalPerdidaMonetario < 0 ? '-' : '+'}${Math.abs(totalMonetario - totalPerdidaMonetario).toLocaleString('es-CL')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Toolbar de Controles (En una sola fila ordenada directamente arriba del gráfico) */}
        <div className="flex flex-wrap items-center gap-2.5 w-full mb-6 relative z-20 border-b border-outline-variant/10 dark:border-white/5 pb-4">
            {/* Custom Mode Dropdown */}
            <div className="relative shrink-0">
              <button 
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="bg-surface-container-highest dark:bg-[#1e1e1e] px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-colors flex items-center gap-2 border border-transparent dark:border-white/10 whitespace-nowrap"
              >
                <span>{chartMode === 'ambas' ? 'Total Neto' : chartMode === 'ventas' ? 'Solo Ventas' : 'Solo Mermas'}</span>
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
            
            <div className="w-px h-6 bg-outline-variant/20 dark:bg-white/10 mx-1 shrink-0 hidden sm:block"></div>

            {/* Custom Period Dropdown */}
            <div className="relative shrink-0">
              <button 
                onClick={() => setShowPeriodMenu(!showPeriodMenu)}
                className="bg-surface-container-highest dark:bg-[#1e1e1e] px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-colors flex items-center gap-2 border border-transparent dark:border-white/10 whitespace-nowrap"
              >
                <span>{PERIODOS[periodo]}</span>
                <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
              </button>

              {showPeriodMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPeriodMenu(false)} />
                  <div className="absolute left-0 top-full mt-2 w-full min-w-[170px] bg-surface dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
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

            {/* Selector de Mes Custom */}
            {periodo === 2 && (
              <div className="relative shrink-0">
                <button 
                  onClick={() => {
                    if (mesSeleccionado) {
                      const [y] = mesSeleccionado.split('-')
                      if (y) setPickerYear(Number(y))
                    }
                    setShowMonthPicker(!showMonthPicker)
                  }}
                  className="bg-surface-container-highest dark:bg-[#1e1e1e] px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-all flex items-center gap-2 border border-transparent dark:border-white/10 shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">calendar_month</span>
                  <span className="font-bold uppercase tracking-wider">{getNombreMesSeleccionado(mesSeleccionado) || 'SELECCIONAR MES'}</span>
                  <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                </button>

                {showMonthPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowMonthPicker(false)} />
                    <div className="absolute left-0 sm:right-0 top-full mt-2 w-72 bg-surface-container-high dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-[24px] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                      {/* Header con Control de Año */}
                      <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/10 dark:border-white/10">
                        <button 
                          onClick={() => setPickerYear(prev => prev - 1)}
                          className="p-1 rounded-full hover:bg-white/10 text-on-surface dark:text-white transition-colors flex items-center justify-center"
                          title="Año anterior"
                        >
                          <span className="material-symbols-outlined text-lg">chevron_left</span>
                        </button>
                        <span className="font-headline font-black text-sm tracking-widest text-primary dark:text-[#e2bd6c]">
                          {pickerYear}
                        </span>
                        <button 
                          onClick={() => setPickerYear(prev => prev + 1)}
                          className="p-1 rounded-full hover:bg-white/10 text-on-surface dark:text-white transition-colors flex items-center justify-center"
                          title="Año siguiente"
                        >
                          <span className="material-symbols-outlined text-lg">chevron_right</span>
                        </button>
                      </div>

                      {/* Grid de Meses */}
                      <div className="grid grid-cols-3 gap-2">
                        {['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'].map((mLabel, idx) => {
                          const mNum = String(idx + 1).padStart(2, '0')
                          const valueIso = `${pickerYear}-${mNum}`
                          const isSelected = mesSeleccionado === valueIso
                          return (
                            <button
                              key={mLabel}
                              onClick={() => {
                                setMesSeleccionado(valueIso)
                                setShowMonthPicker(false)
                              }}
                              className={`py-2.5 px-1 rounded-xl text-xs font-bold tracking-wide transition-all text-center ${
                                isSelected
                                  ? 'bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black shadow-md scale-105 font-black'
                                  : 'text-on-surface dark:text-white/80 hover:bg-surface-variant dark:hover:bg-white/10'
                              }`}
                            >
                              {mLabel}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Selector de Año Custom */}
            {periodo === 3 && (
              <div className="relative shrink-0">
                <button 
                  onClick={() => setShowYearPicker(!showYearPicker)}
                  className="bg-surface-container-highest dark:bg-[#1e1e1e] px-4 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-all flex items-center gap-2 border border-transparent dark:border-white/10 shadow-sm active:scale-95 whitespace-nowrap"
                >
                  <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">calendar_today</span>
                  <span className="font-bold uppercase tracking-wider">AÑO {anoSeleccionado}</span>
                  <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                </button>

                {showYearPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowYearPicker(false)} />
                    <div className="absolute left-0 sm:right-0 top-full mt-2 w-52 bg-surface-container-high dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-[24px] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                      <div className="text-[10px] font-bold text-outline dark:text-gray-400 uppercase tracking-widest text-center mb-3 pb-1 border-b border-outline-variant/10 dark:border-white/10">
                        Seleccionar Año
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {[2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030].map(y => (
                          <button
                            key={y}
                            onClick={() => {
                              setAnoSeleccionado(y)
                              setShowYearPicker(false)
                            }}
                            className={`py-2 rounded-xl text-xs font-bold transition-all text-center ${
                              anoSeleccionado === y
                                ? 'bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black shadow-md scale-105 font-black'
                                : 'text-on-surface dark:text-white/80 hover:bg-surface-variant dark:hover:bg-white/10'
                            }`}
                          >
                            {y}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Selector de Rango Personalizado Custom */}
            {periodo === 4 && (
              <div className="flex items-center gap-2 shrink-0">
                {/* Fecha Inicio */}
                <div className="relative shrink-0">
                  <button 
                    onClick={() => {
                      if (fechaInicio) {
                        const parts = fechaInicio.split('-').map(Number)
                        if (parts.length === 3 && parts[0] && parts[1]) {
                          setInicioCalYear(parts[0])
                          setInicioCalMonth(parts[1] - 1)
                        }
                      }
                      setShowInicioPicker(!showInicioPicker)
                      setShowFinPicker(false)
                    }}
                    className="bg-surface-container-highest dark:bg-[#1e1e1e] px-3.5 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent dark:border-white/10 shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">calendar_today</span>
                    <span className="font-bold uppercase tracking-wider">Desde: {fechaInicio ? fechaInicio.split('-').reverse().join('/') : 'INICIO'}</span>
                    <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                  </button>

                  {showInicioPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowInicioPicker(false)} />
                      <div className="absolute left-0 sm:right-0 top-full mt-2 w-72 bg-surface-container-high dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-[24px] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header del Calendario */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/10 dark:border-white/10">
                          <button 
                            onClick={() => {
                              if (inicioCalMonth === 0) {
                                setInicioCalMonth(11)
                                setInicioCalYear(prev => prev - 1)
                              } else {
                                setInicioCalMonth(prev => prev - 1)
                              }
                            }}
                            className="p-1 rounded-full hover:bg-white/10 text-on-surface dark:text-white transition-colors flex items-center justify-center"
                            title="Mes anterior"
                          >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                          </button>
                          <span className="font-headline font-black text-xs tracking-wider text-primary dark:text-[#e2bd6c] uppercase">
                            {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][inicioCalMonth]} {inicioCalYear}
                          </span>
                          <button 
                            onClick={() => {
                              if (inicioCalMonth === 11) {
                                setInicioCalMonth(0)
                                setInicioCalYear(prev => prev + 1)
                              } else {
                                setInicioCalMonth(prev => prev + 1)
                              }
                            }}
                            className="p-1 rounded-full hover:bg-white/10 text-on-surface dark:text-white transition-colors flex items-center justify-center"
                            title="Mes siguiente"
                          >
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                          </button>
                        </div>

                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                          {['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map(d => (
                            <span key={d} className="text-[10px] font-bold text-outline dark:text-gray-400 py-1">
                              {d}
                            </span>
                          ))}
                        </div>

                        {/* Grid de días */}
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const daysInMonth = new Date(inicioCalYear, inicioCalMonth + 1, 0).getDate()
                            const rawFirstDay = new Date(inicioCalYear, inicioCalMonth, 1).getDay()
                            const offset = (rawFirstDay + 6) % 7
                            const cells = []
                            for (let i = 0; i < offset; i++) {
                              cells.push(<div key={`empty-in-${i}`} />)
                            }
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dayStr = String(day).padStart(2, '0')
                              const mStr = String(inicioCalMonth + 1).padStart(2, '0')
                              const iso = `${inicioCalYear}-${mStr}-${dayStr}`
                              const isSelected = fechaInicio === iso
                              cells.push(
                                <button
                                  key={day}
                                  onClick={() => {
                                    setFechaInicio(iso)
                                    setShowInicioPicker(false)
                                  }}
                                  className={`py-1.5 text-xs font-bold rounded-xl transition-all text-center ${
                                    isSelected
                                      ? 'bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black font-black shadow-md scale-105'
                                      : 'text-on-surface dark:text-white/80 hover:bg-surface-variant dark:hover:bg-white/10'
                                  }`}
                                >
                                  {day}
                                </button>
                              )
                            }
                            return cells
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {/* Fecha Fin */}
                <div className="relative shrink-0">
                  <button 
                    onClick={() => {
                      if (fechaFin) {
                        const parts = fechaFin.split('-').map(Number)
                        if (parts.length === 3 && parts[0] && parts[1]) {
                          setFinCalYear(parts[0])
                          setFinCalMonth(parts[1] - 1)
                        }
                      }
                      setShowFinPicker(!showFinPicker)
                      setShowInicioPicker(false)
                    }}
                    className="bg-surface-container-highest dark:bg-[#1e1e1e] px-3.5 py-2 rounded-xl text-xs font-headline italic tracking-wide text-on-surface dark:text-white hover:bg-surface-variant dark:hover:bg-white/5 transition-all flex items-center gap-1.5 border border-transparent dark:border-white/10 shadow-sm active:scale-95 whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-sm text-primary dark:text-[#e2bd6c]">event</span>
                    <span className="font-bold uppercase tracking-wider">Hasta: {fechaFin ? fechaFin.split('-').reverse().join('/') : 'FIN'}</span>
                    <span className="material-symbols-outlined text-sm opacity-60">expand_more</span>
                  </button>

                  {showFinPicker && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowFinPicker(false)} />
                      <div className="absolute left-0 sm:right-0 top-full mt-2 w-72 bg-surface-container-high dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-[24px] shadow-2xl z-50 p-4 animate-in fade-in zoom-in-95 duration-200">
                        {/* Header del Calendario */}
                        <div className="flex items-center justify-between mb-3 pb-2 border-b border-outline-variant/10 dark:border-white/10">
                          <button 
                            onClick={() => {
                              if (finCalMonth === 0) {
                                setFinCalMonth(11)
                                setFinCalYear(prev => prev - 1)
                              } else {
                                setFinCalMonth(prev => prev - 1)
                              }
                            }}
                            className="p-1 rounded-full hover:bg-white/10 text-on-surface dark:text-white transition-colors flex items-center justify-center"
                            title="Mes anterior"
                          >
                            <span className="material-symbols-outlined text-lg">chevron_left</span>
                          </button>
                          <span className="font-headline font-black text-xs tracking-wider text-primary dark:text-[#e2bd6c] uppercase">
                            {['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'][finCalMonth]} {finCalYear}
                          </span>
                          <button 
                            onClick={() => {
                              if (finCalMonth === 11) {
                                setFinCalMonth(0)
                                setFinCalYear(prev => prev + 1)
                              } else {
                                setFinCalMonth(prev => prev + 1)
                              }
                            }}
                            className="p-1 rounded-full hover:bg-white/10 text-on-surface dark:text-white transition-colors flex items-center justify-center"
                            title="Mes siguiente"
                          >
                            <span className="material-symbols-outlined text-lg">chevron_right</span>
                          </button>
                        </div>

                        {/* Días de la semana */}
                        <div className="grid grid-cols-7 gap-1 text-center mb-1">
                          {['LU', 'MA', 'MI', 'JU', 'VI', 'SÁ', 'DO'].map(d => (
                            <span key={d} className="text-[10px] font-bold text-outline dark:text-gray-400 py-1">
                              {d}
                            </span>
                          ))}
                        </div>

                        {/* Grid de días */}
                        <div className="grid grid-cols-7 gap-1">
                          {(() => {
                            const daysInMonth = new Date(finCalYear, finCalMonth + 1, 0).getDate()
                            const rawFirstDay = new Date(finCalYear, finCalMonth, 1).getDay()
                            const offset = (rawFirstDay + 6) % 7
                            const cells = []
                            for (let i = 0; i < offset; i++) {
                              cells.push(<div key={`empty-fi-${i}`} />)
                            }
                            for (let day = 1; day <= daysInMonth; day++) {
                              const dayStr = String(day).padStart(2, '0')
                              const mStr = String(finCalMonth + 1).padStart(2, '0')
                              const iso = `${finCalYear}-${mStr}-${dayStr}`
                              const isSelected = fechaFin === iso
                              cells.push(
                                <button
                                  key={day}
                                  onClick={() => {
                                    setFechaFin(iso)
                                    setShowFinPicker(false)
                                  }}
                                  className={`py-1.5 text-xs font-bold rounded-xl transition-all text-center ${
                                    isSelected
                                      ? 'bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black font-black shadow-md scale-105'
                                      : 'text-on-surface dark:text-white/80 hover:bg-surface-variant dark:hover:bg-white/10'
                                  }`}
                                >
                                  {day}
                                </button>
                              )
                            }
                            return cells
                          })()}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Tres Puntos / Exportar */}
            <div className="relative shrink-0 ml-auto sm:ml-0">
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

        <div className="w-full h-[400px] relative z-10 animate-in fade-in zoom-in-95 duration-1000">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart key={`${chartMode}-${periodo}`} data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorGanancia" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#e2bd6c" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#e2bd6c" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorPerdida" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ba1a1a" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#ba1a1a" stopOpacity={0}/>
                </linearGradient>
              </defs>
              
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ffffff" opacity={0.05} />
              
              <XAxis 
                dataKey="label" 
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 10, fill: '#808080', fontWeight: 'bold' }}
                dy={15}
              />
              
              <YAxis 
                hide={true} 
                domain={['auto', 'auto']}
              />
              
              <Tooltip 
                cursor={{ stroke: '#e2bd6c', strokeWidth: 1, strokeDasharray: '5 5' }}
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-[#1e1e1e]/90 backdrop-blur-xl border border-white/10 p-4 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                        <p className="text-[10px] text-white/40 font-black uppercase tracking-widest mb-2">{label}</p>
                        {payload.map((entry, index) => (
                          <div key={index} className="flex items-center gap-3 mb-1 last:mb-0">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-[11px] text-white/60 font-bold">{entry.name === 'Total' ? 'Neto' : entry.name}:</span>
                            <span className={`text-sm font-black ${entry.value >= 0 ? 'text-[#e2bd6c]' : 'text-red-400'}`}>
                              {formatMoney(entry.value)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )
                  }
                  return null
                }}
              />
              
              {(chartMode === 'ambas' || chartMode === 'ventas') && (
                <Area 
                  type="monotone" 
                  name="Ventas"
                  dataKey={chartMode === 'ambas' ? 'Total' : 'Ganancia'} 
                  stroke="#e2bd6c" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorGanancia)" 
                  animationDuration={2000}
                />
              )}
              
              {(chartMode === 'ambas' || chartMode === 'mermas') && (
                <Area 
                  type="monotone" 
                  name="Mermas"
                  dataKey="Pérdida" 
                  stroke="#ba1a1a" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorPerdida)"
                  strokeDasharray="5 5"
                  animationDuration={2000}
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
          
          {chartData.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-4">
              <span className="material-symbols-outlined text-4xl text-white/10 animate-pulse">monitoring</span>
              <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">Esperando datos comerciales...</span>
            </div>
          )}
        </div>
      </section>

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
          {registrosFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((v) => {
            const isMerma = v._tipo === 'merma'
            const esVentaDirecta = v.cliente === "Venta Directa" && !isMerma

            let flujoMonetario = 0
            if (v.productos && Array.isArray(v.productos)) {
              v.productos.forEach(item => {
                const prod = productos.find(xd => xd.id === item.productoId)
                const precio = prod ? (Number(prod.precio) || Number(prod.precioCosto) || 0) : (Number(item.precioCosto) || Number(item.precio) || 0);
                const cant = Number(item.cantidad) || 1;
                flujoMonetario += precio * cant;
              })
            }

            return (
              <div 
                key={v.id} 
                className={`p-5 rounded-3xl border flex flex-col gap-3.5 transition-all duration-200 hover:scale-[1.01] ${
                  isMerma 
                    ? 'bg-red-500/[0.04] dark:bg-red-500/10 border-red-500/35 dark:border-red-500/30 shadow-md shadow-red-500/5 hover:border-red-500/60' 
                    : 'bg-white dark:bg-[#161616] border-outline-variant/35 dark:border-white/10 shadow-md shadow-black/[0.04] dark:shadow-none hover:shadow-xl hover:border-primary/50 dark:hover:border-[#e2bd6c]/50'
                }`}
              >
                <div className="flex justify-between items-start pb-2.5 border-b border-outline-variant/15 dark:border-white/5">
                  <div className="flex items-center gap-2 min-w-0">
                     <span className={`material-symbols-outlined text-[17px] shrink-0 ${isMerma ? 'text-error dark:text-red-400' : (esVentaDirecta ? 'text-primary dark:text-[#e2bd6c]' : 'text-secondary dark:text-[#e2bd6c]')}`}>
                       {isMerma ? 'remove_shopping_cart' : (esVentaDirecta ? 'storefront' : 'local_shipping')}
                     </span>
                     <span className={`font-headline font-bold text-xs uppercase tracking-wider truncate ${isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-white'}`}>
                       {isMerma ? v.motivo : (esVentaDirecta ? 'Venta Directa' : v.cliente)}
                     </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-extrabold uppercase text-outline/80 dark:text-gray-400 bg-surface-container dark:bg-white/5 px-2 py-0.5 rounded-lg border border-outline-variant/10">
                       {getLocalStr(v)}
                    </span>
                    <button 
                      onClick={() => deshacerRegistro(v)}
                      disabled={procesando}
                      className={`w-7 h-7 rounded-xl flex items-center justify-center transition-all cursor-pointer ${
                        procesando 
                          ? 'opacity-40 cursor-not-allowed' 
                          : 'text-outline/60 hover:text-error hover:bg-error/10 dark:hover:bg-red-500/10 active:scale-90'
                      }`}
                      title="Deshacer registro y devolver al inventario"
                    >
                      <span className="material-symbols-outlined text-[15px]">undo</span>
                    </button>
                  </div>
                </div>

                <ul className="text-xs space-y-1.5 pl-1 my-1">
                  {v.productos && v.productos.map((prodItem, idx) => {
                    const baseProd = productos.find(xd => xd.id === prodItem.productoId)
                    const unitPrice = baseProd ? (Number(baseProd.precio) || Number(baseProd.precioCosto) || 0) : (Number(prodItem.precioCosto) || Number(prodItem.precio) || 0)
                    return (
                      <li key={idx} className={`flex justify-between items-center text-xs ${isMerma ? 'text-red-950 dark:text-red-300/90' : 'text-on-surface dark:text-white/85'}`}>
                        <span className="truncate pr-2 font-medium">
                          <strong className={`${isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-[#e2bd6c]'}`}>{prodItem.cantidad}x</strong> {prodItem.nombre || baseProd?.nombre || 'Producto'} 
                          {prodItem.variante && (
                            <span className="inline-flex items-center gap-1 ml-1.5 bg-primary/5 dark:bg-[#e2bd6c]/10 px-1.5 py-0.5 rounded border border-primary/10 dark:border-[#e2bd6c]/10 text-[9px] font-black uppercase">
                              {prodItem.variante}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 font-bold text-outline dark:text-gray-400 text-[11px]">
                          (${unitPrice.toLocaleString('es-CL')} c/u)
                        </span>
                      </li>
                    )
                  })}
                </ul>

                <div className="mt-auto pt-2.5 border-t border-outline-variant/15 dark:border-white/5 flex items-center justify-between">
                   <span className="text-[10px] font-black uppercase tracking-wider text-outline dark:text-gray-400">Total Flujo</span>
                   <span className={`font-headline font-black text-xl ${isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-[#e2bd6c]'}`}>
                     {isMerma ? `-$${flujoMonetario.toLocaleString('es-CL')}` : `+$${flujoMonetario.toLocaleString('es-CL')}`}
                   </span>
                </div>
              </div>
            )
          })}
        </div>
        
        {/* Paginación UI */}
        {registrosFiltrados.length > itemsPerPage && (
          <div className="mt-10 flex items-center justify-center gap-2">
            <button 
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-high dark:bg-white/5 text-on-surface dark:text-white/60 disabled:opacity-20 hover:bg-surface-variant transition-colors border border-outline-variant/10"
            >
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.ceil(registrosFiltrados.length / itemsPerPage) }, (_, i) => i + 1).map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-10 h-10 rounded-xl text-[10px] font-extrabold transition-all border ${currentPage === page ? 'bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black border-transparent shadow-lg shadow-secondary/20 scale-110' : 'bg-surface-container-high dark:bg-white/5 text-outline dark:text-gray-500 border-outline-variant/10 hover:bg-surface-variant'}`}
                >
                  {page}
                </button>
              ))}
            </div>

            <button 
              onClick={() => setCurrentPage(prev => Math.min(Math.ceil(registrosFiltrados.length / itemsPerPage), prev + 1))}
              disabled={currentPage === Math.ceil(registrosFiltrados.length / itemsPerPage)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-high dark:bg-white/5 text-on-surface dark:text-white/60 disabled:opacity-20 hover:bg-surface-variant transition-colors border border-outline-variant/10"
            >
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </div>
        )}
        
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

      {/* Overlay de Resumen de Confirmación Mermas (Versión Modal Fija) */}
      {mostrarResumenMerma && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 animate-in fade-in duration-300">
          {/* Backdrop con desenfoque */}
          <div 
            className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md" 
            onClick={() => !procesando && setMostrarResumenMerma(false)}
          />
          
          <div className="w-full max-w-md bg-[#1a1a1a] dark:bg-[#121212] border border-white/10 dark:border-error/20 rounded-[3rem] p-8 md:p-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative overflow-hidden animate-in zoom-in-95 duration-300">
            {/* Línea decorativa superior */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-error to-transparent opacity-50" />
            
            <div className="text-center mb-8">
              <div className="w-20 h-20 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-error/30 shadow-[0_0_20px_rgba(186,26,26,0.2)]">
                <span className="material-symbols-outlined text-error text-4xl">inventory_2</span>
              </div>
              <h4 className="font-headline text-3xl text-white italic mb-2 tracking-tight">Confirmar Ajuste</h4>
              <p className="text-[10px] text-error/60 font-label uppercase tracking-[0.4em] font-black">Movimiento de Inventario</p>
            </div>

            <div className="space-y-6 mb-10">
              <div className="grid grid-cols-2 gap-4 bg-white/5 rounded-2xl p-5 border border-white/5">
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-white/40 font-black">Naturaleza</span>
                  <span className="text-[11px] font-bold text-error flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm">{motivoMerma === 'Dañado' ? 'inventory_2' : motivoMerma === 'Regalo' ? 'featured_seasonal_and_gifts' : 'assignment_return'}</span>
                    {motivoMerma}
                  </span>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  <span className="text-[9px] uppercase tracking-widest text-white/40 font-black">Fecha Efectiva</span>
                  <span className="text-[11px] font-bold text-white/90 flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm opacity-60">calendar_today</span>
                    {fechaMerma}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <p className="text-[9px] text-white/30 font-black uppercase tracking-widest ml-1">Productos a retirar ({conteoMerma.filter(i => i.vendido > 0).length})</p>
                <div className="max-h-[180px] overflow-y-auto pr-2 custom-scrollbar space-y-2">
                  {conteoMerma.filter(i => i.vendido > 0).map(i => (
                    <div key={i.id} className="flex justify-between items-center text-[11px] font-bold bg-white/5 p-4 rounded-2xl border border-white/5 hover:border-error/30 transition-all group">
                      <div className="flex flex-col gap-1">
                        <span className="text-white/80 group-hover:text-white transition-colors">{i.producto}</span>
                        {i.variante && (
                          <div className="flex items-center gap-1.5 bg-white/5 px-2 py-0.5 rounded-full border border-white/10 w-fit">
                            <div 
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: getHexColor(i.variante) || '#ccc' }}
                            />
                            <span className="text-[8px] font-black uppercase tracking-widest text-white/40">{i.variante}</span>
                          </div>
                        )}
                      </div>
                      <span className="bg-error text-white px-3 py-1 rounded-xl text-[10px] shadow-lg shadow-error/20">-{i.vendido}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <button 
                onClick={guardarMerma}
                disabled={procesando}
                className="w-full py-5 text-[11px] font-black uppercase tracking-[0.2em] bg-error text-white hover:bg-error/90 hover:scale-[1.02] active:scale-[0.98] transition-all rounded-2xl shadow-2xl shadow-error/30 flex items-center justify-center gap-3 disabled:opacity-50"
              >
                {procesando ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    Procesando...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    Confirmar Salida
                  </>
                )}
              </button>
              <button 
                onClick={() => setMostrarResumenMerma(false)}
                disabled={procesando}
                className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-white/40 hover:text-white transition-colors text-center"
              >
                Volver a la edición
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
