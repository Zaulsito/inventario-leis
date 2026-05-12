import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { db } from './config/firebase'

// Número de WhatsApp al que llegarán los pedidos (formato internacional sin el +)
const WHATSAPP_NUMBER = "56921648127" // ¡Cambia esto por tu número real!

export default function CatalogoPublico() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Categorías
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
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
    if (filtroCategoria === 'TODAS') return true;
    return (p.coleccion || '').trim().toUpperCase() === filtroCategoria;
  })

  const indexActual = productoParaVer ? productosFiltrados.findIndex(p => p.id === productoParaVer.id) : -1;

  function irAAnterior() {
    if (indexActual > 0 && !animacion) {
      setAnimacion('salir-derecha');
      setTimeout(() => {
        setProductoParaVer(productosFiltrados[indexActual - 1]);
        setAnimacion('entrar-izquierda');
        setTimeout(() => setAnimacion(''), 300);
      }, 300);
    }
  }

  function irASiguiente() {
    if (indexActual < productosFiltrados.length - 1 && !animacion) {
      setAnimacion('salir-izquierda');
      setTimeout(() => {
        setProductoParaVer(productosFiltrados[indexActual + 1]);
        setAnimacion('entrar-derecha');
        setTimeout(() => setAnimacion(''), 300);
      }, 300);
    }
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (!productoParaVer) return;
      if (e.key === 'ArrowLeft') irAAnterior();
      if (e.key === 'ArrowRight') irASiguiente();
      if (e.key === 'Escape') setProductoParaVer(null);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [productoParaVer, indexActual]);

  // Lógica de Swipe para móviles
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const minSwipeDistance = 50;

  const handleTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e) => setTouchEnd(e.targetTouches[0].clientX);

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    if (isLeftSwipe) irASiguiente();
    if (isRightSwipe) irAAnterior();
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
    <div className="min-h-screen bg-surface-container-lowest pb-32 relative">
      
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

      {/* HEADER PÚBLICO */}
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md px-6 py-5 border-b border-outline-variant/20 shadow-sm flex flex-col gap-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 md:gap-4">
            <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center p-1 shrink-0">
              <img src="/logo.jpeg" alt="Logo Leis" className="w-full h-full object-contain rounded-lg" />
            </div>
            <div>
              <h1 className="font-headline text-xl md:text-2xl text-secondary font-bold italic">Catálogo de Productos</h1>
              <p className="text-[10px] uppercase tracking-widest text-outline font-bold">Arma tu pedido online</p>
            </div>
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
        </div>

        {/* FILTROS DE CATEGORÍA */}
        <div className="relative flex items-center group">
          <button 
            onClick={() => scrollCategories('left')} 
            className="absolute left-0 z-10 bg-surface/90 backdrop-blur-md p-1.5 rounded-full shadow-md border border-outline-variant/30 flex items-center justify-center scale-90 -translate-x-2 md:-translate-x-1/2 hover:scale-100 transition-all text-secondary"
          >
            <span className="material-symbols-outlined text-base">chevron_left</span>
          </button>
          
          <div 
            ref={categoryContainerRef}
            className="flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth pb-2 pt-1 px-4 md:px-2 mask-horizontal-fade w-full"
          >
            {categoriasUnicas.map(c => (
              <button
                key={c}
                onClick={() => setFiltroCategoria(c)}
                className={`px-5 py-2 text-[10px] font-bold uppercase tracking-widest rounded-full border transition-all whitespace-nowrap shrink-0
                  ${filtroCategoria === c
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
            className="absolute right-0 z-10 bg-surface/90 backdrop-blur-md p-1.5 rounded-full shadow-md border border-outline-variant/30 flex items-center justify-center scale-90 translate-x-2 md:translate-x-1/2 hover:scale-100 transition-all text-secondary"
          >
            <span className="material-symbols-outlined text-base">chevron_right</span>
          </button>
        </div>
      </header>

      {/* GRID DE PRODUCTOS */}
      <main className="p-6 md:p-10 max-w-7xl mx-auto">
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
                      <img src={p.fotoUrl} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                      className="font-headline font-bold text-sm md:text-base text-on-surface leading-tight line-clamp-2 mb-1 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setProductoParaVer(p)}
                    >
                      {p.nombre}
                    </h3>
                    <p className="text-[10px] text-outline uppercase tracking-wider mb-3">{(p.coleccion || '').toUpperCase()}</p>
                    
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
      </main>

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
          
          {/* BOTONES NAVEGACIÓN LATERAL (WEB) */}
          <button 
            disabled={indexActual <= 0}
            onClick={(e) => { e.stopPropagation(); irAAnterior(); }}
            className="fixed left-4 lg:left-10 top-1/2 -translate-y-1/2 z-[70] hidden md:flex w-14 h-14 items-center justify-center rounded-full bg-surface/90 backdrop-blur-md shadow-2xl border border-outline-variant/20 text-secondary hover:scale-110 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
          >
            <span className="material-symbols-outlined text-3xl group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
          </button>

          <button 
            disabled={indexActual >= productosFiltrados.length - 1}
            onClick={(e) => { e.stopPropagation(); irASiguiente(); }}
            className="fixed right-4 lg:right-10 top-1/2 -translate-y-1/2 z-[70] hidden md:flex w-14 h-14 items-center justify-center rounded-full bg-surface/90 backdrop-blur-md shadow-2xl border border-outline-variant/20 text-secondary hover:scale-110 active:scale-95 transition-all disabled:opacity-20 disabled:cursor-not-allowed group"
          >
            <span className="material-symbols-outlined text-3xl group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </button>

          <div 
            className={`bg-surface w-full max-w-lg rounded-[32px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh] ${animacion}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="p-6 border-b border-outline-variant/10 bg-surface-container-low shrink-0 flex justify-between items-center">
              <h3 className="font-headline font-bold text-lg text-on-surface pr-4">Detalle del Producto</h3>
              <button onClick={() => setProductoParaVer(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-surface-variant text-outline">
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            
            <div className="p-0 overflow-y-auto custom-scrollbar flex-1">
              <div className="aspect-video bg-surface-variant/30 flex items-center justify-center overflow-hidden">
                {productoParaVer.fotoUrl ? (
                  <img src={productoParaVer.fotoUrl} alt={productoParaVer.nombre} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-5xl text-outline/20">image</span>
                )}
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <div className="flex justify-between items-start gap-4 mb-2">
                    <h2 className="font-headline font-bold text-2xl text-on-surface leading-tight">{productoParaVer.nombre}</h2>
                    <p className="font-bold text-secondary text-2xl">${(productoParaVer.precio || 0).toLocaleString('es-CL')}</p>
                  </div>
                  <p className="text-xs text-outline uppercase tracking-widest font-bold">{(productoParaVer.coleccion || '').toUpperCase()} • {productoParaVer.marca || 'Sin marca'}</p>
                </div>

                {productoParaVer.descripcion ? (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">Descripción</p>
                    <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">{productoParaVer.descripcion}</p>
                  </div>
                ) : (
                  <p className="text-sm text-outline italic">No hay descripción disponible para este producto.</p>
                )}

                <div className="pt-4 border-t border-outline-variant/10 flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-outline mb-1">Disponibilidad</p>
                    <p className="text-sm font-bold text-on-surface">
                      {productoParaVer.variantes?.length > 0 
                        ? `${productoParaVer.variantes.reduce((sum, v) => sum + Number(v.stock), 0)} unidades en total`
                        : `${productoParaVer.stock} unidades disponibles`}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 bg-surface-container border-t border-outline-variant/10 shrink-0">
              <button 
                onClick={() => {
                  abrirModalAñadir(productoParaVer);
                  setProductoParaVer(null);
                }}
                className="w-full bg-primary text-on-primary py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2"
              >
                <span className="material-symbols-outlined text-lg">add_shopping_cart</span>
                Añadir al Pedido
              </button>
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
    </div>
  )
}
