import { useState, useEffect, Fragment, useRef } from 'react'
import { collection, onSnapshot, addDoc, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { calcularEstado } from '../utils/date'
import Footer from '../components/Footer'

const formInicial = { 
  cliente: '', 
  fechaEntrega: '', 
  productosSeleccionados: [],
  pagoEstado: 'sin pagar', // 'pagado', 'sin pagar', 'parcial'
  medioPago: 'transferencia', // 'transferencia', 'tarjeta', 'cuota', 'efectivo'
  abono: 0,
  banco: '',
  comprobante: '',
  esVentaOnline: false,
  canalVenta: ''
}

const getCanalColor = (canal) => {
  if (!canal) return 'bg-amber-500/10 text-amber-600';
  const c = canal.toLowerCase();
  if (c.includes('facebook')) return 'bg-[#1877F2]/10 text-[#1877F2]';
  if (c.includes('whatsapp')) return 'bg-[#25D366]/10 text-[#25D366]';
  if (c.includes('instagram')) return 'bg-[#E1306C]/10 text-[#E1306C]';
  if (c.includes('jumbo')) return 'bg-green-500/10 text-green-600';
  return 'bg-amber-500/10 text-amber-600';
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

const groupOrdersByCustomer = (ordersList) => {
  const groups = {};
  const orderedKeys = [];
  
  ordersList.forEach(p => {
    const name = (p.cliente || 'Desconocido').trim();
    const key = name.toLowerCase();
    if (!groups[key]) {
      groups[key] = {
        id: key,
        cliente: name,
        pedidos: []
      };
      orderedKeys.push(key);
    }
    groups[key].pedidos.push(p);
  });
  
  return orderedKeys.map(k => groups[k]);
};

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(formInicial)
  const [errorMsg, setErrorMsg] = useState('')
  const [showProdDropdown, setShowProdDropdown] = useState(false)
  const [busquedaProd, setBusquedaProd] = useState('')
  const [expandedId, setExpandedId] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [originalProductos, setOriginalProductos] = useState([])
  const [activeTab, setActiveTab] = useState('pedidos') // 'pedidos' o 'clientes'
  const [showClienteDropdown, setShowClienteDropdown] = useState(false)
  const [busquedaCanal, setBusquedaCanal] = useState('')
  const [showCanalDropdown, setShowCanalDropdown] = useState(false)
  
  // Estados para secciones colapsables y paginación
  const [sectionsOpen, setSectionsOpen] = useState({
    pendientes: true,
    abonados: true,
    finalizados: true
  })
  const [pagePendientes, setPagePendientes] = useState(1)
  const [pageAbonados, setPageAbonados] = useState(1)
  const [pageFinalizados, setPageFinalizados] = useState(1)
  const [pageClientes, setPageClientes] = useState(1)
  const [busquedaClientes, setBusquedaClientes] = useState('')
  const [expandedCliente, setExpandedCliente] = useState(null)
  const [expandedCustomer, setExpandedCustomer] = useState(null)

  const renderPaginationControls = (currentPage, totalItems, setPage) => {
    const itemsPerPage = 20;
    const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 pb-2 border-t border-outline-variant/10 dark:border-white/5 mt-4">
        <span className="text-xs text-outline dark:text-gray-400 font-medium">
          Mostrando <span className="font-semibold text-on-surface dark:text-white">{Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(totalItems, currentPage * itemsPerPage)}</span> de <span className="font-semibold text-on-surface dark:text-white">{totalItems}</span> pedidos
        </span>
        
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="p-2 rounded-lg border border-outline-variant/20 dark:border-white/10 text-outline dark:text-gray-400 hover:bg-surface-container-high dark:hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            title="Página Anterior"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {startPage > 1 && (
            <>
              <button
                onClick={() => setPage(1)}
                className={`min-w-[36px] h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                  currentPage === 1
                    ? 'bg-[#e2bd6c] text-black font-bold shadow-md shadow-[#e2bd6c]/20'
                    : 'text-outline dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                1
              </button>
              {startPage > 2 && (
                <span className="px-1 text-outline dark:text-gray-500 select-none text-xs">...</span>
              )}
            </>
          )}

          {pages.map((p) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`min-w-[36px] h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                currentPage === p
                  ? 'bg-[#e2bd6c] text-black font-bold shadow-md shadow-[#e2bd6c]/20'
                  : 'text-outline dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-white/5 border border-transparent'
              }`}
            >
              {p}
            </button>
          ))}

          {endPage < totalPages && (
            <>
              {endPage < totalPages - 1 && (
                <span className="px-1 text-outline dark:text-gray-500 select-none text-xs">...</span>
              )}
              <button
                onClick={() => setPage(totalPages)}
                className={`min-w-[36px] h-9 flex items-center justify-center text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                  currentPage === totalPages
                    ? 'bg-[#e2bd6c] text-black font-bold shadow-md shadow-[#e2bd6c]/20'
                    : 'text-outline dark:text-gray-300 hover:bg-surface-container-high dark:hover:bg-white/5 border border-transparent'
                }`}
              >
                {totalPages}
              </button>
            </>
          )}

          <button
            onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="p-2 rounded-lg border border-outline-variant/20 dark:border-white/10 text-outline dark:text-gray-400 hover:bg-surface-container-high dark:hover:bg-white/5 disabled:opacity-40 disabled:hover:bg-transparent transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
            title="Página Siguiente"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    );
  };
  
  // Nuevo estado para diálogos personalizados
  const [dialog, setDialog] = useState({
    show: false,
    title: '',
    message: '',
    confirmLabel: 'Confirmar',
    onConfirm: null,
    isPrompt: false,
    promptValue: '',
    placeholder: ''
  })

  function closeDialog() {
    setDialog({ ...dialog, show: false })
  }

  // Lógica para Clientes Frecuentes y Sugerencias
  const clientesData = pedidos.reduce((acc, p) => {
    const nombre = (p.cliente || 'Desconocido').trim()
    if (!acc[nombre]) {
      acc[nombre] = { nombre, pedidosCount: 0, totalGastado: 0, ultimaCompra: p.fechaEntrega, compras: [] }
    }
    acc[nombre].pedidosCount += 1
    acc[nombre].totalGastado += p.total || 0
    if (new Date(p.fechaEntrega) > new Date(acc[nombre].ultimaCompra)) {
      acc[nombre].ultimaCompra = p.fechaEntrega
    }
    acc[nombre].compras.push({
      id: p.id,
      fecha: p.fechaEntrega,
      total: p.total,
      productos: p.productos || [],
      pagoEstado: p.pagoEstado || 'sin pagar'
    })
    return acc
  }, {})

  // Ordenar las compras de cada cliente de la más reciente a la más antigua
  Object.values(clientesData).forEach(c => {
    c.compras.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
  })

  const sortedClientes = Object.values(clientesData).sort((a, b) => b.pedidosCount - a.pedidosCount)

  const canalesBase = ['Facebook', 'Instagram', 'WhatsApp', 'TikTok']
  const canalesExistentes = Array.from(new Set(pedidos.filter(p => p.canalVenta).map(p => p.canalVenta)))
  const canalesDisponibles = Array.from(new Set([...canalesBase, ...canalesExistentes]))

  // --- Back button closing for mobile/browser history ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (showModal) {
        setShowModal(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showModal]);

  const wasModalOpenRef = useRef(false);

  useEffect(() => {
    if (showModal && !wasModalOpenRef.current) {
      window.history.pushState({ modalOpen: true }, '');
      wasModalOpenRef.current = true;
    } else if (!showModal && wasModalOpenRef.current) {
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
      wasModalOpenRef.current = false;
    }
  }, [showModal]);

  useEffect(() => {
    // Escuchar productos
    const unsubProd = onSnapshot(collection(db, 'productos'), (snapshot) => {
      setProductos(snapshot.docs.map(d => ({ id: d.id, ...d.data() })))
    })
    // Escuchar pedidos
    const unsubPed = onSnapshot(collection(db, 'pedidos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Ordenar por fecha de entrega más próxima
      data.sort((a, b) => new Date(a.fechaEntrega) - new Date(b.fechaEntrega))
      setPedidos(data)
    })
    return () => { unsubProd(); unsubPed(); }
  }, [])

  function openNew() {
    setForm(formInicial)
    setEditingId(null)
    setOriginalProductos([])
    setErrorMsg('')
    setShowModal(true)
  }

  function handleEdit(pedido) {
    setForm({
      cliente: pedido.cliente,
      fechaEntrega: pedido.fechaEntrega,
      productosSeleccionados: pedido.productos.map(p => {
        // Encontrar el producto en la lista maestra para saber el stock actual real
        const pMaestro = productos.find(pm => pm.id === p.productoId);
        let stockOriginal = pMaestro ? pMaestro.stock : p.cantidad;
        
        // Si tiene variante, buscar el stock de esa variante
        if (p.variante && pMaestro?.variantes) {
          const v = pMaestro.variantes.find(v => v.nombre === p.variante);
          if (v) stockOriginal = v.stock;
        }

        return {
          ...p,
          stockOriginal: stockOriginal // Stock disponible ahora
        };
      }),
      pagoEstado: pedido.pagoEstado || 'sin pagar',
      medioPago: pedido.medioPago || 'transferencia',
      abono: pedido.abono || 0,
      banco: pedido.banco || '',
      comprobante: pedido.comprobante || '',
      esVentaOnline: pedido.esVentaOnline || false,
      canalVenta: pedido.canalVenta || ''
    });
    setEditingId(pedido.id);
    setOriginalProductos(JSON.parse(JSON.stringify(pedido.productos))); // Copia profunda
    setErrorMsg('');
    setShowModal(true);
  }

  function handleAddProduct(productoId, varianteNombre = null) {
    if (!productoId) return
    const prod = productos.find(p => p.id === productoId)
    
    if (!prod) return
    
    let stockDisp = prod.stock;
    if (varianteNombre && prod.variantes) {
      const v = prod.variantes.find(v => v.nombre === varianteNombre);
      if (v) stockDisp = v.stock;
    }

    if (stockDisp <= 0) {
      return setErrorMsg(`El producto ${prod.nombre} ${varianteNombre ? `(${varianteNombre})` : ''} no tiene stock disponible.`)
    }

    const yaExiste = form.productosSeleccionados.find(p => p.productoId === productoId && (p.variante || null) === (varianteNombre || null))
    if (yaExiste) return
    
    setForm({
      ...form, 
      productosSeleccionados: [...form.productosSeleccionados, { 
        productoId: prod.id, 
        nombre: prod.nombre, 
        variante: varianteNombre,
        cantidad: 1, 
        precio: prod.precio || 0,
        stockOriginal: stockDisp 
      }]
    })
    setErrorMsg('')
  }

  function handleRemoveProduct(productoId, varianteNombre = null) {
    setForm(prev => ({
      ...prev,
      productosSeleccionados: prev.productosSeleccionados.filter(p => 
        !(p.productoId === productoId && (p.variante || null) === (varianteNombre || null))
      )
    }))
  }

  function handleQuantityChange(productoId, varianteNombre, cantidad) {
    const qty = Number(cantidad)
    const prodRef = form.productosSeleccionados.find(p => p.productoId === productoId && (p.variante || null) === (varianteNombre || null))
    
    if (!prodRef) return;

    // Al editar, el "stock disponible" es el stock actual del maestro + lo que ya teníamos reservado en este pedido
    const originalItem = originalProductos.find(op => op.productoId === productoId && (op.variante || null) === (varianteNombre || null));
    const originalQty = originalItem?.cantidad || 0;
    const stockDisponibleTotal = prodRef.stockOriginal + (editingId ? originalQty : 0);

    if (qty > stockDisponibleTotal) {
      return setErrorMsg(`Stock insuficiente para ${prodRef.nombre} ${varianteNombre ? `(${varianteNombre})` : ''}. Máximo: ${stockDisponibleTotal}`)
    }
    setErrorMsg('')
    setForm({
      ...form,
      productosSeleccionados: form.productosSeleccionados.map(p => 
        (p.productoId === productoId && p.variante === varianteNombre) ? { ...p, cantidad: qty } : p
      )
    })
  }

  async function handleSave() {
    setErrorMsg('')
    const isNombreValido = form.esVentaOnline ? true : form.cliente.trim() !== '';
    
    if (!isNombreValido || !form.fechaEntrega || form.productosSeleccionados.length === 0) {
      return setErrorMsg('La fecha de entrega y al menos un producto son obligatorios.' + (!isNombreValido ? ' El nombre del cliente es obligatorio para ventas presenciales.' : ''))
    }

    // Validación estricta final de stock antes de descontar
    for (const item of form.productosSeleccionados) {
      if (item.cantidad <= 0) {
        return setErrorMsg(`La cantidad de ${item.nombre} ${item.variante ? `(${item.variante})` : ''} debe ser mayor a 0.`)
      }
      const pData = productos.find(p => p.id === item.productoId)
      
      // Cuando editamos, el stock "disponible" es: stock_maestro + cantidad_previa_en_este_pedido
      let stockDisponible = 0;
      if (pData) {
        if (item.variante && pData.variantes) {
          const v = pData.variantes.find(v => v.nombre === item.variante);
          stockDisponible = v ? v.stock : 0;
        } else {
          stockDisponible = pData.stock;
        }
      }

      if (editingId) {
        const itemPrevio = originalProductos.find(p => p.productoId === item.productoId && p.variante === item.variante);
        if (itemPrevio) {
          stockDisponible += itemPrevio.cantidad;
        }
      }

      if (!pData || stockDisponible < item.cantidad) {
        return setErrorMsg(`Stock insuficiente de ${item.nombre} ${item.variante ? `(${item.variante})` : ''} en este momento. Tienes ${stockDisponible} libres.`)
      }
    }

    try {
      const batch = writeBatch(db)

      // 1. Manejar Stock (Inventario)
      const productosMap = {}; // productoId -> { stock: number, variantes: [] }

      // Inicializar el mapa con los productos involucrados (los actuales y los previos si editamos)
      const idsInvolucrados = new Set([
        ...form.productosSeleccionados.map(p => p.productoId),
        ...(editingId ? originalProductos.map(p => p.productoId) : [])
      ]);

      for (const id of idsInvolucrados) {
        const pM = productos.find(p => p.id === id);
        if (pM) {
          productosMap[id] = { 
            stock: Number(pM.stock), 
            variantes: pM.variantes ? JSON.parse(JSON.stringify(pM.variantes)) : null 
          };
        }
      }

      if (editingId) {
        // Primero: "Devolver" virtualmente el stock que estaba reservado antes
        for (const oldItem of originalProductos) {
          const pData = productosMap[oldItem.productoId];
          if (pData) {
            pData.stock += oldItem.cantidad;
            if (oldItem.variante && pData.variantes) {
              const v = pData.variantes.find(v => (v.nombre || null) === (oldItem.variante || null));
              if (v) v.stock = Number(v.stock) + oldItem.cantidad;
            }
          }
        }
        // Segundo: Restar el nuevo stock solicitado
        for (const newItem of form.productosSeleccionados) {
          const pData = productosMap[newItem.productoId];
          if (pData) {
            pData.stock -= newItem.cantidad;
            if (newItem.variante && pData.variantes) {
              const v = pData.variantes.find(v => (v.nombre || null) === (newItem.variante || null));
              if (v) v.stock = Number(v.stock) - newItem.cantidad;
            }
          }
        }
      } else {
        // Pedido nuevo: solo restar
        for (const item of form.productosSeleccionados) {
          const pData = productosMap[item.productoId];
          if (pData) {
            pData.stock -= item.cantidad;
            if (item.variante && pData.variantes) {
              const v = pData.variantes.find(v => (v.nombre || null) === (item.variante || null));
              if (v) v.stock = Number(v.stock) - item.cantidad;
            }
          }
        }
      }

      // Aplicar todos los cambios consolidados al batch
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

      // 2. Crear o Actualizar Pedido
      const total = form.productosSeleccionados.reduce((acc, p) => acc + (p.cantidad * p.precio), 0);
      const abonoNum = Number(form.abono) || 0;
      
      const pedidoData = {
        cliente: form.cliente.trim() || (form.esVentaOnline ? (form.canalVenta || 'Venta Online') : ''),
        fechaEntrega: form.fechaEntrega,
        productos: form.productosSeleccionados.map(p => ({
          productoId: p.productoId,
          nombre: p.nombre,
          variante: p.variante || null,
          cantidad: p.cantidad,
          precio: p.precio
        })),
        pagoEstado: form.pagoEstado,
        medioPago: form.medioPago,
        total: total,
        abono: abonoNum,
        saldoPendiente: total - abonoNum,
        banco: form.medioPago === 'transferencia' ? form.banco : '',
        comprobante: form.medioPago === 'transferencia' ? form.comprobante : '',
        esVentaOnline: form.esVentaOnline,
        canalVenta: form.esVentaOnline ? form.canalVenta : '',
        estado: 'pendiente'
      };

      if (editingId) {
        const pedidoRef = doc(db, 'pedidos', editingId);
        batch.update(pedidoRef, pedidoData);
      } else {
        const pedidoRef = doc(collection(db, 'pedidos'));
        batch.set(pedidoRef, {
          ...pedidoData,
          historialAbonos: abonoNum > 0 ? [{ fecha: new Date().toISOString(), monto: abonoNum }] : [],
          fechaCreacion: new Date().toISOString()
        });
      }

      await batch.commit()
      setShowModal(false)
      setEditingId(null)
    } catch (e) {
      setErrorMsg('Error al guardar pedido: ' + e.message)
    }
  }

  async function handleCompletarPago(pedido) {
    if (!pedido || !pedido.id) return
    
    setDialog({
      show: true,
      title: 'Confirmar Pago Total',
      message: `¿Confirmas que el pedido de ${pedido.cliente} ha sido pagado en su totalidad?`,
      confirmLabel: 'Sí, Marcar como Pagado',
      onConfirm: async () => {
        try {
          const ref = doc(db, 'pedidos', pedido.id)
          const totalCalc = pedido.total || (pedido.productos || []).reduce((acc, p) => acc + (p.cantidad * (p.precio || 0)), 0)
          const montoFaltante = totalCalc - (pedido.abono || 0)
          const historial = pedido.historialAbonos || []
          if (montoFaltante > 0) {
            historial.push({ fecha: new Date().toISOString(), monto: montoFaltante, nota: 'Liquidación Total' })
          }

          await updateDoc(ref, {
            pagoEstado: 'pagado',
            abono: totalCalc,
            saldoPendiente: 0,
            total: totalCalc,
            historialAbonos: historial
          })
          closeDialog()
        } catch (e) {
          console.error(e)
          alert('Error: ' + e.message)
        }
      }
    })
  }

  async function handleActualizarAbono(pedido) {
    if (!pedido || !pedido.id) return
    const totalCalc = pedido.total || (pedido.productos || []).reduce((acc, p) => acc + (p.cantidad * (p.precio || 0)), 0)
    
    setDialog({
      show: true,
      isPrompt: true,
      title: 'Actualizar Abono',
      message: `Ingresa el NUEVO MONTO TOTAL que el cliente ha entregado hasta ahora.\n(Total del pedido: $${totalCalc.toLocaleString('es-CL')})`,
      promptValue: pedido.abono.toString(),
      placeholder: 'Ej: 5000',
      confirmLabel: 'Guardar Abono',
      onConfirm: async (valor) => {
        const montoNum = Number(valor)
        if (isNaN(montoNum) || montoNum < 0) return alert('Ingresa un monto válido.')
        if (montoNum > totalCalc) return alert('El abono no puede ser mayor al total.')

        try {
          const ref = doc(db, 'pedidos', pedido.id)
          const isFull = montoNum === totalCalc
          const incremento = montoNum - (pedido.abono || 0)
          const historial = pedido.historialAbonos || []
          
          if (incremento > 0) {
            historial.push({ fecha: new Date().toISOString(), monto: incremento, nota: 'Abono Parcial' })
          } else if (incremento < 0) {
            historial.push({ fecha: new Date().toISOString(), monto: incremento, nota: 'Corrección / Devolución' })
          }

          await updateDoc(ref, {
            abono: montoNum,
            saldoPendiente: totalCalc - montoNum,
            pagoEstado: isFull ? 'pagado' : 'parcial',
            total: totalCalc,
            historialAbonos: historial
          })
          closeDialog()
        } catch (e) {
          console.error(e)
        }
      }
    })
  }

  async function handleDelete(pedido) {
    if (!pedido || !pedido.id) return
    
    setDialog({
      show: true,
      title: '¿Eliminar Pedido?',
      message: `¿Estás seguro de eliminar el pedido de ${pedido.cliente}? Los productos (${pedido.productos?.length || 0}) se devolverán al stock.`,
      confirmLabel: 'Sí, Eliminar y Devolver Stock',
      onConfirm: async () => {
        try {
          const batch = writeBatch(db)
          // 1. Consolidar Stock (Inventario) para devolver
          const productosMap = {}; // productoId -> { stock: number, variantes: [] }
          const productosList = pedido.productos || []

          for (const item of productosList) {
            if (!productosMap[item.productoId]) {
              const pM = productos.find(p => p.id === item.productoId);
              if (pM) {
                productosMap[item.productoId] = {
                  stock: Number(pM.stock),
                  variantes: pM.variantes ? JSON.parse(JSON.stringify(pM.variantes)) : null
                };
              }
            }

            const pData = productosMap[item.productoId];
            if (pData) {
              pData.stock += Number(item.cantidad);
              if (item.variante && pData.variantes) {
                const v = pData.variantes.find(v => (v.nombre || null) === (item.variante || null));
                if (v) v.stock = Number(v.stock) + Number(item.cantidad);
              }
            }
          }

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
          batch.delete(doc(db, 'pedidos', pedido.id))
          await batch.commit()
          closeDialog()
        } catch (e) {
          console.error(e)
          alert('Error: ' + e.message)
        }
      }
    })
  }

  async function handleEliminarAbono(pedido, abonoIndex) {
    if (!pedido || !pedido.id || !pedido.historialAbonos) return;
    
    setDialog({
      show: true,
      title: '¿Eliminar Abono?',
      message: '¿Estás seguro de eliminar este registro de abono? Se recalculará el total abonado y el saldo pendiente.',
      confirmLabel: 'Sí, Eliminar Abono',
      onConfirm: async () => {
        try {
          const historial = [...pedido.historialAbonos];
          historial.splice(abonoIndex, 1);
          
          const nuevoAbonoTotal = historial.reduce((acc, curr) => acc + curr.monto, 0);
          const totalCalc = pedido.total || pedido.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
          const isFull = nuevoAbonoTotal >= totalCalc;
          
          const ref = doc(db, 'pedidos', pedido.id);
          await updateDoc(ref, {
            abono: nuevoAbonoTotal,
            saldoPendiente: Math.max(0, totalCalc - nuevoAbonoTotal),
            pagoEstado: nuevoAbonoTotal === 0 ? 'sin pagar' : (isFull ? 'pagado' : 'parcial'),
            historialAbonos: historial
          });
          closeDialog();
        } catch (e) {
          console.error(e);
          alert('Error al eliminar abono: ' + e.message);
        }
      }
    });
  }

  function generarRecordatorio(pedido) {
    // Formato YYYYMMDDTHHmmssZ
    const startDate = new Date(pedido.fechaEntrega + 'T09:00:00').toISOString().replace(/-|:|\.\d\d\d/g, "")
    const endDate = new Date(pedido.fechaEntrega + 'T10:00:00').toISOString().replace(/-|:|\.\d\d\d/g, "")

    const resumen = `Entrega de Pedido Leis - ${pedido.cliente}`
    const desc = `Entrega programada para:\n${pedido.productos.map(p => `- ${p.cantidad}x ${p.nombre}`).join('\n')}`

    const icsContent = 
`BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Leis Inventario//ES
BEGIN:VEVENT
UID:${pedido.id}@leis.inventario
DTSTAMP:${new Date().toISOString().replace(/-|:|\.\d\d\d/g, "")}
DTSTART:${startDate}
DTEND:${endDate}
SUMMARY:${resumen}
DESCRIPTION:${desc}
BEGIN:VALARM
TRIGGER:-P3D
ACTION:DISPLAY
DESCRIPTION:Recordatorio 3 dias antes
END:VALARM
BEGIN:VALARM
TRIGGER:-PT1H
ACTION:DISPLAY
DESCRIPTION:Recordatorio 1 hora antes
END:VALARM
END:VEVENT
END:VCALENDAR`

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', `pedido_${pedido.cliente.replace(/\s+/g, '_')}.ics`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Filtrar y ordenar los pedidos para evitar desajustes en la paginación
  const listPendientes = pedidos.filter(p => p.pagoEstado === 'sin pagar' || !p.pagoEstado);
  const listAbonados = pedidos.filter(p => p.pagoEstado === 'parcial');
  const listFinalizados = pedidos.filter(p => p.pagoEstado === 'pagado');

  const groupedPendientes = groupOrdersByCustomer(listPendientes);
  const groupedAbonados = groupOrdersByCustomer(listAbonados);
  const groupedFinalizados = groupOrdersByCustomer(listFinalizados);

  const safePagePendientes = Math.max(1, Math.min(pagePendientes, Math.ceil(groupedPendientes.length / 20) || 1));
  const safePageAbonados = Math.max(1, Math.min(pageAbonados, Math.ceil(groupedAbonados.length / 20) || 1));
  const safePageFinalizados = Math.max(1, Math.min(pageFinalizados, Math.ceil(groupedFinalizados.length / 20) || 1));

  const paginatedPendientes = groupedPendientes.slice((safePagePendientes - 1) * 20, safePagePendientes * 20);
  const paginatedAbonados = groupedAbonados.slice((safePageAbonados - 1) * 20, safePageAbonados * 20);
  const paginatedFinalizados = groupedFinalizados.slice((safePageFinalizados - 1) * 20, safePageFinalizados * 20);

  const filteredClientes = sortedClientes.filter(c => 
    c.nombre.toLowerCase().includes(busquedaClientes.toLowerCase())
  );
  const safePageClientes = Math.max(1, Math.min(pageClientes, Math.ceil(filteredClientes.length / 20) || 1));
  const paginatedClientes = filteredClientes.slice((safePageClientes - 1) * 20, safePageClientes * 20);

  return (
    <div className="p-8 md:p-10 relative flex flex-col min-h-full overflow-y-auto transition-colors duration-500">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-surface/80 dark:bg-[#121212]/80 backdrop-blur-md px-8 md:px-10 py-8 flex flex-col items-center justify-center border-b border-outline-variant/20 dark:border-white/5">
        <div className="relative text-center mx-auto mb-6">
          <p className="font-label text-[10px] font-bold uppercase tracking-[0.3em] text-primary/60 dark:text-[#e2bd6c]/60 mb-2">Gestión y Entregas</p>
          <h1 className="font-headline text-5xl text-secondary dark:text-white italic leading-tight tracking-tighter luxe-reveal">Pedidos</h1>
          <div className="absolute left-1/2 -bottom-4 -translate-x-1/2 w-20 h-1 bg-gradient-to-r from-transparent via-primary/20 dark:via-[#e2bd6c]/20 to-transparent rounded-full" />
        </div>

        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="hidden md:block flex-1" /> {/* Espaciador para centrar las tabs si es necesario */}

        {/* TABS para navegar entre Pedidos e Historial de Clientes */}
        <div className="flex bg-surface-container-high dark:bg-white/5 p-1 rounded-2xl md:self-end self-start border border-outline-variant/10 dark:border-white/5">
          <button 
            onClick={() => setActiveTab('pedidos')}
            className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'pedidos' ? 'bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black shadow-md' : 'text-outline dark:text-gray-500 hover:bg-surface-variant dark:hover:bg-white/5'}`}
          >
            Ventas
          </button>
          <button 
            onClick={() => setActiveTab('clientes')}
            className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'clientes' ? 'bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black shadow-md' : 'text-outline dark:text-gray-500 hover:bg-surface-variant dark:hover:bg-white/5'}`}
          >
            Frecuentes
          </button>
        </div>

          <button onClick={openNew} className="flex items-center justify-center gap-2 bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black px-6 py-3.5 rounded-xl font-label font-extrabold uppercase text-[10px] tracking-widest shadow-lg hover:scale-105 active:scale-95 transition-all border border-secondary/20 dark:border-[#e2bd6c]/20">
            <span className="material-symbols-outlined text-sm">add_circle</span>
            Crear Pedido
          </button>
        </div>
      </header>

      <div className="space-y-20 flex-1 overflow-y-auto pt-8 md:pt-10">
        {activeTab === 'pedidos' ? (
          <>
        {/* 1. Pedidos Pendientes (Sin Pagar) */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div 
            onClick={() => setSectionsOpen(prev => ({ ...prev, pendientes: !prev.pendientes }))}
            className="flex items-center justify-between group select-none cursor-pointer hover:opacity-90 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-error/10 dark:bg-white/5 flex items-center justify-center shadow-sm border border-error/5 dark:border-white/5 transition-transform duration-300 group-hover:scale-105">
                <span className="material-symbols-outlined text-error text-2xl font-bold">priority_high</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-2xl font-bold text-on-surface dark:text-white/90 leading-tight">Pedidos Pendientes</h2>
                  <span className="bg-error/10 dark:bg-white/5 text-error dark:text-red-400 font-bold px-2 py-0.5 rounded-full text-xs transition-colors">
                    [ {listPendientes.length} ]
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline dark:text-gray-500">Sin ningún abono realizado</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary/5 dark:bg-white/5 flex items-center justify-center border border-outline-variant/10 dark:border-white/10 transition-transform duration-300">
              <span className={`material-symbols-outlined text-outline dark:text-gray-400 transition-transform duration-300 ${sectionsOpen.pendientes ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-error/20 via-outline-variant/10 dark:via-white/5 to-transparent mb-4" />
          
          {sectionsOpen.pendientes && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* Vista Desktop (Tabla) */}
              <div className="hidden md:block bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-sm border border-error/5 dark:border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-surface-container dark:bg-white/5">
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-500">Cliente</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-500">Fecha de Entrega</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-500">Total Pendiente</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline text-right dark:text-gray-500">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 dark:divide-white/5">
                      {paginatedPendientes.map(group => {
                        const fechas = group.pedidos.map(p => p.fechaEntrega).filter(Boolean);
                        const uniqueFechas = Array.from(new Set(fechas)).sort();
                        let fechaDisplay = "";
                        if (uniqueFechas.length === 1) {
                          fechaDisplay = uniqueFechas[0];
                        } else if (uniqueFechas.length > 1) {
                          fechaDisplay = `${uniqueFechas[0]} ... ${uniqueFechas[uniqueFechas.length - 1]}`;
                        } else {
                          fechaDisplay = "Sin fecha";
                        }

                        const totalDinero_acumulado = group.pedidos.reduce((acc, p) => acc + (p.total || p.productos.reduce((sum, pr) => sum + (pr.cantidad * (pr.precio || 0)), 0)), 0);

                        return (
                          <Fragment key={group.id}>
                            <tr 
                              className={`hover:bg-surface-container-high dark:hover:bg-white/5 transition-colors cursor-pointer ${expandedCustomer === group.id ? 'bg-surface-container-high dark:bg-white/10' : ''}`}
                              onClick={() => setExpandedCustomer(expandedCustomer === group.id ? null : group.id)}
                            >
                              <td className="px-7 py-5">
                                <div className="flex items-center gap-3">
                                  <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedCustomer === group.id ? 'rotate-180' : ''}`}>
                                    keyboard_arrow_down
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-headline font-bold text-base text-on-surface dark:text-[#e2bd6c]">{group.cliente}</p>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-error/10 text-error dark:bg-red-400/10 dark:text-red-400">
                                        {group.pedidos.length} {group.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-7 py-5">
                                <span className="font-bold text-on-surface-variant text-sm">{fechaDisplay}</span>
                              </td>
                              <td className="px-7 py-5">
                                <p className="text-sm font-bold text-error">${totalDinero_acumulado.toLocaleString('es-CL')}</p>
                              </td>
                              <td className="px-7 py-5 text-right">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-500 opacity-60">
                                  {expandedCustomer === group.id ? 'Colapsar' : 'Ver pedidos'}
                                </span>
                              </td>
                            </tr>
                            {expandedCustomer === group.id && (
                              <tr className="bg-surface-container-low/30 dark:bg-white/[0.01]">
                                <td colSpan={4} className="px-7 py-6">
                                  <div className="space-y-4">
                                    {group.pedidos.map(p => {
                                      const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
                                      const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1;
                                      const isCritico = diasFaltantes >= 0 && diasFaltantes <= 3;

                                      return (
                                        <div key={p.id} className="bg-surface dark:bg-[#1a1a1a] rounded-[24px] p-5 border border-outline-variant/15 dark:border-white/5 shadow-lg space-y-4">
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                              <span className={`material-symbols-outlined text-outline transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                                expand_more
                                              </span>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <p className="text-sm font-black text-on-surface dark:text-[#e2bd6c]">Pedido del {p.fechaEntrega}</p>
                                                  <span className="text-[8px] bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-primary dark:text-gray-400">
                                                    Vía {p.medioPago}
                                                  </span>
                                                  {p.canalVenta && (
                                                    <span className={`${getCanalColor(p.canalVenta)} px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                                                      <span className="material-symbols-outlined text-[10px]">location_on</span>
                                                      {p.canalVenta}
                                                    </span>
                                                  )}
                                                  {isCritico && (
                                                    <span className="bg-error/10 text-error px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider">
                                                      Entrega Próxima
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-6">
                                              <div className="text-right">
                                                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Total Pedido</p>
                                                <p className="text-sm font-bold text-error">${totalC.toLocaleString('es-CL')}</p>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <button onClick={() => handleEdit(p)} className="text-primary hover:bg-primary-container p-2 rounded-full transition-colors" title="Editar Pedido">
                                                  <span className="material-symbols-outlined text-xl">edit</span>
                                                </button>
                                                <button onClick={() => handleCompletarPago(p)} className="text-secondary hover:bg-secondary-container p-2 rounded-full transition-colors" title="Marcar como Pagado">
                                                  <span className="material-symbols-outlined text-xl">check_circle</span>
                                                </button>
                                                <button onClick={() => generarRecordatorio(p)} className="text-outline hover:bg-surface-container-high p-2 rounded-full transition-colors" title="Agendar Recordatorio">
                                                  <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                                                </button>
                                                <button onClick={() => handleDelete(p)} className="text-error opacity-50 hover:opacity-100 hover:bg-error-container p-2 rounded-full transition-colors" title="Eliminar Pedido">
                                                  <span className="material-symbols-outlined text-xl">delete</span>
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                          {expandedId === p.id && (
                                            <div className="mt-4 pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                              <div>
                                                <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary dark:text-[#e2bd6c]/80 mb-3">Detalle de Productos</h4>
                                                <div className="space-y-2">
                                                  {p.productos?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-surface-container-highest/20 dark:bg-white/[0.03] px-4 py-3 rounded-xl border border-outline-variant/5">
                                                      <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-primary font-black text-sm">{item.cantidad}x</span>
                                                          <span className="font-bold text-on-surface dark:text-white/90 text-sm">{item.nombre}</span>
                                                        </div>
                                                        {item.variante && (
                                                          <div className="flex items-center gap-1.5 mt-1 bg-amber-500/5 dark:bg-[#e2bd6c]/5 px-2 py-0.5 rounded-lg w-fit border border-amber-500/10 dark:border-[#e2bd6c]/10">
                                                            <div 
                                                              className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20 shadow-sm"
                                                              style={{ backgroundColor: getHexColor(item.variante) || '#ccc' }}
                                                            />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-[#e2bd6c]">
                                                              {item.variante}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                      <span className="font-black text-primary dark:text-[#e2bd6c] text-base">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>

                                              {p.comprobante && (
                                                <div className="mt-4 pt-4 border-t border-primary/10 dark:border-white/5">
                                                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-[#e2bd6c]">Datos de Transferencia</p>
                                                  <p className="text-sm text-on-surface-variant mt-1">
                                                    Banco: <span className="font-bold text-on-surface dark:text-white/90">{p.banco}</span> | 
                                                    Comprobante: <span className="font-bold text-on-surface dark:text-white/90">{p.comprobante}</span>
                                                  </p>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {groupedPendientes.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-7 py-12 text-center text-on-surface-variant text-sm italic">No hay pedidos pendientes de pago inicial.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Vista Mobile (Tarjetas) */}
              <div className="md:hidden space-y-4">
                {paginatedPendientes.map(group => {
                  const fechas = group.pedidos.map(p => p.fechaEntrega).filter(Boolean);
                  const uniqueFechas = Array.from(new Set(fechas)).sort();
                  let fechaDisplay = "";
                  if (uniqueFechas.length === 1) {
                    fechaDisplay = uniqueFechas[0];
                  } else if (uniqueFechas.length > 1) {
                    fechaDisplay = `${uniqueFechas[0]} ... ${uniqueFechas[uniqueFechas.length - 1]}`;
                  } else {
                    fechaDisplay = "Sin fecha";
                  }

                  const totalDinero_acumulado = group.pedidos.reduce((acc, p) => acc + (p.total || p.productos.reduce((sum, pr) => sum + (pr.cantidad * (pr.precio || 0)), 0)), 0);

                  return (
                    <div key={group.id} className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-[28px] p-5 shadow-sm border border-outline-variant/10 dark:border-white/5">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedCustomer(expandedCustomer === group.id ? null : group.id)}>
                        <div className="w-12 h-12 bg-error/10 rounded-2xl flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-error text-xl font-bold">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline font-bold text-base text-on-surface dark:text-[#e2bd6c] truncate">{group.cliente}</h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">
                            {group.pedidos.length} {group.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-outline">
                            <span className="material-symbols-outlined text-xs">event</span>
                            <span>Pendientes: {fechaDisplay}</span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="text-[9px] font-bold text-outline uppercase tracking-wider leading-none">Total</p>
                            <p className="text-sm font-bold text-error leading-tight">${totalDinero_acumulado.toLocaleString('es-CL')}</p>
                          </div>
                          <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedCustomer === group.id ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </div>
                      </div>
                      
                      {expandedCustomer === group.id && (
                        <div className="mt-4 pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          {group.pedidos.map(p => {
                            const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
                            const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1;
                            const isCritico = diasFaltantes >= 0 && diasFaltantes <= 3;
                            return (
                              <div key={p.id} className="bg-surface dark:bg-[#1a1a1a] rounded-[20px] p-4 border border-outline-variant/10 dark:border-white/5 shadow-sm space-y-3">
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                  <div>
                                    <p className="text-xs font-black text-on-surface dark:text-[#e2bd6c]">Pedido del {p.fechaEntrega}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="text-[8px] bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-primary dark:text-gray-400">
                                        {p.medioPago}
                                      </span>
                                      {p.canalVenta && (
                                        <span className={`px-2 py-0.5 rounded-full ${getCanalColor(p.canalVenta)} text-[8px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                                          <span className="material-symbols-outlined text-[9px]">location_on</span>
                                          {p.canalVenta}
                                        </span>
                                      )}
                                      {isCritico && (
                                        <span className="bg-error/15 text-error px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider">
                                          Próximo
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-2">
                                    <div>
                                      <p className="text-[9px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest">Total</p>
                                      <p className="text-xs font-bold text-error">${totalC.toLocaleString('es-CL')}</p>
                                    </div>
                                    <span className={`material-symbols-outlined text-outline transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                      expand_more
                                    </span>
                                  </div>
                                </div>

                                {expandedId === p.id && (
                                  <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                                    {p.productos?.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-secondary/5 dark:bg-white/[0.03] px-3 py-2 rounded-xl border border-secondary/10">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-secondary dark:text-[#e2bd6c] font-black text-xs">{item.cantidad}x</span>
                                          <span className="font-bold text-on-surface dark:text-white/90 text-xs">{item.nombre}</span>
                                        </div>
                                        <span className="font-black text-secondary dark:text-[#e2bd6c] text-xs">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                      </div>
                                    ))}

                                    {p.banco && (
                                      <div className="bg-primary/5 dark:bg-white/5 p-3 rounded-xl border border-primary/10 dark:border-white/5">
                                        <p className="text-[9px] font-bold uppercase tracking-widest text-primary dark:text-[#e2bd6c]">Datos de Transferencia</p>
                                        <p className="text-xs font-bold text-on-surface dark:text-white/90 mt-1">{p.banco} | {p.comprobante}</p>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <button onClick={() => handleEdit(p)} className="flex-1 bg-primary/10 text-primary py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest">
                                    Editar
                                  </button>
                                  <button onClick={() => handleCompletarPago(p)} className="flex-1 bg-secondary text-white py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest shadow-sm">
                                    Pagar Todo
                                  </button>
                                  <button onClick={() => handleDelete(p)} className="w-10 bg-error/10 text-error flex items-center justify-center rounded-xl">
                                    <span className="material-symbols-outlined">delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedPendientes.length === 0 && (
                  <div className="bg-surface-container-lowest/50 rounded-[32px] border-2 border-dashed border-outline-variant/20 p-12 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-outline-variant/10 rounded-full flex items-center justify-center mx-auto opacity-40">
                      <span className="material-symbols-outlined text-3xl">inventory_2</span>
                    </div>
                    <div>
                      <p className="font-headline font-bold text-on-surface-variant text-lg">No hay pedidos pendientes</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">Todo el inventario está al día</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controles de Paginación */}
              {renderPaginationControls(safePagePendientes, groupedPendientes.length, setPagePendientes)}
            </div>
          )}
        </section>

        {/* 2. Pedidos Abonados (En Proceso) */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
          <div 
            onClick={() => setSectionsOpen(prev => ({ ...prev, abonados: !prev.abonados }))}
            className="flex items-center justify-between group select-none cursor-pointer hover:opacity-90 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 dark:bg-white/5 flex items-center justify-center shadow-sm border border-amber-500/5 dark:border-white/5 transition-transform duration-300 group-hover:scale-105">
                <span className="material-symbols-outlined text-amber-600 dark:text-[#e2bd6c] text-2xl font-bold">payments</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-2xl font-bold text-on-surface dark:text-white/90 leading-tight">Pedidos Abonados</h2>
                  <span className="bg-amber-500/10 dark:bg-[#e2bd6c]/10 text-amber-600 dark:text-[#e2bd6c] font-bold px-2 py-0.5 rounded-full text-xs transition-colors">
                    [ {listAbonados.length} ]
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline dark:text-gray-500">En proceso de pago parcial</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary/5 dark:bg-white/5 flex items-center justify-center border border-outline-variant/10 dark:border-white/10 transition-transform duration-300">
              <span className={`material-symbols-outlined text-outline dark:text-gray-400 transition-transform duration-300 ${sectionsOpen.abonados ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-amber-500/20 via-outline-variant/10 dark:via-white/5 to-transparent mb-4" />
          
          {sectionsOpen.abonados && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* Vista Desktop */}
              <div className="hidden md:block bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-sm border border-amber-500/5 dark:border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[800px]">
                    <thead>
                      <tr className="bg-surface-container dark:bg-[#2a2a2a]">
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Cliente</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Fecha Entrega</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Estado del Abono</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Saldo</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 dark:divide-white/5">
                      {paginatedAbonados.map(group => {
                        const fechas = group.pedidos.map(p => p.fechaEntrega).filter(Boolean);
                        const uniqueFechas = Array.from(new Set(fechas)).sort();
                        let fechaDisplay = "";
                        if (uniqueFechas.length === 1) {
                          fechaDisplay = uniqueFechas[0];
                        } else if (uniqueFechas.length > 1) {
                          fechaDisplay = `${uniqueFechas[0]} ... ${uniqueFechas[uniqueFechas.length - 1]}`;
                        } else {
                          fechaDisplay = "Sin fecha";
                        }

                        const totalC_acumulado = group.pedidos.reduce((acc, p) => acc + (p.total || p.productos.reduce((sum, pr) => sum + (pr.cantidad * (pr.precio || 0)), 0)), 0);
                        const totalAbono_acumulado = group.pedidos.reduce((acc, p) => acc + (Number(p.abono) || 0), 0);
                        const totalSaldo_acumulado = totalC_acumulado - totalAbono_acumulado;
                        const perc = totalC_acumulado > 0 ? Math.round((totalAbono_acumulado / totalC_acumulado) * 100) : 0;

                        return (
                          <Fragment key={group.id}>
                            <tr 
                              className={`hover:bg-surface-container-high dark:hover:bg-white/5 transition-colors group cursor-pointer ${expandedCustomer === group.id ? 'bg-surface-container-high dark:bg-white/10' : ''}`}
                              onClick={() => setExpandedCustomer(expandedCustomer === group.id ? null : group.id)}
                            >
                              <td className="px-7 py-5">
                                <div className="flex items-center gap-3">
                                  <span className={`material-symbols-outlined text-outline dark:text-gray-500 transition-transform duration-300 ${expandedCustomer === group.id ? 'rotate-180' : ''}`}>
                                    keyboard_arrow_down
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-headline font-bold text-base text-on-surface dark:text-[#e2bd6c]">{group.cliente}</p>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-primary/10 text-primary dark:bg-[#e2bd6c]/10 dark:text-[#e2bd6c]">
                                        {group.pedidos.length} {group.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-7 py-5">
                                <span className="font-bold text-on-surface-variant text-sm">{fechaDisplay}</span>
                              </td>
                              <td className="px-7 py-5">
                                <div className="w-32 bg-outline-variant/20 h-1.5 rounded-full overflow-hidden mb-2">
                                  <div 
                                    className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                                    style={{ width: `${perc}%` }}
                                  />
                                </div>
                                <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                                  {perc}% Cubierto
                                </p>
                              </td>
                              <td className="px-7 py-5 text-right">
                                <div className="space-y-0.5">
                                  <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Abonado: ${totalAbono_acumulado.toLocaleString('es-CL')}</p>
                                  <p className="text-sm font-bold text-primary">Pendiente: ${totalSaldo_acumulado.toLocaleString('es-CL')}</p>
                                </div>
                              </td>
                              <td className="px-7 py-5 text-right">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-500 opacity-60">
                                  {expandedCustomer === group.id ? 'Colapsar' : 'Ver pedidos'}
                                </span>
                              </td>
                            </tr>
                            {expandedCustomer === group.id && (
                              <tr className="bg-surface-container-low/30 dark:bg-white/[0.01]">
                                <td colSpan={5} className="px-7 py-6">
                                  <div className="space-y-4">
                                    {group.pedidos.map(p => {
                                      const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
                                      const singlePerc = totalC > 0 ? Math.round((p.abono / totalC) * 100) : 0;
                                      return (
                                        <div key={p.id} className="bg-surface dark:bg-[#1a1a1a] rounded-[24px] p-5 border border-outline-variant/15 dark:border-white/5 shadow-lg space-y-4">
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                              <span className={`material-symbols-outlined text-outline transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                                expand_more
                                              </span>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <p className="text-sm font-black text-on-surface dark:text-[#e2bd6c]">Pedido del {p.fechaEntrega}</p>
                                                  <span className="text-[8px] bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-primary dark:text-gray-400">
                                                    Vía {p.medioPago}
                                                  </span>
                                                  {p.canalVenta && (
                                                    <span className={`${getCanalColor(p.canalVenta)} px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                                                      <span className="material-symbols-outlined text-[10px]">location_on</span>
                                                      {p.canalVenta}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-6">
                                              <div className="text-right">
                                                <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Abonado: ${p.abono?.toLocaleString('es-CL')} ({singlePerc}%)</p>
                                                <p className="text-sm font-bold text-primary">Saldo: ${(totalC - (p.abono || 0)).toLocaleString('es-CL')}</p>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <button onClick={() => handleEdit(p)} className="text-primary hover:bg-primary-container p-2 rounded-full transition-colors" title="Editar Pedido">
                                                  <span className="material-symbols-outlined text-xl">edit</span>
                                                </button>
                                                <button onClick={() => handleActualizarAbono(p)} className="text-amber-600 hover:bg-amber-100 p-2 rounded-full transition-colors" title="Actualizar Abono">
                                                  <span className="material-symbols-outlined text-xl">edit_calendar</span>
                                                </button>
                                                <button onClick={() => handleCompletarPago(p)} className="text-secondary hover:bg-secondary-container p-2 rounded-full transition-colors" title="Liquidar Saldo (Pagado)">
                                                  <span className="material-symbols-outlined text-xl">price_check</span>
                                                </button>
                                                <button onClick={() => handleDelete(p)} className="text-error opacity-50 hover:opacity-100 hover:bg-error-container p-2 rounded-full transition-colors" title="Eliminar Pedido">
                                                  <span className="material-symbols-outlined text-xl">delete</span>
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                          {expandedId === p.id && (
                                            <div className="mt-4 pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                              <div>
                                                <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary dark:text-[#e2bd6c]/80 mb-3">Detalle de Productos</h4>
                                                <div className="space-y-2">
                                                  {p.productos?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-surface-container-highest/20 dark:bg-white/[0.03] px-4 py-3 rounded-xl border border-outline-variant/5">
                                                      <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-primary font-black text-sm">{item.cantidad}x</span>
                                                          <span className="font-bold text-on-surface dark:text-white/90 text-sm">{item.nombre}</span>
                                                        </div>
                                                        {item.variante && (
                                                          <div className="flex items-center gap-1.5 mt-1 bg-amber-500/5 dark:bg-[#e2bd6c]/5 px-2 py-0.5 rounded-lg w-fit border border-amber-500/10 dark:border-[#e2bd6c]/10">
                                                            <div 
                                                              className="w-2.5 h-2.5 rounded-full border border-black/10 dark:border-white/20 shadow-sm"
                                                              style={{ backgroundColor: getHexColor(item.variante) || '#ccc' }}
                                                            />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-[#e2bd6c]">
                                                              {item.variante}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                      <span className="font-black text-primary dark:text-[#e2bd6c] text-base">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>

                                              {p.historialAbonos && p.historialAbonos.length > 0 && (
                                                <div className="pt-4 border-t border-outline-variant/10 dark:border-white/5">
                                                  <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-amber-600 dark:text-[#e2bd6c]/80 mb-3">Historial de Pagos</h4>
                                                  <div className="space-y-2">
                                                    {p.historialAbonos.map((abono, idx) => (
                                                      <div key={idx} className="flex justify-between items-center text-xs bg-surface-container-highest/20 dark:bg-white/5 px-4 py-3 rounded-xl border border-outline-variant/5 dark:border-white/5 hover:bg-surface-variant/20 transition-colors">
                                                        <div className="flex flex-col">
                                                          <span className="text-on-surface-variant dark:text-white/90 font-medium">
                                                           {new Date(abono.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                          </span>
                                                          <span className="text-[8px] text-outline dark:text-gray-500 uppercase font-bold tracking-wider">{abono.nota || 'Abono'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                          <span className="font-bold text-amber-700 dark:text-[#f3d692] text-sm">+ ${abono.monto.toLocaleString('es-CL')}</span>
                                                          <button onClick={(e) => { e.stopPropagation(); handleEliminarAbono(p, idx); }} className="w-6 h-6 rounded-full hover:bg-error/10 flex items-center justify-center text-error opacity-50 hover:opacity-100 transition-all" title="Deshacer Abono">
                                                            <span className="material-symbols-outlined text-[14px]">undo</span>
                                                          </button>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {groupedAbonados.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-7 py-20 text-center text-on-surface-variant text-sm italic">Sin abonos en curso.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              
              {/* Vista Mobile */}
              <div className="md:hidden space-y-4">
                {paginatedAbonados.map(group => {
                  const fechas = group.pedidos.map(p => p.fechaEntrega).filter(Boolean);
                  const uniqueFechas = Array.from(new Set(fechas)).sort();
                  let fechaDisplay = "";
                  if (uniqueFechas.length === 1) {
                    fechaDisplay = uniqueFechas[0];
                  } else if (uniqueFechas.length > 1) {
                    fechaDisplay = `${uniqueFechas[0]} ... ${uniqueFechas[uniqueFechas.length - 1]}`;
                  } else {
                    fechaDisplay = "Sin fecha";
                  }

                  const totalC_acumulado = group.pedidos.reduce((acc, p) => acc + (p.total || p.productos.reduce((sum, pr) => sum + (pr.cantidad * (pr.precio || 0)), 0)), 0);
                  const totalAbono_acumulado = group.pedidos.reduce((acc, p) => acc + (Number(p.abono) || 0), 0);
                  const totalSaldo_acumulado = totalC_acumulado - totalAbono_acumulado;
                  const perc = totalC_acumulado > 0 ? Math.round((totalAbono_acumulado / totalC_acumulado) * 100) : 0;

                  return (
                    <div key={group.id} className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-[28px] p-5 shadow-sm border border-outline-variant/10 dark:border-white/5">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedCustomer(expandedCustomer === group.id ? null : group.id)}>
                        <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-amber-600 text-xl font-bold">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline font-bold text-base text-on-surface dark:text-[#e2bd6c] truncate">{group.cliente}</h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">
                            {group.pedidos.length} {group.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] font-bold uppercase tracking-widest text-outline">Entrega: {fechaDisplay}</span>
                            <div className="w-16 bg-outline-variant/20 h-1 rounded-full overflow-hidden ml-auto">
                              <div className="h-full bg-amber-500" style={{ width: `${perc}%` }} />
                            </div>
                            <span className="text-[9px] font-bold text-amber-600 uppercase">{perc}%</span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="text-[9px] font-bold text-outline uppercase tracking-wider">Saldo</p>
                            <p className="text-sm font-bold text-primary leading-tight">${totalSaldo_acumulado.toLocaleString('es-CL')}</p>
                          </div>
                          <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedCustomer === group.id ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </div>
                      </div>
                      
                      {expandedCustomer === group.id && (
                        <div className="mt-4 pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          {group.pedidos.map(p => {
                            const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
                            const singlePerc = totalC > 0 ? Math.round((p.abono / totalC) * 100) : 0;
                            return (
                              <div key={p.id} className="bg-surface dark:bg-[#1a1a1a] rounded-[20px] p-4 border border-outline-variant/10 dark:border-white/5 shadow-sm space-y-3">
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                  <div>
                                    <p className="text-xs font-black text-on-surface dark:text-[#e2bd6c]">Pedido del {p.fechaEntrega}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="text-[8px] bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-primary dark:text-gray-400">
                                        {p.medioPago}
                                      </span>
                                      {p.canalVenta && (
                                        <span className={`px-2 py-0.5 rounded-full ${getCanalColor(p.canalVenta)} text-[8px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                                          <span className="material-symbols-outlined text-[9px]">location_on</span>
                                          {p.canalVenta}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-2">
                                    <div>
                                      <p className="text-[9px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest">Saldo</p>
                                      <p className="text-xs font-bold text-primary">${(totalC - p.abono).toLocaleString('es-CL')}</p>
                                    </div>
                                    <span className={`material-symbols-outlined text-outline transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                      expand_more
                                    </span>
                                  </div>
                                </div>

                                {expandedId === p.id && (
                                  <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                                    {p.productos?.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-surface-container-highest/20 dark:bg-white/[0.03] px-3 py-2 rounded-xl border border-outline-variant/5">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-primary font-black text-xs">{item.cantidad}x</span>
                                          <span className="font-bold text-on-surface dark:text-white/90 text-xs">{item.nombre}</span>
                                        </div>
                                        <span className="font-black text-primary dark:text-[#e2bd6c] text-xs">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                      </div>
                                    ))}

                                    {p.historialAbonos && p.historialAbonos.length > 0 && (
                                      <div className="mb-2 space-y-2">
                                        <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-amber-600 dark:text-[#e2bd6c]/80 px-1 mt-2">Registro de Pagos</p>
                                        <div className="space-y-1.5">
                                          {p.historialAbonos.map((abono, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-[10px] bg-amber-500/5 dark:bg-white/5 px-3 py-2 rounded-xl border border-amber-500/10 dark:border-white/5">
                                              <div className="flex flex-col">
                                                <span className="text-on-surface-variant dark:text-white/90 font-medium">
                                                  {new Date(abono.fecha).toLocaleDateString('es-CL')} {new Date(abono.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[7px] text-outline dark:text-gray-500 uppercase font-bold tracking-wider">{abono.nota || 'Abono'}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold text-amber-700 dark:text-[#f3d692] text-xs">+ ${abono.monto.toLocaleString('es-CL')}</span>
                                                <button onClick={(e) => { e.stopPropagation(); handleEliminarAbono(p, idx); }} className="w-6 h-6 rounded-full hover:bg-error/10 flex items-center justify-center text-error opacity-50 hover:opacity-100 transition-all" title="Deshacer Abono">
                                                  <span className="material-symbols-outlined text-[14px]">undo</span>
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <button onClick={() => handleEdit(p)} className="flex-1 bg-primary/10 text-primary py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest">
                                    Editar
                                  </button>
                                  <button onClick={() => handleActualizarAbono(p)} className="flex-1 bg-amber-100 text-amber-800 py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest">
                                    Abonar
                                  </button>
                                  <button onClick={() => handleCompletarPago(p)} className="flex-1 bg-secondary text-white py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest">
                                    Liquidar
                                  </button>
                                  <button onClick={() => handleDelete(p)} className="w-10 bg-error/10 text-error flex items-center justify-center rounded-xl">
                                    <span className="material-symbols-outlined text-base">delete</span>
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedAbonados.length === 0 && (
                  <div className="bg-surface-container-lowest/50 rounded-[32px] border-2 border-dashed border-outline-variant/20 p-12 text-center space-y-4 animate-in fade-in zoom-in-95 duration-500">
                    <div className="w-16 h-16 bg-outline-variant/10 rounded-full flex items-center justify-center mx-auto opacity-40">
                      <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                    </div>
                    <div>
                      <p className="font-headline font-bold text-on-surface-variant text-lg">Sin abonos pendientes</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">No hay saldos por cobrar actualmente</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controles de Paginación */}
              {renderPaginationControls(safePageAbonados, groupedAbonados.length, setPageAbonados)}
            </div>
          )}
        </section>

        {/* 3. Historial de Finalizados */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <div 
            onClick={() => setSectionsOpen(prev => ({ ...prev, finalizados: !prev.finalizados }))}
            className="flex items-center justify-between group select-none cursor-pointer hover:opacity-90 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-secondary/10 dark:bg-white/5 flex items-center justify-center shadow-sm border border-secondary/5 dark:border-white/5 transition-transform duration-300 group-hover:scale-105">
                <span className="material-symbols-outlined text-secondary dark:text-green-400 text-2xl font-bold">verified_user</span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-headline text-2xl font-bold text-on-surface dark:text-white/90 leading-tight">Historial de Finalizados</h2>
                  <span className="bg-secondary/10 dark:bg-white/10 text-secondary dark:text-green-400 font-bold px-2 py-0.5 rounded-full text-xs transition-colors">
                    [ {listFinalizados.length} ]
                  </span>
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline dark:text-gray-500">Pedidos con pago completado</p>
              </div>
            </div>
            <div className="w-10 h-10 rounded-full bg-secondary/5 dark:bg-white/5 flex items-center justify-center border border-outline-variant/10 dark:border-white/10 transition-transform duration-300">
              <span className={`material-symbols-outlined text-outline dark:text-gray-400 transition-transform duration-300 ${sectionsOpen.finalizados ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-secondary/20 via-outline-variant/10 dark:via-white/5 to-transparent mb-4" />
          
          {sectionsOpen.finalizados && (
            <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
              {/* Vista Desktop */}
              <div className="hidden md:block bg-surface-container-low dark:bg-[#1e1e1e] rounded-3xl overflow-hidden shadow-sm border border-outline-variant/5 dark:border-white/5">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="bg-surface-container dark:bg-[#2a2a2a]">
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Cliente</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Fecha de Entrega</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400">Total Pagado</th>
                        <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline dark:text-gray-400 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {paginatedFinalizados.map(group => {
                        const fechas = group.pedidos.map(p => p.fechaEntrega).filter(Boolean);
                        const uniqueFechas = Array.from(new Set(fechas)).sort();
                        let fechaDisplay = "";
                        if (uniqueFechas.length === 1) {
                          fechaDisplay = uniqueFechas[0];
                        } else if (uniqueFechas.length > 1) {
                          fechaDisplay = `${uniqueFechas[0]} ... ${uniqueFechas[uniqueFechas.length - 1]}`;
                        } else {
                          fechaDisplay = "Sin fecha";
                        }
                        const totalDinero_acumulado = group.pedidos.reduce((acc, p) => acc + (p.total || p.productos.reduce((sum, pr) => sum + (pr.cantidad * (pr.precio || 0)), 0)), 0);

                        return (
                          <Fragment key={group.id}>
                            <tr 
                              className={`hover:bg-surface-container-high dark:hover:bg-white/5 transition-colors cursor-pointer ${expandedCustomer === group.id ? 'bg-surface-container-high dark:bg-white/10' : ''}`}
                              onClick={() => setExpandedCustomer(expandedCustomer === group.id ? null : group.id)}
                            >
                              <td className="px-7 py-5">
                                <div className="flex items-center gap-3">
                                  <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedCustomer === group.id ? 'rotate-180' : ''}`}>
                                    keyboard_arrow_down
                                  </span>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="font-headline font-bold text-base text-on-surface dark:text-[#f3d692]">{group.cliente}</p>
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider bg-secondary/10 text-secondary dark:bg-[#e2bd6c]/10 dark:text-[#e2bd6c]">
                                        {group.pedidos.length} {group.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-7 py-5">
                                <span className="font-bold text-on-surface-variant text-sm">{fechaDisplay}</span>
                              </td>
                              <td className="px-7 py-5">
                                <p className="text-sm font-bold text-secondary">${totalDinero_acumulado.toLocaleString('es-CL')}</p>
                              </td>
                              <td className="px-7 py-5 text-right">
                                <span className="text-[10px] font-extrabold uppercase tracking-widest text-outline dark:text-gray-500 opacity-60">
                                  {expandedCustomer === group.id ? 'Colapsar' : 'Ver pedidos'}
                                </span>
                              </td>
                            </tr>
                            {expandedCustomer === group.id && (
                              <tr className="bg-surface-container-low/30 dark:bg-white/[0.01]">
                                <td colSpan={4} className="px-7 py-6">
                                  <div className="space-y-4">
                                    {group.pedidos.map(p => {
                                      const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
                                      return (
                                        <div key={p.id} className="bg-surface dark:bg-[#1a1a1a] rounded-[24px] p-5 border border-outline-variant/15 dark:border-white/5 shadow-lg space-y-4">
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                              <span className={`material-symbols-outlined text-outline transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                                expand_more
                                              </span>
                                              <div>
                                                <div className="flex items-center gap-2">
                                                  <p className="text-sm font-black text-on-surface dark:text-[#e2bd6c]">Pedido del {p.fechaEntrega}</p>
                                                  <span className="text-[8px] bg-primary/5 dark:bg-white/5 border border-primary/10 dark:border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-primary dark:text-gray-400">
                                                    Vía {p.medioPago}
                                                  </span>
                                                  {p.canalVenta && (
                                                    <span className={`${getCanalColor(p.canalVenta)} px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                                                      <span className="material-symbols-outlined text-[10px]">location_on</span>
                                                      {p.canalVenta}
                                                    </span>
                                                  )}
                                                </div>
                                              </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                              <div className="text-right">
                                                <p className="text-sm font-bold text-secondary">${totalC.toLocaleString('es-CL')}</p>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                <button onClick={() => handleEdit(p)} className="text-primary hover:bg-primary-container p-2 rounded-full transition-colors" title="Editar Pedido">
                                                  <span className="material-symbols-outlined text-xl">edit</span>
                                                </button>
                                                <button onClick={() => handleDelete(p)} className="text-error opacity-60 hover:opacity-100 hover:bg-error-container p-2 rounded-full transition-all" title="Eliminar registro permanentemente">
                                                  <span className="material-symbols-outlined text-xl">delete_forever</span>
                                                </button>
                                              </div>
                                            </div>
                                          </div>

                                          {expandedId === p.id && (
                                            <div className="mt-4 pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                              <div>
                                                <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-secondary dark:text-[#e2bd6c]/80 mb-3">Detalle de la Venta</h4>
                                                <div className="space-y-2">
                                                  {p.productos?.map((item, idx) => (
                                                    <div key={idx} className="flex justify-between items-center bg-secondary/5 dark:bg-white/[0.03] px-4 py-3 rounded-xl border border-secondary/10">
                                                      <div className="flex flex-col">
                                                        <div className="flex items-center gap-2">
                                                          <span className="text-secondary dark:text-[#e2bd6c] font-black text-sm">{item.cantidad}x</span>
                                                          <span className="font-bold text-on-surface dark:text-white/90 text-sm">{item.nombre}</span>
                                                        </div>
                                                        {item.variante && (
                                                          <div className="flex items-center gap-1.5 mt-1 bg-secondary/5 dark:bg-[#e2bd6c]/5 px-2 py-0.5 rounded-lg w-fit border border-secondary/10 dark:border-white/5">
                                                            <div 
                                                              className="w-2 h-2 rounded-full border border-black/10 dark:border-white/20 shadow-sm"
                                                              style={{ backgroundColor: getHexColor(item.variante) || '#ccc' }}
                                                            />
                                                            <span className="text-[8px] font-black uppercase tracking-widest text-[#e2bd6c]">
                                                              {item.variante}
                                                            </span>
                                                          </div>
                                                        )}
                                                      </div>
                                                      <span className="font-black text-secondary dark:text-[#e2bd6c] text-base">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>

                                              {p.historialAbonos && p.historialAbonos.length > 0 && (
                                                <div className="pt-4 border-t border-outline-variant/10">
                                                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">Historial de Pagos</h4>
                                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                    {p.historialAbonos.map((abono, idx) => (
                                                      <div key={idx} className="flex justify-between items-center text-xs bg-surface-container-highest/30 dark:bg-white/5 px-4 py-2 rounded-xl border border-transparent dark:border-white/5">
                                                        <div className="flex flex-col">
                                                          <span className="text-on-surface-variant dark:text-white/90 font-medium">
                                                            {new Date(abono.fecha).toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                          </span>
                                                          <span className="text-[8px] text-outline dark:text-gray-400 uppercase font-bold">{abono.nota || 'Abono'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                          <span className="font-bold text-secondary dark:text-[#e2bd6c]">+ ${abono.monto.toLocaleString('es-CL')}</span>
                                                          <button onClick={(e) => { e.stopPropagation(); handleEliminarAbono(p, idx); }} className="w-6 h-6 rounded-full hover:bg-error/10 flex items-center justify-center text-error opacity-50 hover:opacity-100 transition-all" title="Deshacer Abono">
                                                            <span className="material-symbols-outlined text-[14px]">undo</span>
                                                          </button>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </div>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {groupedFinalizados.length === 0 && (
                        <tr>
                          <td colSpan={4} className="px-7 py-20 text-center text-on-surface-variant text-sm italic">Historial vacío.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              {/* Vista Mobile */}
              <div className="md:hidden space-y-4">
                {paginatedFinalizados.map(group => {
                  const fechas = group.pedidos.map(p => p.fechaEntrega).filter(Boolean);
                  const uniqueFechas = Array.from(new Set(fechas)).sort();
                  let fechaDisplay = "";
                  if (uniqueFechas.length === 1) {
                    fechaDisplay = uniqueFechas[0];
                  } else if (uniqueFechas.length > 1) {
                    fechaDisplay = `${uniqueFechas[0]} ... ${uniqueFechas[uniqueFechas.length - 1]}`;
                  } else {
                    fechaDisplay = "Sin fecha";
                  }
                  const totalDinero_acumulado = group.pedidos.reduce((acc, p) => acc + (p.total || p.productos.reduce((sum, pr) => sum + (pr.cantidad * (pr.precio || 0)), 0)), 0);

                  return (
                    <div key={group.id} className="bg-surface-container-low dark:bg-[#1e1e1e] rounded-[28px] p-5 shadow-sm border border-outline-variant/10 dark:border-white/5">
                      <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedCustomer(expandedCustomer === group.id ? null : group.id)}>
                        <div className="w-12 h-12 bg-secondary/10 dark:bg-white/5 rounded-2xl flex items-center justify-center shrink-0">
                          <span className="material-symbols-outlined text-secondary dark:text-[#e2bd6c] text-xl font-bold">person</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-headline font-bold text-base text-on-surface dark:text-[#f3d692] truncate">{group.cliente}</h3>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 mb-1">
                            {group.pedidos.length} {group.pedidos.length === 1 ? 'pedido' : 'pedidos'}
                          </p>
                          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-outline">
                            <span className="material-symbols-outlined text-xs">event</span>
                            <span>Finalizados: {fechaDisplay}</span>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-2">
                          <div>
                            <p className="text-[9px] font-bold text-outline uppercase tracking-wider leading-none">Total</p>
                            <p className="text-sm font-bold text-secondary dark:text-[#e2bd6c] leading-tight">${totalDinero_acumulado.toLocaleString('es-CL')}</p>
                          </div>
                          <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedCustomer === group.id ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </div>
                      </div>

                      {expandedCustomer === group.id && (
                        <div className="mt-4 pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                          {group.pedidos.map(p => {
                            const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0);
                            return (
                              <div key={p.id} className="bg-surface dark:bg-[#1a1a1a] rounded-[20px] p-4 border border-outline-variant/10 dark:border-white/5 shadow-sm space-y-3">
                                <div className="flex justify-between items-center cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                                  <div>
                                    <p className="text-xs font-black text-on-surface dark:text-[#e2bd6c]">Pedido del {p.fechaEntrega}</p>
                                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                      <span className="text-[8px] bg-secondary/5 dark:bg-white/5 border border-secondary/10 dark:border-white/10 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider text-secondary dark:text-gray-400">
                                        {p.medioPago}
                                      </span>
                                      {p.canalVenta && (
                                        <span className={`px-2 py-0.5 rounded-full ${getCanalColor(p.canalVenta)} text-[8px] font-bold uppercase tracking-wider flex items-center gap-1`}>
                                          <span className="material-symbols-outlined text-[9px]">location_on</span>
                                          {p.canalVenta}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="text-right flex items-center gap-2">
                                    <div>
                                      <p className="text-[9px] text-outline dark:text-gray-500 font-bold uppercase tracking-widest">Total</p>
                                      <p className="text-xs font-bold text-secondary">${totalC.toLocaleString('es-CL')}</p>
                                    </div>
                                    <span className={`material-symbols-outlined text-outline transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                      expand_more
                                    </span>
                                  </div>
                                </div>

                                {expandedId === p.id && (
                                  <div className="space-y-2 mt-3 pt-3 border-t border-outline-variant/5">
                                    {p.productos?.map((item, idx) => (
                                      <div key={idx} className="flex justify-between items-center bg-secondary/5 dark:bg-white/[0.03] px-3 py-2 rounded-xl border border-secondary/10">
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-secondary dark:text-[#e2bd6c] font-black text-xs">{item.cantidad}x</span>
                                          <span className="font-bold text-on-surface dark:text-white/90 text-xs">{item.nombre}</span>
                                        </div>
                                        <span className="font-black text-secondary dark:text-[#e2bd6c] text-xs">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                      </div>
                                    ))}

                                    {p.historialAbonos && p.historialAbonos.length > 0 && (
                                      <div className="mb-2 space-y-2">
                                        <p className="text-[8px] font-extrabold uppercase tracking-[0.2em] text-secondary dark:text-[#e2bd6c]/80 px-1 mt-2">Pagos Registrados</p>
                                        <div className="space-y-1.5">
                                          {p.historialAbonos.map((abono, idx) => (
                                            <div key={idx} className="flex justify-between items-center text-[10px] bg-secondary/5 dark:bg-white/5 px-3 py-2 rounded-xl border border-secondary/10 dark:border-white/5">
                                              <div className="flex flex-col">
                                                <span className="text-on-surface-variant dark:text-white/90 font-medium">
                                                  {new Date(abono.fecha).toLocaleDateString('es-CL')} {new Date(abono.fecha).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[7px] text-outline dark:text-gray-500 uppercase font-bold tracking-wider">{abono.nota || 'Abono'}</span>
                                              </div>
                                              <div className="flex items-center gap-2">
                                                <span className="font-bold text-secondary dark:text-[#f3d692] text-xs">+ ${abono.monto.toLocaleString('es-CL')}</span>
                                                <button onClick={(e) => { e.stopPropagation(); handleEliminarAbono(p, idx); }} className="w-6 h-6 rounded-full hover:bg-error/10 flex items-center justify-center text-error opacity-50 hover:opacity-100 transition-all" title="Deshacer Abono">
                                                  <span className="material-symbols-outlined text-[14px]">undo</span>
                                                </button>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}

                                <div className="flex gap-2 pt-2">
                                  <button onClick={() => handleEdit(p)} className="flex-1 bg-primary/10 text-primary py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest">
                                    Editar
                                  </button>
                                  <button onClick={() => handleDelete(p)} className="flex-1 bg-error/10 text-error py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest flex items-center justify-center gap-2">
                                    <span className="material-symbols-outlined text-sm">delete_forever</span>
                                    Eliminar
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
                {groupedFinalizados.length === 0 && (
                  <div className="bg-surface-container-lowest/50 rounded-[32px] border-2 border-dashed border-outline-variant/20 p-12 text-center space-y-4">
                    <div className="w-16 h-16 bg-outline-variant/10 rounded-full flex items-center justify-center mx-auto opacity-40">
                      <span className="material-symbols-outlined text-3xl">auto_stories</span>
                    </div>
                    <div>
                      <p className="font-headline font-bold text-on-surface-variant text-lg">Historial vacío</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">Pronto verás tus ventas aquí</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Controles de Paginación */}
              {renderPaginationControls(safePageFinalizados, groupedFinalizados.length, setPageFinalizados)}
            </div>
          )}
        </section>
          </>
        ) : (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-white/5 flex items-center justify-center shadow-sm border border-primary/5 dark:border-white/5">
                  <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-2xl font-bold">groups</span>
                </div>
                <div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface dark:text-white/90 leading-tight">Clientes Frecuentes</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline dark:text-gray-500">Ranking por frecuencia de compra</p>
                </div>
              </div>

              {/* Buscador de Clientes */}
              <div className="relative w-full md:w-80">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-outline dark:text-gray-400 text-sm">search</span>
                <input
                  type="text"
                  value={busquedaClientes}
                  onChange={e => {
                    setBusquedaClientes(e.target.value);
                    setPageClientes(1); // Reiniciar a la primera página al buscar
                  }}
                  placeholder="Buscar cliente por nombre..."
                  className="w-full bg-surface-container-low dark:bg-white/5 rounded-xl pl-10 pr-10 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container dark:focus:ring-[#e2bd6c]/20 border border-outline-variant/20 dark:border-white/10 transition-all font-bold placeholder:font-normal dark:text-white dark:placeholder:text-gray-500"
                />
                {busquedaClientes && (
                  <button
                    onClick={() => {
                      setBusquedaClientes('');
                      setPageClientes(1);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-outline dark:text-gray-400 hover:text-on-surface dark:hover:text-white transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {paginatedClientes.map((cliente, idx) => (
                <div 
                  key={idx} 
                  onClick={() => setExpandedCliente(expandedCliente === cliente.nombre ? null : cliente.nombre)}
                  className={`bg-surface-container-low dark:bg-[#1e1e1e] rounded-[32px] p-6 border border-outline-variant/10 dark:border-white/5 shadow-sm hover:shadow-md transition-all group cursor-pointer ${expandedCliente === cliente.nombre ? 'ring-2 ring-primary/30 dark:ring-[#e2bd6c]/30 shadow-md' : ''}`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-headline text-2xl font-bold italic">
                      {cliente.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500 block mb-1">Pedidos</span>
                      <span className="text-2xl font-headline font-bold text-secondary dark:text-[#e2bd6c] bg-secondary/10 dark:bg-[#e2bd6c]/10 px-3 py-1 rounded-xl">
                        {cliente.pedidosCount}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-headline font-bold text-lg text-on-surface dark:text-[#f3d692] truncate group-hover:text-primary transition-colors">
                        {cliente.nombre}
                      </h3>
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">
                        Última compra: {cliente.ultimaCompra}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-outline-variant/10 dark:border-white/5 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-outline dark:text-gray-500 uppercase tracking-widest">Inversión Total</span>
                      <span className="text-base font-bold text-primary dark:text-[#e2bd6c]">${cliente.totalGastado.toLocaleString('es-CL')}</span>
                    </div>

                    {/* Historial de Compras Expandible */}
                    {expandedCliente === cliente.nombre && (
                      <div className="pt-4 border-t border-outline-variant/10 dark:border-white/5 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300" onClick={(e) => e.stopPropagation()}>
                        <h4 className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-secondary dark:text-[#e2bd6c] mb-2 flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-[14px]">history</span>
                          Historial de Compras
                        </h4>
                        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                          {cliente.compras.map((compra, cIdx) => (
                            <div key={cIdx} className="bg-surface dark:bg-[#2a2a2a] p-3 rounded-2xl border border-outline-variant/10 dark:border-white/5 shadow-sm space-y-2">
                              <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider">
                                <span className="text-outline dark:text-gray-400">Entrega: {compra.fecha}</span>
                                <span className={`px-2 py-0.5 rounded-full ${
                                  compra.pagoEstado === 'pagado' ? 'bg-secondary/15 text-secondary dark:text-green-400' :
                                  compra.pagoEstado === 'parcial' ? 'bg-amber-500/15 text-amber-600 dark:text-[#e2bd6c]' :
                                  'bg-error/15 text-error'
                                }`}>
                                  {compra.pagoEstado === 'pagado' ? 'Pagado' :
                                   compra.pagoEstado === 'parcial' ? 'Abonado' :
                                   'Sin Pagar'}
                                </span>
                              </div>
                              <div className="space-y-1">
                                {compra.productos.map((prod, pIdx) => (
                                  <div key={pIdx} className="flex justify-between items-center text-xs">
                                    <span className="text-on-surface-variant dark:text-white/80">
                                      <span className="font-bold text-primary dark:text-[#e2bd6c] mr-1">{prod.cantidad}x</span>
                                      {prod.nombre}
                                      {prod.variante && (
                                        <span className="text-[9px] font-medium text-outline dark:text-gray-400 ml-1">
                                          ({prod.variante})
                                        </span>
                                      )}
                                    </span>
                                    <span className="font-bold text-on-surface dark:text-[#e2bd6c] text-[11px]">
                                      ${(prod.precio * prod.cantidad).toLocaleString('es-CL')}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="pt-2 border-t border-dashed border-outline-variant/10 dark:border-white/5 flex justify-between items-center text-xs">
                                <span className="text-[10px] font-bold text-outline dark:text-gray-400">Total Pedido</span>
                                <span className="text-primary dark:text-[#e2bd6c] text-sm font-extrabold">${compra.total.toLocaleString('es-CL')}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {sortedClientes.length === 0 ? (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-outline-variant/10 rounded-full flex items-center justify-center mx-auto mb-4 opacity-40">
                    <span className="material-symbols-outlined text-3xl">person_search</span>
                  </div>
                  <p className="font-headline font-bold text-on-surface-variant">Aún no hay historial de clientes</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">Registra tu primer pedido para ver estadísticas</p>
                </div>
              ) : filteredClientes.length === 0 ? (
                <div className="col-span-full py-20 text-center bg-surface-container-low dark:bg-[#1e1e1e] rounded-[32px] border border-outline-variant/10 dark:border-white/5">
                  <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 text-primary dark:text-[#e2bd6c]">
                    <span className="material-symbols-outlined text-3xl">search_off</span>
                  </div>
                  <p className="font-headline font-bold text-on-surface-variant dark:text-white/80">No se encontraron clientes</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">Intenta con otro nombre o término de búsqueda</p>
                </div>
              ) : null}
            </div>

            {/* Controles de Paginación para Clientes */}
            {renderPaginationControls(safePageClientes, filteredClientes.length, setPageClientes)}
          </section>
        )}
      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 dark:bg-black/80 backdrop-blur-md p-4">
          <div className="bg-surface dark:bg-[#121212] w-full max-w-lg rounded-[32px] shadow-2xl border border-outline-variant/20 dark:border-white/10 flex flex-col h-full md:h-auto max-h-[95vh] md:max-h-[85vh] overflow-hidden">
            {/* Header del Modal */}
            <div className="px-6 py-6 border-b border-outline-variant/10 dark:border-white/5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-2xl font-bold">
                    {editingId ? 'edit_note' : 'add_shopping_cart'}
                  </span>
                </div>
                <div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface dark:text-white/90 leading-tight">
                    {editingId ? 'Editar Pedido' : 'Nuevo Pedido'}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline dark:text-gray-500">
                    {editingId ? 'Modificar datos de la venta' : 'Agendar venta y entrega'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 hover:bg-surface-container-high dark:hover:bg-white/5 rounded-full flex items-center justify-center text-outline dark:text-gray-500 transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Cuerpo del Formulario con Scroll y padding extra abajo para no chocar con el menú */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar pb-32 md:pb-8">
              {errorMsg && (
                <div className="bg-error-container text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2 shrink-0">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2 relative">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">
                    Nombre del Cliente {form.esVentaOnline && <span className="text-primary/60 lowercase italic font-normal">(Opcional)</span>}
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white/90 placeholder:text-outline/40 dark:placeholder:text-white/20"
                      placeholder="Ej. Juan Pérez"
                      value={form.cliente}
                      onChange={e => {
                        setForm({...form, cliente: e.target.value})
                        setShowClienteDropdown(true)
                      }}
                      onFocus={() => setShowClienteDropdown(true)}
                    />
                    {showClienteDropdown && form.cliente && sortedClientes.filter(c => c.nombre.toLowerCase().includes(form.cliente.toLowerCase()) && c.nombre.toLowerCase() !== form.cliente.toLowerCase()).length > 0 && (
                      <div className="absolute left-0 top-full mt-2 w-full bg-surface dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-[80] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                        {sortedClientes
                          .filter(c => c.nombre.toLowerCase().includes(form.cliente.toLowerCase()))
                          .slice(0, 5)
                          .map((c, idx) => (
                            <button
                              key={idx}
                              onClick={() => {
                                setForm({ ...form, cliente: c.nombre })
                                setShowClienteDropdown(false)
                              }}
                              className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-primary/10 border-b border-outline-variant/5 last:border-0 flex items-center justify-between group"
                            >
                              <span>{c.nombre}</span>
                              <span className="text-[9px] text-outline opacity-0 group-hover:opacity-100 uppercase tracking-widest">Ya es cliente</span>
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                  {showClienteDropdown && <div className="fixed inset-0 z-[75]" onClick={() => setShowClienteDropdown(false)} />}
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Fecha de Entrega</label>
                  <input 
                    type="date" 
                    className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white/90"
                    value={form.fechaEntrega}
                    onChange={e => setForm({...form, fechaEntrega: e.target.value})}
                  />
                </div>
              </div>

              {/* Opción de Venta con Origen */}
              <div className="bg-surface-container-low dark:bg-white/5 p-5 rounded-3xl border border-outline-variant/10 dark:border-white/10 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary dark:text-[#e2bd6c]">Venta con Origen / Lugar</p>
                    <p className="text-[9px] text-outline font-medium">¿Venta por redes sociales o lugar físico (Jumbo, etc)?</p>
                  </div>
                  <button 
                    onClick={() => setForm({ ...form, esVentaOnline: !form.esVentaOnline })}
                    className={`w-12 h-6 rounded-full transition-colors relative flex items-center px-1 ${form.esVentaOnline ? 'bg-primary' : 'bg-outline-variant/30'}`}
                  >
                    <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${form.esVentaOnline ? 'translate-x-6' : 'translate-x-0'}`} />
                  </button>
                </div>

                {form.esVentaOnline && (
                  <div className="grid grid-cols-1 gap-3 pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1 dark:text-gray-500">Lugar o Canal de Venta</label>
                    <div className="relative">
                      <div className="relative group">
                        <input 
                          type="text"
                          value={form.canalVenta}
                          onChange={(e) => {
                            setForm({ ...form, canalVenta: e.target.value })
                            setShowCanalDropdown(true)
                          }}
                          onFocus={() => setShowCanalDropdown(true)}
                          className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] pr-10 dark:text-white/90"
                          placeholder="Ej: Facebook, Jumbo, Cesfam..."
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm opacity-40 dark:text-white/40">location_on</span>
                      </div>

                      {showCanalDropdown && (
                        <>
                          <div className="absolute left-0 top-full mt-2 w-full bg-surface dark:bg-[#1e1e1e] border border-outline-variant/20 dark:border-white/10 rounded-2xl shadow-2xl z-[70] overflow-hidden">
                            <div className="max-h-40 overflow-y-auto custom-scrollbar">
                              {canalesDisponibles
                                .filter(c => c.toLowerCase().includes(form.canalVenta.toLowerCase()))
                                .map((canal, idx) => (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      setForm({ ...form, canalVenta: canal })
                                      setShowCanalDropdown(false)
                                    }}
                                    className="w-full px-5 py-3 text-left text-xs font-bold hover:bg-primary/10 border-b border-outline-variant/5 last:border-0"
                                  >
                                    {canal}
                                  </button>
                                ))}
                              {form.canalVenta && !canalesDisponibles.includes(form.canalVenta) && (
                                <button
                                  onClick={() => setShowCanalDropdown(false)}
                                  className="w-full px-5 py-3 text-left text-xs font-bold text-primary italic"
                                >
                                  + Añadir "{form.canalVenta}"
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Nuevos campos de Pago */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1 dark:text-gray-500">Estado del Pago</label>
                  <div className="flex p-1 bg-surface-container-high dark:bg-white/5 rounded-2xl gap-1 border border-outline-variant/10 dark:border-white/5 shadow-inner">
                    <button 
                      type="button"
                      onClick={() => setForm({...form, pagoEstado: 'sin pagar'})}
                      disabled={form.medioPago === 'cuota'}
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all duration-300 
                        ${form.pagoEstado === 'sin pagar' ? 'bg-error text-white shadow-md scale-105' : 'text-outline'}
                        ${form.medioPago === 'cuota' ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-variant'}
                      `}
                    >
                      Sin Pagar
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        if (form.medioPago === 'cuota') {
                          setForm({...form, pagoEstado: 'parcial'})
                        }
                      }}
                      disabled={form.medioPago !== 'cuota'}
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all duration-300 
                        ${form.pagoEstado === 'parcial' ? 'bg-amber-500 text-white shadow-md scale-105' : 'text-outline'}
                        ${form.medioPago !== 'cuota' ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-variant'}
                      `}
                    >
                      Abonado
                    </button>
                    <button 
                      type="button"
                      onClick={() => setForm({...form, pagoEstado: 'pagado'})}
                      disabled={form.medioPago === 'cuota'}
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all duration-300 
                        ${form.pagoEstado === 'pagado' ? 'bg-secondary dark:bg-[#e2bd6c] text-white dark:text-black shadow-md scale-105' : 'text-outline dark:text-gray-500'}
                        ${form.medioPago === 'cuota' ? 'opacity-30 cursor-not-allowed' : 'hover:bg-surface-variant dark:hover:bg-white/5'}
                      `}
                    >
                      Pagado
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1 dark:text-gray-500">Medio de Pago</label>
                  <div className="relative group">
                    <select 
                      className="w-full bg-surface-container-lowest dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold appearance-none shadow-sm dark:text-white"
                      value={form.medioPago}
                      onChange={e => {
                        const val = e.target.value
                        setForm({
                          ...form, 
                          medioPago: val, 
                          pagoEstado: val === 'cuota' ? 'parcial' : 'sin pagar',
                          abono: val === 'cuota' ? form.abono : 0
                        })
                      }}
                    >
                      <option value="transferencia" className="dark:bg-[#1e1e1e]">Transferencia</option>
                      <option value="tarjeta" className="dark:bg-[#1e1e1e]">Tarjeta</option>
                      <option value="cuota" className="dark:bg-[#1e1e1e]">Cuota (Abono)</option>
                      <option value="efectivo" className="dark:bg-[#1e1e1e]">Efectivo</option>
                    </select>
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-outline text-lg pointer-events-none group-focus-within:rotate-180 transition-transform">expand_more</span>
                  </div>
                </div>
              </div>

              {form.medioPago === 'transferencia' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Banco</label>
                    <input 
                      type="text"
                      className="w-full bg-surface-container-lowest dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white"
                      placeholder="Ej: Banco Estado"
                      value={form.banco}
                      onChange={(e) => setForm({ ...form, banco: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Comprobante / Operación</label>
                    <input 
                      type="text"
                      className="w-full bg-surface-container-lowest dark:bg-[#1e1e1e] border border-outline-variant/30 dark:border-white/10 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] font-bold shadow-sm dark:text-white"
                      placeholder="N° de operación"
                      value={form.comprobante}
                      onChange={(e) => setForm({ ...form, comprobante: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {form.pagoEstado === 'parcial' || form.medioPago === 'cuota' ? (
                <div className="bg-amber-50 dark:bg-[#e2bd6c]/5 p-5 rounded-3xl border border-amber-200 dark:border-[#e2bd6c]/20 space-y-4 animate-in fade-in zoom-in-95 duration-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-amber-800 dark:text-[#e2bd6c] italic">Monto del Abono</label>
                    <span className="bg-amber-200/50 dark:bg-[#e2bd6c]/20 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-700 dark:text-[#e2bd6c] uppercase">
                      Saldo: ${(form.productosSeleccionados.reduce((acc, p) => acc + (p.cantidad * p.precio), 0) - (Number(form.abono) || 0)).toLocaleString('es-CL')}
                    </span>
                  </div>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-600 dark:text-[#e2bd6c] font-black text-lg">$</span>
                    <input 
                      type="number" 
                      value={form.abono} 
                      onChange={e => {
                        const val = e.target.value;
                        const totalEstimado = form.productosSeleccionados.reduce((acc, p) => acc + (p.cantidad * p.precio), 0);
                        let nextEstado = form.pagoEstado;
                        if (Number(val) >= totalEstimado && form.productosSeleccionados.length > 0 && Number(val) > 0) {
                          nextEstado = 'pagado';
                          if (form.pagoEstado !== 'pagado') {
                            alert('El monto del abono cubre el total estimado. El estado quedará como "Pagado".');
                          }
                        } else {
                          nextEstado = 'parcial';
                        }
                        setForm({...form, abono: val, pagoEstado: nextEstado});
                      }}
                      className="w-full bg-white dark:bg-white/5 border-2 border-amber-100 dark:border-white/10 rounded-2xl pl-10 pr-5 py-3 text-base focus:outline-none focus:border-amber-400 dark:focus:border-[#e2bd6c] font-bold text-amber-950 dark:text-white/90 shadow-inner"
                      placeholder="0"
                    />
                  </div>
                </div>
              ) : null}

            </div>

            {/* Buscador de Productos (Fuera del scroll para efecto pop-out) */}
            <div className="px-6 py-4 border-t border-outline-variant/20 shrink-0">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">Agregar Productos</label>
                <div className="relative">
                  <div className="relative group">
                    <input 
                      type="text"
                      value={busquedaProd}
                      onChange={(e) => {
                        setBusquedaProd(e.target.value)
                        if (!showProdDropdown) setShowProdDropdown(true)
                      }}
                      onFocus={() => setShowProdDropdown(true)}
                      className="w-full bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-xl px-4 py-2 text-xs text-left transition-all font-headline italic h-[38px] focus:outline-none focus:border-primary dark:focus:border-[#e2bd6c] pr-10 dark:text-white/90"
                      placeholder="BUSCAR PRODUCTO O SKU..."
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm opacity-40 dark:text-white/40 group-focus-within:rotate-180 transition-transform duration-300 pointer-events-none">expand_more</span>
                  </div>

                  {showProdDropdown && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => { setShowProdDropdown(false); setBusquedaProd(''); }} />
                      <div className="absolute left-0 bottom-full mb-2 w-full bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-xl z-[70] overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="max-h-80 overflow-y-auto custom-scrollbar">
                          {productos
                            .filter(p => {
                              const yaAgregados = form.productosSeleccionados.filter(ps => ps.productoId === p.id);
                              // Si no tiene variantes, ocultar si ya se agregó
                              if (!p.variantes || p.variantes.length === 0) {
                                return yaAgregados.length === 0;
                              }
                              // Si tiene variantes, mostrar siempre que quede alguna por agregar
                              return p.variantes.some(v => !yaAgregados.some(ya => (ya.variante || null) === (v.nombre || null)));
                            })
                            .filter(p => 
                              p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) || 
                              (p.sku || '').toLowerCase().includes(busquedaProd.toLowerCase())
                            )
                            .sort((a, b) => new Date(b.fechaIngreso || 0) - new Date(a.fechaIngreso || 0))
                            .slice(0, 8)
                            .map((p, idx, arr) => (
                              <div key={p.id} className={`${idx !== arr.length - 1 ? 'border-b border-outline-variant/5' : ''}`}>
                                <button 
                                  onClick={() => { handleAddProduct(p.id); setShowProdDropdown(false); setBusquedaProd(''); }}
                                  disabled={p.stock <= 0}
                                  className={`w-full flex items-center justify-between px-5 py-3.5 text-xs font-headline italic tracking-wide transition-colors text-left
                                    ${p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'text-on-surface hover:bg-surface-variant'}
                                  `}
                                >
                                  <div className="flex flex-col">
                                    <span className="font-headline italic text-on-surface">{p.nombre}</span>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${p.stock <= 0 ? 'text-error' : 'text-primary/60'}`}>
                                      {p.stock <= 0 ? 'SIN STOCK' : `${p.stock} UNIDADES TOTALES`}
                                    </span>
                                  </div>
                                  {p.stock > 0 && !p.variantes?.length && <span className="material-symbols-outlined text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">add_circle</span>}
                                  {p.variantes?.length > 0 && (
                                    <span className="px-2 py-1 bg-primary text-on-primary rounded-lg text-[9px] font-black uppercase tracking-tighter animate-pulse shadow-md">
                                      Elegir Color
                                    </span>
                                  )}
                                </button>
                                
                                {p.variantes?.length > 0 && (
                                  <div className="bg-surface-container-low/50 py-1 space-y-1">
                                    {p.variantes.map((v, vIdx) => (
                                      <button
                                        key={vIdx}
                                        disabled={v.stock <= 0}
                                        onClick={() => { handleAddProduct(p.id, v.nombre); setShowProdDropdown(false); setBusquedaProd(''); }}
                                        className={`w-full flex items-center justify-between pl-10 pr-5 py-2 text-[10px] font-bold uppercase tracking-wider transition-colors text-left
                                          ${v.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'text-on-surface-variant hover:bg-primary/5 hover:text-primary'}
                                        `}
                                      >
                                        <div className="flex items-center gap-2">
                                          <div 
                                            className="w-2 h-2 rounded-full border border-black/5 dark:border-white/10" 
                                            style={{ backgroundColor: getHexColor(v.nombre) || '#ccc' }}
                                          />
                                          <span>{v.nombre}</span>
                                        </div>
                                        <span className={v.stock <= 0 ? 'text-error/60' : 'opacity-60'}>{v.stock} u.</span>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          {productos.filter(p => !form.productosSeleccionados.map(ps => ps.productoId).includes(p.id)).filter(p => p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) || (p.sku || '').toLowerCase().includes(busquedaProd.toLowerCase())).length === 0 && (
                            <div className="px-5 py-8 text-center text-outline text-[10px] uppercase tracking-widest italic font-sans not-italic">
                              {busquedaProd ? 'No se encontraron resultados' : 'No hay más productos disponibles'}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
            </div>

            <div className="px-6 pb-6 overflow-y-auto">

              {form.productosSeleccionados.length > 0 && (
                <div className="bg-surface-container-low dark:bg-white/5 rounded-xl p-4 space-y-3 border border-outline-variant/10 dark:border-white/5">
                  {form.productosSeleccionados.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-3 bg-surface/50 dark:bg-white/[0.02] p-3 rounded-xl border border-outline-variant/5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate text-on-surface dark:text-white/90">{item.nombre}</p>
                        {item.variante && (
                          <div className="flex items-center gap-1.5 mt-1 bg-primary/5 dark:bg-[#e2bd6c]/5 px-2 py-0.5 rounded-md w-fit border border-primary/10 dark:border-white/5">
                            <div 
                              className="w-2 h-2 rounded-full border border-black/5 dark:border-white/10"
                              style={{ backgroundColor: getHexColor(item.variante) || '#ccc' }}
                            />
                            <span className="text-[9px] font-black uppercase tracking-widest text-primary dark:text-[#e2bd6c]">{item.variante}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-outline">Cant:</span>
                        <input 
                          type="number" 
                          min="1" 
                          max={item.stockOriginal + (editingId ? (originalProductos.find(op => op.productoId === item.productoId && (op.variante || null) === (item.variante || null))?.cantidad || 0) : 0)}
                          value={item.cantidad}
                          onChange={(e) => handleQuantityChange(item.productoId, item.variante, e.target.value)}
                          className="w-16 bg-surface-container-lowest dark:bg-white/5 border border-outline-variant/30 dark:border-white/10 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-primary dark:text-white font-bold"
                        />
                        <button 
                          onClick={() => handleRemoveProduct(item.productoId, item.variante)} 
                          className="w-8 h-8 flex items-center justify-center rounded-full bg-error/10 text-error hover:bg-error hover:text-white transition-all duration-200 active:scale-90" 
                          title="Quitar producto"
                        >
                          <span className="material-symbols-outlined text-base">close</span>
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center border-t border-outline-variant/10 pt-3">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
                      Total estimado:
                    </p>
                    <p className="text-lg font-headline font-bold text-primary">
                      ${form.productosSeleccionados.reduce((acc, p) => acc + (p.cantidad * p.precio), 0).toLocaleString('es-CL')}
                    </p>
                  </div>
                  <p className="text-[9px] text-on-surface-variant uppercase tracking-widest font-bold pt-1 text-right opacity-60">
                    El stock se descontará automáticamente.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-surface-container-low/50 dark:bg-white/5 px-6 py-6 flex flex-col md:flex-row justify-end gap-3 border-t border-outline-variant/10 dark:border-white/5 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="w-full md:w-auto px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-outline dark:text-gray-500 hover:bg-surface-container-high dark:hover:bg-white/5 transition-all order-2 md:order-1"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="w-full md:w-auto px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black shadow-lg shadow-primary/20 dark:shadow-[#e2bd6c]/10 hover:scale-[1.02] active:scale-95 transition-all order-1 md:order-2"
              >
                {editingId ? 'Guardar Cambios' : 'Confirmar y Agendar'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Diálogo Personalizado (Confirmación / Prompt) */}
      {dialog.show && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 dark:bg-black/80 backdrop-blur-md animate-in fade-in duration-300" onClick={closeDialog} />
          <div className="bg-surface dark:bg-[#121212] w-full max-w-sm rounded-[32px] shadow-2xl border border-outline-variant/20 dark:border-white/5 overflow-hidden animate-in zoom-in-95 fade-in duration-300 relative z-10">
            <div className="p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-2">
                <span className="material-symbols-outlined text-3xl text-primary">
                  {dialog.isPrompt ? 'edit_note' : 'contact_support'}
                </span>
              </div>
              <h3 className="font-headline font-bold text-xl text-on-surface">{dialog.title}</h3>
              <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{dialog.message}</p>
              
              {dialog.isPrompt && (
                <div className="pt-2">
                  <input 
                    type="number"
                    autoFocus
                    className="w-full bg-surface-container-high border-2 border-primary/20 rounded-2xl px-5 py-4 text-center text-xl font-bold text-primary focus:border-primary outline-none transition-all"
                    placeholder={dialog.placeholder}
                    value={dialog.promptValue}
                    onChange={(e) => setDialog({ ...dialog, promptValue: e.target.value })}
                  />
                </div>
              )}

              <div className="flex flex-col gap-2 pt-4">
                <button 
                  onClick={() => dialog.onConfirm(dialog.isPrompt ? dialog.promptValue : null)}
                  className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all"
                >
                  {dialog.confirmLabel}
                </button>
                <button 
                  onClick={closeDialog}
                  className="w-full bg-surface-container-high text-on-surface-variant py-4 rounded-2xl font-bold text-sm hover:bg-surface-container-highest transition-all"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  )
}
