// src/pages/Inventario.jsx
import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore'
import { db } from '../config/firebase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
import BarcodeScanner from '../components/BarcodeScanner'
import { getLocalDateString } from '../utils/date'
import { calcularEstado } from '../utils/date'

const estadoConfig = {
  disponible: { label: 'Disponible', cls: 'bg-green-100 text-green-700 font-bold' },
  bajo:       { label: 'Stock bajo', cls: 'bg-yellow-100 text-yellow-800 font-bold' },
  critico:    { label: 'Crítico',    cls: 'bg-[#FF837C] text-white font-bold shadow-sm' },
  sin_stock:  { label: 'Sin stock',  cls: 'bg-gray-400 text-white font-bold' },
}

const formInicial = { 
  nombre: '', 
  sku: '', 
  coleccion: '', 
  proveedor: '', 
  marca: '',
  precio: '', 
  stock: '', 
  fechaIngreso: getLocalDateString(), 
  fotoUrl: '',
  variantes: []
}

export default function Inventario() {
  const [busqueda, setBusqueda]   = useState('')
  const [filtroCol, setFiltroCol] = useState('TODOS')
  const [orden, setOrden]         = useState('alfabetico-asc')
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [esNuevaCategoria, setEsNuevaCategoria] = useState(false)
  const [esNuevoProveedor, setEsNuevoProveedor] = useState(false)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [expandedImage, setExpandedImage] = useState(null)
  const [showCatDropdown, setShowCatDropdown] = useState(false)
  const [showProvDropdown, setShowProvDropdown] = useState(false)
  const [showMarcaDropdown, setShowMarcaDropdown] = useState(false)
  const [showOrdenDropdown, setShowOrdenDropdown] = useState(false)
  const [busquedaCat, setBusquedaCat] = useState('')
  const [busquedaProv, setBusquedaProv] = useState('')
  const [busquedaMarca, setBusquedaMarca] = useState('')
  const categoryContainerRef = useRef(null)

  // Estados del CRUD
  const [showModal, setShowModal] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [form, setForm] = useState(formInicial)
  const [editingId, setEditingId] = useState(null)
  const [expandedProduct, setExpandedProduct] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setProductos(data)
      setLoading(false)
    })
    return unsub
  }, [])

  useEffect(() => {
    if (showModal) {
      document.body.classList.add('modal-open')
    } else {
      document.body.classList.remove('modal-open')
    }
  }, [showModal])

  // Handlers del CRUD
  function openNew() {
    setForm(formInicial)
    setEditingId(null)
    setErrorMsg('')
    setEsNuevaCategoria(false)
    setEsNuevoProveedor(false)
    setShowModal(true)
  }

  function openEdit(p) {
    setForm({ 
      nombre: p.nombre, 
      sku: p.sku, 
      coleccion: (p.coleccion || '').trim().toUpperCase(), 
      proveedor: (p.proveedor || '').trim().toUpperCase(),
      marca: (p.marca || '').trim().toUpperCase(),
      precio: p.precio, 
      stock: p.stock, 
      fechaIngreso: p.fechaIngreso || getLocalDateString(), 
      fotoUrl: p.fotoUrl || '',
      variantes: p.variantes || []
    })
    setEditingId(p.id)
    setErrorMsg('')
    setEsNuevaCategoria(false)
    setEsNuevoProveedor(false)
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

    const stockCalculado = form.variantes && form.variantes.length > 0 
      ? form.variantes.reduce((sum, v) => sum + Number(v.stock), 0)
      : Math.floor(Number(form.stock))

    const estadoFinal = calcularEstado(stockCalculado)
    
    const payload = {
      nombre: form.nombre,
      sku: form.sku,
      coleccion: form.coleccion.trim().toUpperCase(),
      proveedor: (form.proveedor || '').trim().toUpperCase(),
      marca: (form.marca || '').trim().toUpperCase(),
      precio: Math.floor(Number(form.precio)) || 0,
      stock: stockCalculado,
      variantes: form.variantes || [],
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
  const categoriasUnicas = [...new Set(productos.map(p => (p.coleccion || '').trim().toUpperCase()))].filter(Boolean).sort()
  const proveedoresUnicos = [...new Set(productos.map(p => (p.proveedor || '').trim().toUpperCase()))].filter(Boolean).sort()
  const marcasUnicas = [...new Set(productos.map(p => (p.marca || '').trim().toUpperCase()))].filter(Boolean).sort()
  const colecciones = ['TODOS', ...categoriasUnicas]

  const filtrados = productos.filter(p => {
    const matchBusq = p.nombre.toLowerCase().includes(busqueda.toLowerCase()) || p.sku.toLowerCase().includes(busqueda.toLowerCase())
    const matchCol  = filtroCol === 'TODOS' || (p.coleccion || '').trim().toUpperCase() === filtroCol
    return matchBusq && matchCol
  }).sort((a, b) => {
    if (orden === 'alfabetico-asc') return a.nombre.localeCompare(b.nombre)
    if (orden === 'alfabetico-desc') return b.nombre.localeCompare(a.nombre)
    if (orden === 'fecha-desc') return new Date(b.fechaIngreso) - new Date(a.fechaIngreso)
    if (orden === 'stock-desc') return b.stock - a.stock
    if (orden === 'stock-asc') return a.stock - b.stock
    if (orden === 'precio-desc') return b.precio - a.precio
    if (orden === 'precio-asc') return a.precio - b.precio
    return 0
  })

  function scrollCategories(direction) {
    if (categoryContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      categoryContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const totalSKUs    = filtrados.length
  const bajosDeStock = filtrados.filter(p => p.estado === 'bajo' || p.estado === 'critico').length
  const valorTotal   = filtrados.reduce((acc, p) => acc + (p.stock * (p.precio || 0)), 0)
  const stockTotal   = filtrados.reduce((acc, p) => acc + p.stock, 0)

  function porcBarra(stock) {
    if (productos.length === 0) return 0
    const max = Math.max(...productos.map(p => p.stock))
    return Math.round((stock / max) * 100)
  }

  function exportarCSV() {
    const encabezados = ['Producto', 'Marca', 'Cód. Barra', 'Categoría', 'Stock', 'Precio unit.', 'Estado', 'Fecha Ingreso']
    const filas = []
    
    filtrados.forEach(p => {
      if (p.variantes && p.variantes.length > 0) {
        p.variantes.forEach(v => {
          filas.push([
            `"${(p.nombre || '').replace(/"/g, '""')} (${v.nombre.toUpperCase()})"`,
            `"${(p.marca || '').replace(/"/g, '""')}"`,
            `"${(p.sku || '').replace(/"/g, '""')}"`,
            `"${(p.coleccion || '').toUpperCase().replace(/"/g, '""')}"`,
            v.stock,
            p.precio,
            `"${calcularEstado(v.stock).toUpperCase()}"`,
            `"${p.fechaIngreso || ''}"`
          ])
        })
      } else {
        filas.push([
          `"${(p.nombre || '').replace(/"/g, '""')}"`,
          `"${(p.marca || '').replace(/"/g, '""')}"`,
          `"${(p.sku || '').replace(/"/g, '""')}"`,
          `"${(p.coleccion || '').toUpperCase().replace(/"/g, '""')}"`,
          p.stock,
          p.precio,
          `"${(p.estado || '').toUpperCase()}"`,
          `"${p.fechaIngreso || ''}"`
        ])
      }
    })
    
    const csvContent = encabezados.join(";") + "\n" + filas.map(e => e.join(";")).join("\n")
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
      // Título estilizado
      doc.setFontSize(20)
      doc.setTextColor(139, 115, 85) // Color secundario
      doc.setFont("helvetica", "bold")
      doc.text("Reporte de Inventario - Leis", 14, 20)
      
      doc.setFontSize(10)
      doc.setTextColor(100, 100, 100)
      doc.setFont("helvetica", "normal")
      doc.text(`Generado el: ${new Date().toLocaleString()}`, 14, 28)
      
      const tableData = []
      filtrados.forEach(p => {
        if (p.variantes && p.variantes.length > 0) {
          p.variantes.forEach(v => {
            tableData.push([
              `${p.nombre} (${v.nombre.toUpperCase()})`,
              p.marca || '-',
              p.sku,
              p.coleccion,
              v.stock.toString(),
              `$${(p.precio || 0).toLocaleString('es-CL')}`,
              calcularEstado(v.stock).toUpperCase(),
              p.fechaIngreso || '-'
            ])
          })
        } else {
          tableData.push([
            p.nombre,
            p.marca || '-',
            p.sku,
            p.coleccion,
            p.stock.toString(),
            `$${(p.precio || 0).toLocaleString('es-CL')}`,
            p.estado.toUpperCase(),
            p.fechaIngreso || '-'
          ])
        }
      })

      autoTable(doc, {
        startY: 35,
        head: [['Producto', 'Marca', 'Cód. Barra', 'Categoría', 'Stock', 'Precio', 'Estado', 'Fecha Ing.']],
        body: tableData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 4,
          lineColor: [255, 255, 255], // Líneas blancas para separar "cuadros"
          lineWidth: 1.5,
        },
        headStyles: {
          fillColor: [139, 115, 85], // Color secundario
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center',
          lineWidth: 0,
        },
        bodyStyles: {
          fillColor: [248, 245, 238], // Color crema muy suave (tipo tarjeta)
          textColor: [60, 60, 60],
          valign: 'middle',
        },
        columnStyles: {
          3: { halign: 'center' }, // Stock
          4: { halign: 'right', fontStyle: 'bold' }, // Precio
          5: { halign: 'center' }, // Estado
        },
        // Estilo alternado muy sutil para dar profundidad
        alternateRowStyles: {
          fillColor: [242, 238, 228],
        },
        margin: { left: 14, right: 14 },
      })
      doc.save("inventario_leis.pdf")
    } catch (e) {
      console.error("Error PDF:", e)
      alert("Hubo un error al generar el PDF. Revisa la consola.")
    }
  }

  return (
    <div className="flex flex-col h-full relative">

      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-8 md:px-10 py-7 flex flex-col md:flex-row md:justify-between md:items-end gap-4 border-b border-outline-variant/20 tour-inv-header">
        <div>
          <h1 className="font-headline text-4xl text-secondary font-bold italic leading-tight">Inventario Maestro</h1>
          <p className="text-primary font-label text-xs uppercase tracking-[0.2em] font-bold mt-1">Control de Existencias</p>
        </div>
      </header>

      <div className="p-8 md:p-10 space-y-8">

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 tour-inv-metricas">
          <div className="bg-surface-container-low p-6 rounded-xl flex flex-col justify-between h-36">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary text-2xl">deployed_code</span>
              <p className="text-[9px] uppercase tracking-widest font-extrabold text-outline leading-none">Total Productos</p>
            </div>
            <p className="text-3xl font-headline italic font-bold">{totalSKUs.toLocaleString()}</p>
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

          <div className={`p-6 rounded-xl flex flex-col justify-between h-36 shadow-lg border transition-colors ${bajosDeStock > 0 ? 'bg-[#FF837C] border-[#FF837C]' : 'bg-primary-container border-primary/10'}`}>
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-2xl ${bajosDeStock > 0 ? 'text-on-error opacity-90' : 'text-on-primary-container'}`}>priority_high</span>
              <p className={`text-[9px] uppercase tracking-widest font-extrabold leading-none ${bajosDeStock > 0 ? 'text-on-error opacity-80' : 'text-on-primary-container'}`}>Stock Bajo</p>
            </div>
            <p className={`text-3xl font-headline italic font-bold ${bajosDeStock > 0 ? 'text-on-error' : 'text-on-primary-container'}`}>{bajosDeStock}</p>
          </div>
        </div>

        <div className="bg-surface-container-low rounded-3xl shadow-sm overflow-visible">
          <div className="p-4 md:p-7 pb-8 border-b-2 border-outline-variant/30 bg-surface-container/50 space-y-6 rounded-t-3xl overflow-visible">
            
            <div className="relative flex items-center group">
              <button 
                onClick={() => scrollCategories('left')} 
                className="absolute left-0 z-10 bg-surface/80 backdrop-blur-md p-1.5 rounded-full shadow-md border border-outline-variant/20 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center scale-90"
              >
                <span className="material-symbols-outlined text-sm">chevron_left</span>
              </button>
              
              <div 
                ref={categoryContainerRef}
                className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth px-2 py-1 flex-1 mask-horizontal-fade"
              >
                {colecciones.map(c => (
                  <button
                    key={c}
                    onClick={() => setFiltroCol(c)}
                    className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-all whitespace-nowrap shrink-0
                      ${filtroCol === c
                        ? 'bg-secondary text-white border-secondary shadow-md scale-105'
                        : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface/50 hover:border-outline-variant'
                      }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <button 
                onClick={() => scrollCategories('right')} 
                className="absolute right-0 z-10 bg-surface/80 backdrop-blur-md p-1.5 rounded-full shadow-md border border-outline-variant/20 translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity hidden md:flex items-center justify-center scale-90"
              >
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              </button>
            </div>
            
            <div className="flex flex-col xl:flex-row gap-4 pt-2 border-t border-outline-variant/10">
              <div className="flex flex-col md:flex-row gap-3 flex-1">
                <div className="flex items-center gap-2 flex-1 max-w-2xl">
                  <div className="relative flex-1">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-sm">search</span>
                    <input
                      value={busqueda}
                      onChange={e => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre o código..."
                      className="w-full bg-surface-container-low rounded-xl pl-10 pr-5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-container border border-outline-variant/20 transition-all font-bold placeholder:font-normal"
                    />
                  </div>
                  
                  <div className="relative shrink-0">
                    <button onClick={() => setShowExportMenu(!showExportMenu)} className="p-2.5 bg-surface-container-low border border-outline-variant/20 rounded-xl hover:bg-surface transition-colors flex items-center justify-center text-on-surface-variant shadow-sm h-[42px] px-3">
                      <span className="material-symbols-outlined text-lg">more_horiz</span>
                    </button>
                    {showExportMenu && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowExportMenu(false)} />
                        <div className="absolute right-0 mt-2 w-48 bg-surface-container-highest border border-outline-variant/20 rounded-xl shadow-xl z-[70] py-2 overflow-hidden">
                          <button onClick={() => { exportarPDF(); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-variant/50 text-[11px] font-bold uppercase tracking-widest text-on-surface transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-error text-lg">picture_as_pdf</span>
                            Exportar a PDF
                          </button>
                          <button onClick={() => { exportarCSV(); setShowExportMenu(false); }} className="w-full text-left px-4 py-3 hover:bg-surface-variant/50 text-[11px] font-bold uppercase tracking-widest text-on-surface transition-colors flex items-center gap-2">
                            <span className="material-symbols-outlined text-green-600 text-lg">csv</span>
                            Exportar a CSV
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-1 md:flex-none h-[42px]">
                  <div className="relative flex-1 md:flex-none h-full">
                    <button 
                      onClick={() => setShowOrdenDropdown(!showOrdenDropdown)}
                      className="flex items-center bg-surface-container-low border border-outline-variant/20 rounded-2xl px-3 md:px-4 gap-2 md:gap-3 hover:bg-surface-variant/30 transition-all shadow-sm min-w-[120px] md:min-w-[150px] justify-between h-full"
                    >
                      <div className="flex items-center gap-1.5 md:gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">sort</span>
                        <span className="text-[9px] md:text-[10px] font-bold uppercase tracking-widest text-on-surface whitespace-nowrap">
                          {orden === 'alfabetico-asc' && 'A - Z'}
                          {orden === 'alfabetico-desc' && 'Z - A'}
                          {orden === 'fecha-desc' && 'Reciente'}
                          {orden === 'stock-desc' && 'Stock Max'}
                          {orden === 'stock-asc' && 'Stock Min'}
                          {orden === 'precio-desc' && 'Precio Max'}
                          {orden === 'precio-asc' && 'Precio Min'}
                        </span>
                      </div>
                      <span className={`material-symbols-outlined text-sm opacity-40 transition-transform duration-300 ${showOrdenDropdown ? 'rotate-180' : ''}`}>expand_more</span>
                    </button>

                    {showOrdenDropdown && (
                      <>
                        <div className="fixed inset-0 z-[60]" onClick={() => setShowOrdenDropdown(false)} />
                        <div className="absolute left-0 top-full mt-2 w-[220px] bg-surface-container-highest border border-outline-variant/20 rounded-2xl shadow-2xl z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          {[
                            { id: 'alfabetico-asc', label: 'A - Z', icon: 'sort_by_alpha' },
                            { id: 'alfabetico-desc', label: 'Z - A', icon: 'sort_by_alpha' },
                            { id: 'fecha-desc', label: 'Más reciente', icon: 'calendar_today' },
                            { id: 'stock-desc', label: 'Mayor Stock', icon: 'trending_down' },
                            { id: 'stock-asc', label: 'Menor Stock', icon: 'trending_up' },
                            { id: 'precio-desc', label: 'Mayor Precio', icon: 'payments' },
                            { id: 'precio-asc', label: 'Menor Precio', icon: 'sell' },
                          ].map((opc) => (
                            <button
                              key={opc.id}
                              onClick={() => { setOrden(opc.id); setShowOrdenDropdown(false); }}
                              className={`w-full flex items-center gap-3 px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest transition-colors text-left
                                ${orden === opc.id ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-variant'}
                              `}
                            >
                              <span className="material-symbols-outlined text-sm">{opc.icon}</span>
                              {opc.label}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                  
                  <button onClick={openNew} className="flex-1 md:flex-none h-full flex items-center justify-center gap-1.5 md:gap-2 bg-secondary text-white px-3 md:px-5 rounded-xl font-label font-bold uppercase text-[9px] md:text-[10px] tracking-tight md:tracking-widest shadow-md hover:shadow-lg hover:scale-105 transition-all tour-inv-nuevo whitespace-nowrap">
                    <span className="material-symbols-outlined text-sm">add</span>
                    <span className="hidden sm:inline">Nuevo Producto</span>
                    <span className="sm:hidden">Nuevo</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="md:hidden divide-y divide-outline-variant/10">
            {filtrados.map((p) => {
              const est = estadoConfig[p.estado] || estadoConfig.disponible
              const isExpanded = expandedProduct === p.id
              
              return (
                <div key={p.id} className="bg-surface-container-low overflow-hidden transition-all duration-300">
                  <div 
                    onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
                    className="p-4 flex items-center gap-4 active:bg-surface-variant/20 transition-colors cursor-pointer"
                  >
                    <div className="w-14 h-14 rounded-xl bg-surface-container overflow-hidden shrink-0 border border-outline-variant/20 shadow-sm flex items-center justify-center">
                      {p.fotoUrl ? (
                        <img 
                          src={p.fotoUrl} 
                          alt={p.nombre} 
                          className="w-full h-full object-cover"
                          onClick={(e) => { e.stopPropagation(); setExpandedImage(p.fotoUrl); }}
                        />
                      ) : (
                        <span className="material-symbols-outlined text-outline/40">image</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-headline font-bold text-base text-on-surface truncate leading-tight mb-0.5">{p.nombre}</h4>
                      {p.marca && <p className="text-[10px] text-outline font-bold uppercase tracking-widest leading-none mt-0.5">Marca: {p.marca}</p>}
                      <p className="text-[10px] text-outline font-bold uppercase tracking-widest leading-none">SKU: {p.sku}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${est.cls}`}>
                        {est.label.toUpperCase()}
                      </span>
                      <p className="text-secondary font-bold text-xs">${(p.precio || 0).toLocaleString('es-CL')}</p>
                    </div>
                    <span className={`material-symbols-outlined text-outline transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>expand_more</span>
                  </div>

                  <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isExpanded ? 'max-h-[800px] opacity-100 pb-5 px-4' : 'max-h-0 opacity-0'}`}>
                    {p.variantes && p.variantes.length > 0 && (
                      <div className="mb-4 bg-surface-container/30 rounded-xl p-3 border border-outline-variant/10">
                        <p className="text-[9px] font-bold text-outline-variant uppercase tracking-wider mb-2">Desglose por Variantes</p>
                        <div className="grid grid-cols-2 gap-2">
                          {p.variantes.map((v, i) => (
                            <div key={i} className="flex justify-between items-center bg-surface-container-low px-3 py-2 rounded-lg border border-outline-variant/5">
                              <span className="text-[10px] font-bold text-on-surface uppercase">{v.nombre}</span>
                              <span className="text-[10px] font-extrabold text-secondary">{v.stock} u.</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-outline-variant/10">
                      <div className="space-y-4">
                        <p className="text-[9px] font-bold text-outline-variant uppercase tracking-wider">Detalles</p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60">store</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline leading-none">Proveedor</p>
                              <p className="text-[11px] font-bold text-on-surface">{(p.proveedor || 'S/P').toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60">category</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline leading-none">Categoría</p>
                              <p className="text-[11px] font-bold text-on-surface">{(p.coleccion || '').toUpperCase()}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-sm text-primary/60">calendar_today</span>
                            <div>
                              <p className="text-[8px] uppercase text-outline leading-none">Ingreso</p>
                              <p className="text-[11px] font-bold text-on-surface">{p.fechaIngreso || '-'}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col justify-between">
                        <div>
                          <p className="text-[9px] font-bold text-outline-variant uppercase tracking-wider mb-2">Inventario</p>
                          <div className="flex items-end justify-between mb-1">
                            <p className={`text-base font-bold ${p.estado !== 'disponible' ? 'text-error' : 'text-primary'}`}>
                              {p.stock.toLocaleString()} <span className="text-[10px] font-medium opacity-70">u.</span>
                            </p>
                          </div>
                          <div className="w-full bg-outline-variant/20 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${p.estado === 'disponible' ? 'bg-primary' : 'bg-[#FF837C]'}`}
                              style={{ width: `${porcBarra(p.stock)}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button 
                            onClick={(e) => { e.stopPropagation(); openEdit(p); }}
                            className="flex-1 flex items-center justify-center gap-2 bg-surface-container-high border border-outline-variant/20 text-primary py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">edit</span>
                            Editar
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                            className="flex-1 flex items-center justify-center gap-2 bg-error-container/20 border border-error/10 text-error py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm active:scale-95 transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">delete</span>
                            Borrar
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[640px]">
              <thead>
                <tr className="bg-surface-container">
                  {['', 'Producto', 'Proveedor', 'Categoría', 'Stock', 'Precio unit.', 'Estado', 'Fecha Ingreso'].map((h, i) => (
                    <th key={i} className={`py-5 font-label font-extrabold text-[10px] uppercase tracking-[0.2em] text-outline whitespace-nowrap ${i === 0 ? 'pl-8 w-12' : 'px-7'} ${i === 8 ? 'pr-10' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {filtrados.map(p => {
                  const est = estadoConfig[p.estado] || estadoConfig.disponible
                  return (
                    <tr key={p.id} className="hover:bg-surface-container-high transition-colors group">
                      <td className="pl-8 py-5">
                        <div className="flex flex-col gap-2 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-[-10px] group-hover:translate-x-0">
                          <button onClick={() => openEdit(p)} className="text-outline/40 hover:text-primary transition-colors" title="Editar">
                            <span className="material-symbols-outlined text-[18px]">edit</span>
                          </button>
                          <button onClick={() => handleDelete(p.id)} className="text-outline/40 hover:text-error transition-colors" title="Eliminar">
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      </td>
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
                            {p.marca && <p className="text-[10px] font-bold text-outline uppercase tracking-widest mt-0.5">Marca: {p.marca}</p>}
                            <p className="text-[10px] font-bold text-outline uppercase tracking-widest">Cód. Barra: {p.sku}</p>
                            {p.variantes && p.variantes.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {p.variantes.map((v, i) => (
                                  <span key={i} className="text-[8px] bg-surface-variant px-1.5 py-0.5 rounded text-on-surface-variant font-bold uppercase">{v.nombre} ({v.stock})</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant/40 text-on-surface-variant text-[10px] font-bold uppercase rounded-full inline-block whitespace-nowrap text-center">
                          {(p.proveedor || 'S/P').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        <span className="px-3 py-1 bg-surface-variant text-on-surface-variant text-[10px] font-bold uppercase rounded-full inline-block whitespace-nowrap text-center">
                          {(p.coleccion || '').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-7 py-5">
                        <p className={`text-sm font-bold mb-1 ${p.estado !== 'disponible' ? 'text-error' : ''}`}>
                          {p.stock.toLocaleString()} <span className="text-[10px] opacity-60">u.</span>
                        </p>
                        <div className="w-16 bg-outline-variant/20 h-1 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${p.estado === 'disponible' ? 'bg-primary' : 'bg-[#FF837C]'}`}
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
                        <span className="text-[10px] font-bold text-outline uppercase tracking-widest whitespace-nowrap">{p.fechaIngreso || '-'}</span>
                      </td>
                    </tr>

                  )
                })}
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-7 py-12 text-center text-on-surface-variant text-sm">
                      No se encontraron productos. Crea uno nuevo usando el botón de arriba.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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

      {/* Modal CRUD (NUEVO / EDITAR) */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl border border-outline-variant/20 flex flex-col max-h-[90vh] overflow-hidden">
            {/* Header del Modal */}
            <div className="bg-surface-container-low px-6 py-5 flex justify-between items-center border-b border-outline-variant/20 shrink-0">
              <h3 className="font-headline font-bold text-xl text-primary flex items-center gap-2">
                <span className="material-symbols-outlined">{editingId ? 'edit_square' : 'add_box'}</span>
                {editingId ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button 
                onClick={() => setShowModal(false)} 
                className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-variant transition-colors text-outline"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            {/* Cuerpo del Formulario (Scrollable) */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
              {errorMsg && (
                <div className="bg-error-container/20 text-error text-[11px] font-bold uppercase tracking-wider px-4 py-3 rounded-xl border border-error/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-1">
                  <span className="material-symbols-outlined text-base">error</span>
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* Fila 1: Nombre */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Nombre del Producto</label>
                <input 
                  type="text" 
                  value={form.nombre} 
                  onChange={e => setForm({...form, nombre: e.target.value})}
                  className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm transition-all"
                  placeholder="Ej. Crema Collagen"
                />
              </div>

              {/* Fila 2: Marca y SKU */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Marca</label>
                  <input 
                    type="text" 
                    value={form.marca} 
                    onChange={e => setForm({...form, marca: e.target.value})}
                    onFocus={() => setShowMarcaDropdown(true)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm transition-all uppercase"
                    placeholder="BUSCAR MARCA..."
                  />
                  {showMarcaDropdown && (
                    <>
                      <div className="fixed inset-0 z-[110]" onClick={() => setShowMarcaDropdown(false)} />
                      <div className="absolute left-0 top-full mt-1 w-full bg-[#E5E0D3] rounded-2xl shadow-2xl z-[120] py-2 border border-outline-variant/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                        <button 
                          type="button"
                          onClick={() => setShowMarcaDropdown(false)}
                          className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] flex items-center gap-2 hover:bg-black/5 transition-colors"
                        >
                          <span className="text-lg font-bold">+</span> <span className="text-lg font-bold">+</span> AÑADIR NUEVA
                        </button>
                        {marcasUnicas
                          .filter(m => m.toLowerCase().includes((form.marca || '').toLowerCase()))
                          .slice(0, 3)
                          .map(m => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => { setForm({...form, marca: m}); setShowMarcaDropdown(false); }}
                              className="w-full text-left px-5 py-4 text-[13px] font-bold uppercase italic text-[#4A4A4A] hover:bg-black/5 transition-colors border-t border-black/10"
                            >
                              {m}
                            </button>
                          ))
                        }
                      </div>
                    </>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Código de Barra / SKU</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={form.sku} 
                      onChange={e => setForm({...form, sku: e.target.value})}
                      className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl pl-4 pr-14 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm transition-all"
                      placeholder="Escribe o escanea..."
                    />
                    <button 
                      type="button" 
                      onClick={() => setIsScanning(true)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-primary-container text-primary rounded-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Fila 3: Proveedor y Categoría */}
              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Proveedor</label>
                  <input 
                    type="text" 
                    value={form.proveedor} 
                    onChange={e => setForm({...form, proveedor: e.target.value})}
                    onFocus={() => setShowProvDropdown(true)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm uppercase"
                    placeholder="BUSCAR PROVEEDOR..."
                  />
                  {showProvDropdown && (
                    <>
                      <div className="fixed inset-0 z-[110]" onClick={() => setShowProvDropdown(false)} />
                      <div className="absolute left-0 top-full mt-1 w-full bg-[#E5E0D3] rounded-2xl shadow-2xl z-[120] py-2 border border-outline-variant/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                        <button 
                          type="button"
                          onClick={() => setShowProvDropdown(false)}
                          className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] flex items-center gap-2 hover:bg-black/5 transition-colors"
                        >
                          <span className="text-lg font-bold">+</span> <span className="text-lg font-bold">+</span> AÑADIR NUEVO
                        </button>
                        {proveedoresUnicos
                          .filter(p => p.toLowerCase().includes((form.proveedor || '').toLowerCase()))
                          .slice(0, 3)
                          .map(p => (
                            <button
                              key={p}
                              type="button"
                              onClick={() => { setForm({...form, proveedor: p}); setShowProvDropdown(false); }}
                              className="w-full text-left px-5 py-4 text-[13px] font-bold uppercase italic text-[#4A4A4A] hover:bg-black/5 transition-colors border-t border-black/10"
                            >
                              {p}
                            </button>
                          ))
                        }
                      </div>
                    </>
                  )}
                </div>

                <div className="relative">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Categoría</label>
                  <input 
                    type="text" 
                    value={form.coleccion} 
                    onChange={e => setForm({...form, coleccion: e.target.value})}
                    onFocus={() => setShowCatDropdown(true)}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm uppercase"
                    placeholder="BUSCAR CATEGORÍA..."
                  />
                  {showCatDropdown && (
                    <>
                      <div className="fixed inset-0 z-[110]" onClick={() => setShowCatDropdown(false)} />
                      <div className="absolute left-0 top-full mt-1 w-full bg-[#E5E0D3] rounded-2xl shadow-2xl z-[120] py-2 border border-outline-variant/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                        <button 
                          type="button"
                          onClick={() => setShowCatDropdown(false)}
                          className="w-full text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest text-[#8B7355] flex items-center gap-2 hover:bg-black/5 transition-colors"
                        >
                          <span className="text-lg font-bold">+</span> <span className="text-lg font-bold">+</span> AÑADIR NUEVA
                        </button>
                        {categoriasUnicas
                          .filter(c => c.toLowerCase().includes((form.coleccion || '').toLowerCase()))
                          .slice(0, 3)
                          .map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => { setForm({...form, coleccion: c}); setShowCatDropdown(false); }}
                              className="w-full text-left px-5 py-4 text-[13px] font-bold uppercase italic text-[#4A4A4A] hover:bg-black/5 transition-colors border-t border-black/10"
                            >
                              {c}
                            </button>
                          ))
                        }
                      </div>
                    </>
                  )}
                </div>
              </div>


              {/* Fila 4: Precio y Stock */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Precio Unit. ($)</label>
                  <input 
                    type="number" 
                    value={form.precio} 
                    onChange={e => setForm({...form, precio: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">
                    {form.variantes?.length > 0 ? 'Stock Total' : 'Stock Inicial'}
                  </label>
                  <input 
                    type="number" 
                    value={form.variantes?.length > 0 ? form.variantes.reduce((sum, v) => sum + Number(v.stock), 0) : form.stock} 
                    onChange={e => setForm({...form, stock: e.target.value})}
                    readOnly={form.variantes?.length > 0}
                    className={`w-full border border-outline-variant/30 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-primary font-bold shadow-sm ${form.variantes?.length > 0 ? 'bg-surface-variant/30 text-outline' : 'bg-surface-container-lowest'}`}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* GESTIÓN DE VARIANTES (Colores, Tallas, etc) */}
              <div className="bg-surface-container/30 rounded-2xl p-4 border border-outline-variant/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-primary">diversity_2</span>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface">Variantes (Color, etc.)</p>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setForm({...form, variantes: [...(form.variantes || []), { nombre: '', stock: 0 }]})}
                    className="bg-secondary/10 text-secondary text-[9px] font-bold uppercase px-3 py-1.5 rounded-lg border border-secondary/20 hover:bg-secondary/20 transition-all"
                  >
                    + Añadir
                  </button>
                </div>

                <div className="space-y-2">
                  {(form.variantes || []).map((variant, index) => (
                    <div key={index} className="flex items-center gap-2 animate-in fade-in zoom-in-95 duration-200">
                      <input 
                        type="text" 
                        value={variant.nombre}
                        onChange={e => {
                          const newV = [...form.variantes]
                          newV[index].nombre = e.target.value
                          setForm({...form, variantes: newV})
                        }}
                        className="flex-1 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-3 py-2.5 text-xs font-bold focus:outline-none focus:border-primary"
                        placeholder="Ej. Verde"
                      />
                      <input 
                        type="number" 
                        value={variant.stock}
                        onChange={e => {
                          const newV = [...form.variantes]
                          newV[index].stock = e.target.value
                          setForm({...form, variantes: newV})
                        }}
                        className="w-20 bg-surface-container-lowest border border-outline-variant/20 rounded-xl px-2 py-2.5 text-xs font-bold text-center focus:outline-none focus:border-primary"
                        placeholder="0"
                      />
                      <button 
                        onClick={() => setForm({...form, variantes: form.variantes.filter((_, i) => i !== index)})}
                        className="w-10 h-10 flex items-center justify-center text-error/60 hover:text-error hover:bg-error/5 rounded-xl transition-all"
                      >
                        <span className="material-symbols-outlined text-xl">delete</span>
                      </button>
                    </div>
                  ))}
                  {(!form.variantes || form.variantes.length === 0) && (
                    <p className="text-[10px] text-outline text-center py-2 italic font-medium opacity-60">
                      Ideal para productos con diferentes colores o tallas.
                    </p>
                  )}
                </div>
              </div>

              {/* Fila 5: Otros */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">Fecha Ingreso</label>
                  <input 
                    type="date" 
                    value={form.fechaIngreso} 
                    onChange={e => setForm({...form, fechaIngreso: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary font-bold shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-secondary mb-1.5 ml-1">URL Foto</label>
                  <input 
                    type="url" 
                    value={form.fotoUrl} 
                    onChange={e => setForm({...form, fotoUrl: e.target.value})}
                    className="w-full bg-surface-container-lowest border border-outline-variant/30 rounded-xl px-4 py-3 text-xs focus:outline-none focus:border-primary font-bold shadow-sm"
                    placeholder="https://..."
                  />
                </div>
              </div>
            </div>

            {/* Footer del Modal */}
            <div className="bg-surface-container-low px-6 py-4 border-t border-outline-variant/20 flex gap-3 shrink-0">
              <button 
                onClick={() => setShowModal(false)}
                className="flex-1 py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest text-on-surface-variant hover:bg-surface-variant transition-all active:scale-95 border border-outline-variant/10"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave}
                className="flex-[2] py-3.5 rounded-xl font-bold text-[11px] uppercase tracking-widest bg-primary text-on-primary shadow-lg hover:shadow-xl active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                 <span className="material-symbols-outlined text-base">{editingId ? 'save' : 'add_circle'}</span>
                {editingId ? 'Guardar Cambios' : 'Registrar Producto'}
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
