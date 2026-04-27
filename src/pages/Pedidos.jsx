import { useState, useEffect, Fragment } from 'react'
import { collection, onSnapshot, addDoc, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { calcularEstado } from '../utils/date'

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
      acc[nombre] = { nombre, pedidosCount: 0, totalGastado: 0, ultimaCompra: p.fechaEntrega }
    }
    acc[nombre].pedidosCount += 1
    acc[nombre].totalGastado += p.total || 0
    if (new Date(p.fechaEntrega) > new Date(acc[nombre].ultimaCompra)) {
      acc[nombre].ultimaCompra = p.fechaEntrega
    }
    return acc
  }, {})

  const sortedClientes = Object.values(clientesData).sort((a, b) => b.pedidosCount - a.pedidosCount)

  const canalesBase = ['Facebook', 'Instagram', 'WhatsApp', 'TikTok']
  const canalesExistentes = Array.from(new Set(pedidos.filter(p => p.canalVenta).map(p => p.canalVenta)))
  const canalesDisponibles = Array.from(new Set([...canalesBase, ...canalesExistentes]))

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
        return {
          ...p,
          stockOriginal: pMaestro ? pMaestro.stock : p.cantidad // Stock disponible ahora
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

  function handleAddProduct(productoId) {
    if (!productoId) return
    const prod = productos.find(p => p.id === productoId)
    if (!prod || prod.stock <= 0) {
      return setErrorMsg('El producto no tiene stock disponible.')
    }
    const yaExiste = form.productosSeleccionados.find(p => p.productoId === productoId)
    if (yaExiste) return
    
    setForm({
      ...form, 
      productosSeleccionados: [...form.productosSeleccionados, { 
        productoId: prod.id, 
        nombre: prod.nombre, 
        cantidad: 1, 
        precio: prod.precio || 0,
        stockOriginal: prod.stock 
      }]
    })
    setErrorMsg('')
  }

  function handleRemoveProduct(productoId) {
    setForm({
      ...form,
      productosSeleccionados: form.productosSeleccionados.filter(p => p.productoId !== productoId)
    })
  }

  function handleQuantityChange(productoId, cantidad) {
    const qty = Number(cantidad)
    const prodRef = form.productosSeleccionados.find(p => p.productoId === productoId)
    
    // Al editar, el "stock disponible" es el stock actual del maestro + lo que ya teníamos reservado en este pedido
    const originalQty = originalProductos.find(op => op.productoId === productoId)?.cantidad || 0;
    const stockDisponibleTotal = prodRef.stockOriginal + (editingId ? originalQty : 0);

    if (qty > stockDisponibleTotal) {
      return setErrorMsg(`Stock insuficiente para ${prodRef.nombre}. Máximo: ${stockDisponibleTotal}`)
    }
    setErrorMsg('')
    setForm({
      ...form,
      productosSeleccionados: form.productosSeleccionados.map(p => 
        p.productoId === productoId ? { ...p, cantidad: qty } : p
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
        return setErrorMsg(`La cantidad de ${item.nombre} debe ser mayor a 0.`)
      }
      const pData = productos.find(p => p.id === item.productoId)
      
      // Cuando editamos, el stock "disponible" es: stock_maestro + cantidad_previa_en_este_pedido
      let stockDisponible = pData ? pData.stock : 0;
      if (editingId) {
        const itemPrevio = originalProductos.find(p => p.productoId === item.productoId);
        if (itemPrevio) {
          stockDisponible += itemPrevio.cantidad;
        }
      }

      if (!pData || stockDisponible < item.cantidad) {
        return setErrorMsg(`Stock insuficiente de ${item.nombre} en este momento. Tienes ${pData ? pData.stock : 0} libres.`)
      }
    }

    try {
      const batch = writeBatch(db)

      // 1. Manejar Stock (Inventario)
      // Si estamos editando, primero debemos "devolver" virtualmente el stock anterior
      // Y luego restar el nuevo.
      
      // Productos que estaban antes pero ya no están (eliminados del pedido)
      if (editingId) {
        for (const oldItem of originalProductos) {
          const newItem = form.productosSeleccionados.find(p => p.productoId === oldItem.productoId);
          const pMaestro = productos.find(p => p.id === oldItem.productoId);
          if (pMaestro) {
            const prodRef = doc(db, 'productos', oldItem.productoId);
            // Si el producto fue eliminado del pedido, devolvemos todo su stock
            if (!newItem) {
              const nuevoStock = pMaestro.stock + oldItem.cantidad;
              batch.update(prodRef, { stock: nuevoStock, estado: calcularEstado(nuevoStock) });
            } else {
              // Si sigue estando, calculamos la diferencia
              const diferencia = oldItem.cantidad - newItem.cantidad; // Positivo si bajó cantidad, Negativo si subió
              const nuevoStock = pMaestro.stock + diferencia;
              batch.update(prodRef, { stock: nuevoStock, estado: calcularEstado(nuevoStock) });
            }
          }
        }
        
        // Productos que son nuevos en el pedido
        for (const newItem of form.productosSeleccionados) {
          const wasPresent = originalProductos.find(p => p.productoId === newItem.productoId);
          if (!wasPresent) {
            const pMaestro = productos.find(p => p.id === newItem.productoId);
            if (pMaestro) {
              const prodRef = doc(db, 'productos', newItem.productoId);
              const nuevoStock = pMaestro.stock - newItem.cantidad;
              batch.update(prodRef, { stock: nuevoStock, estado: calcularEstado(nuevoStock) });
            }
          }
        }
      } else {
        // Lógica normal para pedidos nuevos
        for (const item of form.productosSeleccionados) {
          const prodRef = doc(db, 'productos', item.productoId)
          const pData = productos.find(p => p.id === item.productoId)
          const nuevoStock = pData.stock - item.cantidad
          batch.update(prodRef, { 
            stock: nuevoStock,
            estado: calcularEstado(nuevoStock)
          })
        }
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
          await updateDoc(ref, {
            pagoEstado: 'pagado',
            abono: totalCalc,
            saldoPendiente: 0,
            total: totalCalc
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
          await updateDoc(ref, {
            abono: montoNum,
            saldoPendiente: totalCalc - montoNum,
            pagoEstado: isFull ? 'pagado' : 'parcial',
            total: totalCalc
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
          const productosList = pedido.productos || []
          for (const item of productosList) {
            const pData = productos.find(p => p.id === item.productoId)
            if (pData) { 
              const prodRef = doc(db, 'productos', item.productoId)
              const nuevoStock = Number(pData.stock) + Number(item.cantidad)
              batch.update(prodRef, { 
                stock: nuevoStock,
                estado: calcularEstado(nuevoStock)
              })
            }
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

  return (
    <div className="flex flex-col h-full relative">
      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-8 md:px-10 py-7 flex flex-col md:flex-row md:items-end gap-6 border-b border-outline-variant/20">
        <div className="flex-1">
          <h1 className="font-headline text-4xl text-secondary font-bold italic leading-tight">Pedidos</h1>
          <p className="text-primary font-label text-xs uppercase tracking-[0.2em] font-bold mt-1">Gestión y Entregas</p>
        </div>

        {/* TABS para navegar entre Pedidos e Historial de Clientes */}
        <div className="flex bg-surface-container-high p-1 rounded-2xl md:self-end self-start">
          <button 
            onClick={() => setActiveTab('pedidos')}
            className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'pedidos' ? 'bg-secondary text-white shadow-md' : 'text-outline hover:bg-surface-variant'}`}
          >
            Ventas
          </button>
          <button 
            onClick={() => setActiveTab('clientes')}
            className={`px-6 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${activeTab === 'clientes' ? 'bg-secondary text-white shadow-md' : 'text-outline hover:bg-surface-variant'}`}
          >
            Frecuentes
          </button>
        </div>

        <button onClick={openNew} className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-label font-bold uppercase text-xs tracking-widest shadow-md hover:scale-105 transition-all tour-pedidos-crear">
          <span className="material-symbols-outlined text-sm">add</span>
          Crear Pedido
        </button>
      </header>

      <div className="p-8 md:p-10 space-y-20 pb-32 flex-1 overflow-y-auto">
        {activeTab === 'pedidos' ? (
          <>
        {/* 1. Pedidos Pendientes (Sin Pagar) */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-error/10 flex items-center justify-center shadow-sm border border-error/5">
              <span className="material-symbols-outlined text-error text-2xl font-bold">priority_high</span>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">Pedidos Pendientes</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline">Sin ningún abono realizado</p>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-error/20 via-outline-variant/10 to-transparent mb-4" />
          {/* Vista Desktop (Tabla) */}
          <div className="hidden md:block bg-surface-container-low rounded-3xl overflow-hidden shadow-sm border border-error/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container">
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Cliente</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Fecha de Entrega</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Detalle y Total</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pedidos.filter(p => p.pagoEstado === 'sin pagar' || !p.pagoEstado).map(p => {
                    const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1
                    const isCritico = diasFaltantes >= 0 && diasFaltantes <= 3

                    return (
                      <Fragment key={p.id}>
                        <tr 
                          className={`hover:bg-surface-container-high transition-colors group cursor-pointer ${expandedId === p.id ? 'bg-surface-container-high' : ''}`}
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        >
                          <td className="px-7 py-5">
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                keyboard_arrow_down
                              </span>
                              <div>
                                <p className="font-headline font-bold text-base text-on-surface">{p.cliente}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-primary">Vía {p.medioPago}</span>
                                  {p.banco && <span className="text-[9px] font-bold uppercase tracking-widest text-outline">| {p.banco}</span>}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-7 py-5">
                            <div className="flex items-center gap-2">
                              <span className={`material-symbols-outlined text-lg ${isCritico ? 'text-error' : 'text-outline'}`}>event</span>
                              <span className={`font-bold ${isCritico ? 'text-error' : 'text-on-surface-variant'}`}>{p.fechaEntrega}</span>
                            </div>
                          </td>
                          <td className="px-7 py-5">
                            <p className="text-sm text-on-surface-variant mb-1">{p.productos.length} productos</p>
                            <p className="text-sm font-bold text-error">Total: ${p.total?.toLocaleString('es-CL')}</p>
                          </td>
                          <td className="px-7 py-5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
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
                          </td>
                        </tr>
                        {expandedId === p.id && (
                          <tr className="bg-surface-container-low/50">
                            <td colSpan={4} className="px-7 py-4">
                              <div className="bg-surface rounded-2xl p-4 border border-outline-variant/20 shadow-inner">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-primary mb-3">Detalle de Productos</h4>
                                <div className="space-y-2">
                                  {p.productos?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-outline-variant/10 pb-2 last:border-0">
                                      <span className="text-on-surface-variant">{item.cantidad}x <span className="font-bold text-on-surface">{item.nombre}</span></span>
                                      <span className="font-bold text-primary">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                    </div>
                                  ))}
                                  {p.comprobante && (
                                    <div className="mt-4 pt-4 border-t border-primary/10">
                                      <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600">Datos de Transferencia</p>
                                      <p className="text-sm text-on-surface-variant mt-1">
                                        Banco: <span className="font-bold text-on-surface">{p.banco}</span> | 
                                        Comprobante: <span className="font-bold text-on-surface">{p.comprobante}</span>
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    )
                  })}
                  {pedidos.filter(p => p.pagoEstado === 'sin pagar' || !p.pagoEstado).length === 0 && (
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
            {pedidos.filter(p => p.pagoEstado === 'sin pagar' || !p.pagoEstado).map(p => {
              const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1
              const isCritico = diasFaltantes >= 0 && diasFaltantes <= 3
              return (
                <div key={p.id} className="bg-surface-container-low rounded-[28px] p-4 shadow-sm border border-outline-variant/10 overflow-hidden">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                    <div className="w-14 h-14 bg-error/10 rounded-2xl flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-error text-2xl font-bold italic leading-none">P</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-headline font-bold text-base text-on-surface truncate">{p.cliente}</h3>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Entrega: {p.fechaEntrega}</p>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${isCritico ? 'bg-error text-on-error' : 'bg-primary/10 text-primary'}`}>
                        {p.medioPago}
                      </span>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-error leading-tight">${p.total?.toLocaleString('es-CL')}</p>
                      <span className="material-symbols-outlined text-outline text-xl transition-transform" style={{ transform: expandedId === p.id ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                    </div>
                  </div>
                  
                  {expandedId === p.id && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-3 mb-5">
                        {p.productos?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-on-surface-variant font-medium">{item.cantidad}x {item.nombre}</span>
                            <span className="font-bold text-on-surface">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                          </div>
                        ))}
                        {p.banco && (
                          <div className="bg-primary/5 p-3 rounded-xl">
                            <p className="text-[9px] font-bold uppercase tracking-widest text-primary">Datos de Transferencia</p>
                            <p className="text-xs font-bold text-on-surface mt-1">{p.banco} | {p.comprobante}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => handleEdit(p)} className="flex-1 bg-primary/10 text-primary py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm">
                          Editar
                        </button>
                        <button onClick={() => handleCompletarPago(p)} className="flex-1 bg-secondary text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm">
                          Pagar Todo
                        </button>
                        <button onClick={() => handleDelete(p)} className="w-12 bg-error/10 text-error flex items-center justify-center rounded-xl">
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {pedidos.filter(p => p.pagoEstado === 'sin pagar' || !p.pagoEstado).length === 0 && (
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
        </section>

        {/* 2. Pedidos Abonados (En Proceso) */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-75">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center shadow-sm border border-amber-500/5">
              <span className="material-symbols-outlined text-amber-600 text-2xl font-bold">payments</span>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">Pedidos Abonados</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline">En proceso de pago parcial</p>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-amber-500/20 via-outline-variant/10 to-transparent mb-4" />
          {/* Vista Desktop */}
          <div className="hidden md:block bg-surface-container-low rounded-3xl overflow-hidden shadow-sm border border-amber-500/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface-container">
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Cliente</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Fecha Entrega</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Estado del Abono</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline text-right">Saldo</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pedidos.filter(p => p.pagoEstado === 'parcial').map(p => {
                    const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0)
                    return (
                      <Fragment key={p.id}>
                        <tr 
                          className={`hover:bg-surface-container-high transition-colors group cursor-pointer ${expandedId === p.id ? 'bg-surface-container-high' : ''}`}
                          onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                        >
                          <td className="px-7 py-5">
                            <div className="flex items-center gap-3">
                              <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedId === p.id ? 'rotate-180' : ''}`}>
                                keyboard_arrow_down
                              </span>
                              <div>
                                <p className="font-headline font-bold text-base text-on-surface">{p.cliente}</p>
                                <div className="flex items-center gap-2">
                                  <span className="text-[9px] font-bold uppercase tracking-widest text-outline">Vía {p.canalVenta || p.medioPago}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-7 py-5">
                            <span className="font-bold text-on-surface-variant text-sm">{p.fechaEntrega}</span>
                          </td>
                          <td className="px-7 py-5">
                            <div className="w-32 bg-outline-variant/20 h-1.5 rounded-full overflow-hidden mb-2">
                              <div 
                                className="h-full bg-amber-500 rounded-full transition-all duration-1000"
                                style={{ width: `${Math.min(100, (p.abono / totalC) * 100)}%` }}
                              />
                            </div>
                            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                              {Math.round((p.abono / totalC) * 100)}% Cubierto
                            </p>
                          </td>
                          <td className="px-7 py-5 text-right">
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-bold text-outline uppercase tracking-wider">Abonado: ${p.abono?.toLocaleString('es-CL')}</p>
                              <p className="text-sm font-bold text-primary">Pendiente: ${(totalC - (p.abono || 0)).toLocaleString('es-CL')}</p>
                            </div>
                          </td>
                          <td className="px-7 py-5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => handleEdit(p)} className="text-primary hover:bg-primary-container p-2 rounded-full transition-colors" title="Editar Pedido">
                              <span className="material-symbols-outlined text-xl">edit</span>
                            </button>
                            <button onClick={() => handleActualizarAbono(p)} className="text-amber-600 hover:bg-amber-100 p-2 rounded-full transition-colors" title="Actualizar Abono">
                              <span className="material-symbols-outlined text-xl">edit_calendar</span>
                            </button>
                            <button onClick={() => handleCompletarPago(p)} className="text-secondary hover:bg-secondary-container p-2 rounded-full transition-colors" title="Liquidar Saldo (Pagado)">
                              <span className="material-symbols-outlined text-xl">price_check</span>
                            </button>
                            <button onClick={() => handleDelete(p)} className="text-error opacity-50 hover:opacity-100 hover:bg-error-container p-2 rounded-full transition-colors">
                              <span className="material-symbols-outlined text-xl">delete</span>
                            </button>
                          </td>
                        </tr>
                        {expandedId === p.id && (
                          <tr className="bg-surface-container-low/50">
                            <td colSpan={5} className="px-7 py-4">
                              <div className="bg-surface rounded-2xl p-4 border border-outline-variant/20 shadow-inner">
                                <h4 className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-3">Detalle de Productos</h4>
                                <div className="space-y-2">
                                  {p.productos?.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-sm border-b border-outline-variant/10 pb-2 last:border-0">
                                      <span className="text-on-surface-variant">{item.cantidad}x <span className="font-bold text-on-surface">{item.nombre}</span></span>
                                      <span className="font-bold text-primary">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                  {pedidos.filter(p => p.pagoEstado === 'parcial').length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-7 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                          <span className="material-symbols-outlined text-5xl">payments</span>
                          <div>
                            <p className="font-headline font-bold text-lg">Sin abonos en curso</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest">No hay pagos parciales por liquidar</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Vista Mobile */}
          <div className="md:hidden space-y-4">
            {pedidos.filter(p => p.pagoEstado === 'parcial').map(p => {
              const totalC = p.total || p.productos.reduce((acc, pr) => acc + (pr.cantidad * (pr.precio || 0)), 0)
              const perc = Math.round((p.abono / totalC) * 100)
              return (
                <div key={p.id} className="bg-surface-container-low rounded-[28px] p-4 shadow-sm border border-outline-variant/10">
                  <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                    <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-amber-600 text-2xl font-bold italic leading-none">A</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-headline font-bold text-base text-on-surface truncate">{p.cliente}</h3>
                      <p className="text-[9px] font-bold uppercase tracking-widest text-outline">Entrega: {p.fechaEntrega}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <div className="w-16 bg-outline-variant/20 h-1 rounded-full overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${perc}%` }} />
                        </div>
                        <span className="text-[9px] font-bold text-amber-600 uppercase">{perc}% Cubierto</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-outline uppercase tracking-wider italic">Saldo</p>
                      <p className="text-sm font-bold text-primary leading-tight">${(totalC - p.abono).toLocaleString('es-CL')}</p>
                    </div>
                  </div>
                  
                  {expandedId === p.id && (
                    <div className="mt-4 pt-4 border-t border-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-300">
                      <div className="space-y-2 mb-4 bg-surface p-3 rounded-2xl border border-outline-variant/10">
                        {p.productos?.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-on-surface-variant">{item.cantidad}x {item.nombre}</span>
                            <span className="font-bold text-on-surface">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                          </div>
                        ))}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => handleEdit(p)} className="col-span-2 bg-primary/10 text-primary py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm">
                          Editar Pedido
                        </button>
                        <button onClick={() => handleActualizarAbono(p)} className="bg-amber-100 text-amber-800 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest">
                          Nuevo Abono
                        </button>
                        <button onClick={() => handleCompletarPago(p)} className="bg-secondary text-white py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-sm">
                          Liquidar Todo
                        </button>
                        <button onClick={() => handleDelete(p)} className="col-span-2 bg-error/10 text-error py-2.5 rounded-xl font-bold text-[9px] uppercase tracking-widest">
                          Eliminar Pedido
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {pedidos.filter(p => p.pagoEstado === 'parcial').length === 0 && (
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
        </section>

        {/* 3. Historial de Finalizados */}
        <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center shadow-sm border border-secondary/5">
              <span className="material-symbols-outlined text-secondary text-2xl font-bold">verified_user</span>
            </div>
            <div>
              <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">Historial de Finalizados</h2>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline">Pedidos con pago completado</p>
            </div>
          </div>
          <div className="h-px w-full bg-gradient-to-r from-secondary/20 via-outline-variant/10 to-transparent mb-4" />
          {/* Vista Desktop */}
          <div className="hidden md:block bg-surface-container-low rounded-3xl overflow-hidden shadow-sm border border-outline-variant/5">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="bg-surface-container">
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Cliente</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Fecha de Entrega</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Total Pagado</th>
                    <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pedidos.filter(p => p.pagoEstado === 'pagado').map(p => (
                    <Fragment key={p.id}>
                      <tr 
                        className={`hover:bg-surface-container-high transition-colors cursor-pointer ${expandedId === p.id ? 'bg-surface-container-high' : ''}`}
                        onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                      >
                        <td className="px-7 py-5">
                          <div className="flex items-center gap-3">
                            <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${expandedId === p.id ? 'rotate-180' : ''}`}>
                              keyboard_arrow_down
                            </span>
                            <div>
                              <p className="font-headline font-bold text-base text-on-surface">{p.cliente}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold uppercase tracking-widest text-outline">Vía {p.medioPago}</span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-7 py-5">
                          <span className="font-bold text-on-surface-variant text-sm">{p.fechaEntrega}</span>
                        </td>
                        <td className="px-7 py-5">
                          <p className="text-sm font-bold text-secondary">${p.total?.toLocaleString('es-CL')}</p>
                        </td>
                        <td className="px-7 py-5 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleDelete(p)} 
                            className="text-error opacity-60 hover:opacity-100 hover:bg-error-container p-2 rounded-full transition-all"
                            title="Eliminar registro permanentemente"
                          >
                            <span className="material-symbols-outlined text-xl">delete_forever</span>
                          </button>
                        </td>
                      </tr>
                      {expandedId === p.id && (
                        <tr className="bg-surface-container-low/50">
                          <td colSpan={4} className="px-7 py-4">
                            <div className="bg-surface rounded-2xl p-4 border border-outline-variant/20 shadow-inner">
                              <h4 className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-3">Detalle de la Venta</h4>
                              <div className="space-y-2">
                                {p.productos?.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm border-b border-outline-variant/10 pb-2 last:border-0">
                                    <span className="text-on-surface-variant">{item.cantidad}x <span className="font-bold text-on-surface">{item.nombre}</span></span>
                                    <span className="font-bold text-secondary">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                  {pedidos.filter(p => p.pagoEstado === 'pagado').length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-7 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-40">
                          <span className="material-symbols-outlined text-5xl">history</span>
                          <div>
                            <p className="font-headline font-bold text-lg">Historial vacío</p>
                            <p className="text-[10px] font-bold uppercase tracking-widest">Aún no hay pedidos finalizados registrados</p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {/* Vista Mobile */}
          <div className="md:hidden space-y-4">
            {pedidos.filter(p => p.pagoEstado === 'pagado').map(p => (
              <div key={p.id} className="bg-surface-container-low rounded-[28px] p-4 shadow-sm border border-outline-variant/10">
                <div className="flex items-center gap-4 cursor-pointer" onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}>
                  <div className="w-14 h-14 bg-secondary/10 rounded-2xl flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-secondary text-2xl font-bold italic leading-none">H</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline font-bold text-base text-on-surface truncate">{p.cliente}</h3>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-outline">Finalizado el: {p.fechaEntrega}</p>
                    <span className="inline-flex px-2 py-0.5 rounded-full bg-secondary/10 text-secondary text-[9px] font-bold uppercase tracking-wider mt-1">
                      {p.medioPago}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-secondary leading-tight">${p.total?.toLocaleString('es-CL')}</p>
                    <span className="material-symbols-outlined text-outline text-xl transition-transform" style={{ transform: expandedId === p.id ? 'rotate(180deg)' : 'none' }}>expand_more</span>
                  </div>
                </div>
                
                {expandedId === p.id && (
                  <div className="mt-4 pt-4 border-t border-outline-variant/10 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="space-y-2 mb-4">
                      {p.productos?.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="text-on-surface-variant">{item.cantidad}x {item.nombre}</span>
                          <span className="font-bold text-secondary">${(item.precio * item.cantidad).toLocaleString('es-CL')}</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => handleDelete(p)} className="w-full bg-error/10 text-error py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-sm">delete_forever</span>
                      Eliminar del Historial
                    </button>
                  </div>
                )}
              </div>
            ))}
            {pedidos.filter(p => p.pagoEstado === 'pagado').length === 0 && (
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
        </section>
          </>
        ) : (
          <section className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shadow-sm border border-primary/5">
                  <span className="material-symbols-outlined text-primary text-2xl font-bold">groups</span>
                </div>
                <div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">Clientes Frecuentes</h2>
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-outline">Ranking por frecuencia de compra</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedClientes.map((cliente, idx) => (
                <div key={idx} className="bg-surface-container-low rounded-[32px] p-6 border border-outline-variant/10 shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center text-primary font-headline text-2xl font-bold italic">
                      {cliente.nombre.charAt(0).toUpperCase()}
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-outline block mb-1">Pedidos</span>
                      <span className="text-2xl font-headline font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-xl">
                        {cliente.pedidosCount}
                      </span>
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-headline font-bold text-lg text-on-surface truncate group-hover:text-primary transition-colors">
                        {cliente.nombre}
                      </h3>
                      <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-1">
                        Última compra: {cliente.ultimaCompra}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-outline-variant/10 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Inversión Total</span>
                      <span className="text-base font-bold text-primary">${cliente.totalGastado.toLocaleString('es-CL')}</span>
                    </div>
                  </div>
                </div>
              ))}

              {sortedClientes.length === 0 && (
                <div className="col-span-full py-20 text-center">
                  <div className="w-16 h-16 bg-outline-variant/10 rounded-full flex items-center justify-center mx-auto mb-4 opacity-40">
                    <span className="material-symbols-outlined text-3xl">person_search</span>
                  </div>
                  <p className="font-headline font-bold text-on-surface-variant">Aún no hay historial de clientes</p>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline mt-1">Registra tu primer pedido para ver estadísticas</p>
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-lg rounded-[32px] shadow-2xl border border-outline-variant/20 flex flex-col h-full md:h-auto max-h-[95vh] md:max-h-[85vh] overflow-hidden">
            {/* Header del Modal */}
            <div className="px-6 py-6 border-b border-outline-variant/10 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-primary text-2xl font-bold">
                    {editingId ? 'edit_note' : 'add_shopping_cart'}
                  </span>
                </div>
                <div>
                  <h2 className="font-headline text-2xl font-bold text-on-surface leading-tight">
                    {editingId ? 'Editar Pedido' : 'Nuevo Pedido'}
                  </h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-outline">
                    {editingId ? 'Modificar datos de la venta' : 'Agendar venta y entrega'}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowModal(false)} className="w-10 h-10 hover:bg-surface-container-high rounded-full flex items-center justify-center text-outline transition-colors">
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
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary font-bold shadow-sm"
                      placeholder="Ej. Juan Pérez"
                      value={form.cliente}
                      onChange={e => {
                        setForm({...form, cliente: e.target.value})
                        setShowClienteDropdown(true)
                      }}
                      onFocus={() => setShowClienteDropdown(true)}
                    />
                    {showClienteDropdown && form.cliente && sortedClientes.filter(c => c.nombre.toLowerCase().includes(form.cliente.toLowerCase()) && c.nombre.toLowerCase() !== form.cliente.toLowerCase()).length > 0 && (
                      <div className="absolute left-0 top-full mt-1 w-full bg-surface border border-outline-variant/20 rounded-xl shadow-lg z-[80] overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
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
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary font-bold shadow-sm"
                    value={form.fechaEntrega}
                    onChange={e => setForm({...form, fechaEntrega: e.target.value})}
                  />
                </div>
              </div>

              {/* Opción de Venta con Origen */}
              <div className="bg-surface-container-low p-5 rounded-3xl border border-outline-variant/10 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Venta con Origen / Lugar</p>
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
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Lugar o Canal de Venta</label>
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
                          className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-xs font-bold focus:outline-none focus:border-primary pr-10"
                          placeholder="Ej: Facebook, Jumbo, Cesfam..."
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm opacity-40">location_on</span>
                      </div>

                      {showCanalDropdown && (
                        <>
                          <div className="fixed inset-0 z-[60]" onClick={() => setShowCanalDropdown(false)} />
                          <div className="absolute left-0 top-full mt-2 w-full bg-surface border border-outline-variant/20 rounded-2xl shadow-xl z-[70] overflow-hidden">
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
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Estado del Pago</label>
                  <div className="flex p-1 bg-surface-container-high rounded-2xl gap-1 border border-outline-variant/10 shadow-inner">
                    <button 
                      type="button"
                      onClick={() => setForm({...form, pagoEstado: 'sin pagar'})}
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all duration-300 ${form.pagoEstado === 'sin pagar' ? 'bg-error text-white shadow-md scale-105' : 'text-outline hover:bg-surface-variant'}`}
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
                      className={`flex-1 py-2.5 rounded-xl text-[9px] font-bold uppercase transition-all duration-300 ${form.pagoEstado === 'pagado' ? 'bg-secondary text-white shadow-md scale-105' : 'text-outline hover:bg-surface-variant'}`}
                    >
                      Pagado
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Medio de Pago</label>
                  <div className="relative group">
                    <select 
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary font-bold appearance-none shadow-sm"
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
                      <option value="transferencia">Transferencia</option>
                      <option value="tarjeta">Tarjeta</option>
                      <option value="cuota">Cuota (Abono)</option>
                      <option value="efectivo">Efectivo</option>
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
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary font-bold shadow-sm"
                      placeholder="Ej: Banco Estado"
                      value={form.banco}
                      onChange={(e) => setForm({ ...form, banco: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-outline uppercase tracking-widest px-1">Comprobante / Operación</label>
                    <input 
                      type="text"
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:border-primary font-bold shadow-sm"
                      placeholder="N° de operación"
                      value={form.comprobante}
                      onChange={(e) => setForm({ ...form, comprobante: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {form.pagoEstado === 'parcial' || form.medioPago === 'cuota' ? (
                <div className="bg-amber-50 p-5 rounded-3xl border border-amber-200 space-y-4 animate-in fade-in zoom-in-95 duration-200 shadow-sm">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-amber-800 italic">Monto del Abono</label>
                    <span className="bg-amber-200/50 px-2 py-0.5 rounded-full text-[9px] font-bold text-amber-700 uppercase">
                      Saldo: ${(form.productosSeleccionados.reduce((acc, p) => acc + (p.cantidad * p.precio), 0) - (Number(form.abono) || 0)).toLocaleString('es-CL')}
                    </span>
                  </div>
                  <div className="relative group">
                    <span className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-600 font-black text-lg">$</span>
                    <input 
                      type="number" 
                      value={form.abono} 
                      onChange={e => setForm({...form, abono: e.target.value})}
                      className="w-full bg-white border-2 border-amber-100 rounded-2xl pl-10 pr-5 py-3 text-base focus:outline-none focus:border-amber-400 font-bold text-amber-950 shadow-inner"
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
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-xs text-left transition-all font-headline italic h-[38px] focus:outline-none focus:border-primary pr-10"
                      placeholder="BUSCAR PRODUCTO O SKU..."
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm opacity-40 group-focus-within:rotate-180 transition-transform duration-300 pointer-events-none">expand_more</span>
                  </div>

                  {showProdDropdown && (
                    <>
                      <div className="fixed inset-0 z-[60]" onClick={() => { setShowProdDropdown(false); setBusquedaProd(''); }} />
                      <div className="absolute left-0 top-full mt-2 w-full bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          {productos
                            .filter(p => !form.productosSeleccionados.map(ps => ps.productoId).includes(p.id))
                            .filter(p => 
                              p.nombre.toLowerCase().includes(busquedaProd.toLowerCase()) || 
                              (p.sku || '').toLowerCase().includes(busquedaProd.toLowerCase())
                            )
                            .sort((a, b) => new Date(b.fechaIngreso || 0) - new Date(a.fechaIngreso || 0))
                            .slice(0, 3)
                            .map((p, idx, arr) => (
                              <button 
                                key={p.id}
                                onClick={() => { handleAddProduct(p.id); setShowProdDropdown(false); setBusquedaProd(''); }}
                                disabled={p.stock <= 0}
                                className={`w-full flex items-center justify-between px-5 py-3.5 text-xs font-headline italic tracking-wide transition-colors text-left
                                  ${p.stock <= 0 ? 'opacity-40 cursor-not-allowed' : 'text-on-surface hover:bg-surface-variant'}
                                  ${idx !== arr.length - 1 ? 'border-b border-outline-variant/5' : ''}
                                `}
                              >
                                <div className="flex flex-col">
                                  <span>{p.nombre}</span>
                                  <span className={`text-[9px] ${p.stock <= 0 ? 'text-error' : 'text-secondary/60'} font-sans not-italic`}>
                                    {p.stock <= 0 ? 'Agotado' : `${p.stock} unidades disponibles`}
                                  </span>
                                </div>
                                {p.stock > 0 && <span className="material-symbols-outlined text-sm text-primary opacity-0 group-hover:opacity-100 transition-opacity">add_circle</span>}
                              </button>
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
                <div className="bg-surface-container-low rounded-xl p-4 space-y-3">
                  {form.productosSeleccionados.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center gap-3">
                      <p className="text-sm font-bold truncate flex-1">{item.nombre}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-outline">Cant:</span>
                        <input 
                          type="number" 
                          min="1" 
                          max={item.stockOriginal}
                          value={item.cantidad}
                          onChange={(e) => handleQuantityChange(item.productoId, e.target.value)}
                          className="w-16 bg-surface-container-lowest border border-outline-variant/30 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:border-primary"
                        />
                        <button onClick={() => handleRemoveProduct(item.productoId)} className="text-error/70 hover:text-error ml-2" title="Quitar">
                          <span className="material-symbols-outlined text-sm">close</span>
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

            <div className="bg-surface-container-low/50 px-6 py-6 flex flex-col md:flex-row justify-end gap-3 border-t border-outline-variant/10 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="w-full md:w-auto px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest text-outline hover:bg-surface-container-high transition-all order-2 md:order-1"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="w-full md:w-auto px-8 py-4 rounded-2xl font-bold text-xs uppercase tracking-widest bg-primary text-on-primary shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all order-1 md:order-2"
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
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-in fade-in duration-300" onClick={closeDialog} />
          <div className="bg-surface w-full max-w-sm rounded-[32px] shadow-2xl border border-outline-variant/20 overflow-hidden animate-in zoom-in-95 fade-in duration-300 relative z-10">
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
    </div>
  )
}
