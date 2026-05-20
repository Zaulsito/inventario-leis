import { useState, useEffect, useRef } from 'react'
import { collection, onSnapshot, doc, setDoc, getDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore'
import { db, auth } from './config/firebase'
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile, sendEmailVerification, deleteUser, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth'

// Número de WhatsApp al que llegarán los pedidos (formato internacional sin el +)
const WHATSAPP_NUMBER = "56921648127" // ¡Cambia esto por tu número real!

function mergeCarts(localCart, dbCart) {
  const merged = [...(dbCart || [])]
  if (localCart && localCart.length > 0) {
    localCart.forEach(localItem => {
      const existingIdx = merged.findIndex(dbItem => dbItem.idCart === localItem.idCart)
      if (existingIdx > -1) {
        const combinedQty = merged[existingIdx].cantidad + localItem.cantidad
        merged[existingIdx].cantidad = Math.min(combinedQty, merged[existingIdx].maxStock)
      } else {
        merged.push(localItem)
      }
    })
  }
  return merged
}

export default function CatalogoPublico() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)

  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem('theme')
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches)
  })

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('theme', 'light')
    }
  }, [isDark])
  
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

  const [isCartOpen, setIsCartOpen] = useState(false)

  // Modal de selección de variantes
  const [productParaAñadir, setProductParaAñadir] = useState(null)
  const [varianteSeleccionada, setVarianteSeleccionada] = useState('')

  // Modal de detalle del producto
  const [productoParaVer, setProductoParaVer] = useState(null)
  
  // Modal checkout final
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')

  // Auth State
  const [currentUser, setCurrentUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authTab, setAuthTab] = useState('login') // 'login' | 'register'
  const [authForm, setAuthForm] = useState({ nombre: '', email: '', password: '', whatsapp: '' })
  const [authError, setAuthError] = useState('')
  const [authSuccess, setAuthSuccess] = useState('')
  const [isAuthLoading, setIsAuthLoading] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  // Edit Profile States
  const [showEditProfileModal, setShowEditProfileModal] = useState(false)
  const [editProfileForm, setEditProfileForm] = useState({ nombre: '', whatsapp: '' })
  const [editProfileError, setEditProfileError] = useState('')
  const [editProfileSuccess, setEditProfileSuccess] = useState('')
  const [isEditProfileLoading, setIsEditProfileLoading] = useState(false)

  // Delete Account States
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteAccountError, setDeleteAccountError] = useState('')
  const [deleteAccountSuccess, setDeleteAccountSuccess] = useState('')
  const [isDeleteAccountLoading, setIsDeleteAccountLoading] = useState(false)

  // Referencias para evitar condiciones de carrera en la sincronización del carrito
  const loadingCartFromDb = useRef(false)
  const lastLoadedUid = useRef(null)
  const isRegistering = useRef(false)

  const [animacion, setAnimacion] = useState('') // '', 'salir-izquierda', 'salir-derecha', etc.
  const [indexImagenActual, setIndexImagenActual] = useState(0)
  const [mostrarIndicador, setMostrarIndicador] = useState(false)
  const [mostrarControlesZoom, setMostrarControlesZoom] = useState(true)
  const [expandedImage, setExpandedImage] = useState(null)

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
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user && !user.emailVerified) {
        if (!isRegistering.current) {
          await signOut(auth)
          setCurrentUser(null)
          setUserData(null)
          setCarrito([])
          lastLoadedUid.current = null
          loadingCartFromDb.current = false
          return
        }
      }

      setCurrentUser(user)
      if (user) {
        if (lastLoadedUid.current !== user.uid) {
          loadingCartFromDb.current = true
          lastLoadedUid.current = user.uid
        }
        
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', user.uid))
          let dbCart = []
          if (userDoc.exists()) {
            const data = userDoc.data()
            setUserData(data)
            
            // Si el correo está verificado en Auth pero no en Firestore, lo actualizamos
            if (data.emailVerified !== true) {
              await setDoc(doc(db, 'usuarios', user.uid), { emailVerified: true }, { merge: true })
              data.emailVerified = true
              setUserData({ ...data })
            }
            
            // Pre-llenar checkout
            setClienteNombre(user.displayName || '')
            setClienteWhatsapp(data.whatsapp || '')
            dbCart = data.carrito || []
          } else {
            setClienteNombre(user.displayName || '')
          }
          
          setCarrito(prev => {
            const merged = mergeCarts(prev, dbCart)
            localStorage.setItem('carritoLeis', JSON.stringify(merged))
            loadingCartFromDb.current = false
            return merged
          })
        } catch (e) {
          console.error("Error cargando perfil", e)
          loadingCartFromDb.current = false
        }
      } else {
        setUserData(null)
        setClienteNombre('')
        setClienteWhatsapp('')
        setCarrito([])
        lastLoadedUid.current = null
        loadingCartFromDb.current = false
      }
    })
    return unsub
  }, [])

  useEffect(() => {
    // Escuchar productos en tiempo real
    const unsub = onSnapshot(collection(db, 'productos'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      // Ordenar alfabéticamente
      data.sort((a, b) => a.nombre.localeCompare(b.nombre))
      setProductos(data)
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

  const handleAuthSubmit = async (e) => {
    e.preventDefault()
    setAuthError('')
    setAuthSuccess('')
    setIsAuthLoading(true)

    try {
      if (authTab === 'login') {
        const userCred = await signInWithEmailAndPassword(auth, authForm.email, authForm.password)
        if (!userCred.user.emailVerified) {
          const now = Date.now()
          const lastSent = Number(localStorage.getItem('lastVerificationSent_') || '0')
          if (now - lastSent < 60000) {
            await signOut(auth)
            throw new Error("unverified-email-cooldown")
          } else {
            await sendEmailVerification(userCred.user)
            localStorage.setItem('lastVerificationSent_', String(now))
            await signOut(auth)
            throw new Error("unverified-email-sent")
          }
        }
        setShowAuthModal(false)
      } else {
        if (!authForm.nombre.trim()) throw new Error("El nombre es obligatorio")
        if (!authForm.whatsapp.trim()) throw new Error("El número de WhatsApp es obligatorio")
        
        // Verificar que el número de WhatsApp sea único (con depuración perezosa de fantasmas expirados > 30 min)
        const normalizedWhatsapp = authForm.whatsapp.trim()
        const q = query(collection(db, 'usuarios'), where('whatsapp', '==', normalizedWhatsapp))
        const querySnapshot = await getDocs(q)
        
        let whatsappBloqueado = false
        if (!querySnapshot.empty) {
          for (const docSnap of querySnapshot.docs) {
            const data = docSnap.data()
            const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0
            const ahora = Date.now()
            
            // Si el usuario registrado anterior no verificó su correo y pasaron más de 30 minutos (1800000 ms), lo borramos
            if (data.emailVerified === false && (ahora - createdAt > 1800000)) {
              await deleteDoc(doc(db, 'usuarios', docSnap.id))
            } else {
              whatsappBloqueado = true
            }
          }
        }
        
        if (whatsappBloqueado) {
          throw new Error("Este número de WhatsApp ya está registrado con otra cuenta activa.")
        }
        
        isRegistering.current = true
        
        try {
          const userCred = await createUserWithEmailAndPassword(auth, authForm.email, authForm.password)
          
          // Enviar correo de verificación
          await sendEmailVerification(userCred.user)
          localStorage.setItem('lastVerificationSent_', String(Date.now()))
          
          // Actualizar el displayName
          await updateProfile(userCred.user, { displayName: authForm.nombre })
          
          // Guardar whatsapp en firestore con emailVerified: false
          await setDoc(doc(db, 'usuarios', userCred.user.uid), {
            nombre: authForm.nombre,
            email: authForm.email,
            whatsapp: authForm.whatsapp,
            emailVerified: false,
            createdAt: new Date().toISOString()
          })
          
          await signOut(auth)
          
          setAuthSuccess("¡Registro exitoso! Te hemos enviado un enlace de verificación. Por favor, verifica tu cuenta antes de iniciar sesión.")
          setAuthForm({ nombre: '', email: '', password: '', whatsapp: '' })
          setAuthTab('login')
        } finally {
          isRegistering.current = false
        }
      }
    } catch (error) {
      console.error(error)
      if (error.message === "unverified-email-cooldown") {
        setAuthError("Tu correo electrónico no está verificado. Por favor, revisa tu bandeja de entrada (ya enviamos un enlace hace poco; espera un minuto antes de reintentar).")
      } else if (error.message === "unverified-email-sent") {
        setAuthError("Tu correo electrónico no está verificado. Hemos enviado un nuevo enlace de verificación a tu bandeja de entrada.")
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError('Este correo ya está registrado. Si aún no lo has verificado, intenta iniciar sesión para recibir un nuevo enlace de activación.')
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        setAuthError('Credenciales incorrectas.')
      } else if (error.code === 'auth/user-not-found') {
        setAuthError('No hay cuenta con este correo.')
      } else if (error.code === 'auth/weak-password') {
        setAuthError('La contraseña debe tener al menos 6 caracteres.')
      } else {
        setAuthError(error.message || 'Error al autenticar')
      }
    } finally {
      setIsAuthLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
      setShowProfileMenu(false)
    } catch (e) {
      console.error(e)
    }
  }

  const handleUpdateProfile = async (e) => {
    e.preventDefault()
    setEditProfileError('')
    setEditProfileSuccess('')
    setIsEditProfileLoading(true)

    try {
      if (!editProfileForm.nombre.trim()) throw new Error("El nombre es obligatorio")
      if (!editProfileForm.whatsapp.trim()) throw new Error("El número de WhatsApp es obligatorio")

      const newNombre = editProfileForm.nombre.trim()
      const newWhatsapp = editProfileForm.whatsapp.trim()

      if (newWhatsapp !== (userData?.whatsapp || '')) {
        const q = query(collection(db, 'usuarios'), where('whatsapp', '==', newWhatsapp))
        const querySnapshot = await getDocs(q)
        
        let whatsappBloqueado = false
        if (!querySnapshot.empty) {
          for (const docSnap of querySnapshot.docs) {
            if (docSnap.id === currentUser.uid) continue;
            
            const data = docSnap.data()
            const createdAt = data.createdAt ? new Date(data.createdAt).getTime() : 0
            const ahora = Date.now()
            
            // Si el otro usuario no está verificado y pasaron más de 30 minutos, lo borramos de Firestore
            if (data.emailVerified === false && (ahora - createdAt > 1800000)) {
              await deleteDoc(doc(db, 'usuarios', docSnap.id))
            } else {
              whatsappBloqueado = true
            }
          }
        }
        
        if (whatsappBloqueado) {
          throw new Error("Este número de WhatsApp ya está registrado con otra cuenta activa.")
        }
      }

      // Actualizar Perfil en Auth
      await updateProfile(currentUser, { displayName: newNombre })
      
      // Actualizar en Firestore
      await setDoc(doc(db, 'usuarios', currentUser.uid), {
        nombre: newNombre,
        whatsapp: newWhatsapp
      }, { merge: true })

      // Sincronizar estados locales
      setUserData(prev => ({ ...prev, nombre: newNombre, whatsapp: newWhatsapp }))
      setClienteNombre(newNombre)
      setClienteWhatsapp(newWhatsapp)

      setEditProfileSuccess("¡Perfil actualizado con éxito!")
      setTimeout(() => {
        setShowEditProfileModal(false)
        setEditProfileSuccess('')
      }, 1500)
    } catch (err) {
      console.error(err)
      setEditProfileError(err.message || 'Error al actualizar el perfil')
    } finally {
      setIsEditProfileLoading(false)
    }
  }

  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setDeleteAccountError('')
    setDeleteAccountSuccess('')
    setIsDeleteAccountLoading(true)

    try {
      if (!deletePassword) throw new Error("La contraseña es obligatoria")

      // 1. Re-autenticar al usuario para evitar errores de sesión expirada (requires-recent-login)
      const credential = EmailAuthProvider.credential(currentUser.email, deletePassword)
      await reauthenticateWithCredential(currentUser, credential)

      const uid = currentUser.uid

      // 2. Borrar documento de Firestore
      await deleteDoc(doc(db, 'usuarios', uid))

      // 3. Borrar de Firebase Auth
      await deleteUser(currentUser)

      // 4. Limpiar sesión y estados locales
      setCarrito([])
      localStorage.removeItem('carritoLeis')
      setCurrentUser(null)
      setUserData(null)
      setClienteNombre('')
      setClienteWhatsapp('')
      lastLoadedUid.current = null
      loadingCartFromDb.current = false
      setDeletePassword('')

      setDeleteAccountSuccess("¡Tu cuenta ha sido eliminada permanentemente!")
      setTimeout(() => {
        setShowDeleteAccountModal(false)
        setDeleteAccountSuccess('')
      }, 2000)
    } catch (err) {
      console.error(err)
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setDeleteAccountError('La contraseña introducida es incorrecta.')
      } else {
        setDeleteAccountError(err.message || 'Error al eliminar la cuenta')
      }
    } finally {
      setIsDeleteAccountLoading(false)
    }
  }

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
  }

  // --- RENDER ---

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-surface text-on-surface">Cargando catálogo...</div>
  }

  return (
    <div className={`flex h-[100dvh] ${isDark ? 'bg-[#0c0c0c]' : 'bg-surface'} relative overflow-hidden transition-colors duration-500`}>
      
      {/* ── BACKGROUND WATERMARK ── */}
      <div className={`fixed inset-0 pointer-events-none z-0 flex items-center justify-center transition-opacity duration-500 ${isDark ? 'opacity-10' : 'opacity-15'}`}>
        <div className="w-[85%] md:w-[40%] max-w-lg rounded-[3.5rem] crystal-effect">
          <img 
            src={isDark ? "/logo-dark.png" : "/logo.jpeg"} 
            alt="Watermark" 
            className={`w-full h-full object-contain rounded-[3.5rem] shadow-sm transition-all duration-500 ${isDark ? 'mix-blend-overlay' : 'mix-blend-multiply'}`}
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
      <aside className={`fixed md:relative top-0 left-0 h-full w-[280px] border-r z-50 flex flex-col transition-all duration-300 ease-in-out shadow-2xl md:shadow-none ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'} ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* CABECERA SIDEBAR */}
        <div className={`p-6 border-b flex justify-between items-center shrink-0 ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/20 bg-surface-container-low'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg shadow-sm flex items-center justify-center p-1 shrink-0 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
              <img src={isDark ? "/logo-dark.png" : "/logo.jpeg"} alt="Logo" className="w-full h-full object-contain rounded" />
            </div>
            <div>
              <h1 className={`font-headline text-lg font-bold italic leading-tight ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>Catálogo</h1>
              <p className={`text-[9px] uppercase tracking-widest font-bold ${isDark ? 'text-[#e2bd6c]/60' : 'text-outline'}`}>Filtros</p>
            </div>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className={`md:hidden p-2 rounded-full transition-colors ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-outline hover:bg-surface-variant'}`}>
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* CONTENIDO SIDEBAR (FILTROS) */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
          
          {/* BÚSQUEDA */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'}`}>
              <span className="material-symbols-outlined text-sm">search</span>
              Búsqueda
            </h3>
            <div className="relative">
              <input 
                type="text" 
                placeholder="Nombre, SKU..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={`w-full border rounded-xl pl-4 pr-10 py-3 text-sm font-medium focus:outline-none focus:ring-4 transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50 focus:ring-[#e2bd6c]/5' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50 focus:ring-primary/5'}`}
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
            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'}`}>
              <span className="material-symbols-outlined text-sm">payments</span>
              Rango de Precio
            </h3>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-gray-400' : 'text-outline'}`}>$</span>
                <input 
                  type="number" 
                  placeholder="Min"
                  value={precioMin}
                  onChange={e => setPrecioMin(e.target.value)}
                  className={`w-full border rounded-xl pl-7 pr-2 py-2.5 text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'}`}
                />
              </div>
              <span className={isDark ? 'text-white/20' : 'text-outline-variant'}>-</span>
              <div className="relative flex-1">
                <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs ${isDark ? 'text-gray-400' : 'text-outline'}`}>$</span>
                <input 
                  type="number" 
                  placeholder="Max"
                  value={precioMax}
                  onChange={e => setPrecioMax(e.target.value)}
                  className={`w-full border rounded-xl pl-7 pr-2 py-2.5 text-sm focus:outline-none transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'}`}
                />
              </div>
            </div>
          </div>

          {/* DISPONIBILIDAD */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'}`}>
              <span className="material-symbols-outlined text-sm">inventory_2</span>
              Disponibilidad
            </h3>
            <label className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${isDark ? 'border-white/10 bg-white/5 hover:bg-white/10' : 'border-outline-variant/30 bg-surface-container-low hover:bg-surface-variant/50'}`}>
              <span className={`text-sm font-bold ${isDark ? 'text-white' : 'text-on-surface'}`}>Solo disponible</span>
              <div className="relative flex items-center">
                <input 
                  type="checkbox" 
                  className="sr-only peer"
                  checked={soloDisponibles}
                  onChange={e => setSoloDisponibles(e.target.checked)}
                />
                <div className={`w-10 h-6 bg-outline-variant/50 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all ${isDark ? 'peer-checked:bg-[#e2bd6c]' : 'peer-checked:bg-primary'}`}></div>
              </div>
            </label>
          </div>

          {/* CATEGORÍAS */}
          <div className="space-y-3">
            <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'}`}>
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
                      ? (isDark ? 'bg-[#e2bd6c] text-black shadow-md scale-[1.02]' : 'bg-secondary text-white shadow-md scale-[1.02]')
                      : (isDark ? 'text-gray-300 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/50')
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
        <div className={`p-6 border-t shrink-0 ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/20 bg-surface-container-lowest'}`}>
          <button 
            onClick={() => {
              setFiltroCategoria('TODAS')
              setSearchTerm('')
              setPrecioMin('')
              setPrecioMax('')
              setSoloDisponibles(false)
            }}
            className={`w-full py-3 rounded-xl border font-bold text-xs uppercase tracking-widest transition-colors ${isDark ? 'border-white/10 text-white hover:bg-white/5' : 'border-outline-variant/30 text-on-surface hover:bg-surface-variant'}`}
          >
            Limpiar Filtros
          </button>
        </div>
      </aside>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* HEADER PRINCIPAL COMPACTO */}
        <header className={`sticky top-0 z-30 backdrop-blur-md px-4 py-4 md:px-8 md:py-6 border-b flex items-center shrink-0 transition-colors duration-500 ${isDark ? 'bg-[#0c0c0c]/80 border-white/5' : 'bg-white/80 border-outline-variant/20'}`}>
          <div className="w-16 shrink-0">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className={`md:hidden w-10 h-10 flex items-center justify-center rounded-xl transition-colors ${isDark ? 'bg-white/5 text-white' : 'bg-surface-variant text-on-surface'}`}
            >
              <span className="material-symbols-outlined">menu_open</span>
            </button>
          </div>

          <div className="flex-1 flex justify-center">
            <h2 className={`font-headline text-lg md:text-2xl font-bold italic leading-tight text-center ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
              {filtroCategoria === 'TODAS' ? 'Todos los Productos' : filtroCategoria}
              <span className={`ml-2 text-sm font-sans font-normal not-italic ${isDark ? 'text-gray-400' : 'text-outline'}`}>({productosFiltrados.length})</span>
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Botón de Apariencia (Modo Oscuro/Claro) */}
            <button 
              onClick={() => setIsDark(!isDark)}
              className={`p-3 rounded-2xl transition-colors shrink-0 ${isDark ? 'bg-white/5 text-[#e2bd6c] hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'}`}
              title={isDark ? "Modo Claro" : "Modo Oscuro"}
            >
              <span className="material-symbols-outlined">
                {isDark ? 'light_mode' : 'dark_mode'}
              </span>
            </button>

            {currentUser ? (
              <div className="relative">
                <button 
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] hover:bg-[#e2bd6c]/20' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}
                >
                  <span className="font-bold text-sm">{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</span>
                </button>
                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-[110]" onClick={() => setShowProfileMenu(false)} />
                    <div className={`absolute right-0 top-full mt-2 w-48 border rounded-2xl shadow-xl z-[120] py-2 animate-in fade-in slide-in-from-top-2 ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-surface-container-lowest border-outline-variant/20'}`}>
                      <div className={`px-4 py-2 border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                        <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-on-surface'}`}>{currentUser.displayName}</p>
                        <p className={`text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>{currentUser.email}</p>
                      </div>
                      <button 
                        onClick={() => {
                          setEditProfileForm({
                            nombre: currentUser.displayName || '',
                            whatsapp: userData?.whatsapp || ''
                          })
                          setEditProfileError('')
                          setEditProfileSuccess('')
                          setShowEditProfileModal(true)
                          setShowProfileMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 border-b ${isDark ? 'text-white border-white/5 hover:bg-white/5' : 'text-on-surface border-outline-variant/10 hover:bg-surface-variant/20'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Editar Perfil
                      </button>
                      <button 
                        onClick={() => {
                          setDeletePassword('')
                          setDeleteAccountError('')
                          setDeleteAccountSuccess('')
                          setShowDeleteAccountModal(true)
                          setShowProfileMenu(false)
                        }}
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 border-b ${isDark ? 'text-error hover:bg-error/10' : 'text-error hover-bg-error/10'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">delete_forever</span>
                        Eliminar Cuenta
                      </button>
                      <button 
                        onClick={handleLogout}
                        className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/20'}`}
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        Cerrar Sesión
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button 
                onClick={() => setShowAuthModal(true)}
                className={`p-3 rounded-2xl transition-colors shrink-0 ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'}`}
                title="Iniciar Sesión / Crear Cuenta"
              >
                <span className="material-symbols-outlined">person</span>
              </button>
            )}

            <button 
              onClick={() => setIsCartOpen(true)}
              className={`relative p-3 rounded-2xl transition-colors shrink-0 ml-1 ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] hover:bg-[#e2bd6c]/20' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}
            >
              <span className="material-symbols-outlined">shopping_cart</span>
              {totalItems > 0 && (
                <span className="absolute -top-2 -right-2 bg-error text-on-error text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md animate-in zoom-in">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
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
              const tieneStock = tieneVariantes 
                ? p.variantes.some(v => Number(v.stock) > 0)
                : Number(p.stock) > 0;

              return (
                <div key={p.id} className={`rounded-[24px] overflow-hidden border shadow-sm flex flex-col group hover:shadow-md transition-all ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-surface-container-low border-outline-variant/20'} ${!tieneStock ? 'grayscale opacity-70' : ''}`}>
                  {/* Imagen */}
                  <div 
                    className={`aspect-square relative overflow-hidden flex items-center justify-center cursor-pointer ${isDark ? 'bg-white/5' : 'bg-white/60'}`}
                    onClick={() => setProductoParaVer(p)}
                  >
                    {p.fotoUrl ? (
                       <img src={p.fotoUrl} alt={p.nombre} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
                    ) : (
                       <span className={`material-symbols-outlined text-4xl ${isDark ? 'text-white/20' : 'text-outline/30'}`}>image</span>
                    )}
                    {p.marca && (
                      <div className={`absolute top-2 right-2 backdrop-blur-sm px-2 py-1 rounded-md ${isDark ? 'bg-[#151515]/90' : 'bg-white/90'}`}>
                        <span className={`text-[8px] font-bold uppercase tracking-widest ${isDark ? 'text-[#e2bd6c]' : 'text-on-surface'}`}>{p.marca}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="p-4 flex flex-col flex-1">
                    <h3 
                      className={`font-headline font-bold text-sm md:text-xl leading-tight line-clamp-2 mb-1 cursor-pointer transition-colors ${isDark ? 'text-white hover:text-[#e2bd6c]' : 'text-on-surface hover:text-primary'}`}
                      onClick={() => setProductoParaVer(p)}
                    >
                      {p.nombre}
                    </h3>
                    <p className={`text-[10px] md:text-xs uppercase tracking-wider mb-3 ${isDark ? 'text-[#e2bd6c]/60' : 'text-outline'}`}>{(p.coleccion || '').toUpperCase()}</p>
                    
                    <div className="mt-auto flex items-end justify-between gap-2">
                      <p className={`font-bold text-base md:text-lg ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>${(p.precio || 0).toLocaleString('es-CL')}</p>
                      
                      {/* LÓGICA DE BOTONES INLINE */}
                      {!tieneStock ? (
                        <span className={`px-3 h-10 rounded-xl flex items-center justify-center text-[10px] font-bold uppercase tracking-widest shrink-0 ${isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-variant text-on-surface-variant'}`}>
                          Agotado
                        </span>
                      ) : tieneVariantes ? (
                        <button 
                          onClick={() => abrirModalAñadir(p)}
                          className={`px-3 h-10 rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all text-[10px] font-bold uppercase tracking-widest shrink-0 ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary-fixed-dim'}`}
                        >
                          Opciones {totalEnCarritoVariants > 0 && <span className={`ml-1 px-1.5 py-0.5 rounded-md ${isDark ? 'bg-black/20 text-black/80' : 'bg-white/20 text-on-primary/80'}`}>{totalEnCarritoVariants}</span>}
                        </button>
                      ) : cartItem ? (
                        <div className={`flex items-center gap-1 rounded-xl p-1 h-10 shrink-0 border ${isDark ? 'bg-white/5 border-white/10' : 'bg-surface-container-highest border-outline-variant/20'}`}>
                          <button onClick={() => {
                            if(cartItem.cantidad === 1) eliminarDelCarrito(cartItem.idCart);
                            else actualizarCantidad(cartItem.idCart, -1);
                          }} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-on-surface'}`}>
                            <span className="material-symbols-outlined text-[16px]">remove</span>
                          </button>
                          <span className={`w-5 text-center font-bold text-xs ${isDark ? 'text-white' : 'text-on-surface'}`}>{cartItem.cantidad}</span>
                          <button onClick={() => actualizarCantidad(cartItem.idCart, 1)} className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-on-surface'}`}>
                            <span className="material-symbols-outlined text-[16px]">add</span>
                          </button>
                        </div>
                      ) : (
                        <button 
                          onClick={() => añadirAlCarrito(p, null)}
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md hover:scale-105 active:scale-95 transition-all shrink-0 ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary-fixed-dim'}`}
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
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'}`}
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
                        ? (isDark ? 'bg-[#e2bd6c] text-black shadow-md' : 'bg-secondary text-white shadow-md')
                        : (isDark ? 'border border-white/10 text-gray-300 hover:bg-white/5' : 'border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant')
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
                  className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors ${isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'}`}
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
          <div className={`w-full max-w-md h-full relative z-10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'}`}>
            <div className={`p-6 border-b flex justify-between items-center bg-surface-container-low shrink-0 ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/20 bg-surface-container-low'}`}>
              <h2 className={`font-headline text-xl font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                <span className={`material-symbols-outlined ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>shopping_cart</span>
                Tu Pedido
              </h2>
              <button onClick={() => setIsCartOpen(false)} className={`p-2 rounded-full transition-colors ${isDark ? 'text-gray-400 hover:bg-white/5' : 'text-outline hover:bg-surface-variant'}`}>
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {carrito.length === 0 ? (
                <div className={`text-center py-10 opacity-50 flex flex-col items-center ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                  <span className="material-symbols-outlined text-5xl mb-2">production_quantity_limits</span>
                  <p>Aún no hay productos en el carrito</p>
                </div>
              ) : (
                carrito.map(item => (
                  <div key={item.idCart} className={`flex items-center gap-4 p-4 rounded-[20px] border ${isDark ? 'bg-white/5 border-white/10' : 'bg-surface-container-low border-outline-variant/10'}`}>
                    <div className="flex-1">
                      <p className={`font-bold text-sm leading-tight ${isDark ? 'text-white' : 'text-on-surface'}`}>{item.nombre}</p>
                      <p className={`font-bold text-xs mt-1 ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>${item.precio.toLocaleString('es-CL')}</p>
                    </div>
                    
                    <div className={`flex items-center gap-2 rounded-xl p-1 ${isDark ? 'bg-white/5' : 'bg-surface-container-highest'}`}>
                      <button onClick={() => {
                        if(item.cantidad === 1) eliminarDelCarrito(item.idCart);
                        else actualizarCantidad(item.idCart, -1);
                      }} className={`w-7 h-7 flex items-center justify-center rounded-lg ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-on-surface'}`}>
                        <span className="material-symbols-outlined text-[16px]">remove</span>
                      </button>
                      <span className={`w-6 text-center font-bold text-xs ${isDark ? 'text-white' : 'text-on-surface'}`}>{item.cantidad}</span>
                      <button onClick={() => actualizarCantidad(item.idCart, 1)} className={`w-7 h-7 flex items-center justify-center rounded-lg ${isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white text-on-surface'}`}>
                        <span className="material-symbols-outlined text-[16px]">add</span>
                      </button>
                    </div>

                    <button onClick={() => eliminarDelCarrito(item.idCart)} className={`p-2 rounded-xl transition-colors shrink-0 ${isDark ? 'text-red-400/50 hover:text-red-400 hover:bg-red-500/10' : 'text-error/50 hover:text-error hover:bg-error/10'}`}>
                      <span className="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                  </div>
                ))
              )}
            </div>

            {carrito.length > 0 && (
              <div className={`p-6 border-t space-y-4 ${isDark ? 'bg-[#151515] border-white/5 shadow-none' : 'bg-surface-container border-outline-variant/20 shadow-[0_-10px_20px_rgba(0,0,0,0.05)]'}`}>
                <div className="flex justify-between items-center">
                  <span className={`text-sm font-bold uppercase tracking-widest ${isDark ? 'text-gray-400' : 'text-outline'}`}>Total a Pagar</span>
                  <span className={`font-headline text-2xl font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>${totalCarrito.toLocaleString('es-CL')}</span>
                </div>
                <button 
                  onClick={prepararCheckout}
                  className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2 ${isDark ? 'bg-[#e2bd6c] text-black' : 'bg-primary text-on-primary'}`}
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
          <div className={`w-full max-w-sm rounded-[32px] sm:rounded-[32px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh] border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            <div className={`p-6 border-b shrink-0 flex justify-between items-center ${isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/10 bg-surface-container-low'}`}>
              <h3 className={`font-headline font-bold text-lg pr-4 ${isDark ? 'text-white' : 'text-on-surface'}`}>Selecciona una opción</h3>
              <button onClick={() => setProductParaAñadir(null)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-variant text-outline'}`}>
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar">
              <div className={`flex items-center gap-4 mb-4 pb-4 border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                {productParaAñadir.fotoUrl && (
                  <img src={productParaAñadir.fotoUrl} alt={productParaAñadir.nombre} className={`w-16 h-16 rounded-xl object-cover border ${isDark ? 'bg-white/5 border-white/5' : 'bg-surface-variant border-outline-variant/20'}`} />
                )}
                <div>
                  <p className={`font-bold text-sm leading-tight mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>{productParaAñadir.nombre}</p>
                  <p className={`font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>${(productParaAñadir.precio || 0).toLocaleString('es-CL')}</p>
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
                    className={`w-full flex justify-between items-center p-4 rounded-[20px] border-2 transition-all ${varianteSeleccionada === v ? (isDark ? 'border-[#e2bd6c] bg-[#e2bd6c]/5' : 'border-primary bg-primary/5') : (isDark ? 'border-white/10 bg-[#151515] hover:border-[#e2bd6c]/30' : 'border-outline-variant/10 bg-surface hover:border-primary/30')}`}
                  >
                    <span className={`font-bold text-sm uppercase flex items-center gap-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                      {v.nombre}
                      {inCart && <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/20 text-primary'}`}>{inCart.cantidad} en pedido</span>}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? 'text-[#e2bd6c] bg-[#e2bd6c]/10' : 'text-secondary bg-secondary/10'}`}>{v.stock} disp.</span>
                  </button>
                )
              })}
              
              {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).length === 0 && (
                <p className={`text-center text-sm font-bold py-4 ${isDark ? 'text-red-400' : 'text-error'}`}>No hay stock disponible en ninguna variante.</p>
              )}
            </div>
            <div className={`p-6 border-t shrink-0 ${isDark ? 'bg-[#151515] border-white/5' : 'bg-surface-container border-outline-variant/10'}`}>
              <button 
                disabled={!varianteSeleccionada}
                onClick={() => añadirAlCarrito(productParaAñadir, varianteSeleccionada)}
                className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${varianteSeleccionada ? (isDark ? 'bg-[#e2bd6c] text-black shadow-lg hover:scale-[1.02]' : 'bg-primary text-on-primary shadow-lg hover:scale-[1.02]') : (isDark ? 'bg-white/5 text-gray-500 opacity-50 cursor-not-allowed' : 'bg-surface-variant text-outline opacity-50 cursor-not-allowed')}`}
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
            className={`w-full max-w-lg md:max-w-7xl rounded-[32px] md:rounded-[48px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col md:flex-row h-full max-h-[92vh] md:h-[90vh] overscroll-contain border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* BOTÓN CERRAR FLOTANTE PARA MÓVIL / ESCRITORIO */}
            <button 
              onClick={() => setProductoParaVer(null)} 
              className={`absolute top-4 right-4 z-[70] w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-lg ${isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-on-surface'}`}
            >
              <span className="material-symbols-outlined">close</span>
            </button>
            
            <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden custom-scrollbar">
              {/* COLUMNA IZQUIERDA: GALERÍA */}
              <div className={`w-full md:w-[60%] flex flex-col border-b md:border-b-0 md:border-r shrink-0 ${isDark ? 'bg-[#0c0c0c] border-white/5' : 'bg-white border-outline-variant/10'}`}>
                <div className={`flex-1 relative group/gallery overflow-hidden flex items-center justify-center p-6 md:p-12 ${isDark ? 'bg-[#0c0c0c]' : 'bg-[#fcfcfc]'}`}>
                  <div className={`absolute inset-4 md:inset-8 rounded-[48px] overflow-hidden z-0 backdrop-blur-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] ${isDark ? 'bg-black/40' : 'bg-white/50'}`}>
                    {/* FONDO DIFUMINADO DINÁMICO */}
                    {fotosProducto[indexImagenActual] && (
                      <div className="absolute inset-0">
                        <img 
                          src={fotosProducto[indexImagenActual]} 
                          className="w-full h-full object-cover blur-3xl scale-150 opacity-40 transition-all duration-1000 ease-in-out" 
                          alt="Dynamic background"
                        />
                        <div className={`absolute inset-0 ${isDark ? 'bg-black/20' : 'bg-white/10'}`} />
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
                        className={`max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-8 ${isDark ? 'border-[#1e1e1e]' : 'border-white'}`} 
                      />
                      <div className={`absolute inset-0 rounded-[40px] transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`} />
                    </div>
                  ) : (
                    <div className="relative z-10">
                      <span className={`material-symbols-outlined text-7xl ${isDark ? 'text-white/20' : 'text-outline/30'}`}>image</span>
                    </div>
                  )}

                  {/* FLECHAS INTERNAS */}
                  {fotosProducto.length > 1 && (
                    <>
                      <button 
                        onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
                        className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full transition-all opacity-0 group-hover/gallery:opacity-100 ${isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant hover:scale-110 shadow-xl'}`}
                      >
                        <span className="material-symbols-outlined text-2xl">chevron_left</span>
                      </button>
                      <button 
                        onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
                        className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full transition-all opacity-0 group-hover/gallery:opacity-100 ${isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant hover:scale-110 shadow-xl'}`}
                      >
                        <span className="material-symbols-outlined text-2xl">chevron_right</span>
                      </button>
                    </>
                  )}

                  {/* INDICADOR NUMÉRICO REFINADO (AUTO-OCULTABLE) */}
                  {fotosProducto.length > 1 && mostrarIndicador && (
                    <div className={`absolute bottom-10 right-10 z-20 flex items-center gap-2 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border md:hidden animate-in fade-in zoom-in duration-500 animate-out fade-out zoom-out ${isDark ? 'bg-[#1e1e1e]/90 border-white/5' : 'bg-white/90 border-outline-variant/10'}`}>
                      <span className={`material-symbols-outlined text-sm ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>imagesmode</span>
                      <span className={`text-[11px] font-black tracking-[0.1em] ${isDark ? 'text-white' : 'text-on-surface'}`}>
                        {indexImagenActual + 1} <span className="text-outline/40 mx-0.5">/</span> {fotosProducto.length}
                      </span>
                    </div>
                  )}
                </div>

                {/* MINIATURAS EN ESCRITORIO */}
                {fotosProducto.length > 1 && (
                  <div className={`hidden md:flex gap-2 p-4 justify-center border-t overflow-x-auto ${isDark ? 'border-white/5' : 'border-outline-variant/5'}`}>
                    {fotosProducto.map((f, i) => (
                      <button 
                        key={i}
                        onClick={() => setIndexImagenActual(i)}
                        className={`w-20 h-20 rounded-2xl border-2 overflow-hidden transition-all shrink-0 p-1 ${isDark ? 'bg-[#1e1e1e]' : 'bg-white'} ${indexImagenActual === i ? (isDark ? 'border-[#e2bd6c] shadow-lg scale-110' : 'border-primary shadow-lg scale-110') : (isDark ? 'border-white/10 opacity-60 hover:opacity-100 hover:border-[#e2bd6c]/30' : 'border-outline-variant/10 opacity-60 hover:opacity-100 hover:border-primary/30')}`}
                      >
                        <img src={f} className="w-full h-full object-cover rounded-xl" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* COLUMNA DERECHA: INFO */}
              <div className={`w-full md:w-[40%] flex flex-col md:overflow-y-auto custom-scrollbar ${isDark ? 'bg-[#121212]' : 'bg-surface-container-low'}`}>
                <div className="p-8 md:p-12 flex-1 space-y-10">
                  {/* CABECERA: NOMBRE Y MARCA CENTRALIZADA ABAJO */}
                  <div className="animate-in fade-in slide-in-from-right duration-500 delay-100 text-center">
                    <h2 className={`font-headline font-bold text-3xl md:text-5xl leading-[1.1] mb-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>{productoParaVer.nombre}</h2>
                    <p className={`text-xs md:text-sm font-medium uppercase tracking-[0.2em] opacity-60 mb-6 ${isDark ? 'text-[#e2bd6c]/60' : 'text-outline'}`}>{(productoParaVer.coleccion || 'SIN CATEGORÍA').toUpperCase()}</p>
                    
                    <div className="flex items-center gap-4 justify-center">
                      <div className={`h-[1px] flex-1 bg-gradient-to-r ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                      <p className={`text-xs md:text-sm font-bold uppercase tracking-[0.4em] px-2 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>{productoParaVer.marca || 'GENÉRICO'}</p>
                      <div className={`h-[1px] flex-1 bg-gradient-to-l ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                    </div>
                  </div>


                  {/* DESCRIPCIÓN REFINADA */}
                  <div className="space-y-5 animate-in fade-in slide-in-from-right duration-500 delay-300">
                    <div className="flex items-center gap-3">
                      <span className={`material-symbols-outlined text-xl ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>description</span>
                      <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.3em] ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>Descripción Detallada</p>
                    </div>
                    
                    <div className={`backdrop-blur-sm p-6 md:p-10 rounded-[40px] border shadow-sm ${isDark ? 'bg-white/5 border-white/5' : 'bg-white/50 border-outline-variant/5'}`}>
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
                                    ? (isDark ? 'text-white font-black mb-2 mt-4' : 'text-on-surface font-black mb-2 mt-4') 
                                    : (isDark ? 'text-white/80 font-medium opacity-90' : 'text-on-surface-variant font-medium opacity-90')
                                }`}
                              >
                                {linea}
                              </p>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center py-6 text-center space-y-3">
                          <span className={`material-symbols-outlined text-4xl ${isDark ? 'text-white/20' : 'text-outline/30'}`}>info</span>
                          <p className={`text-sm md:text-lg italic ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                            No hay una descripción detallada disponible para este producto en este momento.
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* STOCK CON DISEÑO DE TARJETA */}
                  <div className="animate-in fade-in slide-in-from-right duration-500 delay-400">
                    <div className={`backdrop-blur-sm p-6 md:p-10 rounded-[40px] border relative overflow-hidden group shadow-[0_10px_40px_-15px_rgba(0,0,0,0.05)] ${isDark ? 'bg-white/0 border-white/5' : 'bg-gradient-to-br from-white to-[#f5f5f5] border-outline-variant/10'}`}>
                      <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.08] transition-opacity duration-700">
                        <span className={`material-symbols-outlined text-8xl transform rotate-12 ${isDark ? 'text-white' : 'text-primary'}`}>inventory_2</span>
                      </div>
                      <div className="flex items-center gap-6 relative z-10">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c]' : 'bg-secondary/5 text-secondary'}`}>
                          <span className="material-symbols-outlined text-4xl">inventory_2</span>
                        </div>
                        <div>
                          <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.3em] mb-2 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Disponibilidad en Bodega</p>
                          <p className={`text-xl md:text-3xl font-black ${isDark ? 'text-white' : 'text-on-surface'}`}>
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
                <div className={`p-6 md:p-8 backdrop-blur-2xl border-t sticky bottom-0 z-20 animate-in fade-in slide-in-from-bottom duration-700 delay-500 ${isDark ? 'bg-[#121212]/90 border-white/5' : 'bg-white/90 border-outline-variant/10'}`}>
                  <div className="flex flex-col md:flex-row items-center gap-6">
                    {/* PRECIO COMPACTO EN EL FOOTER */}
                    <div className="flex flex-col items-center md:items-start shrink-0">
                      <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Precio Internet</p>
                      <div className="flex items-baseline gap-1">
                        <span className={`text-xl font-light ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>$</span>
                        <p className={`font-black text-4xl md:text-5xl tracking-tighter ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                          {(productoParaVer.precio || 0).toLocaleString('es-CL')}
                        </p>
                      </div>
                    </div>

                    <button 
                      onClick={() => {
                        abrirModalAñadir(productoParaVer);
                        setProductoParaVer(null);
                      }}
                      className={`group relative flex-1 w-full py-5 md:py-7 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs md:text-sm shadow-xl overflow-hidden hover:scale-[1.02] active:scale-[0.98] transition-all ${isDark ? 'bg-[#e2bd6c] text-black' : 'bg-primary text-on-primary'}`}
                    >
                      <div className={`absolute inset-0 w-1/2 h-full skew-x-[-25deg] -translate-x-full group-hover:translate-x-[250%] transition-transform duration-1000 ease-in-out ${isDark ? 'bg-black/20' : 'bg-white/20'}`} />
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
          <div className={`w-full max-w-sm rounded-[32px] shadow-2xl relative z-10 p-8 text-center animate-in zoom-in-95 duration-300 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl">chat</span>
            </div>
            <h3 className={`font-headline font-bold text-xl mb-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>Confirmar Pedido</h3>
            
            {currentUser ? (
              <p className={`text-sm mb-6 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Enviaremos tu pedido a nuestro WhatsApp.<br/>
                <span className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>Sesión iniciada como {currentUser.displayName}</span>
              </p>
            ) : (
              <div className="mb-6">
                <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>Ingresa tu nombre para enviar el detalle de tu pedido directamente por WhatsApp.</p>
                <button 
                  onClick={() => {setShowCheckout(false); setShowAuthModal(true);}} 
                  className={`text-xs font-bold hover:underline ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}
                >
                  ¿Tienes cuenta? Inicia sesión aquí
                </button>
              </div>
            )}
            
            <input 
              type="text"
              autoFocus
              value={clienteNombre}
              onChange={(e) => setClienteNombre(e.target.value)}
              placeholder="Tu nombre y apellido..."
              className={`w-full border-2 px-5 py-4 rounded-2xl text-center font-bold outline-none transition-all mb-6 ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-[#e2bd6c]' : 'bg-surface-container-low border-primary/20 focus:border-primary text-primary'}`}
            />

            <div className="flex gap-3">
              <button 
                onClick={() => setShowCheckout(false)} 
                className={`flex-1 py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider transition-colors ${isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}`}
              >
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
      {/* MODAL DE AUTENTICACIÓN */}
      {showAuthModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            {/* Header del Modal */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                {authTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'}
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                {authTab === 'login' ? 'Bienvenido de vuelta' : 'Únete a nosotros'}
              </p>
              <button 
                onClick={() => setShowAuthModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Pestañas */}
            <div className={`flex border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <button
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${authTab === 'login' ? (isDark ? 'text-[#e2bd6c] border-b-2 border-[#e2bd6c]' : 'text-primary border-b-2 border-primary') : (isDark ? 'text-gray-400 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/30')}`}
                onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}
              >
                Ingresar
              </button>
              <button
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${authTab === 'register' ? (isDark ? 'text-[#e2bd6c] border-b-2 border-[#e2bd6c]' : 'text-primary border-b-2 border-primary') : (isDark ? 'text-gray-400 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/30')}`}
                onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess(''); }}
              >
                Registrarse
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4">
              {authTab === 'register' && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Nombre Completo</label>
                  <input 
                    type="text" 
                    value={authForm.nombre}
                    onChange={e => setAuthForm({...authForm, nombre: e.target.value})}
                    required
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              )}
              
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Correo Electrónico</label>
                <input 
                  type="email" 
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  required
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                  placeholder="tu@correo.com"
                />
              </div>

              {authTab === 'register' && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Número de WhatsApp</label>
                  <input 
                    type="tel" 
                    value={authForm.whatsapp}
                    onChange={e => setAuthForm({...authForm, whatsapp: e.target.value})}
                    required
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                    placeholder="+56 9 1234 5678"
                  />
                  <p className={`text-[10px] mt-1 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Se usará para autocompletar tus pedidos.</p>
                </div>
              )}

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Contraseña</label>
                <input 
                  type="password" 
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  required
                  minLength={6}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'}`}
                  placeholder="••••••"
                />
              </div>

              {authError && (
                <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-xs font-bold text-center border border-error/20">
                  {authError}
                </div>
              )}

              {authSuccess && (
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-xs font-bold text-center border border-green-500/20 animate-in fade-in">
                  {authSuccess}
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isAuthLoading}
                  className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                >
                  {isAuthLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    authTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className={`text-xs font-bold uppercase tracking-wider transition-colors ${isDark ? 'text-gray-400 hover:text-[#e2bd6c]' : 'text-outline hover:text-on-surface'}`}
                >
                  Continuar como invitado
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE EDITAR PERFIL */}
      {showEditProfileModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            
            {/* Header */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                Editar Perfil
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Mantén tus datos actualizados
              </p>
              <button 
                onClick={() => setShowEditProfileModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
              {editProfileError && (
                <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{editProfileError}</span>
                </div>
              )}

              {editProfileSuccess && (
                <div className="p-4 bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 text-[#e2bd6c] text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{editProfileSuccess}</span>
                </div>
              )}

              {/* Nombre completo */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
                  Nombre Completo
                </label>
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    person
                  </span>
                  <input 
                    type="text"
                    required
                    placeholder="Tu nombre completo"
                    value={editProfileForm.nombre}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, nombre: e.target.value })}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2bd6c]/50 transition-all border ${isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'}`}
                  />
                </div>
              </div>

              {/* WhatsApp */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
                  Número de WhatsApp
                </label>
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    phone
                  </span>
                  <input 
                    type="tel"
                    required
                    placeholder="Ej: 56912345678"
                    value={editProfileForm.whatsapp}
                    onChange={(e) => setEditProfileForm({ ...editProfileForm, whatsapp: e.target.value })}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2bd6c]/50 transition-all border ${isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'}`}
                  />
                </div>
                <span className={`text-[9px] block ml-1 ${isDark ? 'text-gray-500' : 'text-outline'}`}>
                  Formato internacional sin el símbolo "+" (ej: 56912345678).
                </span>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowEditProfileModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border ${isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isEditProfileLoading}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'}`}
                >
                  {isEditProfileLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Guardar Cambios'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ELIMINAR CUENTA */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'}`}>
            
            {/* Header */}
            <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <h3 className="font-headline text-2xl font-black italic text-error">
                Eliminar Cuenta
              </h3>
              <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Esta acción es irreversible
              </p>
              <button 
                onClick={() => setShowDeleteAccountModal(false)}
                className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'}`}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleDeleteAccount} className="p-6 space-y-4">
              <div className="p-4 bg-error/5 border border-error/20 rounded-2xl flex gap-3 items-start">
                <span className="material-symbols-outlined text-error shrink-0 mt-0.5">warning</span>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-error">Advertencia de Seguridad</p>
                  <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                    Al eliminar tu cuenta, todos tus datos de perfil, historial de carrito y acceso serán borrados de forma permanente.
                  </p>
                </div>
              </div>

              {deleteAccountError && (
                <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span>{deleteAccountError}</span>
                </div>
              )}

              {deleteAccountSuccess && (
                <div className="p-4 bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 text-[#e2bd6c] text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  <span>{deleteAccountSuccess}</span>
                </div>
              )}

              {/* Confirmación con Contraseña */}
              <div className="space-y-1.5">
                <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
                  Contraseña Actual
                </label>
                <div className="relative">
                  <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    lock
                  </span>
                  <input 
                    type="password"
                    required
                    placeholder="Introduce tu contraseña para confirmar"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-error/50 transition-all border ${isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'}`}
                  />
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button"
                  onClick={() => setShowDeleteAccountModal(false)}
                  className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border ${isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'}`}
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isDeleteAccountLoading}
                  className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center bg-error text-on-error hover:bg-error-container/80"
                >
                  {isDeleteAccountLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    'Eliminar permanentemente'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
