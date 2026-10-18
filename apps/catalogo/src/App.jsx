import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { collection, onSnapshot, doc, setDoc } from 'firebase/firestore'
import { db } from './config/firebase'
import { getOptimizedImageUrl } from './utils/image'
import { getHexColor } from './utils/colors'
import { toTitleCase, formatPrice } from './utils/formatters'
import { getCategoriaIcon } from './utils/categories'
import { mergeCarts } from './utils/cart'
import { PulsingRing, GlowingHighlight, FloatingArrow, ProductImagePlaceholder } from './components/common/Indicators'
import BeforeAfterSlider from './components/common/BeforeAfterSlider'
import CheckoutModal from './components/cart/CheckoutModal'
import CartDrawerModal from './components/cart/CartDrawerModal'
import { VideoTutorialModal, OrderStepsTutorial, InteractiveMascotTour } from './components/tutorial'
import { AuthModal, EditProfileModal, DeleteAccountModal, ResetPasswordModal } from './components/auth'
import { ProductCard, ProductDetailModal, QuickVariantModal, ImageViewerModal, CatalogHeaderControls, ProductPagination } from './components/product'
import { FilterSidebar, Header, Footer } from './components/layout'
import { HeroBanner } from './components/hero'
import { AutoDemoScreens } from './components/demo'
import { useAutoDemo, useAuth } from './hooks'

// Número de WhatsApp al que llegarán los pedidos (formato internacional sin el +)
const WHATSAPP_NUMBER = "56921648127" // ¡Cambia esto por tu número real!

export default function CatalogoPublico() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    document.title = 'Catálogo Leis'
  }, [])

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [isDark])
  
  // Filtros Avanzados
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [ordenamiento, setOrdenamiento] = useState('destacados')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [soloConImagenes, setSoloConImagenes] = useState(false)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
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

  const [isCartOpen, setIsCartOpen] = useState(false)
  const [filtroCartCategory, setFiltroCartCategory] = useState('TODOS')

  // Estado del Tutorial de Compra interactivo
  const [showTutorial, setShowTutorial] = useState(() => {
    return localStorage.getItem('hide_catalogo_tutorial') !== 'true';
  })

  // Paso actual del Viaje de Compra guiado (0 = inactivo, 1 a 7 = pasos)
  const [tourStep, setTourStep] = useState(0)
  const [isDialogMinimized, setIsDialogMinimized] = useState(false)

  // Estado para colapsar barra lateral
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  
  // Estado para el modal del video tutorial
  const [showVideoModal, setShowVideoModal] = useState(false)










  // Auto-restaurar globo al cambiar de paso
  useEffect(() => {
    if (tourStep > 0) {
      setIsDialogMinimized(false)
    }
  }, [tourStep])

  // Avanzar del paso 4 al 5 cuando el usuario abre el carrito
  useEffect(() => {
    if (tourStep === 4 && isCartOpen) {
      setTourStep(5)
    }
  }, [isCartOpen, tourStep])







  // Modal de selección de variantes
  const [productParaAñadir, setProductParaAñadir] = useState(null)
  const [varianteSeleccionada, setVarianteSeleccionada] = useState('')

  // Modal de detalle del producto
  const [productoParaVer, setProductoParaVer] = useState(null)
  
  // Modal checkout final
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')

  // Referencias para evitar condiciones de carrera en la sincronización del carrito
  const loadingCartFromDb = useRef(false)
  const lastLoadedUid = useRef(null)

  // Auth Hook
  const {
    currentUser,
    setCurrentUser,
    userData,
    setUserData,
    showAuthModal,
    setShowAuthModal,
    authTab,
    setAuthTab,
    authForm,
    setAuthForm,
    authError,
    setAuthError,
    authSuccess,
    setAuthSuccess,
    isAuthLoading,
    showProfileMenu,
    setShowProfileMenu,
    showEditProfileModal,
    setShowEditProfileModal,
    editProfileForm,
    setEditProfileForm,
    editProfileError,
    setEditProfileError,
    editProfileSuccess,
    setEditProfileSuccess,
    isEditProfileLoading,
    showDeleteAccountModal,
    setShowDeleteAccountModal,
    deletePassword,
    setDeletePassword,
    deleteAccountError,
    setDeleteAccountError,
    deleteAccountSuccess,
    setDeleteAccountSuccess,
    isDeleteAccountLoading,
    showResetPasswordModal,
    setShowResetPasswordModal,
    resetEmailSuccess,
    setResetEmailSuccess,
    resetEmailError,
    setResetEmailError,
    isResetEmailLoading,
    forgotEmail,
    setForgotEmail,
    handleAuthSubmit,
    handleLogout,
    handleUpdateProfile,
    handleDeleteAccount,
    handleSendResetEmailLoggedIn,
    handleSendResetEmailForgot
  } = useAuth({
    setClienteNombre,
    setClienteWhatsapp,
    setCarrito,
    loadingCartFromDb,
    lastLoadedUid
  })
  const mainScrollRef = useRef(null)

  const [animacion, setAnimacion] = useState('') // '', 'salir-izquierda', 'salir-derecha', etc.
  const [indexImagenActual, setIndexImagenActual] = useState(0)
  const [mostrarIndicador, setMostrarIndicador] = useState(false)
  const [mostrarControlesZoom, setMostrarControlesZoom] = useState(true)
  const [expandedImage, setExpandedImage] = useState(null)
  const [isModalImgLoading, setIsModalImgLoading] = useState(false)
  const [modoAntesDespues, setModoAntesDespues] = useState(false)
  const [indexFotoAntes, setIndexFotoAntes] = useState(0)
  const [indexFotoDespues, setIndexFotoDespues] = useState(1)
  const [selectedColorByProduct, setSelectedColorByProduct] = useState({})
  const [openColorDropdownId, setOpenColorDropdownId] = useState(null)
  const [varianteDetalle, setVarianteDetalle] = useState(null)

  // Auto Demo Hook
  const {
    isAutoDemo,
    autoDemoStep,
    autoDemoCaption,
    autoDemoProgress,
    showDemoIntro,
    showDemoOutro,
    outroText,
    showOutroLeis,
    pointerStyle,
    pointerType,
    startAutoDemo,
    stopAutoDemo
  } = useAutoDemo({
    productos,
    setIsDark,
    setIsSidebarCollapsed,
    setSearchTerm,
    setPrecioMin,
    setPrecioMax,
    setSoloDisponibles,
    setSoloConImagenes,
    setShowTutorial,
    setTourStep,
    setCarrito,
    setIsCartOpen,
    isCartOpen,
    setShowCheckout,
    showCheckout,
    setShowAuthModal,
    showAuthModal,
    setClienteNombre,
    setClienteWhatsapp,
    setFiltroCartCategory,
    setAuthTab,
    setAuthForm,
    productoParaVer,
    setProductoParaVer,
    setIndexImagenActual,
    añadirAlCarrito
  })



  // --- Back button closing for mobile/browser history ---
  useEffect(() => {
    const handlePopState = (event) => {
      if (
        isCartOpen ||
        productParaAñadir ||
        productoParaVer ||
        showCheckout ||
        showAuthModal ||
        showEditProfileModal ||
        showDeleteAccountModal ||
        showResetPasswordModal ||
        expandedImage
      ) {
        setIsCartOpen(false);
        setProductParaAñadir(null);
        setProductoParaVer(null);
        setShowCheckout(false);
        setShowAuthModal(false);
        setShowEditProfileModal(false);
        setShowDeleteAccountModal(false);
        setShowResetPasswordModal(false);
        setExpandedImage(null);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    isCartOpen,
    productParaAñadir,
    productoParaVer,
    showCheckout,
    showAuthModal,
    showEditProfileModal,
    showDeleteAccountModal,
    showResetPasswordModal,
    expandedImage
  ]);



  const wasModalOpenRef = useRef(false);

  useEffect(() => {
    const anyOpen = !!(
      isCartOpen ||
      productParaAñadir ||
      productoParaVer ||
      showCheckout ||
      showAuthModal ||
      showEditProfileModal ||
      showDeleteAccountModal ||
      showResetPasswordModal ||
      expandedImage
    );

    if (anyOpen && !wasModalOpenRef.current) {
      window.history.pushState({ modalOpen: true }, '');
      wasModalOpenRef.current = true;
    } else if (!anyOpen && wasModalOpenRef.current) {
      if (window.history.state?.modalOpen) {
        window.history.back();
      }
      wasModalOpenRef.current = false;
    }
  }, [
    isCartOpen,
    productParaAñadir,
    productoParaVer,
    showCheckout,
    showAuthModal,
    showEditProfileModal,
    showDeleteAccountModal,
    showResetPasswordModal,
    expandedImage
  ]);

  // Sincronización dual del carrito: localStorage + Firestore
  useEffect(() => {
    localStorage.setItem('carritoLeis', JSON.stringify(carrito))
    
    if (currentUser && !loadingCartFromDb.current) {
      const userRef = doc(db, 'usuarios', currentUser.uid)
      setDoc(userRef, { carrito }, { merge: true })
        .catch(err => console.error("Error al sincronizar carrito:", err))
    }
  }, [carrito, currentUser])

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
      const data = snapshot.docs.map(dDoc => {
        const dData = dDoc.data()
        return { id: dDoc.id, ...dData, nombre: toTitleCase(dData.nombre) }
      })
      // Ordenar alfabéticamente
      data.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(data)
      setLoading(false)
    })
    return unsub
  }, [])

  // --- DERIVADOS ---
  const productosVisibles = productos.filter(p => p.visibleEnCatalogo !== false)

  const categoriasUnicas = ['TODAS', ...new Set(productosVisibles.map(p => (p.coleccion || '').trim().toUpperCase()).filter(Boolean))].sort((a, b) => {
    if (a === 'TODAS') return -1;
    if (b === 'TODAS') return 1;
    return a.localeCompare(b);
  })

  const categoryCounts = useMemo(() => {
    const counts = { TODAS: productosVisibles.length }
    productosVisibles.forEach(p => {
      const cat = (p.coleccion || '').trim().toUpperCase()
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1
      }
    })
    return counts
  }, [productosVisibles])

  const productosFiltrados = productosVisibles.filter(p => {
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
  }).sort((a, b) => {
    if (ordenamiento === 'precio_asc') {
      return (Number(a.precio) || 0) - (Number(b.precio) || 0);
    }
    if (ordenamiento === 'precio_desc') {
      return (Number(b.precio) || 0) - (Number(a.precio) || 0);
    }
    if (ordenamiento === 'recientes') {
      const dateA = new Date(a.fechaIngreso || a.createdAt || 0).getTime();
      const dateB = new Date(b.fechaIngreso || b.createdAt || 0).getTime();
      return dateB - dateA;
    }
    if (ordenamiento === 'mas_vendidos') {
      const ventasA = Number(a.ventasTotal || a.ventasCount || a.stockInvertido || 0);
      const ventasB = Number(b.ventasTotal || b.ventasCount || b.stockInvertido || 0);
      if (ventasB !== ventasA) return ventasB - ventasA;
    }

    // Por defecto (Destacados): productos con fotos primero
    const aTieneFoto = !!(a.fotoUrl || (a.fotos && a.fotos.length > 0 && a.fotos[0]));
    const bTieneFoto = !!(b.fotoUrl || (b.fotos && b.fotos.length > 0 && b.fotos[0]));
    if (aTieneFoto && !bTieneFoto) return -1;
    if (!aTieneFoto && bTieneFoto) return 1;
    return 0;
  })





  const fotosProducto = useMemo(() => {
    if (!productoParaVer) return [];
    if (varianteDetalle) {
      const vFotos = Array.isArray(varianteDetalle.fotos) ? varianteDetalle.fotos.filter(Boolean) : (varianteDetalle.fotoUrl ? [varianteDetalle.fotoUrl] : []);
      if (vFotos.length > 0) return vFotos;
    }
    return productoParaVer.fotos && productoParaVer.fotos.length > 0
      ? productoParaVer.fotos
      : (productoParaVer.fotoUrl ? [productoParaVer.fotoUrl] : []);
  }, [productoParaVer, varianteDetalle]);

  function anteriorImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('hoja-pasar-atras-salir');
    setTimeout(() => {
      setIsModalImgLoading(true);
      setIndexImagenActual(prev => (prev === 0 ? fotosProducto.length - 1 : prev - 1));
      setAnimacion('hoja-pasar-atras-entrar');
      setTimeout(() => setAnimacion(''), 320);
    }, 280);
  }

  function siguienteImagen() {
    if (fotosProducto.length <= 1 || animacion) return;
    setAnimacion('hoja-pasar-adelante-salir');
    setTimeout(() => {
      setIsModalImgLoading(true);
      setIndexImagenActual(prev => (prev === fotosProducto.length - 1 ? 0 : prev + 1));
      setAnimacion('hoja-pasar-adelante-entrar');
      setTimeout(() => setAnimacion(''), 320);
    }, 280);
  }

  function irAImagen(targetIndex) {
    if (targetIndex === indexImagenActual || animacion || targetIndex < 0 || targetIndex >= fotosProducto.length) return;
    const esAdelante = targetIndex > indexImagenActual;
    setAnimacion(esAdelante ? 'hoja-pasar-adelante-salir' : 'hoja-pasar-atras-salir');
    setTimeout(() => {
      setIsModalImgLoading(true);
      setIndexImagenActual(targetIndex);
      setAnimacion(esAdelante ? 'hoja-pasar-adelante-entrar' : 'hoja-pasar-atras-entrar');
      setTimeout(() => setAnimacion(''), 320);
    }, 280);
  }

  useEffect(() => {
    if (productoParaVer) {
      if (productoParaVer.variantes && productoParaVer.variantes.length > 0) {
        const preselectedName = selectedColorByProduct[productoParaVer.id];
        const initial = productoParaVer.variantes.find(v => v.nombre === preselectedName) || productoParaVer.variantes[0];
        setVarianteDetalle(initial);
      } else {
        setVarianteDetalle(null);
      }
    } else {
      setVarianteDetalle(null);
    }
    setIndexImagenActual(0);
    setAnimacion('');
    setIsModalImgLoading(false);
    setModoAntesDespues(false);
    setIndexFotoAntes(0);
    setIndexFotoDespues(1);
  }, [productoParaVer]);

  useEffect(() => {
    // Precarga automática e instantánea de todas las fotos en memoria
    if (fotosProducto && fotosProducto.length > 0) {
      fotosProducto.forEach(url => {
        if (url) {
          const img = new Image();
          img.src = getOptimizedImageUrl(url, 900);
        }
      });
    }
  }, [fotosProducto]);

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
  const [itemsVisiblesTodas, setItemsVisiblesTodas] = useState(20)
  const ITEMS_POR_PAGINA = 20

  useEffect(() => {
    setPaginaActual(1)
    setItemsVisiblesTodas(ITEMS_POR_PAGINA)
  }, [filtroCategoria])

  useEffect(() => {
    if (mainScrollRef.current && filtroCategoria !== 'TODAS') {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [paginaActual])

  const isTodas = filtroCategoria === 'TODAS'
  const totalPaginas = isTodas ? 1 : Math.ceil(productosFiltrados.length / ITEMS_POR_PAGINA)
  const productosPaginados = isTodas
    ? productosFiltrados.slice(0, itemsVisiblesTodas)
    : productosFiltrados.slice((paginaActual - 1) * ITEMS_POR_PAGINA, paginaActual * ITEMS_POR_PAGINA)

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

  const animateFlyToCart = (e, fotoUrl) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    
    const headerCartBtn = document.getElementById('header-cart-btn');
    const mobileCartFab = document.getElementById('mobile-cart-fab');
    
    let target = null;
    if (mobileCartFab && window.getComputedStyle(mobileCartFab).display !== 'none') {
      target = mobileCartFab;
    } else if (headerCartBtn) {
      target = headerCartBtn;
    }
    
    if (!target) return;
    
    const targetRect = target.getBoundingClientRect();
    
    const flyer = document.createElement('div');
    flyer.className = 'flyer-dot';
    
    flyer.style.position = 'fixed';
    flyer.style.top = `${rect.top + rect.height / 2 - 16}px`;
    flyer.style.left = `${rect.left + rect.width / 2 - 16}px`;
    flyer.style.width = '32px';
    flyer.style.height = '32px';
    flyer.style.borderRadius = '50%';
    flyer.style.zIndex = '9999';
    flyer.style.pointerEvents = 'none';
    
    if (fotoUrl) {
      flyer.style.backgroundImage = `url(${fotoUrl})`;
      flyer.style.backgroundSize = 'cover';
      flyer.style.backgroundPosition = 'center';
      flyer.style.boxShadow = '0 8px 24px rgba(226, 189, 108, 0.4)';
      flyer.style.border = '2px solid #e2bd6c';
    } else {
      flyer.style.backgroundColor = '#e2bd6c';
      flyer.style.boxShadow = '0 0 12px #e2bd6c, 0 0 4px #e2bd6c';
    }
    
    document.body.appendChild(flyer);
    
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const endX = targetRect.left + targetRect.width / 2;
    const endY = targetRect.top + targetRect.height / 2;
    
    flyer.animate([
      {
        transform: 'scale(1) translate(0, 0)',
        opacity: 1
      },
      {
        transform: `scale(0.8) translate(${(endX - startX) * 0.4}px, ${(endY - startY) * 0.1 - 100}px)`,
        opacity: 0.95
      },
      {
        transform: `scale(0.3) translate(${endX - startX}px, ${endY - startY}px)`,
        opacity: 0.3
      }
    ], {
      duration: 750,
      easing: 'cubic-bezier(0.25, 1, 0.5, 1)',
      fill: 'forwards'
    });
    
    setTimeout(() => {
      flyer.remove();
      target.classList.add('animate-cart-pop');
      setTimeout(() => {
        target.classList.remove('animate-cart-pop');
      }, 500);
    }, 750);
  };

  function abrirModalAñadir(p) {
    if (p.variantes && p.variantes.length > 0) {
      setProductParaAñadir(p)
      const preselectedName = selectedColorByProduct[p.id];
      const match = p.variantes.find(v => v.nombre === preselectedName && Number(v.stock) > 0)
        || p.variantes.find(v => Number(v.stock) > 0)
        || p.variantes[0];
      setVarianteSeleccionada(match || '')
    } else {
      añadirAlCarrito(p, null)
    }
  }

  function añadirAlCarrito(producto, variante) {
    if (tourStep === 3) {
      setTourStep(4)
    }
    const maxStock = variante ? variante.stock : producto.stock
    const nombreItem = variante ? `${producto.nombre} (${variante.nombre})` : producto.nombre
    const idCart = variante ? `${producto.id}-${variante.nombre}` : producto.id
    const itemFoto = (variante?.fotos && variante.fotos[0]) || variante?.fotoUrl || producto.fotoUrl || ''

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
          maxStock: Number(maxStock),
          fotoUrl: itemFoto,
          marca: producto.marca || ''
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
    if (tourStep === 5) {
      setTourStep(6)
    }
  }

  function enviarPedidoWhatsApp() {
    if (!clienteNombre.trim()) return alert('Por favor ingresa tu nombre')

    let texto = `*NUEVO PEDIDO - CATÁLOGO ONLINE*%0A%0A`
    texto += `*Cliente:* ${clienteNombre}%0A`
    if (clienteWhatsapp) {
      texto += `*Teléfono Contacto:* ${clienteWhatsapp}%0A`
    }
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

    if (tourStep === 6) {
      setTourStep(7)
      setTimeout(() => {
        setTourStep(0)
      }, 7000)
    }
  }

  // Obtener categorías únicas de los productos actualmente en el carrito (incluyendo 'TODOS' siempre al inicio)
  const categoriasEnCarrito = [
    'TODOS',
    ...new Set(carrito.map(item => {
      const pObj = productos.find(p => p.id === item.productoId);
      return pObj?.coleccion ? pObj.coleccion.trim().toUpperCase() : 'JOYAS';
    }))
  ];

  // Resetear el filtro de categorías al cerrar el carrito
  useEffect(() => {
    if (!isCartOpen) {
      setFiltroCartCategory('TODOS')
    }
  }, [isCartOpen])

  // --- RENDER ---

  // Pre-calculate demo products to highlight in the catalog grid
  const demoProd1 = isAutoDemo ? (productos.find(p => (p.nombre || '').toLowerCase().includes("collagen") && p.fotoUrl)
    || productos.find(p => (p.nombre || '').toLowerCase().includes("collagen"))
    || productos.find(p => p.fotoUrl)) : null;
  const demoProd2 = isAutoDemo && demoProd1 ? productos.find(p => p.id !== demoProd1.id && p.fotoUrl && (p.stock > 0 || (p.variantes && p.variantes.some(v => v.stock > 0)))) : null;

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-surface text-on-surface">Cargando catálogo...</div>
  }

  return (
    <div className={`flex h-[100dvh] ${isDark ? 'bg-[#0c0c0c]' : 'bg-surface'} relative overflow-hidden transition-colors duration-500`}>

      {/* ── PANEL LATERAL (SIDEBAR DE FILTROS) ── */}
      <FilterSidebar
        isDark={isDark}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isSidebarCollapsed={isSidebarCollapsed}
        setIsSidebarCollapsed={setIsSidebarCollapsed}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        precioMin={precioMin}
        setPrecioMin={setPrecioMin}
        precioMax={precioMax}
        setPrecioMax={setPrecioMax}
        filtroCategoria={filtroCategoria}
        setFiltroCategoria={setFiltroCategoria}
        categorySearchTerm={categorySearchTerm}
        setCategorySearchTerm={setCategorySearchTerm}
        categoriasUnicas={categoriasUnicas}
        categoryCounts={categoryCounts}
        setSoloDisponibles={setSoloDisponibles}
        setSoloConImagenes={setSoloConImagenes}
        totalResultados={productosFiltrados.length}
        tourStep={tourStep}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HEADER PRINCIPAL COMPACTO */}
        <Header
          isDark={isDark}
          setIsDark={setIsDark}
          isSidebarOpen={isSidebarOpen}
          setIsSidebarOpen={setIsSidebarOpen}
          isSidebarCollapsed={isSidebarCollapsed}
          setIsSidebarCollapsed={setIsSidebarCollapsed}
          showTutorial={showTutorial}
          setShowTutorial={setShowTutorial}
          currentUser={currentUser}
          userData={userData}
          handleLogout={handleLogout}
          onOpenEditProfile={() => {
            setEditProfileForm({
              nombre: currentUser?.displayName || '',
              whatsapp: userData?.whatsapp || ''
            })
            setEditProfileError('')
            setEditProfileSuccess('')
            setShowEditProfileModal(true)
          }}
          onOpenResetPassword={() => {
            setResetEmailSuccess('')
            setResetEmailError('')
            setShowResetPasswordModal(true)
          }}
          setShowAuthModal={setShowAuthModal}
          totalItems={totalItems}
          setIsCartOpen={setIsCartOpen}
          tourStep={tourStep}
          isAutoDemo={isAutoDemo}
          autoDemoStep={autoDemoStep}
        />

        {/* MAIN SCROLLABLE AREA */}
        <main ref={mainScrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar relative z-10 pb-32 md:pb-8">
          <div className="max-w-7xl mx-auto">
            
            {/* ── HERO BANNER PRINCIPAL DE INICIO ── */}
            <HeroBanner
              isDark={isDark}
              categoriasUnicas={categoriasUnicas}
              filtroCategoria={filtroCategoria}
              setFiltroCategoria={setFiltroCategoria}
              soloDisponibles={soloDisponibles}
              setSoloDisponibles={setSoloDisponibles}
              productos={productos}
              setProductoParaVer={setProductoParaVer}
            />

            {/* ── ENCABEZADO DE CATEGORÍA / PRODUCTOS (DEBAJO DEL HERO BANNER) ── */}
            <CatalogHeaderControls
              filtroCategoria={filtroCategoria}
              isDark={isDark}
              totalProductos={productosFiltrados.length}
              ordenamiento={ordenamiento}
              setOrdenamiento={setOrdenamiento}
              isSortOpen={isSortOpen}
              setIsSortOpen={setIsSortOpen}
            />

            {/* ── TUTORIAL INTERACTIVO DE PASOS PARA PEDIDOS ── */}
            {showTutorial && (
              <OrderStepsTutorial
                isDark={isDark}
                setShowTutorial={setShowTutorial}
                setShowVideoModal={setShowVideoModal}
                setTourStep={setTourStep}
              />
            )}
        {productosFiltrados.length === 0 ? (
          <div className="text-center py-20 text-on-surface-variant">
            No hay productos disponibles en esta categoría.
          </div>
        ) : (
          <>
            <div className={`grid gap-4 md:gap-6 ${
              isSidebarCollapsed 
                ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6' 
                : 'grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
            }`}>
              {productosPaginados.map((p, pIndex) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  pIndex={pIndex}
                  isDark={isDark}
                  carrito={carrito}
                  tourStep={tourStep}
                  isAutoDemo={isAutoDemo}
                  autoDemoStep={autoDemoStep}
                  demoProd1={demoProd1}
                  demoProd2={demoProd2}
                  selectedColorByProduct={selectedColorByProduct}
                  setSelectedColorByProduct={setSelectedColorByProduct}
                  openColorDropdownId={openColorDropdownId}
                  setOpenColorDropdownId={setOpenColorDropdownId}
                  setProductoParaVer={setProductoParaVer}
                  abrirModalAñadir={abrirModalAñadir}
                  añadirAlCarrito={añadirAlCarrito}
                  actualizarCantidad={actualizarCantidad}
                  eliminarDelCarrito={eliminarDelCarrito}
                  animateFlyToCart={animateFlyToCart}
                />
              ))}
            </div>
            
            {/* ── PAGINACIÓN DEL CATÁLOGO ── */}
            <ProductPagination
              isDark={isDark}
              isTodas={isTodas}
              itemsVisiblesTodas={itemsVisiblesTodas}
              setItemsVisiblesTodas={setItemsVisiblesTodas}
              ITEMS_POR_PAGINA={ITEMS_POR_PAGINA}
              totalProductos={productosFiltrados.length}
              productosPaginadosCount={productosPaginados.length}
              totalPaginas={totalPaginas}
              paginaActual={paginaActual}
              setPaginaActual={setPaginaActual}
              paginasVisibles={paginasVisibles}
              mainScrollRef={mainScrollRef}
            />
          </>
        )}

            {/* FOOTER DEL CATALOGO */}
            <Footer isDark={isDark} />
          </div>
        </main>
      </div>

      {/* FAB CARRITO MÓVIL */}
      {totalItems > 0 && (
        <div className="fixed bottom-6 inset-x-0 flex justify-center z-20 md:hidden">
          <button 
            id="mobile-cart-fab"
            onClick={() => setIsCartOpen(true)}
            className="bg-secondary text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 font-bold uppercase tracking-widest text-xs animate-in slide-in-from-bottom-10 hover:scale-105 transition-transform"
          >
            <span className="material-symbols-outlined">shopping_bag</span>
            Ver Carrito ({totalItems})
          </button>
        </div>
      )}

      {/* ── MODAL PREMIUM DEL CARRITO ── */}
      <CartDrawerModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        isDark={isDark}
        carrito={carrito}
        productos={productos}
        categoriasEnCarrito={categoriasEnCarrito}
        filtroCartCategory={filtroCartCategory}
        setFiltroCartCategory={setFiltroCartCategory}
        actualizarCantidad={actualizarCantidad}
        eliminarDelCarrito={eliminarDelCarrito}
        totalCarrito={totalCarrito}
        prepararCheckout={prepararCheckout}
        tourStep={tourStep}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* MODAL SELECCIÓN DE VARIANTES */}
      <QuickVariantModal
        isOpen={Boolean(productParaAñadir)}
        onClose={() => setProductParaAñadir(null)}
        isDark={isDark}
        productParaAñadir={productParaAñadir}
        varianteSeleccionada={varianteSeleccionada}
        setVarianteSeleccionada={setVarianteSeleccionada}
        carrito={carrito}
        setSelectedColorByProduct={setSelectedColorByProduct}
        animateFlyToCart={animateFlyToCart}
        añadirAlCarrito={añadirAlCarrito}
      />

      {/* MODAL DETALLE DE PRODUCTO */}
      <ProductDetailModal
        isOpen={Boolean(productoParaVer)}
        onClose={() => setProductoParaVer(null)}
        isDark={isDark}
        productoParaVer={productoParaVer}
        fotosProducto={fotosProducto}
        indexImagenActual={indexImagenActual}
        setIndexImagenActual={setIndexImagenActual}
        animacion={animacion}
        setAnimacion={setAnimacion}
        isModalImgLoading={isModalImgLoading}
        setIsModalImgLoading={setIsModalImgLoading}
        irAImagen={irAImagen}
        anteriorImagen={anteriorImagen}
        siguienteImagen={siguienteImagen}
        mostrarIndicador={mostrarIndicador}
        setExpandedImage={setExpandedImage}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        varianteDetalle={varianteDetalle}
        setVarianteDetalle={setVarianteDetalle}
        selectedColorByProduct={selectedColorByProduct}
        setSelectedColorByProduct={setSelectedColorByProduct}
        animateFlyToCart={animateFlyToCart}
        añadirAlCarrito={añadirAlCarrito}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* MODAL CHECKOUT WHATSAPP */}
      <CheckoutModal
        isOpen={showCheckout}
        onClose={() => setShowCheckout(false)}
        isDark={isDark}
        currentUser={currentUser}
        clienteNombre={clienteNombre}
        setClienteNombre={setClienteNombre}
        onEnviarPedido={enviarPedidoWhatsApp}
        onOpenAuth={() => {
          setShowCheckout(false);
          setShowAuthModal(true);
        }}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
        tourStep={tourStep}
      />
      {/* VISOR DE IMAGEN AMPLIADA (ZOOM) CON NAVEGACIÓN */}
      <ImageViewerModal
        isOpen={Boolean(expandedImage)}
        onClose={() => setExpandedImage(null)}
        fotosProducto={fotosProducto}
        indexImagenActual={indexImagenActual}
        mostrarControlesZoom={mostrarControlesZoom}
        anteriorImagen={anteriorImagen}
        siguienteImagen={siguienteImagen}
        handleTouchStart={handleTouchStart}
        handleTouchMove={handleTouchMove}
        handleTouchEnd={handleTouchEnd}
        animacion={animacion}
        position={position}
        scale={scale}
        setScale={setScale}
        resetZoom={resetZoom}
      />

      {/* ── MODAL VIDEO TUTORIAL ── */}
      <VideoTutorialModal
        isOpen={showVideoModal}
        onClose={() => setShowVideoModal(false)}
        isDark={isDark}
      />

      {/* MODAL DE AUTENTICACIÓN */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        isDark={isDark}
        authTab={authTab}
        setAuthTab={setAuthTab}
        authForm={authForm}
        setAuthForm={setAuthForm}
        handleAuthSubmit={handleAuthSubmit}
        isAuthLoading={isAuthLoading}
        authError={authError}
        setAuthError={setAuthError}
        authSuccess={authSuccess}
        setAuthSuccess={setAuthSuccess}
        forgotEmail={forgotEmail}
        setForgotEmail={setForgotEmail}
        handleSendResetEmailForgot={handleSendResetEmailForgot}
        isResetEmailLoading={isResetEmailLoading}
        resetEmailError={resetEmailError}
        setResetEmailError={setResetEmailError}
        resetEmailSuccess={resetEmailSuccess}
        setResetEmailSuccess={setResetEmailSuccess}
        isAutoDemo={isAutoDemo}
        autoDemoStep={autoDemoStep}
      />

      {/* MODAL DE EDITAR PERFIL */}
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        isDark={isDark}
        editProfileForm={editProfileForm}
        setEditProfileForm={setEditProfileForm}
        handleUpdateProfile={handleUpdateProfile}
        isEditProfileLoading={isEditProfileLoading}
        editProfileError={editProfileError}
        editProfileSuccess={editProfileSuccess}
        onOpenDeleteAccount={() => {
          setDeletePassword('')
          setDeleteAccountError('')
          setDeleteAccountSuccess('')
          setShowDeleteAccountModal(true)
          setShowEditProfileModal(false)
        }}
      />

      {/* MODAL DE ELIMINAR CUENTA */}
      <DeleteAccountModal
        isOpen={showDeleteAccountModal}
        onClose={() => setShowDeleteAccountModal(false)}
        isDark={isDark}
        deletePassword={deletePassword}
        setDeletePassword={setDeletePassword}
        handleDeleteAccount={handleDeleteAccount}
        isDeleteAccountLoading={isDeleteAccountLoading}
        deleteAccountError={deleteAccountError}
        deleteAccountSuccess={deleteAccountSuccess}
      />

      {/* MODAL DE RESTABLECER CONTRASEÑA */}
      <ResetPasswordModal
        isOpen={showResetPasswordModal}
        onClose={() => setShowResetPasswordModal(false)}
        isDark={isDark}
        currentUser={currentUser}
        handleSendResetEmailLoggedIn={handleSendResetEmailLoggedIn}
        isResetEmailLoading={isResetEmailLoading}
        resetEmailError={resetEmailError}
        resetEmailSuccess={resetEmailSuccess}
      />


      {/* ── AUTO-DEMO OVERLAYS Y SUBTÍTULOS ── */}
      <AutoDemoScreens
        isDark={isDark}
        isAutoDemo={isAutoDemo}
        showDemoIntro={showDemoIntro}
        showDemoOutro={showDemoOutro}
        outroText={outroText}
        showOutroLeis={showOutroLeis}
        pointerStyle={pointerStyle}
        pointerType={pointerType}
        autoDemoCaption={autoDemoCaption}
        autoDemoProgress={autoDemoProgress}
      />

      {/* ── TOUR GUIADO DE COMPRA CON LA GATITA YOSHITA ── */}
      <InteractiveMascotTour
        tourStep={tourStep}
        setTourStep={setTourStep}
        isDialogMinimized={isDialogMinimized}
        setIsDialogMinimized={setIsDialogMinimized}
        isDark={isDark}
      />


    </div>
  )
}
