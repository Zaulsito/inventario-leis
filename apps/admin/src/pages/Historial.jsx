import { useState, useEffect, useMemo, useRef } from 'react'
import { useOutletContext, useNavigate, useLocation } from 'react-router-dom'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, query, where, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'
import { getLocalDateString, formatDateDMA } from '../utils/date'
import Footer from '../components/Footer'
import { getOptimizedImageUrl } from '../utils/image'

export default function Historial() {
  const { isDark = false } = useOutletContext() || {}
  const navigate = useNavigate()
  const location = useLocation()
  const initializedFromStateRef = useRef(false)

  const [productos, setProductos] = useState([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [activeSubTab, setActiveSubTab] = useState('kardex') // 'kardex' | 'lotes'
  const [historyFilter, setHistoryFilter] = useState('todos') // 'todos' | 'entradas' | 'salidas' | 'ventas' | 'mermas' | 'reposicion'
  const [historyLogs, setHistoryLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showProductDropdown, setShowProductDropdown] = useState(false)
  const [productSearchInput, setProductSearchInput] = useState('')
  const [modoGanancia, setModoGanancia] = useState('vendido') // 'vendido' | 'global'
  const [showGananciaInfoModal, setShowGananciaInfoModal] = useState(false)

  // Form para ajuste directo de stock desde el historial
  const [formAjuste, setFormAjuste] = useState({
    ajusteStock: '',
    motivoAjuste: '',
    notaAjuste: '',
    precioCosto: ''
  })
  const [isSubmittingAjuste, setIsSubmittingAjuste] = useState(false)

  // 1. Escuchar lista de productos de Firestore
  useEffect(() => {
    const q = query(collection(db, 'productos'))
    const unsub = onSnapshot(q, (snapshot) => {
      const prods = snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
      prods.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
      setProductos(prods)
    })
    return () => unsub()
  }, [])

  // 2. Si venimos con un productoId desde state (ej. clic desde Inventario)
  useEffect(() => {
    if (!initializedFromStateRef.current && location.state && location.state.productoId) {
      initializedFromStateRef.current = true
      setSelectedProductId(location.state.productoId)
      navigate(location.pathname, { replace: true, state: null })
    } else if (!selectedProductId && productos.length > 0) {
      setSelectedProductId(productos[0].id)
    }
  }, [location.state, productos, navigate, selectedProductId])

  const selectedProduct = useMemo(() => {
    return productos.find(p => p.id === selectedProductId) || null
  }, [productos, selectedProductId])

  // Actualizar precio de costo referencial en el formulario de ajuste
  useEffect(() => {
    if (selectedProduct) {
      setFormAjuste(prev => ({
        ...prev,
        precioCosto: selectedProduct.precioCosto || ''
      }))
    }
  }, [selectedProduct])

  // 3. Cargar Historial Completo del Producto Seleccionado
  useEffect(() => {
    if (!selectedProductId) {
      setHistoryLogs([])
      return
    }

    async function loadHistory() {
      setIsLoading(true)
      try {
        const targetProd = productos.find(p => p.id === selectedProductId)

        // a. Historial de inventario de Firestore
        const qLogs = query(
          collection(db, 'historial_inventario'),
          where('productoId', '==', selectedProductId)
        )
        const snapLogs = await getDocs(qLogs)
        const logsBase = snapLogs.docs.map(d => ({ id: d.id, ...d.data() }))

        // b. Pedidos reales
        const snapPedidos = await getDocs(collection(db, 'pedidos'))
        const logsPedidos = []

        snapPedidos.docs.forEach(pDoc => {
          const ped = { id: pDoc.id, ...pDoc.data() }
          if (Array.isArray(ped.productos)) {
            ped.productos.forEach(prod => {
              const isMatch = prod.id === selectedProductId || 
                (targetProd && targetProd.sku && prod.sku && prod.sku.toLowerCase() === targetProd.sku.toLowerCase()) ||
                (targetProd && targetProd.nombre && prod.nombre && prod.nombre.toLowerCase() === targetProd.nombre.toLowerCase())

              if (isMatch) {
                const cant = Number(prod.cantidad) || 1
                const fechaIso = ped.fechaEntrega || ped.fechaCreacion || ped.createdAt || getLocalDateString()
                const pEst = (ped.estadoPago || ped.estado || '').toLowerCase()
                const totalPed = Number(ped.total) || 0
                const abonoPed = Number(ped.abono) || 0
                const saldoPed = ped.saldoPendiente !== undefined ? Number(ped.saldoPendiente) : (totalPed - abonoPed)

                let statusLabel = 'Pendiente'
                if (pEst === 'pagado' || pEst === 'finalizado' || pEst === 'completado' || (totalPed > 0 && saldoPed <= 0)) {
                  statusLabel = 'Pagado'
                } else if (pEst === 'parcial' || pEst === 'abonado' || abonoPed > 0) {
                  statusLabel = 'Abonado'
                }

                logsPedidos.push({
                  id: `pedido-${ped.id}-${prod.id || selectedProductId}`,
                  fecha: fechaIso,
                  accion: `Venta en Pedido a ${ped.cliente || 'Cliente'}`,
                  motivo: `Pedido #${ped.id ? ped.id.slice(-5) : ''} de ${ped.cliente || 'Cliente'} • ${cant} un.`,
                  cambio: -cant,
                  stockNuevo: statusLabel,
                  esPedidoReal: true,
                  pedidoId: ped.id,
                  cliente: ped.cliente,
                  precio: prod.precio || 0
                })
              }
            })
          }
        })

        // c. Mermas reales
        const snapMermas = await getDocs(collection(db, 'mermas'))
        const logsMermas = []

        snapMermas.docs.forEach(mDoc => {
          const mer = { id: mDoc.id, ...mDoc.data() }
          if (Array.isArray(mer.productos)) {
            mer.productos.forEach(prod => {
              const isMatch = prod.productoId === selectedProductId || prod.id === selectedProductId ||
                (targetProd && targetProd.sku && prod.sku && prod.sku.toLowerCase() === targetProd.sku.toLowerCase()) ||
                (targetProd && targetProd.nombre && prod.nombre && prod.nombre.toLowerCase() === targetProd.nombre.toLowerCase())

              if (isMatch) {
                const cant = Number(prod.cantidad) || 1
                const fechaIso = mer.fechaEntrega || mer.fecha || mer.fechaCreacion || getLocalDateString()
                const motivoText = mer.motivo ? `Pérdida por ${mer.motivo}` : 'Merma de inventario'

                logsMermas.push({
                  id: `merma-${mer.id}-${prod.productoId || prod.id || selectedProductId}`,
                  fecha: fechaIso,
                  accion: `Merma / ${mer.motivo || 'Dañado'}`,
                  motivo: `${motivoText} • ${cant} un.`,
                  cambio: -cant,
                  stockNuevo: 'Merma',
                  esMermaReal: true,
                  mermaId: mer.id,
                  motivoMerma: mer.motivo || 'Dañado'
                })
              }
            })
          }
        })

        // Fusionar evitando duplicados
        const logsMap = new Map()
        const snapPedidosIds = new Set(snapPedidos.docs.map(d => d.id))
        const snapMermasIds = new Set(snapMermas.docs.map(d => d.id))

        logsPedidos.forEach(lp => logsMap.set(lp.id, lp))
        logsMermas.forEach(lm => logsMap.set(lm.id, lm))

        logsBase.forEach(l => {
          const isDupPedido = l.pedidoId && Array.from(logsMap.values()).some(lp => lp.pedidoId === l.pedidoId)
          const isDupMerma = l.mermaId && Array.from(logsMap.values()).some(lm => lm.mermaId === l.mermaId)
          const isOrphanMerma = l.mermaId && !snapMermasIds.has(l.mermaId)
          const isOrphanPedido = l.pedidoId && !snapPedidosIds.has(l.pedidoId)

          if (!logsMap.has(l.id) && !isDupPedido && !isDupMerma && !isOrphanMerma && !isOrphanPedido) {
            logsMap.set(l.id, l)
          }
        })

        const combined = Array.from(logsMap.values())
        combined.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
        setHistoryLogs(combined)
      } catch (e) {
        console.error("Error cargando historial de stock:", e)
        setHistoryLogs([])
      } finally {
        setIsLoading(false)
      }
    }

    loadHistory()
  }, [selectedProductId, productos])

  // Métricas calculadas para el producto seleccionado
  const productStats = useMemo(() => {
    if (!selectedProduct) return { 
      entradas: 0, 
      salidas: 0, 
      stockCalculado: 0, 
      inversionTotal: 0, 
      unidadesTotales: 0,
      ventasDinero: 0,
      unidadesVendidas: 0,
      costoVentas: 0,
      gananciaVentas: 0,
      balanceGlobal: 0
    }

    let entradas = 0
    let salidas = 0
    let inversionTotal = 0
    let unidadesTotales = 0
    let ventasDinero = 0
    let unidadesVendidas = 0
    let costoVentas = 0

    historyLogs.forEach(log => {
      const c = Number(log.cambio) || 0
      const accionStr = (log.accion || '').toLowerCase()
      const motivoStr = (log.motivo || '').toLowerCase()
      const costUnit = Number(log.precioCosto) || Number(selectedProduct.precioCosto) || 0

      if (c > 0) {
        entradas += c
        inversionTotal += (c * costUnit)
        unidadesTotales += c
      } else {
        const cantSalida = Math.abs(c)
        salidas += cantSalida

        const isVenta = log.esPedidoReal || accionStr.includes('pedido') || motivoStr.includes('pedido') || accionStr.includes('venta') || motivoStr.includes('venta')
        if (isVenta) {
          unidadesVendidas += cantSalida
          const pVentaUnit = Number(log.precio) || Number(selectedProduct.precio) || 0
          ventasDinero += (cantSalida * pVentaUnit)
          costoVentas += (cantSalida * costUnit)
        }
      }
    })

    const stockCalculado = (historyLogs && historyLogs.length > 0)
      ? Math.max(0, entradas - salidas)
      : (Number(selectedProduct.stock) || 0)

    const gananciaVentas = ventasDinero - costoVentas
    const balanceGlobal = ventasDinero - inversionTotal

    return {
      entradas,
      salidas,
      stockCalculado,
      inversionTotal,
      unidadesTotales,
      ventasDinero,
      unidadesVendidas,
      costoVentas,
      gananciaVentas,
      balanceGlobal
    }
  }, [selectedProduct, historyLogs])

  useEffect(() => {
    if (selectedProduct && historyLogs && historyLogs.length > 0 && productStats.stockCalculado !== undefined) {
      if (Number(selectedProduct.stock) !== productStats.stockCalculado) {
        updateDoc(doc(db, 'productos', selectedProduct.id), { stock: productStats.stockCalculado })
          .catch(e => console.error("Error sincronizando stock en Historial:", e))
      }
    }
  }, [selectedProduct?.id, historyLogs, productStats.stockCalculado])

  // Lotes de compra filtrados
  const lotesDeCompra = useMemo(() => {
    const lotes = historyLogs.filter(l => Number(l.cambio) > 0)
    let sumaAcumulada = 0
    return lotes.map(l => {
      const cant = Number(l.cambio) || 0
      const costUnit = Number(l.precioCosto) || Number(selectedProduct?.precioCosto) || 0
      const totalLote = cant * costUnit
      sumaAcumulada += totalLote

      const motivoStr = (l.motivo || '').toLowerCase()
      let tipoTag = 'Reposición Proveedor'
      if (motivoStr.includes('inicial') || (l.accion || '').toLowerCase().includes('inicial')) {
        tipoTag = 'Stock Inicial'
      } else if (motivoStr.includes('devolución') || motivoStr.includes('devolucion')) {
        tipoTag = 'Devolución Cliente'
      } else if (motivoStr.includes('manual')) {
        tipoTag = 'Ajuste Manual (+)'
      }

      return {
        ...l,
        cant,
        costUnit,
        totalLote,
        sumaAcumulada,
        tipoTag
      }
    })
  }, [historyLogs, selectedProduct])

  // Conteos dinámicos para cada filtro del Kardex
  const filterCounts = useMemo(() => {
    let todos = 0, entradas = 0, salidas = 0, ventas = 0, reposicion = 0, mermas = 0

    historyLogs.forEach(log => {
      const cant = Number(log.cambio) || 0
      const accionStr = (log.accion || '').toLowerCase()
      const motivoStr = (log.motivo || '').toLowerCase()

      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchMotivo = motivoStr.includes(term)
        const matchAccion = accionStr.includes(term)
        const matchCliente = (log.cliente || '').toLowerCase().includes(term)
        const matchPedido = (log.pedidoId || '').toLowerCase().includes(term)
        if (!matchMotivo && !matchAccion && !matchCliente && !matchPedido) return
      }

      todos++
      if (cant > 0) entradas++
      if (cant < 0) salidas++

      const isVenta = log.esPedidoReal || accionStr.includes('pedido') || motivoStr.includes('pedido') || accionStr.includes('venta') || motivoStr.includes('venta')
      if (isVenta) ventas++

      const isMerma = log.esMermaReal || motivoStr.includes('merma') || motivoStr.includes('dañad') || motivoStr.includes('rotura') || motivoStr.includes('pérdida') || motivoStr.includes('perdida')
      if (isMerma) mermas++

      const isReposicion = motivoStr.includes('proveedor') || motivoStr.includes('reposición') || motivoStr.includes('reposicion') || motivoStr.includes('compra') || accionStr.includes('creación') || accionStr.includes('inicial') || motivoStr.includes('inicial') || (cant > 0 && !motivoStr.includes('manual'))
      if (isReposicion) reposicion++
    })

    return { todos, entradas, salidas, ventas, reposicion, mermas }
  }, [historyLogs, searchTerm])

  // Filtrado de movimientos para el Kardex
  const filteredKardexLogs = useMemo(() => {
    return historyLogs.filter(log => {
      const cant = Number(log.cambio) || 0
      const accionStr = (log.accion || '').toLowerCase()
      const motivoStr = (log.motivo || '').toLowerCase()

      // Filtro de Pestañas/Chips
      if (historyFilter === 'entradas' && cant <= 0) return false
      if (historyFilter === 'salidas' && cant >= 0) return false
      if (historyFilter === 'ventas' && !log.esPedidoReal && !accionStr.includes('pedido') && !motivoStr.includes('pedido') && !accionStr.includes('venta') && !motivoStr.includes('venta')) return false
      if (historyFilter === 'mermas' && !log.esMermaReal && !motivoStr.includes('merma') && !motivoStr.includes('dañad') && !motivoStr.includes('pérdida') && !motivoStr.includes('perdida')) return false

      const isReposicion = motivoStr.includes('proveedor') || motivoStr.includes('reposición') || motivoStr.includes('reposicion') || motivoStr.includes('compra') || accionStr.includes('creación') || accionStr.includes('inicial') || motivoStr.includes('inicial') || (cant > 0 && !motivoStr.includes('manual'))
      if (historyFilter === 'reposicion' && !isReposicion) return false

      // Búsqueda por texto (nota, cliente, fecha)
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase()
        const matchMotivo = motivoStr.includes(term)
        const matchAccion = accionStr.includes(term)
        const matchCliente = (log.cliente || '').toLowerCase().includes(term)
        const matchPedido = (log.pedidoId || '').toLowerCase().includes(term)
        if (!matchMotivo && !matchAccion && !matchCliente && !matchPedido) return false
      }

      return true
    })
  }, [historyLogs, historyFilter, searchTerm])

  async function handleDeleteLog(log) {
    if (log.esPedidoReal || log.esMermaReal) {
      alert("Los registros de Ventas o Mermas reales están vinculados a su módulo de origen.")
      return
    }

    const stockActual = selectedProduct ? (Number(selectedProduct.stock) || 0) : 0
    const cambioNum = Number(log.cambio || 0)
    const stockRevertido = Math.max(0, stockActual - cambioNum)

    if (!window.confirm(`¿Deseas eliminar este registro del historial (${cambioNum > 0 ? '+' : ''}${cambioNum} un.) y ajustar el stock de ${stockActual} a ${stockRevertido} un.?`)) return

    try {
      await deleteDoc(doc(db, 'historial_inventario', log.id))
      setHistoryLogs(prev => prev.filter(l => l.id !== log.id))

      if (selectedProduct && cambioNum !== 0) {
        await updateDoc(doc(db, 'productos', selectedProduct.id), {
          stock: stockRevertido
        })
      }
    } catch (e) {
      console.error("Error al eliminar log:", e)
      alert("Error al eliminar log: " + e.message)
    }
  }

  // Registrar ajuste directo de stock desde el panel de historial
  async function handleAddDirectStockAdjustment(e) {
    e.preventDefault()
    const cantNum = Number(formAjuste.ajusteStock) || 0
    if (!cantNum) {
      alert("Por favor ingresa una cantidad a ajustar (ej. 5 o -2)")
      return
    }

    if (!selectedProduct) {
      alert("Por favor selecciona un producto válido")
      return
    }

    setIsSubmittingAjuste(true)
    const stockBase = Number(selectedProduct.stock) || 0
    const stockNuevo = Math.max(0, stockBase + cantNum)
    const costUnit = Math.floor(Number(formAjuste.precioCosto)) || Math.floor(Number(selectedProduct.precioCosto)) || 0

    const accionText = cantNum > 0 ? `Se sumaron ${cantNum}` : `Se restaron ${Math.abs(cantNum)}`
    const selectedMotivo = formAjuste.motivoAjuste || (cantNum > 0 ? "Reposición de Stock" : "Merma / Producto Dañado")
    const motivoText = formAjuste.notaAjuste ? `${selectedMotivo} • ${formAjuste.notaAjuste}` : selectedMotivo

    try {
      const docRef = await addDoc(collection(db, 'historial_inventario'), {
        productoId: selectedProduct.id,
        fecha: new Date().toISOString(),
        accion: accionText,
        cambio: cantNum,
        stockAnterior: stockBase,
        stockNuevo: stockNuevo,
        precioCosto: costUnit,
        costoTotalLote: cantNum > 0 ? (cantNum * costUnit) : 0,
        motivo: motivoText,
        nota: formAjuste.notaAjuste || ''
      })

      await updateDoc(doc(db, 'productos', selectedProduct.id), {
        stock: stockNuevo
      })

      const newLog = {
        id: docRef.id,
        productoId: selectedProduct.id,
        fecha: new Date().toISOString(),
        accion: accionText,
        cambio: cantNum,
        stockAnterior: stockBase,
        stockNuevo: stockNuevo,
        precioCosto: costUnit,
        costoTotalLote: cantNum > 0 ? (cantNum * costUnit) : 0,
        motivo: motivoText,
        nota: formAjuste.notaAjuste || ''
      }

      setHistoryLogs(prev => [newLog, ...prev])
      setFormAjuste(prev => ({
        ...prev,
        ajusteStock: '',
        motivoAjuste: '',
        notaAjuste: ''
      }))
    } catch (err) {
      console.error("Error al registrar ajuste:", err)
      alert("Error al registrar ajuste: " + err.message)
    } finally {
      setIsSubmittingAjuste(false)
    }
  }

  // Filtrado de lista de productos para el dropdown
  const filteredProductsDropdown = useMemo(() => {
    if (!productSearchInput.trim()) return productos.slice(0, 8)
    const term = productSearchInput.toLowerCase()
    return productos.filter(p => 
      (p.nombre || '').toLowerCase().includes(term) || 
      (p.sku || '').toLowerCase().includes(term) ||
      (p.coleccion || '').toLowerCase().includes(term)
    ).slice(0, 10)
  }, [productos, productSearchInput])

  return (
    <div className="min-h-screen flex flex-col justify-between pt-6 px-4 md:px-8 pb-12 max-w-7xl mx-auto">
      <div className="space-y-6">

      <header className="sticky top-0 z-30 bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-md px-8 md:px-10 py-8 flex flex-col items-center justify-center border-b border-outline-variant/20 dark:border-white/5 mb-6">
        <div className="relative text-center mx-auto">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 dark:text-[#e2bd6c]/60 mb-2">Auditoría & Trazabilidad</p>
          <h1 className="font-headline text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter luxe-reveal">Historial de Stock</h1>
          <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>
      </header>

        {/* ── Selector de Producto ── */}
        <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container-low/40 dark:bg-white/[0.03] p-5 rounded-[28px] border border-outline-variant/20 dark:border-white/10 shadow-sm backdrop-blur-md relative ${showProductDropdown ? 'z-[100]' : 'z-20'}`}>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-secondary/10 dark:bg-[#e2bd6c]/15 text-secondary dark:text-[#e2bd6c] border border-secondary/20 dark:border-[#e2bd6c]/30 flex items-center justify-center shrink-0 shadow-inner">
              <span className="material-symbols-outlined text-xl">inventory_2</span>
            </div>
            <div>
              <h2 className="font-headline text-lg italic text-on-surface dark:text-white font-bold leading-tight">
                Seleccionar Producto a Auditar
              </h2>
              {selectedProduct ? (
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-500/20">
                    P. Venta: ${(Number(selectedProduct.precio) || 0).toLocaleString('es-CL')}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border border-blue-500/20">
                    P. Costo (Actual): ${(Number(selectedProduct.precioCosto) || 0).toLocaleString('es-CL')}
                  </span>
                  <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:bg-[#e2bd6c]/15 dark:text-[#e2bd6c] border border-amber-500/20">
                    Margen: ${((Number(selectedProduct.precio) || 0) - (Number(selectedProduct.precioCosto) || 0)).toLocaleString('es-CL')}
                  </span>
                </div>
              ) : (
                <p className="text-[9px] font-bold uppercase tracking-widest text-outline dark:text-gray-400">
                  Elige un producto para visualizar sus movimientos y lotes de compra
                </p>
              )}
            </div>
          </div>

          {/* Selector de Producto Inteligente */}
          <div className="relative min-w-[280px] sm:min-w-[340px]">
            <label className="block text-[9px] font-bold uppercase tracking-widest text-secondary dark:text-[#e2bd6c]/80 mb-1 ml-1">
              Producto Seleccionado
            </label>
            <div 
              onClick={() => setShowProductDropdown(true)}
              className="w-full bg-surface-container-lowest dark:bg-[#1a1a1a] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-4 py-3 flex items-center justify-between cursor-pointer hover:border-primary dark:hover:border-[#e2bd6c] transition-all shadow-sm group"
            >
              <div className="flex items-center gap-3 min-w-0">
                {selectedProduct?.fotoUrl ? (
                  <img src={getOptimizedImageUrl(selectedProduct.fotoUrl, 150)} alt="" className="w-8 h-8 rounded-xl object-cover shrink-0 border border-outline-variant/20" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-surface-variant dark:bg-white/10 flex items-center justify-center text-outline dark:text-gray-400 shrink-0">
                    <span className="material-symbols-outlined text-base">inventory_2</span>
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold text-on-surface dark:text-white truncate">
                    {selectedProduct ? selectedProduct.nombre : 'Seleccionar Producto...'}
                  </p>
                  <p className="text-[9px] font-semibold text-outline dark:text-gray-400 uppercase tracking-wider truncate">
                    {selectedProduct 
                      ? `SKU: ${selectedProduct.sku} • Venta: $${(Number(selectedProduct.precio) || 0).toLocaleString('es-CL')} • Costo: $${(Number(selectedProduct.precioCosto) || 0).toLocaleString('es-CL')}` 
                      : 'Elige para ver su historial'}
                  </p>
                </div>
              </div>
              <span className="material-symbols-outlined text-outline dark:text-gray-400 group-hover:text-primary dark:group-hover:text-[#e2bd6c] transition-colors">
                unfold_more
              </span>
            </div>

            {/* Dropdown flotante de selección de producto */}
            {showProductDropdown && (
              <>
                <div className="fixed inset-0 z-[110]" onClick={() => setShowProductDropdown(false)} />
                <div className="absolute right-0 top-full mt-2 w-full sm:w-[380px] bg-surface-container-high dark:bg-[#222222] rounded-[24px] shadow-2xl z-[120] p-3 border border-outline-variant/20 dark:border-white/10 space-y-2 animate-in fade-in zoom-in-95 duration-200">
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline dark:text-gray-400 text-sm">search</span>
                    <input
                      type="text"
                      value={productSearchInput}
                      onChange={e => setProductSearchInput(e.target.value)}
                      placeholder="Buscar por nombre o SKU..."
                      className="w-full bg-surface-container-lowest dark:bg-[#181818] border border-outline-variant/30 dark:border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs font-semibold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                      autoFocus
                    />
                  </div>

                  <div className="max-h-64 overflow-y-auto space-y-1 custom-scrollbar pr-1">
                    {filteredProductsDropdown.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setSelectedProductId(p.id)
                          setShowProductDropdown(false)
                          setProductSearchInput('')
                        }}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all ${
                          selectedProductId === p.id 
                            ? 'bg-primary/10 text-primary dark:bg-[#e2bd6c]/20 dark:text-[#e2bd6c] font-bold border border-primary/20 dark:border-[#e2bd6c]/30' 
                            : 'hover:bg-surface-variant/40 dark:hover:bg-white/5 text-on-surface dark:text-white/90'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {p.fotoUrl ? (
                            <img src={getOptimizedImageUrl(p.fotoUrl, 150)} alt="" className="w-7 h-7 rounded-lg object-cover shrink-0" />
                          ) : (
                            <div className="w-7 h-7 rounded-lg bg-surface-variant dark:bg-white/10 flex items-center justify-center text-outline dark:text-gray-400 shrink-0">
                              <span className="material-symbols-outlined text-xs">inventory_2</span>
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{p.nombre}</p>
                            <p className="text-[9px] text-outline dark:text-gray-400 font-semibold">
                              {p.coleccion} • Venta: ${(Number(p.precio) || 0).toLocaleString('es-CL')} • Costo: ${(Number(p.precioCosto) || 0).toLocaleString('es-CL')}
                            </p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-md bg-surface-variant/60 dark:bg-white/10 shrink-0 ml-2">
                          {p.stock} un.
                        </span>
                      </button>
                    ))}

                    {filteredProductsDropdown.length === 0 && (
                      <p className="text-center text-[10px] text-outline py-4 font-semibold">No se encontraron productos.</p>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Tarjetas de Métricas del Producto Seleccionado ── */}
        {selectedProduct && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="bg-surface-container-low/60 dark:bg-white/5 p-4 rounded-2xl border border-outline-variant/20 dark:border-white/10 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-outline dark:text-gray-400 mb-1">Stock Actual</span>
              <span className="text-xl font-black text-on-surface dark:text-white">
                {productStats.stockCalculado.toLocaleString('es-CL')} un.
              </span>
              <span className="text-[8px] font-extrabold text-outline/70 dark:text-gray-500 mt-1 uppercase tracking-wider">En inventario</span>
            </div>

            <div className="bg-emerald-500/10 dark:bg-emerald-500/15 p-4 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">Total Entradas</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                +{productStats.entradas.toLocaleString('es-CL')} un.
              </span>
              <span className="text-[8px] font-extrabold text-emerald-700/60 dark:text-emerald-300/60 mt-1 uppercase tracking-wider">Compras / Lotes</span>
            </div>

            <div className="bg-purple-500/10 dark:bg-purple-500/15 p-4 rounded-2xl border border-purple-500/20 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-purple-700 dark:text-purple-300 mb-1">Total Salidas</span>
              <span className="text-xl font-black text-purple-600 dark:text-purple-400">
                -{productStats.salidas.toLocaleString('es-CL')} un.
              </span>
              <span className="text-[8px] font-extrabold text-purple-700/60 dark:text-purple-300/60 mt-1 uppercase tracking-wider">Ventas / Mermas</span>
            </div>

            <div className="bg-emerald-500/10 dark:bg-emerald-500/15 p-4 rounded-2xl border border-emerald-500/20 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 mb-1">Total Ventas</span>
              <span className="text-xl font-black text-emerald-600 dark:text-emerald-400">
                ${productStats.ventasDinero.toLocaleString('es-CL')}
              </span>
              <span className="text-[8px] font-extrabold text-emerald-700/70 dark:text-emerald-300/70 mt-1 uppercase tracking-wider">
                {productStats.unidadesVendidas} un. vendidas
              </span>
            </div>

            <div className="bg-blue-500/10 dark:bg-blue-500/15 p-4 rounded-2xl border border-blue-500/20 shadow-sm flex flex-col justify-center items-center text-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-blue-700 dark:text-blue-300 mb-1">Inversión Lotes</span>
              <span className="text-xl font-black text-blue-600 dark:text-blue-400">
                ${productStats.inversionTotal.toLocaleString('es-CL')}
              </span>
              <span className="text-[8px] font-extrabold text-blue-700/70 dark:text-blue-300/70 mt-1 uppercase tracking-wider">
                {productStats.unidadesTotales} un. compradas
              </span>
            </div>

            <div className="bg-amber-500/10 dark:bg-[#e2bd6c]/10 p-4 rounded-2xl border border-amber-500/20 dark:border-[#e2bd6c]/30 shadow-sm flex flex-col justify-between items-center text-center relative group">
              <div className="flex items-center justify-between w-full gap-1 mb-1">
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-800 dark:text-[#e2bd6c] truncate">
                    {modoGanancia === 'vendido' ? 'Ganancia' : 'Balance Global'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowGananciaInfoModal(true)}
                    className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-900 dark:bg-[#e2bd6c]/25 dark:text-[#e2bd6c] hover:scale-110 transition-all flex items-center justify-center cursor-pointer shrink-0 border border-amber-500/30"
                    title="Ver cómo se realiza este cálculo"
                  >
                    <span className="material-symbols-outlined text-[10px] font-black">info</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setModoGanancia(prev => prev === 'vendido' ? 'global' : 'vendido')}
                  className="px-1.5 py-0.5 rounded-full text-[8px] font-extrabold uppercase tracking-wider bg-amber-500/20 dark:bg-[#e2bd6c]/20 text-amber-900 dark:text-[#e2bd6c] border border-amber-500/30 hover:scale-105 transition-all cursor-pointer shrink-0"
                  title="Haz clic para cambiar el modo de cálculo"
                >
                  {modoGanancia === 'vendido' ? 'Global' : 'Vendido'}
                </button>
              </div>
              <span className={`text-xl font-black ${
                (modoGanancia === 'vendido' ? productStats.gananciaVentas : productStats.balanceGlobal) >= 0 
                  ? 'text-emerald-600 dark:text-emerald-400' 
                  : 'text-rose-600 dark:text-rose-400'
              }`}>
                ${(modoGanancia === 'vendido' ? productStats.gananciaVentas : productStats.balanceGlobal).toLocaleString('es-CL')}
              </span>
              <span className="text-[8px] font-extrabold text-amber-800/70 dark:text-[#e2bd6c]/70 mt-1 uppercase tracking-wider">
                {modoGanancia === 'vendido' ? 'Margen prod. vendidos' : 'Desc. inversión total'}
              </span>
            </div>
          </div>
        )}

        {/* ── Modal Explicativo de Cálculos Financieros ── */}
        {showGananciaInfoModal && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-surface-container-high dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-[28px] max-w-lg w-full p-6 shadow-2xl space-y-5 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between border-b border-outline-variant/20 dark:border-white/10 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 dark:bg-[#e2bd6c]/15 text-amber-700 dark:text-[#e2bd6c] flex items-center justify-center font-bold">
                    <span className="material-symbols-outlined text-lg">analytics</span>
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-wider text-on-surface dark:text-white">
                      Desglose de Cálculos Financieros
                    </h3>
                    <p className="text-[10px] text-outline dark:text-gray-400 font-bold">
                      {selectedProduct ? selectedProduct.nombre : 'Producto Auditado'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowGananciaInfoModal(false)}
                  className="w-8 h-8 rounded-full bg-surface-variant/40 dark:bg-white/10 text-outline hover:text-on-surface dark:text-gray-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-base">close</span>
                </button>
              </div>

              <div className="space-y-4 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1">
                {/* 1. Modo Ganancia Vendido */}
                <div className="bg-emerald-500/10 dark:bg-emerald-500/15 p-4 rounded-2xl border border-emerald-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300">
                    <span className="material-symbols-outlined text-sm">sell</span>
                    <h4 className="text-xs font-black uppercase tracking-wider">1. Ganancia sobre Productos Vendidos</h4>
                  </div>
                  <p className="text-[11px] text-on-surface/80 dark:text-gray-300 leading-relaxed font-medium">
                    Muestra el margen neto obtenido únicamente de las <strong>{productStats.unidadesVendidas} unidades</strong> que han sido efectivamente vendidas al público.
                  </p>
                  <div className="bg-surface/50 dark:bg-black/20 p-3 rounded-xl space-y-1 text-[11px] font-bold">
                    <div className="flex justify-between">
                      <span className="text-outline dark:text-gray-400">Total Ingresos por Ventas ({productStats.unidadesVendidas} un.):</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${productStats.ventasDinero.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-outline dark:text-gray-400">Costo de Comprar esas {productStats.unidadesVendidas} un.:</span>
                      <span className="text-rose-600 dark:text-rose-400">-${productStats.costoVentas.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-outline-variant/20 dark:border-white/10 text-xs font-black">
                      <span className="text-on-surface dark:text-white">Ganancia Neta Real:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${productStats.gananciaVentas.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </div>

                {/* 2. Modo Balance Global */}
                <div className="bg-blue-500/10 dark:bg-blue-500/15 p-4 rounded-2xl border border-blue-500/20 space-y-2">
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                    <span className="material-symbols-outlined text-sm">account_balance_wallet</span>
                    <h4 className="text-xs font-black uppercase tracking-wider">2. Balance Global de Lotes (Flujo de Caja)</h4>
                  </div>
                  <p className="text-[11px] text-on-surface/80 dark:text-gray-300 leading-relaxed font-medium">
                    Compara el dinero ingresado por ventas contra la inversión total de las <strong>{productStats.unidadesTotales} unidades</strong> compradas en inventario.
                  </p>
                  <div className="bg-surface/50 dark:bg-black/20 p-3 rounded-xl space-y-1 text-[11px] font-bold">
                    <div className="flex justify-between">
                      <span className="text-outline dark:text-gray-400">Total Ingresos por Ventas:</span>
                      <span className="text-emerald-600 dark:text-emerald-400">${productStats.ventasDinero.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-outline dark:text-gray-400">Inversión Total en Lotes ({productStats.unidadesTotales} un.):</span>
                      <span className="text-rose-600 dark:text-rose-400">-${productStats.inversionTotal.toLocaleString('es-CL')}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-outline-variant/20 dark:border-white/10 text-xs font-black">
                      <span className="text-on-surface dark:text-white">Balance de Caja Actual:</span>
                      <span className={productStats.balanceGlobal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        ${productStats.balanceGlobal.toLocaleString('es-CL')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGananciaInfoModal(false)}
                  className="px-6 py-2.5 rounded-xl bg-primary text-on-primary dark:bg-[#e2bd6c] dark:text-black font-black text-xs uppercase tracking-wider hover:opacity-90 transition-all shadow-md cursor-pointer"
                >
                  Entendido
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Formulario de Ajuste / Ingreso Directo de Stock ── */}
        {selectedProduct && (
          <div className="bg-surface-container-low/40 dark:bg-white/[0.03] p-5 rounded-[24px] border border-outline-variant/20 dark:border-white/10 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-lg">add_box</span>
              <h3 className="text-xs font-black uppercase tracking-widest text-secondary dark:text-[#e2bd6c]">
                Registrar Nuevo Ingreso o Ajuste de Stock
              </h3>
            </div>

            <form onSubmit={handleAddDirectStockAdjustment} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-outline dark:text-[#e2bd6c]/70 mb-1 ml-1">
                    Cantidad (Sumar / Restar)
                  </label>
                  <input
                    type="number"
                    value={formAjuste.ajusteStock}
                    onChange={e => {
                      const val = e.target.value
                      const numVal = Number(val)
                      let defaultMotivo = formAjuste.motivoAjuste
                      if (numVal > 0 && (!defaultMotivo || defaultMotivo.includes('Merma') || defaultMotivo.includes('Regalo'))) {
                        defaultMotivo = 'Reposición de Stock'
                      } else if (numVal < 0 && (!defaultMotivo || defaultMotivo.includes('Reposición'))) {
                        defaultMotivo = 'Merma / Producto Dañado'
                      }
                      setFormAjuste(prev => ({ ...prev, ajusteStock: val, motivoAjuste: defaultMotivo }))
                    }}
                    placeholder="Ej. 10 o -2"
                    className="w-full bg-surface-container-lowest dark:bg-[#181818] border border-outline-variant/30 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-outline dark:text-[#e2bd6c]/70 mb-1 ml-1">
                    Motivo / Razón
                  </label>
                  <select
                    value={
                      formAjuste.motivoAjuste || 
                      (Number(formAjuste.ajusteStock) < 0 ? 'Merma / Producto Dañado' : 'Reposición de Stock')
                    }
                    onChange={e => setFormAjuste(prev => ({ ...prev, motivoAjuste: e.target.value }))}
                    className="w-full bg-surface-container-lowest dark:bg-[#181818] border border-outline-variant/30 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-bold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white cursor-pointer"
                  >
                    {Number(formAjuste.ajusteStock) < 0 ? (
                      <>
                        <option value="Merma / Producto Dañado">🔴 Merma / Producto Dañado</option>
                        <option value="Regalo / Muestra Promocional">🎁 Regalo / Muestra Promocional</option>
                        <option value="Venta No Registrada">🟢 Venta No Registrada / Venta Rápida</option>
                        <option value="Ajuste Manual">🟡 Ajuste Manual</option>
                      </>
                    ) : (
                      <>
                        <option value="Reposición de Stock">🔵 Reposición de Stock (Proveedor)</option>
                        <option value="Ajuste Manual">🟡 Ajuste Manual</option>
                        <option value="Devolución de Cliente">🟣 Devolución de Cliente</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-bold uppercase tracking-wider text-outline dark:text-[#e2bd6c]/70 mb-1 ml-1">
                    Nota / Comentario (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formAjuste.notaAjuste}
                    onChange={e => setFormAjuste(prev => ({ ...prev, notaAjuste: e.target.value }))}
                    placeholder="Ej. Llegan 10 cajas de caja central"
                    className="w-full bg-surface-container-lowest dark:bg-[#181818] border border-outline-variant/30 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={!formAjuste.ajusteStock || Number(formAjuste.ajusteStock) === 0 || isSubmittingAjuste}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-md ${
                    formAjuste.ajusteStock && Number(formAjuste.ajusteStock) !== 0
                      ? 'bg-primary text-on-primary dark:bg-[#e2bd6c] dark:text-black hover:opacity-90 cursor-pointer active:scale-95'
                      : 'bg-surface-variant/50 text-outline/50 dark:bg-white/5 dark:text-gray-500 cursor-not-allowed border border-outline-variant/20'
                  }`}
                >
                  <span className="material-symbols-outlined text-base font-bold">add_circle</span>
                  {isSubmittingAjuste ? 'Guardando...' : 'Registrar Movimiento'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── Sub-Pestañas: Kardex vs Lotes e Inversión ── */}
        <div className="bg-surface-container-low/50 dark:bg-white/[0.02] rounded-[24px] border border-outline-variant/20 dark:border-white/10 overflow-hidden shadow-sm">
          
          {/* Header de Pestañas */}
          <div className="flex items-center justify-between border-b border-outline-variant/20 dark:border-white/10 px-4 pt-3 pb-0 bg-surface-container/40 dark:bg-white/[0.01]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveSubTab('kardex')}
                className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'kardex'
                    ? 'border-primary text-primary dark:border-[#e2bd6c] dark:text-[#e2bd6c]'
                    : 'border-transparent text-outline dark:text-gray-400 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                Kardex de Movimientos ({historyLogs.length})
              </button>
              <button
                onClick={() => setActiveSubTab('lotes')}
                className={`px-4 py-3 text-xs font-extrabold uppercase tracking-wider border-b-2 transition-all flex items-center gap-2 ${
                  activeSubTab === 'lotes'
                    ? 'border-primary text-primary dark:border-[#e2bd6c] dark:text-[#e2bd6c]'
                    : 'border-transparent text-outline dark:text-gray-400 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-base">analytics</span>
                Lotes de Compra e Inversión ({lotesDeCompra.length})
              </button>
            </div>

            {/* Buscador dentro del historial */}
            {activeSubTab === 'kardex' && (
              <div className="hidden sm:flex items-center relative mb-2">
                <span className="material-symbols-outlined absolute left-3 text-xs text-outline dark:text-gray-400">search</span>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filtrar movimientos..."
                  className="bg-surface-container-lowest dark:bg-[#181818] border border-outline-variant/20 dark:border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] dark:text-white w-48"
                />
              </div>
            )}
          </div>

          {/* ── CONTENIDO 1: KARDEX DE MOVIMIENTOS ── */}
          {activeSubTab === 'kardex' && (
            <div className="p-5 space-y-4">
              
              {/* Chips de Filtro */}
              <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: 'todos', label: `Todos (${filterCounts.todos})`, cls: 'bg-primary text-on-primary dark:bg-[#e2bd6c] dark:text-black' },
                  { id: 'entradas', label: `Entradas (+) (${filterCounts.entradas})`, cls: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-black' },
                  { id: 'salidas', label: `Salidas (-) (${filterCounts.salidas})`, cls: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-black' },
                  { id: 'ventas', label: `Ventas 🟢 (${filterCounts.ventas})`, cls: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300' },
                  { id: 'reposicion', label: `Reposiciones 🔵 (${filterCounts.reposicion})`, cls: 'bg-blue-500/20 text-blue-700 dark:text-blue-300' },
                  { id: 'mermas', label: `Mermas 🔴 (${filterCounts.mermas})`, cls: 'bg-rose-500/20 text-rose-700 dark:text-rose-300' },
                ].map(filter => (
                  <button
                    key={filter.id}
                    onClick={() => setHistoryFilter(filter.id)}
                    className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider border transition-all whitespace-nowrap ${
                      historyFilter === filter.id
                        ? `${filter.cls} border-transparent shadow-sm scale-105`
                        : 'bg-surface-container dark:bg-white/5 text-outline dark:text-gray-400 border-outline-variant/20 dark:border-white/5 hover:border-primary/30'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              {/* Lista de Registros Kardex */}
              {isLoading ? (
                <div className="text-center py-16 text-outline animate-pulse text-sm font-medium">Cargando trazabilidad de stock...</div>
              ) : filteredKardexLogs.length === 0 ? (
                <div className="text-center py-16">
                  <span className="material-symbols-outlined text-4xl text-outline/30 mb-2">history_toggle_off</span>
                  <p className="text-outline text-xs font-semibold">No se encontraron movimientos registrados para los filtros seleccionados.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredKardexLogs.map(log => {
                    const cant = Number(log.cambio) || 0
                    const isPositive = cant > 0
                    const accionStr = (log.accion || '').toLowerCase()
                    const motivoStr = (log.motivo || '').toLowerCase()

                    let badge = { 
                      label: 'AJUSTE MANUAL', 
                      color: 'bg-amber-500/15 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border-amber-500/30', 
                      dot: '🟡', 
                      icon: 'tune',
                      textColor: 'text-amber-600 dark:text-amber-400'
                    }

                    if (log.esPedidoReal || accionStr.includes('pedido') || motivoStr.includes('pedido') || accionStr.includes('venta') || motivoStr.includes('venta')) {
                      badge = { 
                        label: motivoStr.includes('no registrada') ? 'VENTA RÁPIDA' : 'VENTA EN PEDIDO', 
                        color: 'bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300 border-emerald-500/30', 
                        dot: '🟢', 
                        icon: 'shopping_cart',
                        textColor: 'text-emerald-600 dark:text-emerald-400'
                      }
                    } else if (motivoStr.includes('devolución') || motivoStr.includes('devolucion') || motivoStr.includes('cancel') || accionStr.includes('devolución')) {
                      badge = { 
                        label: 'DEVOLUCIÓN', 
                        color: 'bg-purple-500/15 text-purple-700 dark:bg-purple-500/25 dark:text-purple-300 border-purple-500/30', 
                        dot: '🟣', 
                        icon: 'assignment_return',
                        textColor: 'text-purple-600 dark:text-purple-400'
                      }
                    } else if (motivoStr.includes('regalo') || motivoStr.includes('muestra') || motivoStr.includes('promocional')) {
                      badge = { 
                        label: 'REGALO / MUESTRA', 
                        color: 'bg-pink-500/15 text-pink-700 dark:bg-pink-500/25 dark:text-pink-300 border-pink-500/30', 
                        dot: '🎁', 
                        icon: 'card_giftcard',
                        textColor: 'text-pink-600 dark:text-pink-400'
                      }
                    } else if (log.esMermaReal || motivoStr.includes('merma') || motivoStr.includes('dañad') || motivoStr.includes('rotura') || motivoStr.includes('pérdida') || motivoStr.includes('perdida')) {
                      const lbl = log.motivoMerma ? `MERMA / DAÑADO (${log.motivoMerma.toUpperCase()})` : 'MERMA / DAÑADO'
                      badge = { 
                        label: lbl, 
                        color: 'bg-rose-500/15 text-rose-700 dark:bg-rose-500/25 dark:text-rose-300 border-rose-500/30', 
                        dot: '🔴', 
                        icon: 'do_not_disturb_on',
                        textColor: 'text-rose-600 dark:text-rose-400'
                      }
                    } else if (motivoStr.includes('proveedor') || motivoStr.includes('reposición') || motivoStr.includes('reposicion') || motivoStr.includes('compra') || accionStr.includes('creación') || accionStr.includes('inicial') || motivoStr.includes('inicial') || (isPositive && !motivoStr.includes('manual'))) {
                      badge = { 
                        label: 'REPOSICIÓN DE STOCK', 
                        color: 'bg-blue-500/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300 border-blue-500/30', 
                        dot: '🔵', 
                        icon: 'local_shipping',
                        textColor: 'text-blue-600 dark:text-blue-400'
                      }
                    }

                    return (
                      <div
                        key={log.id}
                        onClick={() => {
                          if (log.esPedidoReal && log.pedidoId) {
                            const shortCode = log.pedidoId.slice(-5)
                            navigate('/pedidos', { state: { search: `#${shortCode}`, pedidoId: log.pedidoId } })
                          }
                        }}
                        className={`bg-surface-container-lowest dark:bg-white/[0.03] border border-outline-variant/20 dark:border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-sm transition-all ${
                          log.esPedidoReal 
                            ? 'cursor-pointer hover:border-emerald-500/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/10 group' 
                            : 'hover:border-primary/20'
                        }`}
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${badge.color}`}>
                            <span className="material-symbols-outlined text-xl">{badge.icon}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 ${badge.color}`}>
                                <span>{badge.dot}</span>
                                <span>{badge.label}</span>
                              </span>
                              <span className="text-[10px] text-outline dark:text-gray-400 font-bold tracking-wider">
                                {formatDateDMA(log.fecha, log)}
                              </span>
                            </div>

                            <div className="text-xs font-semibold text-on-surface dark:text-white/90 truncate flex items-center gap-1.5 flex-wrap">
                              {log.esPedidoReal ? (
                                <>
                                  <span>Pedido</span>
                                  <span className="font-mono text-[11px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded font-extrabold flex items-center gap-0.5 group-hover:bg-emerald-500 group-hover:text-white transition-all shadow-sm">
                                    #{log.pedidoId ? log.pedidoId.slice(-5) : ''}
                                    <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                                  </span>
                                  <span>de {log.cliente || 'Cliente'} • {Math.abs(cant)} un.</span>
                                </>
                              ) : (
                                log.motivo || log.accion || 'Movimiento de stock registrado'
                              )}
                            </div>

                            {isPositive && (
                              <div className="mt-1 flex items-center gap-2 text-[10px] font-extrabold text-blue-600 dark:text-blue-400 flex-wrap">
                                <span>Costo: ${(Number(log.precioCosto) || Number(selectedProduct?.precioCosto) || 0).toLocaleString('es-CL')} c/u</span>
                                <span>•</span>
                                <span>Total Lote: ${((cant) * (Number(log.precioCosto) || Number(selectedProduct?.precioCosto) || 0)).toLocaleString('es-CL')}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <p className={`text-lg font-black ${badge.textColor}`}>
                              {isPositive ? '+' : ''}{cant}
                            </p>
                            <p className="text-[9px] text-outline dark:text-gray-400 font-bold uppercase tracking-wider">
                              {log.esPedidoReal ? 'Estado' : 'Stock'}: <span className="font-bold text-on-surface dark:text-white">{log.stockNuevo}</span>
                            </p>
                          </div>

                          {!log.esPedidoReal && !log.esMermaReal && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteLog(log); }}
                              className="w-8 h-8 rounded-full hover:bg-error/10 flex items-center justify-center text-error opacity-40 hover:opacity-100 transition-all"
                              title="Eliminar este registro"
                            >
                              <span className="material-symbols-outlined text-base">delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── CONTENIDO 2: LOTES DE COMPRA E INVERSIÓN ── */}
          {activeSubTab === 'lotes' && (
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-bold text-outline dark:text-gray-400 uppercase tracking-wider">
                  Historial de compras de proveedor e inversión realizada por lote
                </p>
              </div>

              {lotesDeCompra.length === 0 ? (
                <div className="text-center py-16">
                  <span className="material-symbols-outlined text-4xl text-outline/30 mb-2">analytics</span>
                  <p className="text-outline text-xs font-semibold">No se registran lotes de compra para este producto.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-outline-variant/20 dark:border-white/10">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-surface-container-high dark:bg-[#252525] text-outline dark:text-gray-400 font-extrabold uppercase tracking-wider text-[9px]">
                        <th className="py-3 px-4">Fecha Compra</th>
                        <th className="py-3 px-4">Tipo / Origen</th>
                        <th className="py-3 px-4 text-center">Unidades</th>
                        <th className="py-3 px-4 text-right">Costo Unit.</th>
                        <th className="py-3 px-4 text-right">Gasto Lote</th>
                        <th className="py-3 px-4 text-right">Suma Acumulada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 dark:divide-white/5 font-semibold">
                      {lotesDeCompra.map((lote, index) => (
                        <tr key={lote.id || index} className="hover:bg-surface-container-low dark:hover:bg-white/5 transition-colors">
                          <td className="py-3 px-4 text-on-surface dark:text-white font-bold whitespace-nowrap">
                            {formatDateDMA(lote.fecha, lote)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                              {lote.tipoTag}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center text-blue-600 dark:text-blue-400 font-black">
                            +{lote.cant} un.
                          </td>
                          <td className="py-3 px-4 text-right text-outline dark:text-gray-300">
                            ${lote.costUnit.toLocaleString('es-CL')}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-on-surface dark:text-white">
                            ${lote.totalLote.toLocaleString('es-CL')}
                          </td>
                          <td className="py-3 px-4 text-right font-black text-primary dark:text-[#e2bd6c]">
                            ${lote.sumaAcumulada.toLocaleString('es-CL')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

      </div>

      <Footer />
    </div>
  )
}
