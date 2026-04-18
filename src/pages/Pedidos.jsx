import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

const formInicial = { cliente: '', fechaEntrega: '', productosSeleccionados: [] }

export default function Pedidos() {
  const [pedidos, setPedidos] = useState([])
  const [productos, setProductos] = useState([])
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(formInicial)
  const [errorMsg, setErrorMsg] = useState('')
  const [showProdDropdown, setShowProdDropdown] = useState(false)
  const [busquedaProd, setBusquedaProd] = useState('')

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
    setErrorMsg('')
    setShowModal(true)
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
      productosSeleccionados: [...form.productosSeleccionados, { productoId: prod.id, nombre: prod.nombre, cantidad: 1, stockOriginal: prod.stock }]
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
    if (qty > prodRef.stockOriginal) {
      return setErrorMsg(`Stock insuficiente para ${prodRef.nombre}. Máximo: ${prodRef.stockOriginal}`)
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
    if (!form.cliente || !form.fechaEntrega || form.productosSeleccionados.length === 0) {
      return setErrorMsg('Cliente, fecha de entrega y al menos un producto son obligatorios.')
    }

    // Validación estricta final de stock antes de descontar
    for (const item of form.productosSeleccionados) {
      if (item.cantidad <= 0) {
        return setErrorMsg(`La cantidad de ${item.nombre} debe ser mayor a 0.`)
      }
      const pData = productos.find(p => p.id === item.productoId)
      if (!pData || pData.stock < item.cantidad) {
        return setErrorMsg(`Stock insuficiente de ${item.nombre} en este momento. Tienes ${pData ? pData.stock : 0}.`)
      }
    }

    try {
      const batch = writeBatch(db)

      // 1. Modificar Inventario (Restar)
      for (const item of form.productosSeleccionados) {
        const prodRef = doc(db, 'productos', item.productoId)
        const pData = productos.find(p => p.id === item.productoId)
        const nuevoStock = pData.stock - item.cantidad
        
        // Calcular nuevo estado
        const nuevoEstado = nuevoStock <= 10 ? (nuevoStock <= 5 ? 'critico' : 'bajo') : 'disponible'

        batch.update(prodRef, { 
          stock: nuevoStock,
          estado: nuevoEstado
        })
      }

      // 2. Crear Pedido
      const pedidoRef = doc(collection(db, 'pedidos'))
      batch.set(pedidoRef, {
        cliente: form.cliente,
        fechaEntrega: form.fechaEntrega,
        productos: form.productosSeleccionados.map(p => ({
          productoId: p.productoId,
          nombre: p.nombre,
          cantidad: p.cantidad
        })),
        fechaCreacion: new Date().toISOString(),
        estado: 'pendiente'
      })

      await batch.commit()
      setShowModal(false)
    } catch (e) {
      setErrorMsg('Error al guardar pedido: ' + e.message)
    }
  }

  async function handleDelete(pedido) {
    if (!window.confirm(`¿Estás seguro de cancelar/eliminar el pedido de ${pedido.cliente}? Los productos volverán al inventario.`)) return

    try {
      const batch = writeBatch(db)

      // Devolver stock al inventario
      for (const item of pedido.productos) {
        const pData = productos.find(p => p.id === item.productoId)
        if (pData) { // Si el producto aún existe en BD
          const prodRef = doc(db, 'productos', item.productoId)
          const nuevoStock = pData.stock + item.cantidad
          const nuevoEstado = nuevoStock <= 10 ? (nuevoStock <= 5 ? 'critico' : 'bajo') : 'disponible'
          
          batch.update(prodRef, { 
            stock: nuevoStock,
            estado: nuevoEstado
          })
        }
      }

      // Borrar pedido
      const pedidoRef = doc(db, 'pedidos', pedido.id)
      batch.delete(pedidoRef)

      await batch.commit()
    } catch(e) {
      alert("Error al eliminar pedido: " + e.message)
    }
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
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-8 md:px-10 py-7 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-outline-variant/20">
        <div>
          <h1 className="font-headline text-4xl text-secondary font-bold italic leading-tight">Pedidos</h1>
          <p className="text-primary font-label text-xs uppercase tracking-[0.2em] font-bold mt-1">Gestión y Entregas</p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 bg-secondary text-white px-6 py-3 rounded-xl font-label font-bold uppercase text-xs tracking-widest shadow-md hover:scale-105 transition-all tour-pedidos-crear">
          <span className="material-symbols-outlined text-sm">add</span>
          Crear Pedido
        </button>
      </header>

      <div className="p-8 md:p-10 space-y-8">
        <div className="bg-surface-container-low rounded-3xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-container">
                  <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Cliente</th>
                  <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Fecha de Entrega</th>
                  <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">Productos Solicitados</th>
                  <th className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {pedidos.map(p => {
                  const diasFaltantes = Math.floor((new Date(p.fechaEntrega) - new Date()) / (1000 * 60 * 60 * 24)) + 1
                  const isCritico = diasFaltantes >= 0 && diasFaltantes <= 3

                  return (
                    <tr key={p.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-7 py-5">
                        <p className="font-headline font-bold text-base text-on-surface">{p.cliente}</p>
                      </td>
                      <td className="px-7 py-5">
                        <div className="flex items-center gap-2">
                          <span className={`material-symbols-outlined text-lg ${isCritico ? 'text-error' : 'text-outline'}`}>event</span>
                          <span className={`font-bold ${isCritico ? 'text-error' : 'text-on-surface-variant'}`}>{p.fechaEntrega}</span>
                          {isCritico && (
                            <span className="px-2 py-0.5 bg-error/10 text-error text-[9px] font-extrabold uppercase rounded-full tracking-widest animate-pulse">
                              ¡En {diasFaltantes} {diasFaltantes === 1 ? 'día' : 'días'}!
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <ul className="space-y-1">
                          {p.productos.map((prod, idx) => (
                            <li key={idx} className="text-sm">
                              <span className="font-bold text-secondary mr-2">{prod.cantidad}x</span> 
                              <span className="text-on-surface-variant">{prod.nombre}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td className="px-7 py-5 text-right space-x-2">
                        <button onClick={() => generarRecordatorio(p)} className="text-secondary hover:bg-secondary-container p-2 rounded-full transition-colors tooltip" title="Agendar Recordatorio">
                          <span className="material-symbols-outlined text-xl">calendar_add_on</span>
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-error opacity-50 hover:opacity-100 hover:bg-error-container p-2 rounded-full transition-colors" title="Cancelar Módulo (Devuelve Stock)">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {pedidos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-7 py-12 text-center text-on-surface-variant text-sm border-t border-outline-variant/10">
                      No hay pedidos pendientes.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-lg rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col max-h-[90vh]">
            <div className="bg-surface-container-low px-6 py-4 flex justify-between items-center border-b border-outline-variant/20 shrink-0">
              <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">add_shopping_cart</span>
                Nuevo Pedido
              </h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="px-6 pt-6 space-y-6">
              {errorMsg && (
                <div className="bg-error-container text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2 shrink-0">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Nombre del Cliente</label>
                  <input 
                    type="text" 
                    value={form.cliente} 
                    onChange={e => setForm({...form, cliente: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Fecha de Entrega</label>
                  <input 
                    type="date" 
                    value={form.fechaEntrega} 
                    onChange={e => setForm({...form, fechaEntrega: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

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
                  <p className="text-[9px] text-on-surface-variant uppercase tracking-widest font-bold pt-2 border-t border-outline-variant/10 text-right">
                    El stock se descontará automáticamente.
                  </p>
                </div>
              )}
            </div>

            <div className="bg-surface-container-low px-6 py-4 flex justify-end gap-3 border-t border-outline-variant/20 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-widest bg-primary text-on-primary shadow-md hover:scale-105 transition-transform"
              >
                Confirmar y Agendar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
