import { useState, useEffect, useMemo } from 'react'
import { collection, onSnapshot, doc, writeBatch, addDoc, deleteDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Area, AreaChart } from 'recharts'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import { getLocalDateString } from '../utils/date'
import { calcularEstado } from '../utils/date'
import Footer from '../components/Footer'

const PERIODOS = ['Semana Actual', 'Mes Actual', 'Personalizado']

function getNombreMesActual() {
  const d = new Date()
  const meses = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE']
  return `${meses[d.getMonth()]} ${d.getFullYear()}`
}

const CATEGORIAS_GASTOS = [
  { id: 'transporte', label: 'Pasajes / Transporte', icon: 'directions_bus', color: 'text-blue-500' },
  { id: 'comida', label: 'Comida / Alimentación', icon: 'restaurant', color: 'text-amber-500' },
  { id: 'insumos', label: 'Insumos / Embalaje', icon: 'package_2', color: 'text-purple-500' },
  { id: 'otros', label: 'Otros / Gastos Varios', icon: 'payments', color: 'text-emerald-500' }
]

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
  if (!p) return ''
  const f = p.fechaEntrega || p.fechaCreacion
  if (!f) return ''
  try {
    const d = new Date(f)
    if (isNaN(d.getTime())) return ''
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  } catch (e) {
    return ''
  }
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
  const [gastos, setGastos] = useState([])
  
  // Para el módulo de Gastos Operativos
  const [showGastoModal, setShowGastoModal] = useState(false)
  const [gastoForm, setGastoForm] = useState({
    categoria: 'transporte',
    monto: '',
    descripcion: '',
    fecha: getLocalDateString()
  })
  const [gastoProcesando, setGastoProcesando] = useState(false)

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
  }, [periodo, fechaInicio, fechaFin])

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

    const unsubGasto = onSnapshot(collection(db, 'gastos'), snap => {
      const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setGastos(data)
    })

    return () => { unsubProd(); unsubPed(); unsubMerma(); unsubGasto(); }
  }, [])

  // Guardar nuevo gasto operativo
  async function handleGuardarGasto(e) {
    if (e) e.preventDefault();
    const montoNum = Math.floor(Number(gastoForm.monto)) || 0;
    if (montoNum <= 0) {
      alert("Por favor ingresa un monto válido mayor a 0.");
      return;
    }
    setGastoProcesando(true);
    try {
      await addDoc(collection(db, 'gastos'), {
        categoria: gastoForm.categoria,
        monto: montoNum,
        descripcion: gastoForm.descripcion.trim() || 'Gasto operativo',
        fecha: gastoForm.fecha || getLocalDateString(),
        createdAt: new Date().toISOString()
      });
      setGastoForm({
        categoria: 'transporte',
        monto: '',
        descripcion: '',
        fecha: getLocalDateString()
      });
      setShowGastoModal(false);
    } catch (err) {
      console.error("Error guardando gasto:", err);
      alert("Hubo un error al guardar el gasto.");
    } finally {
      setGastoProcesando(false);
    }
  }

  async function handleEliminarGasto(gastoId) {
    if (!window.confirm("¿Estás seguro de eliminar este registro de gasto?")) return;
    try {
      await deleteDoc(doc(db, 'gastos', gastoId));
    } catch (err) {
      console.error("Error eliminando gasto:", err);
      alert("No se pudo eliminar el gasto.");
    }
  }

  // Filtrado de pedidos, mermas y gastos combinados
  const registrosFiltrados = useMemo(() => {
    const combinados = [
      ...pedidos.map(p => ({ ...p, _tipo: 'venta' })),
      ...mermas.map(m => ({ ...m, _tipo: 'merma' })),
      ...gastos.map(g => ({ ...g, _tipo: 'gasto' }))
    ]

    return combinados.filter(p => {
      const fString = p.fechaCreacion || p.fechaEntrega || p.fecha
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
      const fA = new Date(a.fechaCreacion || a.fechaEntrega || a.fecha)
      const fB = new Date(b.fechaCreacion || b.fechaEntrega || b.fecha)
      return fB - fA // Más recientes primero
    })
  }, [pedidos, mermas, gastos, periodo, fechaInicio, fechaFin])

  // Cálculo del gráfico
  const chartData = useMemo(() => {
    const map = {}
    
    // Preparar dominios vacíos
    if (periodo === 0) {
      const start = getStartOfWeek()
      for(let i=0; i<7; i++) {
        const temp = new Date(start)
        temp.setDate(temp.getDate() + i)
        map[temp.getFullYear() + '-' + String(temp.getMonth() + 1).padStart(2, '0') + '-' + String(temp.getDate()).padStart(2, '0')] = { Ganancia: 0, Pérdida: 0, Gasto: 0 }
      }
    }

    registrosFiltrados.forEach(p => {
      const dateStr = getLocalStr(p)
      let sum = 0
      if (p.productos && Array.isArray(p.productos)) {
        p.productos.forEach(item => {
          const prod = productos.find(x => x.id === item.productoId)
          if (prod) {
            const precio = Number(prod.precio) || 0;
            const cant = Number(item.cantidad) || 1;
            sum += precio * cant;
          }
        })
      }
      if (map[dateStr] === undefined) map[dateStr] = { Ganancia: 0, Pérdida: 0, Gasto: 0 }
      
      if (p._tipo === 'venta') {
        let gananciaReal = p.total || sum;
        map[dateStr].Ganancia += gananciaReal;
      } else if (p._tipo === 'gasto') {
        let montoGasto = Number(p.monto) || 0;
        map[dateStr].Gasto += montoGasto;
        map[dateStr].Pérdida += montoGasto;
      } else {
        map[dateStr].Pérdida += sum;
      }
    })

    return Object.keys(map).sort().map(dateStr => {
      const d = new Date(dateStr + 'T12:00:00')
      const nombreDia = d.toLocaleDateString('es-ES', { weekday: 'short' })
      return {
        fechaReal: dateStr,
        label: periodo === 0 ? nombreDia.toUpperCase() : dateStr.split('-').slice(1).reverse().join('/'),
        Ganancia: map[dateStr].Ganancia,
        Pérdida: -map[dateStr].Pérdida,
        Gasto: map[dateStr].Gasto,
        Total: map[dateStr].Ganancia - map[dateStr].Pérdida
      }
    })
  }, [registrosFiltrados, productos, periodo])

  const totalMonetario = chartData.reduce((acc, curr) => acc + curr.Ganancia, 0)
  const totalPerdidaMonetario = chartData.reduce((acc, curr) => acc + Math.abs(curr.Pérdida), 0)
  const totalGastosMonetario = useMemo(() => {
    return registrosFiltrados
      .filter(x => x._tipo === 'gasto')
      .reduce((acc, g) => acc + (Number(g.monto) || 0), 0)
  }, [registrosFiltrados])

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
        _tipo: 'merma'
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
    docPdf.text(`Ventas: $${totalMonetario.toLocaleString('es-CL')} | Mermas: -$${totalPerdidaMonetario.toLocaleString('es-CL')} | Gastos Op: -$${totalGastosMonetario.toLocaleString('es-CL')}`, 14, 28)
    
    const tableData = registrosFiltrados.map(p => {
      const fecha = getLocalStr(p)
      if (p._tipo === 'gasto') {
        const catObj = CATEGORIAS_GASTOS.find(c => c.id === p.categoria)
        const catLabel = catObj ? catObj.label : 'Gasto Operativo'
        return [fecha, `[GASTO] ${catLabel}`, p.descripcion, `-$${Number(p.monto).toLocaleString('es-CL')}`]
      }
      const desc = p.productos ? p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(', ') : ''
      let gananciaVenta = 0
      if (p.productos && Array.isArray(p.productos)) {
        p.productos.forEach(item => {
          const pr = productos.find(xd => xd.id === item.productoId)
          if(pr) gananciaVenta += (pr.precio || 0) * item.cantidad
        })
      }
      const isMerma = p._tipo === 'merma'
      return [fecha, isMerma ? `[MERMA] ${p.motivo}` : p.cliente, desc, isMerma ? `-$${gananciaVenta.toLocaleString('es-CL')}` : `$${gananciaVenta.toLocaleString('es-CL')}`]
    })

    autoTable(docPdf, {
      startY: 35,
      head: [['Fecha', 'Tipo/Cliente', 'Detalle', 'Flujo ($)']],
      body: tableData,
    })

    docPdf.save("reporte_ventas_leis.pdf")
  }

  function exportarCSV() {
    const encabezados = ['Fecha', 'Cliente/Tipo', 'Detalle Productos/Notas', 'Flujo de Dinero ($)']
    const filas = registrosFiltrados.map(p => {
      const fecha = getLocalStr(p)
      if (p._tipo === 'gasto') {
        const catObj = CATEGORIAS_GASTOS.find(c => c.id === p.categoria)
        const catLabel = catObj ? catObj.label : 'Gasto Operativo'
        return [
          `"${fecha}"`, 
          `"[GASTO] ${catLabel}"`, 
          `"${p.descripcion}"`, 
          -Number(p.monto) || 0
        ]
      }
      const desc = p.productos ? p.productos.map(x => `${x.cantidad}x ${x.nombre}`).join(' | ') : ''
      let gananciaVenta = 0
      if (p.productos && Array.isArray(p.productos)) {
        p.productos.forEach(item => {
          const pr = productos.find(xd => xd.id === item.productoId)
          if(pr) gananciaVenta += (pr.precio || 0) * item.cantidad
        })
      }
      const isMerma = p._tipo === 'merma'
      return [
        `"${fecha}"`, 
        `"${isMerma ? `[MERMA] ${p.motivo}` : p.cliente}"`, 
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
          <h1 className="font-headline text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter luxe-reveal">Métricas y Mermas</h1>
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
        
        {/* Indicador de Mes Actual centrado */}
        {periodo === 1 && (
          <div className="absolute top-4 sm:top-6 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
            <div className="px-5 py-2 rounded-full bg-surface-container-highest/90 dark:bg-white/10 backdrop-blur-md border border-[#e2bd6c]/30 shadow-lg flex items-center gap-2 animate-in fade-in zoom-in-95 duration-300">
              <span className="material-symbols-outlined text-sm text-[#e2bd6c] animate-pulse">calendar_month</span>
              <span className="font-headline font-black text-xs sm:text-sm tracking-[0.25em] uppercase text-secondary dark:text-[#e2bd6c]">
                {getNombreMesActual()}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-10 w-full gap-6 relative z-20">
          <div className="flex-1">
            <h3 className="font-headline text-3xl text-on-tertiary-fixed-variant dark:text-white/90 italic">Gráfica Comercial</h3>
            <p className="text-[10px] text-outline dark:text-gray-500 font-label uppercase tracking-[0.2em] mt-1 font-extrabold">Evolución de Ganancias vs Pérdidas</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
              {/* Botón para Registrar Gasto Operativo */}
              <button
                onClick={() => setShowGastoModal(true)}
                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-[#e2bd6c] border border-amber-500/20 px-3.5 py-2 rounded-xl text-xs font-headline italic tracking-wide transition-all flex items-center gap-1.5 shadow-sm active:scale-95"
                title="Registrar gastos de transporte, comida, insumos, otros"
              >
                <span className="material-symbols-outlined text-sm">payments</span>
                <span>+ Registrar Gasto</span>
              </button>

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
          <div className="flex flex-wrap items-center gap-2 w-full xl:w-auto">
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
              <>
                {totalGastosMonetario > 0 && (
                  <div className="bg-amber-500/10 px-3 md:px-4 py-2.5 rounded-2xl flex flex-col items-start xl:items-end border border-amber-500/20 flex-1 xl:flex-none animate-in fade-in zoom-in-95 duration-200">
                    <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-1">Gastos Operativos</span>
                    <span className="font-headline font-bold text-lg md:text-2xl text-amber-600 dark:text-amber-400">-${totalGastosMonetario.toLocaleString('es-CL')}</span>
                  </div>
                )}
                <div className="bg-surface-container dark:bg-white/5 px-3 md:px-5 py-3 rounded-2xl flex flex-col items-start xl:items-end border border-outline-variant/20 dark:border-white/10 flex-1 xl:flex-none animate-in fade-in zoom-in-95 duration-200">
                  <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">Total Neto Real</span>
                  <span className={`font-headline font-bold text-lg md:text-2xl ${totalMonetario - totalPerdidaMonetario < 0 ? 'text-error' : 'text-secondary dark:text-[#e2bd6c]'}`}>
                    {totalMonetario - totalPerdidaMonetario < 0 ? '-' : '+'}${Math.abs(totalMonetario - totalPerdidaMonetario).toLocaleString('es-CL')}
                  </span>
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

      <div className="grid grid-cols-1 gap-8 mb-10 relative z-10 w-full">

        {/* Mermas MANUAL - Luxe Redesign */}
        <section className="bg-gradient-to-br from-error/10 to-surface dark:from-error/5 dark:to-[#1a1a1a] rounded-[2.5rem] p-6 md:p-10 border border-error/20 dark:border-white/5 flex flex-col min-h-[700px] h-auto relative overflow-hidden tour-reportes-mermas shadow-2xl">
          {/* Fondo decorativo interno */}
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-error/10 blur-[100px] rounded-full pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-error/5 blur-[100px] rounded-full pointer-events-none" />
          <div className="flex justify-between items-center mb-6 shrink-0">
            <div>
              <h3 className="font-headline text-2xl text-error dark:text-red-400">Registrar Pérdida</h3>
              <p className="text-[10px] text-error/70 dark:text-red-400/60 font-label uppercase tracking-widest mt-1">Registra productos dañados o mermas.</p>
            </div>
          </div>

          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6 mb-8 shrink-0">
            {/* Selector de Motivo del Ajuste */}
            <div className="flex-1">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-error/40 dark:text-red-400/40 mb-3 ml-1">Motivo del Ajuste</p>
              <div className="flex flex-wrap gap-2">
                {['Dañado', 'Regalo', 'Devolución'].map(m => (
                  <button
                    key={m}
                    onClick={() => setMotivoMerma(m)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border-2 flex items-center gap-2
                      ${motivoMerma === m 
                        ? 'bg-error border-transparent text-white shadow-lg shadow-error/20 scale-105' 
                        : 'bg-transparent border-error/10 text-error/50 hover:bg-error/5 dark:hover:bg-red-950/20'}`}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {m === 'Dañado' ? 'inventory_2' : m === 'Regalo' ? 'featured_seasonal_and_gifts' : 'assignment_return'}
                    </span>
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Fecha */}
            <div className="flex flex-col gap-2 min-w-[200px]">
              <p className="text-[9px] font-extrabold uppercase tracking-[0.2em] text-error/40 dark:text-red-400/40 ml-1">Fecha del Movimiento</p>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-error/50 text-base">calendar_today</span>
                <input 
                  type="date"
                  value={fechaMerma}
                  onChange={e => setFechaMerma(e.target.value)}
                  className="w-full bg-surface-container-highest dark:bg-[#121212] border border-error/20 dark:border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-[11px] font-bold text-error dark:text-red-400 focus:outline-none focus:border-error transition-all"
                />
              </div>
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
                  .filter(p => {
                    const searchTerm = normalizeText(searchMerma);
                    const nameMatch = normalizeText(p.nombre).includes(searchTerm);
                    const skuMatch = normalizeText(p.sku).includes(searchTerm);
                    const variantMatch = p.variantes?.some(v => normalizeText(v.nombre).includes(searchTerm));
                    return nameMatch || skuMatch || variantMatch;
                  })
                  .flatMap(p => {
                    if (p.variantes && p.variantes.length > 0) {
                      return p.variantes.map(v => (
                        <button
                          key={`${p.id}-${v.nombre}`}
                          onMouseDown={(e) => { e.preventDefault(); addItemMerma(p, v.nombre); }}
                          className="w-full px-5 py-4 text-left text-[11px] font-bold hover:bg-error/10 dark:hover:bg-error/20 transition-colors flex justify-between items-center border-b border-error/5 dark:border-error/10 group"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-error dark:text-red-400 group-hover:scale-105 transition-transform origin-left">{p.nombre}</span>
                              <div className="flex items-center gap-1.5 bg-error/5 dark:bg-white/5 px-2 py-0.5 rounded-full border border-error/10 dark:border-white/10">
                                <div 
                                  className="w-2 h-2 rounded-full border border-black/5 dark:border-white/10"
                                  style={{ backgroundColor: getHexColor(v.nombre) || '#ccc' }}
                                />
                                <span className="text-[9px] font-black uppercase tracking-widest text-error/60 dark:text-red-400/60">{v.nombre}</span>
                              </div>
                            </div>
                            <span className="text-[9px] text-outline/50 uppercase tracking-widest">{p.sku}</span>
                          </div>
                          <span className="text-[10px] text-error dark:text-red-400/60 opacity-60 bg-error/5 px-2 py-0.5 rounded-full font-extrabold">Stock: {v.stock}</span>
                        </button>
                      ));
                    }
                    return (
                      <button
                        key={p.id}
                        onMouseDown={(e) => { e.preventDefault(); addItemMerma(p); }}
                        className="w-full px-5 py-4 text-left text-[11px] font-bold hover:bg-error/10 dark:hover:bg-error/20 transition-colors flex justify-between items-center border-b border-error/5 dark:border-error/10 group"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="text-error dark:text-red-400 group-hover:scale-105 transition-transform origin-left">{p.nombre}</span>
                          <span className="text-[9px] text-outline/50 uppercase tracking-widest">{p.sku}</span>
                        </div>
                        <span className="text-[10px] text-error dark:text-red-400/60 opacity-60 bg-error/5 px-2 py-0.5 rounded-full font-extrabold">Stock: {p.stock}</span>
                      </button>
                    );
                  })
                }
                {productos.filter(p => {
                    const searchTerm = normalizeText(searchMerma);
                    const nameMatch = normalizeText(p.nombre).includes(searchTerm);
                    const skuMatch = normalizeText(p.sku).includes(searchTerm);
                    const variantMatch = p.variantes?.some(v => normalizeText(v.nombre).includes(searchTerm));
                    return nameMatch || skuMatch || variantMatch;
                  }).length === 0 && (
                  <div className="px-5 py-6 text-[10px] text-error/50 italic text-center font-bold uppercase tracking-widest">No se encontraron productos</div>
                )}
              </div>
            )}
          </div>

          {/* Tabla de mermas seleccionadas - Luxe Glass Effect */}
          <div className="flex-1 min-h-[300px] bg-white/5 dark:bg-black/40 backdrop-blur-md rounded-[2rem] border border-error/10 dark:border-white/5 relative z-10 p-2 luxe-scrollbar overflow-y-auto">
            {/* El modal se movió al final del componente para ser 'fixed' */}

            <table className="w-full text-left">
              <thead className="sticky top-0 bg-error/5 dark:bg-red-950/40 backdrop-blur-md px-2 z-20">
                <tr className="border-b border-error/10 dark:border-error/20">
                  <th className="py-4 pl-5 font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c] dark:text-red-400/80 rounded-tl-2xl">Producto</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c] dark:text-red-400/80">Stock</th>
                  <th className="py-4 text-center font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c] dark:text-red-400/80">Cant.</th>
                  <th className="py-4 pr-5 text-right font-label text-[9px] font-extrabold uppercase tracking-widest text-[#a6403c] dark:text-red-400/80 rounded-tr-2xl">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-error/5">
                {conteoMerma.map((p) => (
                  <tr key={p.id} className="hover:bg-error/10 dark:hover:bg-red-900/20 transition-colors border-b border-error/5 dark:border-white/5 group">
                    <td className="py-4 pl-5 text-[11px] font-bold truncate max-w-[180px] md:max-w-none text-[#5e2220] dark:text-red-200 group-hover:text-error dark:group-hover:text-red-400 transition-colors flex flex-col gap-1">
                      <span>{p.producto}</span>
                      {p.variante && (
                        <div className="flex items-center gap-1.5 bg-error/5 dark:bg-white/5 px-2 py-0.5 rounded-full border border-error/10 dark:border-white/10 w-fit">
                          <div 
                            className="w-1.5 h-1.5 rounded-full border border-black/5 dark:border-white/10"
                            style={{ backgroundColor: getHexColor(p.variante) || '#ccc' }}
                          />
                          <span className="text-[8px] font-black uppercase tracking-widest text-error/60 dark:text-red-400/60">{p.variante}</span>
                        </div>
                      )}
                    </td>
                    <td className="py-4 text-center font-body text-[11px] font-bold text-[#5e2220] dark:text-red-300/80">{p.stockFin.toLocaleString()}</td>
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

          <div className="mt-8 pt-6 border-t border-error/10 dark:border-white/5 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0 relative z-10">
            <div className="flex items-center gap-3">
              {conteoMerma.length > 0 && (
                <div className="flex flex-col">
                  <span className="text-[9px] font-black uppercase tracking-widest text-error/40 dark:text-white/30">Total a ajustar</span>
                  <span className="text-xl font-headline font-bold text-error dark:text-red-400">
                    {conteoMerma.reduce((acc, curr) => acc + curr.vendido, 0)} <span className="text-xs italic opacity-60">unidades</span>
                  </span>
                </div>
              )}
              {guardadoMerma && (
                <span className="flex items-center gap-2 bg-error/10 px-4 py-2 rounded-full text-[10px] text-error font-black uppercase tracking-widest animate-in fade-in zoom-in duration-300">
                  <span className="material-symbols-outlined text-error text-[16px] animate-bounce">verified</span>
                  Stock Actualizado
                </span>
              )}
            </div>
            <button
              onClick={guardarMerma}
              disabled={conteoMerma.length === 0 || procesando}
              className={`group relative overflow-hidden px-10 py-5 rounded-2xl font-label text-[12px] font-black uppercase tracking-[0.25em] transition-all duration-500 shadow-2xl
                ${conteoMerma.length === 0 || procesando 
                  ? 'bg-outline/10 text-outline/40 grayscale cursor-not-allowed border border-white/5' 
                  : 'bg-error text-white hover:scale-[1.05] active:scale-95 shadow-error/30'}`}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              <div className="flex items-center gap-3 relative z-10">
                <span className="material-symbols-outlined text-xl group-hover:rotate-12 transition-transform">
                  {procesando ? 'sync' : 'delete_sweep'}
                </span>
                {procesando ? 'PROCESANDO...' : 'CONFIRMAR AJUSTE'}
              </div>
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
          {registrosFiltrados.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((v) => {
            const isGasto = v._tipo === 'gasto'
            const isMerma = v._tipo === 'merma'
            const esVentaDirecta = v.cliente === "Venta Directa" && !isMerma && !isGasto

            const catInfo = isGasto ? (CATEGORIAS_GASTOS.find(c => c.id === v.categoria) || CATEGORIAS_GASTOS[3]) : null;

            let flujoMonetario = 0
            if (isGasto) {
              flujoMonetario = Number(v.monto) || 0;
            } else if (v.productos && Array.isArray(v.productos)) {
              v.productos.forEach(item => {
                const prod = productos.find(xd => xd.id === item.productoId)
                if(prod) {
                  const precio = Number(prod.precio) || 0;
                  const cant = Number(item.cantidad) || 1;
                  flujoMonetario += precio * cant;
                }
              })
            }

            return (
              <div 
                key={v.id} 
                className={`p-5 rounded-2xl shadow-sm border flex flex-col gap-3 transition-colors hover:shadow-md ${isGasto ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/20 dark:border-amber-500/30' : (isMerma ? 'bg-error/5 dark:bg-error/10 border-error/20 dark:border-error/30' : 'bg-surface dark:bg-[#121212] border-outline-variant/10 dark:border-white/5')}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                     <span className={`material-symbols-outlined text-[16px] ${isGasto ? 'text-amber-500' : (isMerma ? 'text-error dark:text-red-400' : (esVentaDirecta ? 'text-primary dark:text-[#e2bd6c]' : 'text-secondary dark:text-[#e2bd6c]'))}`}>
                       {isGasto ? catInfo.icon : (isMerma ? 'remove_shopping_cart' : (esVentaDirecta ? 'storefront' : 'local_shipping'))}
                     </span>
                     <span className={`font-bold text-[11px] uppercase tracking-widest ${isGasto ? 'text-amber-600 dark:text-amber-400' : (isMerma ? 'text-error dark:text-red-400' : 'text-on-surface-variant dark:text-white/80')}`}>
                       {isGasto ? catInfo.label : (isMerma ? v.motivo : (esVentaDirecta ? 'Venta Directa' : v.cliente))}
                     </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-extrabold uppercase text-outline/80">
                       {getLocalStr(v)}
                    </span>
                    {isGasto ? (
                      <button 
                        onClick={() => handleEliminarGasto(v.id)}
                        className="text-outline/40 hover:text-error transition-colors focus:outline-none"
                        title="Eliminar gasto operativo"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    ) : (
                      <button 
                        onClick={() => deshacerRegistro(v)}
                        disabled={procesando}
                        className={`transition-colors focus:outline-none ${procesando ? 'opacity-50 cursor-not-allowed' : 'text-outline/40 hover:text-error'}`}
                        title="Deshacer registro y devolver al inventario"
                      >
                        <span className="material-symbols-outlined text-[14px]">undo</span>
                      </button>
                    )}
                  </div>
                </div>

                {isGasto ? (
                  <div className="my-2 px-3 py-2 rounded-xl bg-surface-container/50 dark:bg-white/5 border border-outline-variant/10">
                    <p className="text-xs font-semibold text-on-surface dark:text-white/90 italic">
                      "{v.descripcion}"
                    </p>
                  </div>
                ) : (
                  <ul className="text-xs space-y-1 pl-6 mt-1 mb-2">
                    {v.productos && v.productos.map((prodItem, idx) => {
                      const baseProd = productos.find(xd => xd.id === prodItem.productoId)
                      const unitPrice = baseProd ? (Number(baseProd.precio) || 0) : 0
                      return (
                        <li key={idx} className={`${isMerma ? 'text-[#82322e] dark:text-red-300/80' : 'text-on-surface/80 dark:text-white/70'}`}>
                          <strong className={isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-[#e2bd6c]'}>{prodItem.cantidad}x</strong> {prodItem.nombre} 
                          {prodItem.variante && (
                            <div className="inline-flex items-center gap-1 ml-1.5 bg-primary/5 dark:bg-[#e2bd6c]/10 px-1.5 py-0.5 rounded border border-primary/10 dark:border-[#e2bd6c]/10">
                              <div 
                                className="w-1.5 h-1.5 rounded-full border border-black/5 dark:border-white/10 shadow-sm"
                                style={{ backgroundColor: getHexColor(prodItem.variante) || '#ccc' }}
                              />
                              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-primary/70 dark:text-[#e2bd6c]/70">
                                {prodItem.variante}
                              </span>
                            </div>
                          )}
                          <span className="opacity-60 text-[10px] ml-1">(${unitPrice.toLocaleString('es-CL')} c/u)</span>
                        </li>
                      )
                    })}
                  </ul>
                )}

                <div className="mt-auto flex justify-end">
                   <span className={`font-headline font-bold text-lg ${isGasto ? 'text-amber-600 dark:text-amber-400' : (isMerma ? 'text-error dark:text-red-400' : 'text-secondary dark:text-[#e2bd6c]')}`}>
                     {isGasto || isMerma ? `-$${flujoMonetario.toLocaleString('es-CL')}` : `+$${flujoMonetario.toLocaleString('es-CL')}`}
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
      {/* Modal de Registro de Gasto Operativo */}
      {showGastoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-surface dark:bg-[#121212] border border-outline-variant/20 dark:border-white/10 rounded-[2rem] max-w-lg w-full p-6 md:p-8 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6 pb-4 border-b border-outline-variant/10 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-[#e2bd6c]">
                  <span className="material-symbols-outlined text-xl">payments</span>
                </div>
                <div>
                  <h3 className="font-headline font-bold text-xl text-on-surface dark:text-white">Registrar Gasto Operativo</h3>
                  <p className="text-[10px] uppercase tracking-widest text-outline dark:text-gray-400 font-bold">Pasajes, Comida, Embalaje, Varios</p>
                </div>
              </div>
              <button 
                onClick={() => setShowGastoModal(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-variant dark:hover:bg-white/10 text-outline dark:text-gray-400 transition-colors"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleGuardarGasto} className="space-y-4">
              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-400 mb-1.5">
                  Categoría del Gasto
                </label>
                <select
                  value={gastoForm.categoria}
                  onChange={e => setGastoForm(prev => ({ ...prev, categoria: e.target.value }))}
                  className="w-full bg-surface-container dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                >
                  {CATEGORIAS_GASTOS.map(cat => (
                    <option key={cat.id} value={cat.id} className="bg-surface dark:bg-[#1e1e1e] text-on-surface dark:text-white">
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-400 mb-1.5">
                    Monto ($ CLP)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="ej: 3500"
                    value={gastoForm.monto}
                    onChange={e => setGastoForm(prev => ({ ...prev, monto: e.target.value }))}
                    className="w-full bg-surface-container dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-400 mb-1.5">
                    Fecha del Gasto
                  </label>
                  <input
                    type="date"
                    value={gastoForm.fecha}
                    onChange={e => setGastoForm(prev => ({ ...prev, fecha: e.target.value }))}
                    className="w-full bg-surface-container dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-400 mb-1.5">
                  Descripción / Detalle
                </label>
                <input
                  type="text"
                  placeholder="ej: Pasaje bus para despacho de pedido a Santiago"
                  value={gastoForm.descripcion}
                  onChange={e => setGastoForm(prev => ({ ...prev, descripcion: e.target.value }))}
                  className="w-full bg-surface-container dark:bg-white/5 border border-outline-variant/20 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-on-surface dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
                  required
                />
              </div>

              <div className="pt-4 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowGastoModal(false)}
                  className="px-5 py-2.5 rounded-xl border border-outline-variant/20 dark:border-white/10 text-xs font-extrabold uppercase tracking-wider text-outline dark:text-gray-400 hover:bg-surface-variant dark:hover:bg-white/5 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={gastoProcesando}
                  className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white dark:text-black font-extrabold text-xs uppercase tracking-widest shadow-md transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {gastoProcesando ? (
                    <>
                      <span className="material-symbols-outlined text-sm animate-spin">sync</span>
                      Guardando...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-sm">check</span>
                      Guardar Gasto
                    </>
                  )}
                </button>
              </div>
            </form>
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
