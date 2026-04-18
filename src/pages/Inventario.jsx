// src/pages/Inventario.jsx
import { useState, useEffect } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import BarcodeScanner from '../components/BarcodeScanner'

const estadoConfig = {
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700 font-bold' },
  bajo:       { label: 'Stock bajo', cls: 'bg-yellow-100 text-yellow-800 font-bold' },
  critico:    { label: 'Crítico',    cls: 'bg-error text-on-error font-bold shadow-sm' },
}

const formInicial = { nombre: '', sku: '', coleccion: '', precio: 0, stock: 0, fechaIngreso: new Date().toISOString().split('T')[0], fotoUrl: '' }

export default function Inventario() {
  const [busqueda, setBusqueda]   = useState('')
  const [filtroCol, setFiltroCol] = useState('TODOS')
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [esNuevaCategoria, setEsNuevaCategoria] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [busquedaCat, setBusquedaCat] = useState('')

  // Estados del CRUD
  const [showModal, setShowModal] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
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
    setEsNuevaCategoria(false)
    setShowModal(true)
  }

  function openEdit(p) {
    setForm({ nombre: p.nombre, sku: p.sku, coleccion: (p.coleccion || '').trim().toUpperCase(), precio: p.precio, stock: p.stock, fechaIngreso: p.fechaIngreso || new Date().toISOString().split('T')[0], fotoUrl: p.fotoUrl || '' })
    setEditingId(p.id)
    setErrorMsg('')
    setEsNuevaCategoria(false)
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
      return setErrorMsg('Nombre, Cód. Barra y Categoría son obligatorios.')
    }
    
    // Validar duplicados
    const duplicate = productos.find(p => 
      p.id !== editingId && 
      (p.sku.toLowerCase() === form.sku.toLowerCase() || p.nombre.toLowerCase() === form.nombre.toLowerCase())
    )

    if (duplicate) {
      return setErrorMsg('Ya existe un producto con el mismo Nombre o Cód. Barra.')
    }

    const estadoFinal = form.stock <= 10 ? (form.stock <= 5 ? 'critico' : 'bajo') : 'disponible'
    
    const payload = {
      nombre: form.nombre,
      sku: form.sku,
      coleccion: form.coleccion.trim().toUpperCase(),
      precio: Number(form.precio) || 0,
      stock: Number(form.stock) || 0,
      estado: estadoFinal,
      fechaIngreso: form.fechaIngreso,
      fotoUrl: form.fotoUrl || ''
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
  const categoriasUnicas = [...new Set(productos.map(p => (p.coleccion || '').trim().toUpperCase()))].filter(Boolean)
  const colecciones = ['TODOS', ...categoriasUnicas]

  const filtrados = productos.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.sku.toLowerCase().includes(busqueda.toLowerCase())
    const matchCol  = filtroCol === 'TODOS' || (p.coleccion || '').trim().toUpperCase() === filtroCol
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

  function exportarCSV() {
    const encabezados = ['Producto', 'Cód. Barra', 'Categoría', 'Stock', 'Precio unit.', 'Estado', 'Fecha Ingreso']
    const filas = filtrados.map(p => [
      `"${(p.nombre || '').replace(/"/g, '""')}"`,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.coleccion || '').toUpperCase().replace(/"/g, '""')}"`,
      p.stock,
      p.precio,
      `"${(p.estado || '').toUpperCase()}"`,
      `"${p.fechaIngreso || ''}"`
    ])
    
    // Separamos con punto y coma (;) para que Excel en español lo divida en columnas automáticamente
    const csvContent = encabezados.join(";") + "\n" + filas.map(e => e.join(";")).join("\n")

    // Añadimos el BOM (\uFEFF) para forzar a Excel a leerlo en formato UTF-8 (corrige los tildes)
    const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", "inventario_leis.csv")
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  function exportarPDF() {
    try {
      const doc = new jsPDF()
      doc.text("Reporte de Inventario - Leis", 14, 15)
      
      const tableData = filtrados.map(p => [
        p.nombre,
        p.sku,
        p.coleccion,
        p.stock.toString(),
        `$${(p.precio || 0).toLocaleString('es-CL')}`,
        p.estado.toUpperCase(),
        p.fechaIngreso || '-'
      ])

      autoTable(doc, {
        startY: 20,
        head: [['Producto', 'Cód. Barra', 'Categoría', 'Stock', 'Precio', 'Estado', 'Fecha Ing.']],
        body: tableData,
      })

      doc.save("inventario_leis.pdf")
    } catch (e) {
      console.error("Error PDF:", e)
      alert("Hubo un error al generar el PDF. Revisa la consola.")
    }
  }

  return (
    <div className="flex flex-col h-full relative">

      {/* Header sticky */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-8 md:px-10 py-7 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-outline-variant/20 tour-inv-header">
        <div>
          <h1 className="font-headline text-4xl text-secondary font-bold italic leading-tight">Inventario Maestro</h1>
          <p className="text-primary font-label text-xs uppercase tracking-[0.2em] font-bold mt-1">Control de Existencias</p>
        </div>
      </header>

      <div className="p-8 md:p-10 space-y-8">

        {/* Métricas bento */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tour-inv-metricas">
          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between h-36">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">deployed_code</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-outline leading-none">Total Productos</p>
            </div>
            <p className="text-3xl font-headline italic font-bold">{totalSKUs.toLocaleString()}</p>
          </div>

          <div className={`p-6 rounded-xl flex flex-col justify-between h-36 shadow-lg border transition-colors ${bajosDeStock > 0 ? 'bg-error border-error' : 'bg-primary-container border-primary/10'}`}>
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-2xl ${bajosDeStock > 0 ? 'text-on-error opacity-90' : 'text-on-primary-container'}`}>priority_high</span>
              <p className={`text-[9px] uppercase tracking-widest font-extrabold leading-none ${bajosDeStock > 0 ? 'text-on-error opacity-80' : 'text-on-primary-container'}`}>Stock Bajo</p>
            </div>
            <p className={`text-3xl font-headline italic font-bold ${bajosDeStock > 0 ? 'text-on-error' : 'text-on-primary-container'}`}>{bajosDeStock}</p>
          </div>

          <div className="bg-surface-container-highest p-6 rounded-xl flex flex-col justify-between h-36">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-2xl">payments</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-outline leading-none">Valor Inventario</p>
            </div>
            <p className="font-headline italic font-bold text-xl md:text-2xl">${valorTotal.toLocaleString('es-CL')} CLP</p>
          </div>

          <div className="bg-secondary-container/20 p-6 rounded-xl flex flex-col justify-between h-36 border border-secondary-container/30">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary text-2xl">inventory_2</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-secondary leading-none">Unidades totales</p>
            </div>
            <p className="text-3xl font-headline italic font-bold text-secondary">{stockTotal.toLocaleString()}</p>
          </div>
        </div>

        {/* Tabla */}
        <div className="bg-surface-container-low rounded-3xl overflow-hidden shadow-sm">
          {/* Busqueda, Boton y Categorias */}
          <div className="p-7 border-b border-outline-variant/20 bg-surface-container/50 space-y-5">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div className="relative w-full md:w-auto">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar productos..."
                  className="w-full md:w-64 bg-surface-container rounded-full pl-10 pr-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/20 transition-all"
                />
              </div>
              <div className="flex items-center gap-2 w-full md:w-auto">
                <button onClick={openNew} className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-secondary text-white px-6 py-2.5 rounded-xl font-label font-bold uppercase text-[11px] tracking-widest shadow-md hover:shadow-lg hover:scale-105 transition-all tour-inv-nuevo">
                  <span className="material-symbols-outlined text-sm">add</span>
                  Nuevo Producto
                </button>
                <div className="relative">
                  <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2 border border-outline-variant rounded-xl hover:bg-surface transition-colors flex items-center justify-center text-on-surface-variant min-h-[40px]">
                    <span className="material-symbols-outlined text-lg">more_horiz</span>
                  </button>
                  {showExportMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                      <div className="absolute right-0 mt-2 w-48 bg-surface-container-lowest border border-outline-variant/20 rounded-xl shadow-xl z-20 py-2 overflow-hidden overflow-y-auto">
                        <button onClick={() => { exportarPDF(); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-surface-variant/50 text-[11px] font-bold uppercase tracking-widest text-on-surface transition-colors flex items-center gap-2">
                          <span className="material-symbols-outlined text-error text-lg">picture_as_pdf</span>
                          Exportar a PDF
                        </button>
                        <button onClick={() => { exportarCSV(); setShowExportMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-surface-variant/50 text-[11px] font-bold uppercase tracking-widest text-on-surface transition-colors flex items-center gap-2">
                          <span className="material-symbols-outlined text-green-600 text-lg">csv</span>
                          Exportar a CSV
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 pt-2 border-t border-outline-variant/10">
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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container">
                  {['Producto', 'Categoría', 'Stock', 'Precio unit.', 'Estado', 'Fecha Ingreso', ''].map(h => (
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
                        <div className="flex items-center gap-3">
                          {p.fotoUrl ? (
                            <img 
                              src={p.fotoUrl} 
                              alt={p.nombre} 
                              className="w-10 h-10 rounded-lg object-cover bg-surface-variant flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                              onClick={() => setExpandedImage(p.fotoUrl)}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-surface-variant flex items-center justify-center flex-shrink-0">
                              <span className="material-symbols-outlined text-outline text-lg">image</span>
                            </div>
                          )}
                          <div>
                            <p className="font-headline font-bold text-base text-on-surface">{p.nombre}</p>
                            <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Cód. Barra: {p.sku}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant text-on-surface-variant text-[10px] font-bold uppercase rounded-full inline-block whitespace-nowrap text-center">
                          {(p.coleccion || '').toUpperCase()}
                        </span>
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
                      <td className="px-7 py-5">
                        <span className="text-[10px] font-bold text-outline uppercase tracking-widest">{p.fechaIngreso || '-'}</span>
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

      {/* Modal Imagen Ampliada */}
      {expandedImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={() => setExpandedImage(null)}>
          <div className="relative max-w-2xl w-full flex items-center justify-center">
            <button 
              onClick={() => setExpandedImage(null)} 
              className="absolute -top-12 right-0 text-white hover:text-gray-300 transition-colors p-2"
            >
              <span className="material-symbols-outlined text-3xl">close</span>
            </button>
            <img 
              src={expandedImage} 
              alt="Vista ampliada" 
              className="max-h-[80vh] w-auto object-contain rounded-2xl shadow-2xl"
              onClick={e => e.stopPropagation()} 
            />
          </div>
        </div>
      )}

      {/* Modal CRUD */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col">
            <div className="bg-surface-container-low px-6 py-4 flex justify-between items-center border-b border-outline-variant/20">
              <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">{editingId ? 'edit_square' : 'add_box'}</span>
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-outline hover:text-on-surface">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <div className="p-6 space-y-4 pb-2">
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

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Cód. Barra</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={form.sku} 
                    onChange={e => setForm({...form, sku: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-4 pr-12 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="Ej. 789123456"
                  />
                  <button 
                    type="button" 
                    onClick={() => setIsScanning(true)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-primary hover:text-secondary bg-primary-container p-1.5 rounded-lg transition-colors flex items-center justify-center shadow-sm"
                    title="Escanear Código de Barras"
                  >
                    <span className="material-symbols-outlined text-[16px]">photo_camera</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sección de Categoría (Separada para evitar recortes del dropdown) */}
            <div className="px-6 py-2 relative">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Categoría</label>
                {(esNuevaCategoria || categoriasUnicas.length === 0) ? (
                  <div className="relative">
                    <input 
                      type="text" 
                      value={form.coleccion} 
                      onChange={e => setForm({...form, coleccion: e.target.value})}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary uppercase pr-10"
                      placeholder="NUEVA CATEGORÍA"
                      autoFocus={esNuevaCategoria}
                    />
                    {categoriasUnicas.length > 0 && (
                      <button 
                        type="button" 
                        onClick={() => {
                          setEsNuevaCategoria(false)
                          setForm({...form, coleccion: categoriasUnicas[0] || ''})
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-outline hover:text-primary transition-colors flex items-center p-1"
                        title="Volver a seleccionar de la lista"
                      >
                        <span className="material-symbols-outlined text-[16px]">close</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative group">
                      <input 
                        type="text"
                        value={busquedaCat}
                        onChange={(e) => {
                          setBusquedaCat(e.target.value)
                          if (!showCatDropdown) setShowCatDropdown(true)
                        }}
                        onFocus={() => setShowCatDropdown(true)}
                        className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-xs text-left transition-all font-headline italic h-[38px] focus:outline-none focus:border-primary pr-10"
                        placeholder={form.coleccion || "BUSCAR CATEGORÍA..."}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm opacity-40 group-focus-within:rotate-180 transition-transform duration-300 pointer-events-none">expand_more</span>
                    </div>

                    {showCatDropdown && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => { setShowCatDropdown(false); setBusquedaCat(''); }} />
                        <div className="absolute left-0 top-full mt-2 w-full bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          <div className="max-h-60 overflow-y-auto custom-scrollbar">
                            <button 
                              onClick={() => { setEsNuevaCategoria(true); setForm({...form, coleccion: busquedaCat || ''}); setShowCatDropdown(false); setBusquedaCat(''); }}
                              className="w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors text-left border-b border-outline-variant/10 font-sans not-italic"
                            >
                              <span className="material-symbols-outlined text-sm">add</span>
                              + {busquedaCat ? `Crear "${busquedaCat}"` : 'Añadir Nueva'}
                            </button>
                            {categoriasUnicas
                              .filter(cat => cat.toLowerCase().includes(busquedaCat.toLowerCase()))
                              .slice(0, 3)
                              .map(cat => (
                              <button 
                                key={cat}
                                onClick={() => { setForm({...form, coleccion: cat}); setShowCatDropdown(false); setBusquedaCat(''); }}
                                className={`w-full flex items-center justify-between px-5 py-3.5 text-xs font-headline italic tracking-wide transition-colors text-left
                                  ${form.coleccion === cat ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-variant'}
                                  ${cat !== categoriasUnicas[categoriasUnicas.length-1] ? 'border-b border-outline-variant/5' : ''}
                                `}
                              >
                                {cat}
                                {form.coleccion === cat && <span className="material-symbols-outlined text-sm">check</span>}
                              </button>
                            ))}
                            {busquedaCat && categoriasUnicas.filter(cat => cat.toLowerCase().includes(busquedaCat.toLowerCase())).length === 0 && (
                              <div className="px-5 py-4 text-center text-outline text-[10px] uppercase tracking-widest italic font-sans not-italic">
                                No hay coincidencias
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
            </div>

            <div className="p-6 pt-2 space-y-4">

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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">Fecha de Ingreso</label>
                  <input 
                    type="date" 
                    value={form.fechaIngreso} 
                    onChange={e => setForm({...form, fechaIngreso: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1">URL Foto (Opcional)</label>
                  <input 
                    type="url" 
                    value={form.fotoUrl || ''} 
                    onChange={e => setForm({...form, fotoUrl: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary"
                    placeholder="https://..."
                  />
                </div>
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

      {/* Visor de Escaneo de Cámara */}
      {isScanning && (
        <BarcodeScanner 
          onScan={(decodedText) => {
            setForm({ ...form, sku: decodedText })
            setIsScanning(false)
            // Pequeña notificación web nativa si soporta vibración
            if (window.navigator?.vibrate) window.navigator.vibrate(200)
          }}
          onClose={() => setIsScanning(false)}
        />
      )}
    </div>
  )
}
