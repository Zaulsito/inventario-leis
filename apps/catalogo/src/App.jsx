import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './config/firebase'

// Número de WhatsApp al que llegarán los pedidos (formato internacional sin el +)
const WHATSAPP_NUMBER = "56921648127" // ¡Cambia esto por tu número real!

export default function CatalogoPublico() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filtros Avanzados
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [searchTerm, setSearchTerm] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const categoryContainerRef = useRef(null)

  // Carrito: array de { idCart, producto, variante, cantidad, precio, maxStock }
  const [carrito, setCarrito] = useState(() => {
    try {
      const guardado = localStorage.getItem('carritoLeis')
      return guardado ? JSON.parse(guardado) : []
    } catch (e) {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem('carritoLeis', JSON.stringify(carrito))
  }, [carrito])

  const [isCartOpen, setIsCartOpen] = useState(false)

  // Modal de selección de variantes
  const [productParaAñadir, setProductParaAñadir] = useState(null)
  const [varianteSeleccionada, setVarianteSeleccionada] = useState('')

  // Modal de detalle del producto
  const [productoParaVer, setProductoParaVer] = useState(null)
  
  // Modal checkout final
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')

  const [animacion, setAnimacion] = useState('') // '', 'salir-izquierda', 'salir-derecha', etc.
  const [indexImagenActual, setIndexImagenActual] = useState(0)
  const [mostrarIndicador, setMostrarIndicador] = useState(false)
  const [mostrarControlesZoom, setMostrarControlesZoom] = useState(true)
  const [expandedImage, setExpandedImage] = useState(null)

  useEffect(() => {
    if (productoParaVer) {
      setMostrarIndicador(true)
      const t = setTimeout(() => setMostrarIndicador(false), 3000)
      return () => clearTimeout(t)
    }
  }, [indexImagenActual, productoParaVer])

  useEffect(() => {
    if (expandedImage) {
      setMostrarControlesZoom(true)
      const t = setTimeout(() => setMostrarControlesZoom(false), 2000)
      return () => clearTimeout(t)
    }
  }, [expandedImage, indexImagenActual])

  useEffect(() => {
    // Escuchar productos en tiempo real
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Filtrar productos que tengan al menos 1 de stock (ya sea general o sumando variantes)
      const disponibles = data.filter(p => {
        if (p.variantes && p.variantes.length > 0) {
          const stockTotalVariantes = p.variantes.reduce((sum, v) => sum + Number(v.stock), 0)
          return stockTotalVariantes > 0
        }
        return p.stock > 0
      })
      
      // Ordenar alfabéticamente
      disponibles.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(disponibles)
      setLoading(false)
    })
    return unsub
  }, [])

  // --- DERIVADOS ---
  const categoriasUnicas = ['TODAS', ...new Set(productos.map(p => (p.coleccion || '').trim().toUpperCase()).filter(Boolean))].sort((a, b) => {
    if (a === 'TODAS') return -1;
    if (b === 'TODAS') return 1;
    return a.localeCompare(b);
  })

  const productosFiltrados = productos.filter(p => {
    if (filtroCategoria !== 'TODAS' && (p.coleccion || '').trim().toUpperCase() !== filtroCategoria) return false;
    
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      const matchNombre = (p.nombre || '').toLowerCase().includes(s);
      const matchSku = (p.sku || '').toLowerCase().includes(s);
      const matchMarca = (p.marca || '').toLowerCase().includes(s);
      if (!(matchNombre || matchSku || matchMarca)) return false;
    }

    if (precioMin !== '' && p.precio < Number(precioMin)) return false;
    if (precioMax !== '' && p.precio > Number(precioMax)) return false;

    if (soloDisponibles) {
      const tieneStock = p.variantes && p.variantes.length > 0 
        ? p.variantes.some(v => Number(v.stock) > 0)
        : Number(p.stock) > 0;
      if (!tieneStock) return false;
    }

    return true;
  })

  const fotosProducto = productoParaVer?.fotos || (productoParaVer?.fotoUrl ? [productoParaVer.fotoUrl] : []);

  function anteriorImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('salir-derecha');
    setTimeout(() => {
      setIndexImagenActual(prev => (prev === 0 ? fotosProducto.length - 1 : prev - 1));
      setAnimacion('entrar-izquierda');
      setTimeout(() => setAnimacion(''), 300);
    }, 300);
  }

  function siguienteImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('salir-izquierda');
    setTimeout(() => {
      setIndexImagenActual(prev => (prev === fotosProducto.length - 1 ? 0 : prev + 1));
      setAnimacion('entrar-derecha');
      setTimeout(() => setAnimacion(''), 300);
    }, 300);
  }

  useEffect(() => {
    setIndexImagenActual(0);
    setAnimacion('');
  }, [productoParaVer]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (!productoParaVer) return;
      if (e.key === 'ArrowLeft') anteriorImagen();
      if (e.key === 'ArrowRight') siguienteImagen();
      if (e.key === 'Escape') setProductoParaVer(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productoParaVer, fotosProducto, animacion]);

  // Lógica de Swipe para móviles
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  // Estados para ZOOM y PAN en el visor ampliado
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 });
  const [distanciaInicial, setDistanciaInicial] = useState(0);

  const resetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (!expandedImage) resetZoom();
  }, [expandedImage, indexImagenActual]);

  const handleTouchStart = (e) => {
    if (e.touches.length === 2 && expandedImage) {
      // Inicio de Pinch
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      setDistanciaInicial(dist);
      return;
    }

    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    
    if (scale > 1) {
      setLastTouch({ x: e.touches[0].pageX, y: e.touches[0].pageY });
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && expandedImage) {
      // Lógica de Pinch Zoom
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      );
      if (distanciaInicial > 0) {
        const delta = dist / distanciaInicial;
        setScale(prev => Math.min(Math.max(1, prev * delta), 4));
      }
      setDistanciaInicial(dist);
      return;
    }

    if (scale > 1 && expandedImage) {
      // Lógica de Pan (Desplazamiento) cuando hay zoom
      const deltaX = e.touches[0].pageX - lastTouch.x;
      const deltaY = e.touches[0].pageY - lastTouch.y;
      setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastTouch({ x: e.touches[0].pageX, y: e.touches[0].pageY });
      return;
    }

    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    setDistanciaInicial(0);
    if (scale > 1) return; // No navegar si estamos en modo zoom

    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) siguienteImagen();
    if (isRightSwipe) anteriorImagen();
  };

  const [paginaActual, setPaginaActual] = useState(1)
  const ITEMS_POR_PAGINA = 20

  useEffect(() => {
    setPaginaActual(1)
  }, [filtroCategoria])

  const totalPaginas = Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA)
  const productosPaginados = productosFiltrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)

  // Lógica de paginación (mostrar máximo 3 páginas)
  const paginasVisibles = []
  let inicioPag = Math.max(1, paginaActual - 1)
  let finPag = Math.min(totalPaginas, paginaActual + 1)

  if (finPag - inicioPag < 2 && totalPaginas >= 3) {
    if (inicioPag === 1) finPag = 3
    else if (finPag === totalPaginas) inicioPag = totalPaginas - 2
  }

  for (let i = inicioPag; i <= finPag; i++) {
    paginasVisibles.push(i)
  }

  // --- LÓGICA DEL CARRITO ---

  function abrirModalAñadir(p) {
    if (p.variantes && p.variantes.length > 0) {
      setProductParaAñadir(p)
      setVarianteSeleccionada('')
    } else {
      añadirAlCarrito(p, null)
    }
  }

  function añadirAlCarrito(producto, variante) {
    const maxStock = variante ? variante.stock : producto.stock
    const nombreItem = variante ? `${producto.nombre} (${variante.nombre})` : producto.nombre
    const idCart = variante ? `${producto.id}-${variante.nombre}` : producto.id

    setCarrito(prev => {
      const existente = prev.find(item => item.idCart === idCart)
      if (existente) {
        if (existente.cantidad >= maxStock) {
          alert('No hay más stock disponible para este producto.')
          return prev
        }
        return prev.map(item => 
          item.idCart === idCart 
            ? { ...item, cantidad: item.cantidad + 1 }
            : item
        )
      } else {
        return [...prev, {
          idCart,
          productoId: producto.id,
          nombre: nombreItem,
          precio: producto.precio || 0,
          cantidad: 1,
          maxStock: Number(maxStock)
        }]
      }
    })
    
    setProductParaAñadir(null)
  }

  function actualizarCantidad(idCart, delta) {
    setCarrito(prev => prev.map(item => {
      if (item.idCart === idCart) {
        const nuevaCantidad = item.cantidad + delta
        if (nuevaCantidad > item.maxStock) {
          alert('Has alcanzado el límite de stock disponible.')
          return item
        }
        // La eliminación (cantidad < 1) ahora la manejamos explícitamente en UI, pero si llega por error:
        if (nuevaCantidad < 1) return item 
        return { ...item, cantidad: nuevaCantidad }
      }
      return item
    }))
  }

  function eliminarDelCarrito(idCart) {
    setCarrito(prev => prev.filter(item => item.idCart !== idCart))
  }

  const totalCarrito = carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
  const totalItems = carrito.reduce((acc, item) => acc + item.cantidad, 0)

  function scrollCategories(direction) {
    if (categoryContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      categoryContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  // --- WHATSAPP CHECKOUT ---
  
  function prepararCheckout() {
    if (carrito.length === 0) return alert('El carrito está vacío')
    setShowCheckout(true)
    setIsCartOpen(false)
  }

  function enviarPedidoWhatsApp() {
    if (!clienteNombre.trim()) return alert('Por favor ingresa tu nombre')

    let texto = `*NUEVO PEDIDO - CATÁLOGO ONLINE*%0A%0A`
    texto += `*Cliente:* ${clienteNombre}%0A`
    texto += `*Detalle del pedido:*%0A%0A`

    carrito.forEach(item => {
      texto += `- ${item.cantidad}x ${item.nombre} ($${(item.precio * item.cantidad).toLocaleString('es-CL')})%0A`
    })

    texto += `%0A*TOTAL: $${totalCarrito.toLocaleString('es-CL')}*%0A%0A`
    texto += `_Me gustaría confirmar la disponibilidad de estos productos y coordinar el pago._`

    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${texto}`
    window.open(url, '_blank')
    
    setCarrito([])
    setShowCheckout(false)
    setClienteNombre('')
  }

  // --- RENDER ---

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-surface text-on-surface">Cargando catálogo...</div>
  }

  return (
    <div className="flex h-[100dvh] bg-surface-container-lowest relative overflow-hidden">
      
      {/* ── BACKGROUND WATERMARK ── */}
      <div className="fixed inset-0 pointer-events-none z-0 flex items-center justify-center opacity-15">
        <div className="w-[85%] md:w-[40%] max-w-lg rounded-[3.5rem] crystal-effect">
          <img 
            src="/logo.jpeg" 
            alt="Watermark" 
            className="w-full h-full object-contain rounded-[3.5rem] shadow-sm mix-blend-darken"
          />
        </div>
      </div>

      {/* OVERLAY MÓVIL PARA SIDEBAR */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── PANEL LATERAL (SIDEBAR) ── */}
      <aside className={`fixed md:relative top-0 left-0 h-full w-[280px] bg-surface border-r border-outline-variant/20 z-50 flex flex-col transition-transform duration-300 ease-in-out shadow-2xl md:shadow-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* CABECERA SIDEBAR */}
        <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center p-1 shrink-0">
              <img src="/logo.jpeg" alt="Logo" className="w-full h-full object-contain rounded" />
            </div>
            <div>
              <h1 className="font-headline text-lg text-secondary font-bold italic leading-tight">Catálogo</h1>
              <p className="text-[9px] uppercase tracking-widest text-outline font-bold">Filtros</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="md:hidden p-2 text-outline hover:bg-surface-variant rounded-full transition-colors">
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* CONTENIDO SIDEBAR (FILTROS) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* BÚSQUEDA */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">search</span>
              Búsqueda
            </h3>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Nombre, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-4 pr-10 py-3 text-sm font-medium focus:outline-none focus:border-primary/50 focus:ring-4 focus:ring-primary/5 transition-all"
              />
              {searchTerm && (
                <button 
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-outline-variant/30 text-outline hover:bg-outline-variant/50 transition-all"
                >
                  <span className="material-symbols-outlined text-[12px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* PRECIO */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">payments</span>
              Rango de Precio
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xs">$</span>
                <input 
                  type="number" 
                  placeholder="Min"
                  value={precioMin}
                  onChange={e => setPrecioMin(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-7 pr-2 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
              <span className="text-outline-variant">-</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-outline text-xs">$</span>
                <input 
                  type="number" 
                  placeholder="Max"
                  value={precioMax}
                  onChange={e => setPrecioMax(e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/30 rounded-xl pl-7 pr-2 py-2.5 text-sm focus:outline-none focus:border-primary/50"
                />
              </div>
            </div>
          </div>

          {/* DISPONIBILIDAD */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Disponibilidad
            </h3>
            <label className="flex items-center justify-between p-3 rounded-xl border border-outline-variant/30 bg-surface-container-low cursor-pointer hover:bg-surface-variant/50 transition-colors">
              <span className="text-sm font-bold text-on-surface">En Stock Físico</span>
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={soloDisponibles}
                  onChange={e => setSoloDisponibles(e.target.checked)}
                />
                <div className="w-10 h-6 bg-outline-variant/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </div>
            </label>
          </div>

          {/* CATEGORÍAS */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-outline uppercase tracking-widest flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">category</span>
              Categorías
            </h3>
            <div className="flex flex-col gap-1">
              {categoriasUnicas.map(c => (
                <button
                  key={c}
                  onClick={() => {
                    setFiltroCategoria(c)
                    if (window.innerWidth < 768) setIsSidebarOpen(false)
                  }}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-bold transition-all
                    ${filtroCategoria === c
                      ? 'bg-secondary text-white shadow-md scale-[1.02]'
                      : 'text-on-surface-variant hover:bg-surface-variant/50'
                    }`}
                >
                  <span className="uppercase tracking-wide">{c}</span>
                  {filtroCategoria === c && <span className="material-symbols-outlined text-sm">check</span>}
                </button>
              ))}
            </div>
          </div>

        </div>
        
        {/* FOOTER SIDEBAR */}
        <div className="p-6 border-t border-outline-variant/20 bg-surface-container-lowest shrink-0">
          <button 
            onClick={() => {
              setFiltroCategoria('TODAS')
              setSearchTerm('')
              setPrecioMin('')
              setPrecioMax('')
              setSoloDisponibles(false)
            }}
            className="w-full py-3 rounded-xl border border-outline-variant/30 text-on-surface font-bold text-xs uppercase tracking-widest hover:bg-surface-variant transition-colors"
          >
            Limpiar Filtros
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HEADER PRINCIPAL COMPACTO */}
        <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-4 py-4 md:px-8 md:py-6 border-b border-outline-variant/20 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden w-10 h-10 flex items-center justify-center bg-surface-variant rounded-xl text-on-surface"
            >
              <span className="material-symbols-outlined">menu_open</span>
            </button>
            <h2 className="font-headline text-lg md:text-2xl font-bold text-secondary italic leading-tight">
              {filtroCategoria === 'TODAS' ? 'Todos los Productos' : filtroCategoria}
              <span className="ml-2 text-sm font-sans font-normal text-outline not-italic">({productosFiltrados.length})</span>
            </h2>
          </div>

          <button 
            onClick={() => setIsCartOpen(true)}
            className="relative bg-primary/10 text-primary p-3 rounded-2xl hover:bg-primary/20 transition-colors shrink-0"
          >
            <span className="material-symbols-outlined">shopping_cart</span>
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 bg-error text-on-error text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md animate-in zoom-in">
                {totalItems}
              </span>
            )}
          </button>
        </header>

        {/* MAIN SCROLLABLE AREA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10 pb-32 md:pb-8">
          <div className="max-w-7xl mx-auto">
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            No hay productos disponibles en esta categoría.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
              {productosPaginados.map(p => {
                const tieneVariantes = p.variantes && p.variantes.length > 0;
              const cartItem = !tieneVariantes ? carrito.find(item => item.productoId === p.id) : null;
              const totalEnCarritoVariants = tieneVariantes ? carrito.filter(item => item.productoId === p.id).reduce((sum, i) => sum + i.cantidad, 0) : 0;

              return (
                <div key={p.id} className="bg-surface rounded-[24px] overflow-hidden border border-outline-variant/20 shadow-sm flex flex-col group hover:shadow-md transition-all">
                  {/* Imagen */}
                  <div 
                    className="aspect-square bg-surface-variant/30 relative overflow-hidden flex items-center justify-center cursor-pointer"
                    onClick={() => setProductoParaVer(p)}
                  >
                    {p.fotoUrl ? (
                      <img src={p.fotoUrl} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                      <span className="material-symbols-outlined text-4xl text-outline/30">image</span>
                    )}
                    {p.marca && (
                      <div className="absolute top-2 left-2 bg-surface/90 backdrop-blur-sm px-2 py-1 rounded-md">
                        <span className="text-[8px] font-bold uppercase tracking-widest text-on-surface">{p.marca}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 
                      className="font-headline font-bold text-sm md:text-xl text-on-surface leading-tight line-clamp-2 mb-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setProductoParaVer(p)}
                    >
                      {p.nombre}
                    </h3>
                    <p className="text-[10px] md:text-xs text-outline uppercase tracking-wider mb-3">{(p.coleccion || '').toUpperCase()}</p>
                    
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <p className="font-bold text-secondary text-base md:text-lg">${(p.precio || 0).toLocaleString('es-CL')}</p>
                      
                      {/* LÓGICA DE BOTONES INLINE */}
                      {tieneVariantes ? (
                        <button 
                          onClick={() => abrirModalAñadir(p)}
                          className="bg-primary text-on-primary px-3 h-10 rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all text-[10px] font-bold uppercase tracking-widest shrink-0"
                        >
                          Opciones {totalEnCarritoVariants > 0 && <span className="ml-1 bg-white/20 px-1.5 py-0.5 rounded-md">{totalEnCarritoVariants}</span>}
                        </button>
                      ) : cartItem ? (
                        <div className="flex items-center gap-1 bg-surface-container-highest rounded-xl p-1 h-10 shrink-0 border border-outline-variant/20">
                          <button onClick={() => {
                            if(cartItem.cantidad === 1) eliminarDelCarrito(cartItem.idCart);
                            else actualizarCantidad(cartItem.idCart, -1);
                          }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-on-surface">
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className="w-5 text-center font-bold text-xs">{cartItem.cantidad}</span>
                          <button onClick={() => actualizarCantidad(cartItem.idCart, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-on-surface">
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => añadirAlCarrito(p, null)}
                          className="bg-primary text-on-primary w-10 h-10 rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all shrink-0"
                        >
                          <span className="material-symbols-outlined text-[20px]">add_shopping_cart</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            </div>
            
            {totalPaginas > 1 && (
              <div className="mt-10 flex justify-center items-center gap-2 flex-wrap">
                <button
                  onClick={() => {
                    setPaginaActual(prev => Math.max(prev - 1, 1))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={paginaActual === 1}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>

                {paginasVisibles.map(pag => (
                  <button
                    key={pag}
                    onClick={() => {
                      setPaginaActual(pag)
                      window.scrollTo({ top: 0, behavior: 'smooth' })
                    }}
                    className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold text-sm transition-all ${
                      paginaActual === pag
                        ? 'bg-secondary text-white shadow-md'
                        : 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
                    }`}
                  >
                    {pag}
                  </button>
                ))}

                <button
                  onClick={() => {
                    setPaginaActual(prev => Math.min(prev + 1, totalPaginas))
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  disabled={paginaActual === totalPaginas}
                  className="w-10 h-10 flex items-center justify-center rounded-xl border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                >
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </main>
      </div>

      {/* FAB CARRITO MÓVIL */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-20 md:hidden">
          <button 
            onClick={() => setIsCartOpen(true)}
            className="bg-secondary text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold uppercase tracking-widest text-xs animate-in slide-in-from-bottom-10 hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined">shopping_bag</span>
            Ver Carrito ({totalItems})
          </button>
        </div>
      )}

      {/* DRAWER CARRITO */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCartOpen(false)} />
          <div className="bg-surface w-full max-w-md h-full relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
              <h2 className="font-headline text-xl font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">shopping_cart</span>
                Tu Pedido
              </h2>
              <button onClick={() => setIsCartOpen(false)} className="p-2 hover:bg-surface-variant rounded-full text-outline transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {carrito.length === 0 ? (
                <div className="text-center py-10 opacity-50 flex flex-col items-center">
                  <span className="material-symbols-outlined text-5xl mb-2">production_quantity_limits</span>
                  <p>Aún no hay productos en el carrito</p>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.idCart} className="flex items-center gap-4 bg-surface-container-low p-4 rounded-[20px] border border-outline-variant/10">
                    <div className="flex-1">
                      <p className="font-bold text-sm text-on-surface leading-tight">{item.nombre}</p>
                      <p className="text-secondary font-bold text-xs mt-1">${item.precio.toLocaleString('es-CL')}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 bg-surface-container-highest rounded-xl p-1">
                      <button onClick={() => {
                        if(item.cantidad === 1) eliminarDelCarrito(item.idCart);
                        else actualizarCantidad(item.idCart, -1);
                      }} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-on-surface">
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <span className="w-6 text-center font-bold text-xs">{item.cantidad}</span>
                      <button onClick={() => actualizarCantidad(item.idCart, 1)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface text-on-surface">
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>

                    <button onClick={() => eliminarDelCarrito(item.idCart)} className="text-error/50 hover:text-error hover:bg-error/10 p-2 rounded-xl transition-colors shrink-0">
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <div className="p-6 bg-surface-container border-t border-outline-variant/20 space-y-4 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-bold uppercase tracking-widest text-outline">Total a Pagar</span>
                  <span className="font-headline text-2xl font-bold text-secondary">${totalCarrito.toLocaleString('es-CL')}</span>
                </div>
                <button 
                  onClick={prepararCheckout}
                  className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2"
                >
                  <span className="material-symbols-outlined">send</span>
                  Hacer Pedido
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL SELECCIÓN DE VARIANTES */}
      {productParaAñadir && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setProductParaAñadir(null)} />
          <div className="bg-surface w-full max-w-sm rounded-[32px] sm:rounded-[32px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-outline-variant/10 bg-surface-container-low shrink-0 flex justify-between items-center">
              <h3 className="font-headline font-bold text-lg text-on-surface pr-4">Selecciona una opción</h3>
              <button onClick={() => setProductParaAñadir(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-variant text-outline">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar">
              <div className="flex items-center gap-4 mb-4 pb-4 border-b border-outline-variant/10">
                {productParaAñadir.fotoUrl && (
                  <img src={productParaAñadir.fotoUrl} alt={productParaAñadir.nombre} className="w-16 h-16 rounded-xl object-cover bg-surface-variant" />
                )}
                <div>
                  <p className="font-bold text-sm leading-tight mb-1">{productParaAñadir.nombre}</p>
                  <p className="text-secondary font-bold">${(productParaAñadir.precio || 0).toLocaleString('es-CL')}</p>
                </div>
              </div>

              {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).map((v, i) => {
                // Checar si ya está en carrito para esta variante específica
                const idCartVariante = `${productParaAñadir.id}-${v.nombre}`;
                const inCart = carrito.find(item => item.idCart === idCartVariante);
                
                return (
                  <button
                    key={i}
                    onClick={() => setVarianteSeleccionada(v)}
                    className={`w-full flex justify-between items-center p-4 rounded-[20px] border-2 transition-all ${varianteSeleccionada === v ? 'border-primary bg-primary/5' : 'border-outline-variant/10 bg-surface hover:border-primary/30'}`}
                  >
                    <span className="font-bold text-sm text-on-surface uppercase flex items-center gap-2">
                      {v.nombre}
                      {inCart && <span className="bg-primary/20 text-primary text-[9px] px-1.5 py-0.5 rounded-md">{inCart.cantidad} en pedido</span>}
                    </span>
                    <span className="text-[10px] font-bold text-secondary bg-secondary/10 px-2 py-1 rounded-lg">{v.stock} disp.</span>
                  </button>
                )
              })}
              
              {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).length === 0 && (
                <p className="text-center text-sm text-error font-bold py-4">No hay stock disponible en ninguna variante.</p>
              )}
            </div>
            <div className="p-6 bg-surface-container border-t border-outline-variant/10 shrink-0">
              <button 
                disabled={!varianteSeleccionada}
                onClick={() => añadirAlCarrito(productParaAñadir, varianteSeleccionada)}
                className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${varianteSeleccionada ? 'bg-primary text-on-primary shadow-lg hover:scale-[1.02]' : 'bg-surface-variant text-outline opacity-50 cursor-not-allowed'}`}
              >
                Añadir al Carrito
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLE DE PRODUCTO */}
      {productoParaVer && (
        <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setProductoParaVer(null)} />
          
          <div 
            className={`bg-surface w-full max-w-lg md:max-w-7xl rounded-[32px] md:rounded-[48px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col md:flex-row h-full max-h-[92vh] md:h-[90vh] overscroll-contain`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* BOTÓN CERRAR FLOTANTE PARA MÓVIL / ESCRITORIO */}
            <button 
              onClick={() => setProductoParaVer(null)} 
              className="absolute top-4 right-4 z-[70] w-10 h-10 flex items-center justify-center rounded-full bg-black/10 hover:bg-black/20 text-on-surface backdrop-blur-md transition-all shadow-lg"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden custom-scrollbar">
              {/* COLUMNA IZQUIERDA: GALERÍA */}
              <div className="w-full md:w-[60%] flex flex-col bg-white border-b md:border-b-0 md:border-r border-outline-variant/10 shrink-0">
                <div className="flex-1 relative group/gallery overflow-hidden flex items-center justify-center bg-[#fcfcfc] p-6 md:p-12">
                  <div className="absolute inset-4 md:inset-8 rounded-[48px] overflow-hidden z-0 bg-white/50 backdrop-blur-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]">
                    {/* FONDO DIFUMINADO DINÁMICO */}
                    {fotosProducto[indexImagenActual] && (
                      <div className="absolute inset-0">
                        <img 
                          src={fotosProducto[indexImagenActual]} 
                          className="w-full h-full object-cover blur-3xl scale-150 opacity-40 transition-all duration-1000 ease-in-out" 
                          alt="Dynamic background"
                        />
                        <div className="absolute inset-0 bg-white/10" />
                      </div>
                    )}
                  </div>

                  {fotosProducto[indexImagenActual] ? (
                    <div 
                      className={`relative z-10 max-w-full max-h-full transition-all duration-500 cursor-zoom-in active:scale-95 ${animacion}`}
                      onClick={() => setExpandedImage(fotosProducto[indexImagenActual])}
                    >
                      <img 
                        src={fotosProducto[indexImagenActual]} 
                        alt={productoParaVer.nombre} 
                        className="max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-8 border-white" 
                      />
                      <div className="absolute inset-0 rounded-[40px] hover:bg-black/5 transition-colors" />
                    </div>
                  ) : (
                    <div className="relative z-10">
                      <span className="material-symbols-outlined text-7xl text-outline/20">image</span>
                    </div>
                  )}

                  {/* FLECHAS INTERNAS */}
                  {fotosProducto.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-xl text-secondary hover:scale-110 transition-all opacity-0 group-hover/gallery:opacity-100"
                      >
                        <span className="material-symbols-outlined text-2xl">chevron_left</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-white shadow-xl text-secondary hover:scale-110 transition-all opacity-0 group-hover/gallery:opacity-100"
                      >
                        <span className="material-symbols-outlined text-2xl">chevron_right</span>
                      </button>
                    </>
                  )}

                  {/* INDICADOR NUMÉRICO REFINADO (AUTO-OCULTABLE) */}
                  {fotosProducto.length > 1 && mostrarIndicador && (
                    <div className="absolute bottom-10 right-10 z-20 flex items-center gap-2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border border-outline-variant/10 md:hidden animate-in fade-in zoom-in duration-500 animate-out fade-out zoom-out">
                      <span className="material-symbols-outlined text-sm text-primary">imagesmode</span>
                      <span className="text-[11px] font-black tracking-[0.1em] text-on-surface">
                        {indexImagenActual + 1} <span className="text-outline/40 mx-0.5">/</span> {fotosProducto.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* MINIATURAS EN ESCRITORIO */}
                {fotosProducto.length > 1 && (
                  <div className="hidden md:flex gap-2 p-4 justify-center border-t border-outline-variant/5 overflow-x-auto">
                    {fotosProducto.map((f, i) => (
                      <button 
                        key={i}
                        onClick={() => setIndexImagenActual(i)}
                        className={`w-20 h-20 rounded-2xl border-2 overflow-hidden transition-all shrink-0 p-1 bg-white ${indexImagenActual === i ? 'border-primary shadow-lg scale-110' : 'border-outline-variant/10 opacity-60 hover:opacity-100 hover:border-primary/30'}`}
                      >
                        <img src={f} className="w-full h-full object-cover rounded-xl" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* COLUMNA DERECHA: INFO */}
              <div className="w-full md:w-[40%] flex flex-col bg-[#fafafa] md:overflow-y-auto custom-scrollbar">
                <div className="p-8 md:p-12 flex-1 space-y-10">
                  {/* CABECERA: NOMBRE Y MARCA CENTRALIZADA ABAJO */}
                  <div className="animate-in fade-in slide-in-from-right duration-500 delay-100 text-center">
                    <h2 className="font-headline font-bold text-3xl md:text-5xl text-on-surface leading-[1.1] mb-2">{productoParaVer.nombre}</h2>
                    <p className="text-xs md:text-sm text-outline font-medium uppercase tracking-[0.2em] opacity-60 mb-6">{(productoParaVer.coleccion || 'SIN CATEGORÍA').toUpperCase()}</p>
                    
                    <div className="flex items-center gap-4 justify-center">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-primary/20" />
                      <p className="text-xs md:text-sm text-primary font-bold uppercase tracking-[0.4em] px-2">{productoParaVer.marca || 'GENÉRICO'}</p>
                      <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-primary/20" />
                    </div>
                  </div>


                  {/* DESCRIPCIÓN REFINADA */}
                  <div className="space-y-5 animate-in fade-in slide-in-from-right duration-500 delay-300">
                    <div className="flex items-center gap-3">
                      <span className="material-symbols-outlined text-secondary text-xl">description</span>
                      <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-secondary">Descripción Detallada</p>
                    </div>
                    
                    <div className="bg-white/50 backdrop-blur-sm p-6 md:p-10 rounded-[40px] border border-outline-variant/5 shadow-sm">
                      {productoParaVer.descripcion ? (
                        <div className="space-y-6">
                          {productoParaVer.descripcion.split('\n').map((linea, index) => {
                            // Detectar si la línea es un título (Empieza por número, o es corta y termina en ':')
                            const esTitulo = /^\d+\./.test(linea.trim()) || linea.trim().endsWith(':');
                            
                            return (
                              <p 
                                key={index} 
                                className={`text-sm md:text-xl leading-relaxed transition-all ${
                                  esTitulo 
                                    ? 'text-on-surface font-black mb-2 mt-4' 
                                    : 'text-on-surface-variant font-medium opacity-90'
                                }`}
                              >
                                {linea}
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-6 text-center space-y-3">
                          <span className="material-symbols-outlined text-outline/30 text-4xl">info</span>
                          <p className="text-sm md:text-lg text-outline italic">
                            No hay una descripción detallada disponible para este producto en este momento.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STOCK CON DISEÑO DE TARJETA */}
                  <div className="animate-in fade-in slide-in-from-right duration-500 delay-400">
                    <div className="bg-gradient-to-br from-white to-[#f5f5f5] p-6 md:p-10 rounded-[40px] border border-outline-variant/10 shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                        <span className="material-symbols-outlined text-8xl transform rotate-12">inventory_2</span>
                      </div>
                      <div className="flex items-center gap-6 relative z-10">
                        <div className="w-16 h-16 rounded-2xl bg-secondary/5 flex items-center justify-center text-secondary">
                          <span className="material-symbols-outlined text-4xl">inventory_2</span>
                        </div>
                        <div>
                          <p className="text-[10px] md:text-xs font-black uppercase tracking-[0.3em] text-outline mb-2">Disponibilidad en Bodega</p>
                          <p className="text-xl md:text-3xl font-black text-on-surface">
                            {productoParaVer.variantes?.length > 0 
                              ? `${productoParaVer.variantes.reduce((sum, v) => sum + Number(v.stock), 0)} UNIDADES`
                              : `${productoParaVer.stock} UNIDADES`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BARRA DE ACCIÓN INFERIOR CON PRECIO Y BOTÓN */}
                <div className="p-6 md:p-8 bg-white/90 backdrop-blur-2xl border-t border-outline-variant/10 sticky bottom-0 z-20 animate-in fade-in slide-in-from-bottom duration-700 delay-500">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* PRECIO COMPACTO EN EL FOOTER */}
                    <div className="flex flex-col items-center md:items-start shrink-0">
                      <p className="text-[9px] font-black uppercase tracking-[0.2em] text-outline mb-1">Precio Internet</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-light text-secondary">$</span>
                        <p className="font-black text-secondary text-4xl md:text-5xl tracking-tighter">
                          {(productoParaVer.precio || 0).toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        abrirModalAñadir(productoParaVer);
                        setProductoParaVer(null);
                      }}
                      className="group relative flex-1 w-full bg-primary text-on-primary py-5 md:py-7 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs md:text-sm shadow-xl overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <div className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-[-25deg] -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out" />
                      <div className="relative flex justify-center items-center gap-4">
                        <span className="material-symbols-outlined text-2xl md:text-3xl group-hover:rotate-12 transition-transform">shopping_cart_checkout</span>
                        <span>Añadir al Pedido</span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CHECKOUT WHATSAPP */}
      {showCheckout && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowCheckout(false)} />
          <div className="bg-surface w-full max-w-sm rounded-[32px] shadow-2xl relative z-10 p-8 text-center animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">chat</span>
            </div>
            <h3 className="font-headline font-bold text-xl text-on-surface mb-2">Confirmar Pedido</h3>
            <p className="text-sm text-on-surface-variant mb-6">Ingresa tu nombre para enviar el detalle de tu pedido directamente por WhatsApp.</p>
            
            <input 
              type="text"
              autoFocus
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Tu nombre y apellido..."
              className="w-full bg-surface-container-low border-2 border-primary/20 focus:border-primary px-5 py-4 rounded-2xl text-center font-bold text-primary outline-none transition-all mb-6"
            />

            <div className="flex gap-3">
              <button onClick={() => setShowCheckout(false)} className="flex-1 bg-surface-container-high py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider text-on-surface-variant hover:bg-surface-variant transition-colors">
                Cancelar
              </button>
              <button 
                onClick={enviarPedidoWhatsApp}
                className="flex-[2] bg-[#25D366] text-white py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-2"
              >
                Enviar a WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
      {/* VISOR DE IMAGEN AMPLIADA (ZOOM) CON NAVEGACIÓN */}
      {expandedImage && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-12 animate-in fade-in duration-300"
          onClick={() => setExpandedImage(null)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {/* BOTÓN CERRAR */}
          <button className="absolute top-6 right-6 md:top-12 md:right-12 text-white/40 hover:text-white transition-colors z-[210] p-4">
            <span className="material-symbols-outlined text-5xl">close</span>
          </button>

          {/* FLECHAS DE NAVEGACIÓN EN ZOOM (AUTO-OCULTABLES) */}
          {fotosProducto.length > 1 && mostrarControlesZoom && (
            <>
              <button 
                onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
                className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[210] backdrop-blur-md animate-in fade-in slide-in-from-left duration-300"
              >
                <span className="material-symbols-outlined text-4xl">chevron_left</span>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
                className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[210] backdrop-blur-md animate-in fade-in slide-in-from-right duration-300"
              >
                <span className="material-symbols-outlined text-4xl">chevron_right</span>
              </button>
            </>
          )}

          <div 
            className={`relative z-[205] max-w-full max-h-full transition-transform duration-500 ease-out ${animacion}`}
            style={{ 
              transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
              touchAction: 'none'
            }}
            onDoubleClick={() => scale > 1 ? resetZoom() : setScale(2.5)}
          >
            <img 
              src={fotosProducto[indexImagenActual]} 
              className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl select-none pointer-events-none" 
              alt="Imagen ampliada"
            />
            
            {/* INDICADOR NUMÉRICO EN ZOOM (Solo si no hay zoom aplicado) */}
            {fotosProducto.length > 1 && scale === 1 && (
              <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white/10 text-white/60 px-4 py-1.5 rounded-full text-xs font-black tracking-widest backdrop-blur-md border border-white/10">
                {indexImagenActual + 1} / {fotosProducto.length}
              </div>
            )}
          </div>

          {/* BOTÓN RESET ZOOM (Solo aparece si hay zoom) */}
          {scale > 1 && (
            <button 
              onClick={(e) => { e.stopPropagation(); resetZoom(); }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-3 rounded-full font-bold shadow-2xl z-[220] flex items-center gap-2 animate-in slide-in-from-bottom"
            >
              <span className="material-symbols-outlined">zoom_out</span>
              <span>Resetear Zoom</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
