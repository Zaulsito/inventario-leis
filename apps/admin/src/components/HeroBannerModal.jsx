import { useState, useEffect } from 'react'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '../config/firebase'

// Compresión y optimización automática de imágenes sin pérdida visual de calidad
const optimizeImageFile = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const MAX_DIM = 1000
        let width = img.width
        let height = img.height

        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width)
            width = MAX_DIM
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height)
            height = MAX_DIM
          }
        }

        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        
        // Renderizado nítido de alta calidad
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(img, 0, 0, width, height)

        // WebP con compresión nítida al 88%
        const webpUrl = canvas.toDataURL('image/webp', 0.88)
        resolve(webpUrl)
      }
      img.onerror = (err) => reject(err)
      img.src = e.target.result
    }
    reader.onerror = (err) => reject(err)
    reader.readAsDataURL(file)
  })
}

export default function HeroBannerModal({ isOpen, onClose, isDark }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [productos, setProductos] = useState([])
  const [titulo, setTitulo] = useState('NUEVA COLECCIÓN & CUIDADO PERSONAL')
  const [subtitulo, setSubtitulo] = useState('Joyería en Plata 925 y cosmética capilar seleccionada para realzar tu estilo.')
  
  // Listas de imágenes para los dos flotantes
  const [imagenes1, setImagenes1] = useState([])
  const [imagen1Label, setImagen1Label] = useState('✨ Joyería')
  const [newUrl1, setNewUrl1] = useState('')
  const [selectedProd1, setSelectedProd1] = useState('')
  const [isDragging1, setIsDragging1] = useState(false)
  const [optimizing1, setOptimizing1] = useState(false)

  const [imagenes2, setImagenes2] = useState([])
  const [imagen2Label, setImagen2Label] = useState('🌿 Cosmética')
  const [newUrl2, setNewUrl2] = useState('')
  const [selectedProd2, setSelectedProd2] = useState('')
  const [isDragging2, setIsDragging2] = useState(false)
  const [optimizing2, setOptimizing2] = useState(false)

  useEffect(() => {
    if (!isOpen) return

    async function loadData() {
      setLoading(true)
      try {
        const snapProds = await getDocs(collection(db, 'productos'))
        const prodsList = snapProds.docs.map(d => ({ id: d.id, ...d.data() }))
        setProductos(prodsList)

        const snapDoc = await getDoc(doc(db, 'configuracion', 'heroBanner'))
        if (snapDoc.exists()) {
          const data = snapDoc.data()
          if (data.titulo) setTitulo(data.titulo)
          if (data.subtitulo) setSubtitulo(data.subtitulo)
          
          if (Array.isArray(data.imagenes1) && data.imagenes1.length > 0) {
            setImagenes1(data.imagenes1)
          } else if (data.imagen1Url) {
            setImagenes1([data.imagen1Url])
          } else {
            setImagenes1([])
          }

          if (data.imagen1Label) setImagen1Label(data.imagen1Label)

          if (Array.isArray(data.imagenes2) && data.imagenes2.length > 0) {
            setImagenes2(data.imagenes2)
          } else if (data.imagen2Url) {
            setImagenes2([data.imagen2Url])
          } else {
            setImagenes2([])
          }

          if (data.imagen2Label) setImagen2Label(data.imagen2Label)
        }
      } catch (err) {
        console.error('Error al cargar datos del Hero Banner:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [isOpen])

  // --- PROCESAMIENTO DE ARCHIVOS DRAG & DROP / SELECCIÓN ---
  const processFiles1 = async (files) => {
    if (!files || files.length === 0) return
    setOptimizing1(true)
    try {
      const optimizedUrls = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const optDataUrl = await optimizeImageFile(file)
        optimizedUrls.push(optDataUrl)
      }
      if (optimizedUrls.length > 0) {
        setImagenes1(prev => [...prev, ...optimizedUrls])
      }
    } catch (err) {
      console.error('Error al optimizar imagen 1:', err)
      setErrorMsg('Error al procesar la imagen seleccionada')
    } finally {
      setOptimizing1(false)
    }
  }

  const processFiles2 = async (files) => {
    if (!files || files.length === 0) return
    setOptimizing2(true)
    try {
      const optimizedUrls = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const optDataUrl = await optimizeImageFile(file)
        optimizedUrls.push(optDataUrl)
      }
      if (optimizedUrls.length > 0) {
        setImagenes2(prev => [...prev, ...optimizedUrls])
      }
    } catch (err) {
      console.error('Error al optimizar imagen 2:', err)
      setErrorMsg('Error al procesar la imagen seleccionada')
    } finally {
      setOptimizing2(false)
    }
  }

  const handleAddImg1 = (urlToAdd) => {
    if (!urlToAdd || !urlToAdd.trim()) return
    const cleaned = urlToAdd.trim()
    if (!imagenes1.includes(cleaned)) {
      setImagenes1(prev => [...prev, cleaned])
    }
    setNewUrl1('')
    setSelectedProd1('')
  }

  const handleRemoveImg1 = (index) => {
    setImagenes1(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddImg2 = (urlToAdd) => {
    if (!urlToAdd || !urlToAdd.trim()) return
    const cleaned = urlToAdd.trim()
    if (!imagenes2.includes(cleaned)) {
      setImagenes2(prev => [...prev, cleaned])
    }
    setNewUrl2('')
    setSelectedProd2('')
  }

  const handleRemoveImg2 = (index) => {
    setImagenes2(prev => prev.filter((_, i) => i !== index))
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrorMsg('')
    setSuccessMsg('')

    try {
      await setDoc(doc(db, 'configuracion', 'heroBanner'), {
        titulo,
        subtitulo,
        imagenes1,
        imagen1Label,
        imagen1Url: imagenes1.length > 0 ? imagenes1[0] : '',
        imagenes2,
        imagen2Label,
        imagen2Url: imagenes2.length > 0 ? imagenes2[0] : '',
        updatedAt: new Date().toISOString()
      }, { merge: true })

      setSuccessMsg('¡Configuración del Banner Hero guardada con éxito!')
      setTimeout(() => {
        setSuccessMsg('')
        onClose()
      }, 1500)
    } catch (err) {
      console.error(err)
      setErrorMsg('Error al guardar: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className={`w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border shadow-2xl p-6 md:p-8 ${
        isDark ? 'bg-[#1e1e1e] border-white/10 text-white' : 'bg-white border-outline-variant/30 text-on-surface'
      }`}>
        
        {/* CABECERA MODAL */}
        <div className="flex items-center justify-between border-b pb-4 mb-6 border-outline-variant/20 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c]' : 'bg-primary/10 text-primary'}`}>
              <span className="material-symbols-outlined text-xl">auto_awesome</span>
            </div>
            <div>
              <h2 className="font-headline text-xl font-bold italic leading-tight">Configurar Banner Hero</h2>
              <p className={`text-xs ${isDark ? 'text-gray-400' : 'text-outline'}`}>Arrastra imágenes desde tu PC o selecciona productos para la rotación</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-sm">Cargando datos del Banner...</div>
        ) : (
          <form onSubmit={handleSave} className="space-y-6">
            
            {/* ALERTAS */}
            {successMsg && (
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                {successMsg}
              </div>
            )}
            {errorMsg && (
              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {errorMsg}
              </div>
            )}

            {/* SECCIÓN TEXTOS */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#e2bd6c]">Textos Principales</h3>
              
              <div>
                <label className="block text-xs font-bold mb-1">Título del Banner</label>
                <input 
                  type="text"
                  value={titulo}
                  onChange={e => setTitulo(e.target.value)}
                  placeholder="Ej: NUEVA COLECCIÓN & CUIDADO PERSONAL"
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none transition-all ${
                    isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'
                  }`}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">Subtítulo Descriptivo</label>
                <textarea 
                  rows={2}
                  value={subtitulo}
                  onChange={e => setSubtitulo(e.target.value)}
                  placeholder="Ej: Joyería en Plata 925 y cosmética capilar seleccionada..."
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm font-medium focus:outline-none transition-all ${
                    isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'
                  }`}
                  required
                />
              </div>
            </div>

            {/* SECCIÓN IMÁGENES FLOTANTES */}
            <div className="space-y-6 pt-2 border-t border-outline-variant/10 dark:border-white/5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-[#e2bd6c]">Galerías de Fotos Flotantes (Arrastrar & Soltar con Optimización)</h3>
              
              {/* GALERÍA 1 (FLOTANTE 1 - IZQUIERDA/SUPERIOR) */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-white/5 border-white/10' : 'bg-surface-container-low border-outline-variant/20'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-[#e2bd6c]">diamond</span>
                    Flotante 1: Galería de Imágenes ({imagenes1.length} {imagenes1.length === 1 ? 'foto' : 'fotos'})
                  </span>
                  <input 
                    type="text" 
                    value={imagen1Label} 
                    onChange={e => setImagen1Label(e.target.value)}
                    placeholder="Badge (Ej: ✨ Joyería)"
                    className="text-[11px] font-bold px-3 py-1 rounded-lg border bg-transparent border-white/20 text-[#e2bd6c]"
                  />
                </div>

                {/* ZONA DE ARRASTRE / DROP ZONE 1 */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging1(true); }}
                  onDragLeave={() => setIsDragging1(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging1(false);
                    processFiles1(e.dataTransfer.files);
                  }}
                  className={`p-4 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer relative ${
                    isDragging1 
                      ? 'border-[#e2bd6c] bg-[#e2bd6c]/10 scale-[1.01]' 
                      : (isDark ? 'border-white/15 bg-black/20 hover:border-[#e2bd6c]/40' : 'border-outline-variant/40 bg-white hover:border-primary/40')
                  }`}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    id="hero-file-input-1"
                    className="hidden"
                    onChange={(e) => processFiles1(e.target.files)}
                  />
                  <label htmlFor="hero-file-input-1" className="cursor-pointer block">
                    <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                      <span className="material-symbols-outlined text-3xl text-[#e2bd6c]">cloud_upload</span>
                      <p className="text-xs font-bold">
                        {optimizing1 ? '⚡ Optimizando imagen en alta calidad...' : 'Arrastra fotos aquí desde tu PC o haz clic para examinar'}
                      </p>
                      <p className="text-[10px] text-gray-400">Se comprimen automáticamente manteniendo máxima definición visual</p>
                    </div>
                  </label>
                </div>

                {/* Lista de fotos agregadas 1 */}
                <div className="flex flex-wrap gap-3 p-2 border rounded-xl min-h-[70px] bg-black/10 dark:bg-black/20 border-white/5">
                  {imagenes1.length === 0 ? (
                    <p className="text-xs text-gray-400 italic self-center px-2">No hay imágenes en esta galería. Se usará la rotación de productos del catálogo.</p>
                  ) : (
                    imagenes1.map((url, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-[#e2bd6c]/40 shrink-0">
                        <img src={url} alt={`Foto 1-${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImg1(idx)}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar foto"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Opciones secundarias (Producto o URL) 1 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">O agregar foto de producto existente:</label>
                    <select
                      value={selectedProd1}
                      onChange={e => {
                        const pId = e.target.value
                        setSelectedProd1(pId)
                        if (pId) {
                          const p = productos.find(x => x.id === pId)
                          if (p && p.fotoUrl) handleAddImg1(p.fotoUrl)
                        }
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDark ? 'bg-[#151515] border-white/10 text-white' : 'bg-white border-outline-variant/30 text-on-surface'
                      }`}
                    >
                      <option value="">-- Seleccionar producto --</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.coleccion || 'General'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">O agregar por URL directa:</label>
                    <div className="flex gap-2">
                      <input 
                        type="url"
                        value={newUrl1}
                        onChange={e => setNewUrl1(e.target.value)}
                        placeholder="https://..."
                        className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                          isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-outline-variant/30 text-on-surface'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddImg1(newUrl1)}
                        className="px-3 py-2 rounded-xl bg-[#e2bd6c] text-black font-bold text-xs uppercase"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* GALERÍA 2 (FLOTANTE 2 - DERECHA/INFERIOR) */}
              <div className={`p-5 rounded-2xl border space-y-4 ${isDark ? 'bg-white/5 border-white/10' : 'bg-surface-container-low border-outline-variant/20'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-400">spa</span>
                    Flotante 2: Galería de Imágenes ({imagenes2.length} {imagenes2.length === 1 ? 'foto' : 'fotos'})
                  </span>
                  <input 
                    type="text" 
                    value={imagen2Label} 
                    onChange={e => setImagen2Label(e.target.value)}
                    placeholder="Badge (Ej: 🌿 Cosmética)"
                    className="text-[11px] font-bold px-3 py-1 rounded-lg border bg-transparent border-white/20 text-emerald-400"
                  />
                </div>

                {/* ZONA DE ARRASTRE / DROP ZONE 2 */}
                <div
                  onDragOver={(e) => { e.preventDefault(); setIsDragging2(true); }}
                  onDragLeave={() => setIsDragging2(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging2(false);
                    processFiles2(e.dataTransfer.files);
                  }}
                  className={`p-4 border-2 border-dashed rounded-2xl text-center transition-all cursor-pointer relative ${
                    isDragging2 
                      ? 'border-emerald-500 bg-emerald-500/10 scale-[1.01]' 
                      : (isDark ? 'border-white/15 bg-black/20 hover:border-emerald-500/40' : 'border-outline-variant/40 bg-white hover:border-emerald-500/40')
                  }`}
                >
                  <input 
                    type="file" 
                    accept="image/*" 
                    multiple 
                    id="hero-file-input-2"
                    className="hidden"
                    onChange={(e) => processFiles2(e.target.files)}
                  />
                  <label htmlFor="hero-file-input-2" className="cursor-pointer block">
                    <div className="flex flex-col items-center gap-1.5 pointer-events-none">
                      <span className="material-symbols-outlined text-3xl text-emerald-400">cloud_upload</span>
                      <p className="text-xs font-bold">
                        {optimizing2 ? '⚡ Optimizando imagen en alta calidad...' : 'Arrastra fotos aquí desde tu PC o haz clic para examinar'}
                      </p>
                      <p className="text-[10px] text-gray-400">Se comprimen automáticamente manteniendo máxima definición visual</p>
                    </div>
                  </label>
                </div>

                {/* Lista de fotos agregadas 2 */}
                <div className="flex flex-wrap gap-3 p-2 border rounded-xl min-h-[70px] bg-black/10 dark:bg-black/20 border-white/5">
                  {imagenes2.length === 0 ? (
                    <p className="text-xs text-gray-400 italic self-center px-2">No hay imágenes en esta galería. Se usará la rotación de productos del catálogo.</p>
                  ) : (
                    imagenes2.map((url, idx) => (
                      <div key={idx} className="relative group w-16 h-16 rounded-xl overflow-hidden border border-emerald-500/40 shrink-0">
                        <img src={url} alt={`Foto 2-${idx}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImg2(idx)}
                          className="absolute inset-0 bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Eliminar foto"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Opciones secundarias (Producto o URL) 2 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold mb-1">O agregar foto de producto existente:</label>
                    <select
                      value={selectedProd2}
                      onChange={e => {
                        const pId = e.target.value
                        setSelectedProd2(pId)
                        if (pId) {
                          const p = productos.find(x => x.id === pId)
                          if (p && p.fotoUrl) handleAddImg2(p.fotoUrl)
                        }
                      }}
                      className={`w-full border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                        isDark ? 'bg-[#151515] border-white/10 text-white' : 'bg-white border-outline-variant/30 text-on-surface'
                      }`}
                    >
                      <option value="">-- Seleccionar producto --</option>
                      {productos.map(p => (
                        <option key={p.id} value={p.id}>{p.nombre} ({p.coleccion || 'General'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold mb-1">O agregar por URL directa:</label>
                    <div className="flex gap-2">
                      <input 
                        type="url"
                        value={newUrl2}
                        onChange={e => setNewUrl2(e.target.value)}
                        placeholder="https://..."
                        className={`flex-1 border rounded-xl px-3 py-2 text-xs focus:outline-none ${
                          isDark ? 'bg-white/5 border-white/10 text-white' : 'bg-white border-outline-variant/30 text-on-surface'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddImg2(newUrl2)}
                        className="px-3 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs uppercase"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* BOTONES ACCIÓN */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-outline-variant/20 dark:border-white/10">
              <button 
                type="button"
                onClick={onClose}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-colors ${
                  isDark ? 'text-gray-400 hover:bg-white/5' : 'text-outline hover:bg-surface-variant'
                }`}
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={saving || optimizing1 || optimizing2}
                className={`px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg transition-all flex items-center gap-2 ${
                  isDark 
                    ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90 shadow-[#e2bd6c]/20' 
                    : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
                }`}
              >
                <span className="material-symbols-outlined text-base">save</span>
                {saving ? 'Guardando...' : 'Guardar en Catálogo'}
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  )
}
