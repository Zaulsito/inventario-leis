// src/pages/Inventario.jsx
import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../config/firebase'

const estadoConfig = {
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700' },
  bajo:       { label: 'Stock bajo', cls: 'bg-error-container text-error' },
  critico:    { label: 'Crítico',    cls: 'bg-error/15 text-error font-extrabold' },
}

const formInicial = { nombre: '', sku: '', coleccion: '', precio: 0, stock: 0, fechaIngreso: new Date().toISOString().split('T')[0] }

export default function Inventario() {
  const [busqueda, setBusqueda]   = useState('')
  const [filtroCol, setFiltroCol] = useState('Todos')
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)

  // Estados del CRUD
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(formInicial)
  const [editingId, setEditingId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setProductos(data)
      setLoading(false)
    })
    return unsub
  }, [])

  // Handlers del CRUD
  function openNew() {
    setForm(formInicial)
    setEditingId(null)
    setErrorMsg('')
    setShowModal(true)
  }

  function openEdit(p) {
    setForm({ nombre: p.nombre, sku: p.sku, coleccion: p.coleccion, precio: p.precio, stock: p.stock, fechaIngreso: p.fechaIngreso || new Date().toISOString().split('T')[0] })
    setEditingId(p.id)
    setErrorMsg('')
    setShowModal(true)
  }

  async function handleDelete(id) {
    if (window.confirm("¿Estás seguro de eliminar este producto de la base de datos?")) {
      await deleteDoc(doc(db, 'productos', id))
    }
  }

  async function handleSave() {
    setErrorMsg('')
    if (!form.nombre || !form.sku || !form.coleccion) {
      return setErrorMsg('Nombre, SKU y Colección son obligatorios.')
    }
    
    // Validar duplicados
    const duplicate = productos.find(p => 
      p.id !== editingId && 
      (p.sku.toLowerCase() === form.sku.toLowerCase() || p.nombre.toLowerCase() === form.nombre.toLowerCase())
    )

    if (duplicate) {
      return setErrorMsg('Ya existe un producto con el mismo Nombre o SKU.')
    }

    const estadoFinal = form.stock < 20 ? (form.stock < 10 ? 'critico' : 'bajo') : 'disponible'
    
    const payload = {
      nombre: form.nombre,
      sku: form.sku,
      coleccion: form.coleccion,
      precio: Number(form.precio) || 0,
      stock: Number(form.stock) || 0,
      estado: estadoFinal,
      fechaIngreso: form.fechaIngreso
    }

    try {
      if (editingId)  await updateDoc(doc(db, 'productos', editingId), payload)
      else            await addDoc(collection(db, 'productos'), payload)
      setShowModal(false)
    } catch (e) {
      setErrorMsg('Error al guardar: ' + e.message)
    }
  }

  // Calculos de tabla
  const colecciones = ['Todos', ...new Set(productos.map(p => p.coleccion))]

  const filtrados = productos.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.sku.toLowerCase().includes(busqueda.toLowerCase())
    const matchCol  = filtroCol === 'Todos' || p.coleccion === filtroCol
    return matchBusq && matchCol
  })

  const totalSKUs    = productos.length
  const bajosDeStock = productos.filter(p => p.estado === 'bajo' || p.estado === 'critico').length
  const valorTotal   = productos.reduce((acc, p) => acc + (p.stock * p.precio), 0)
  const stockTotal   = productos.reduce((acc, p) => acc + p.stock, 0)

  function porcBarra(stock) {
    if (productos.length === 0) return 0
    const max = Math.max(...productos.map(p => p.stock))
    return Math.round((stock / max) * 100)
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-8 md:px-10 py-7 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-outline-variant/20">
        <div>
          <h1 className="font-headline text-4xl text-secondary font-bold italic leading-tight">Inventario Maestro</h1>
          <p className="text-primary font-label text-xs uppercase tracking-[0.2em] font-bold mt-1">Control de Existencias</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
            <input
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar productos..."
              className="bg-surface-container-low rounded-full pl-10 pr-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container w-56 border border-outline-variant/20"
            />
          </div>
          <button onClick={openNew} className="flex items-center gap-2 bg-secondary text-white px-5 py-2.5 rounded-xl font-label font-bold uppercase text-[11px] tracking-widest hover:shadow-xl transition-shadow shadow-md">
            <span className="material-symbols-outlined text-sm">add</span>
            Nuevo Producto
          </button>
        </div>
      </header>

      <div className="p-8 md:p-10 space-y-8">

        {/* Métricas bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between h-36">
            <span className="material-symbols-outlined text-primary text-3xl">deployed_code</span>
            <div>
              <p className="text-3xl font-headline italic font-bold">{totalSKUs.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-outline">Total Productos</p>
            </div>
          </div>
          <div className="bg-primary-container p-6 rounded-xl flex flex-col justify-between h-36 shadow-lg border border-primary/10">
            <span className="material-symbols-outlined text-on-primary-container text-3xl">priority_high</span>
            <div>
              <p className="text-3xl font-headline italic font-bold text-on-primary-container">{bajosDeStock}</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-on-primary-container">Stock Bajo</p>
            </div>
          </div>
          <div className="bg-surface-container-highest p-6 rounded-xl flex flex-col justify-between h-36">
            <span className="material-symbols-outlined text-secondary text-3xl">payments</span>
            <div>
              <p className="text-2xl font-headline italic font-bold truncate">${valorTotal.toLocaleString('es-CL')} CLP</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-outline">Valor Inventario</p>
            </div>
          </div>
          <div className="bg-secondary-container/20 p-6 rounded-xl flex flex-col justify-between h-36 border border-secondary-container/30">
            <span className="material-symbols-outlined text-secondary text-3xl">inventory_2</span>
            <div>
              <p className="text-3xl font-headline italic font-bold text-secondary">{stockTotal.toLocaleString()}</p>
              <p className="text-[10px] uppercase tracking-widest font-extrabold text-secondary">Unidades totales</p>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-surface-container-low rounded-3xl overflow-hidden shadow-sm">
          {/* Toolbar tabla */}
          <div className="px-7 py-5 border-b border-outline-variant/20 bg-surface-container/50 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-2 flex-wrap">
              {colecciones.map(c => (
                <button
                  key={c}
                  onClick={() => setFiltroCol(c)}
                  className={`px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-colors ${
                    filtroCol === c
                      ? 'bg-secondary text-white border-secondary'
                      : 'border-outline-variant text-on-surface-variant hover:bg-surface'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-outline-variant rounded-lg hover:bg-surface transition-colors">
                Exportar PDF
              </button>
              <button className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest border border-outline-variant rounded-lg hover:bg-surface transition-colors">
                Exportar CSV
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container">
                  {['Producto', 'Colección', 'Stock', 'Precio unit.', 'Estado', ''].map(h => (
                    <th key={h} className="px-7 py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtrados.map(p => {
                  const est = estadoConfig[p.estado] || estadoConfig.disponible
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="px-7 py-5">
                        <p className="font-headline font-bold text-base text-on-surface">{p.nombre}</p>
                        <p className="text-[10px] font-bold text-outline uppercase tracking-widest">SKU: {p.sku}</p>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant text-on-surface-variant text-[10px] font-bold uppercase rounded-full">
                          {p.coleccion}
                        </span>
                        {p.fechaIngreso && (
                          <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-2">{p.fechaIngreso}</p>
                        )}
                      </td>
                      <td className="px-7 py-5">
                        <p className={`text-sm font-bold mb-1 ${p.estado !== 'disponible' ? 'text-error' : ''}`}>
                          {p.stock.toLocaleString()} u.
                        </p>
                        <div className="w-24 bg-outline-variant/20 h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.estado === 'disponible' ? 'bg-primary' : 'bg-error'}`}
                            style={{ width: `${porcBarra(p.stock)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <p className="text-sm font-bold text-secondary">${(p.precio || 0).toLocaleString('es-CL')}</p>
                      </td>
                      <td className="px-7 py-5">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-1 rounded-lg ${est.cls}`}>
                          {est.label.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5 text-right space-x-1">
                        <button onClick={() => openEdit(p)} className="text-outline hover:text-primary p-2 transition-colors opacity-0 group-hover:opacity-100" title="Editar">
                          <span className="material-symbols-outlined text-xl">edit</span>
                        </button>
                        <button onClick={() => handleDelete(p.id)} className="text-outline hover:text-error p-2 transition-colors opacity-0 group-hover:opacity-100" title="Eliminar">
                          <span className="material-symbols-outlined text-xl">delete</span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-7 py-12 text-center text-on-surface-variant text-sm">
                      No se encontraron productos. Crea uno nuevo usando el botón de arriba.
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
          <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20">
            <div className="bg-surface-container-low px-6 py-4 flex justify-between items-center border-b border-outline-variant/20">
              <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">{editingId ? 'edit_square' : 'add_box'}</span>
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="bg-error-container text-error text-sm px-4 py-3 rounded-xl flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Nombre</label>
                <input 
                  type="text" 
                  value={form.nombre} 
                  onChange={e => setForm({...form, nombre: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                  placeholder="Ej. Crema Hidratante"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">SKU</label>
                  <input 
                    type="text" 
                    value={form.sku} 
                    onChange={e => setForm({...form, sku: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary uppercase"
                    placeholder="INV-001"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Colección</label>
                  <input 
                    type="text" 
                    value={form.coleccion} 
                    onChange={e => setForm({...form, coleccion: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary uppercase"
                    placeholder="Ej. ESENCIAL"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Precio Unit. ($)</label>
                  <input 
                    type="number" 
                    value={form.precio} 
                    onChange={e => setForm({...form, precio: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Stock Inicial</label>
                  <input 
                    type="number" 
                    value={form.stock} 
                    onChange={e => setForm({...form, stock: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Fecha de Ingreso</label>
                <input 
                  type="date" 
                  value={form.fechaIngreso} 
                  onChange={e => setForm({...form, fechaIngreso: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <div className="bg-surface-container-low px-6 py-4 flex justify-end gap-3 border-t border-outline-variant/20">
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
                {editingId ? 'Guardar Cambios' : 'Crear Producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
