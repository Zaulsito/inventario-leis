import { useState, useEffect, useMemo } from 'react'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../config/firebase'

const DEFAULT_WHATSAPP_NUMBER = "56973000390"

export function useCart({
  currentUser,
  loadingCartFromDb,
  tourStep,
  setTourStep,
  selectedColorByProduct = {},
  productos = [],
  whatsappNumber = DEFAULT_WHATSAPP_NUMBER
}) {
  // Carrito: array de { idCart, productoId, nombre, precio, cantidad, maxStock, fotoUrl, marca }
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

  // Modal checkout final
  const [showCheckout, setShowCheckout] = useState(false)
  const [clienteNombre, setClienteNombre] = useState('')
  const [clienteWhatsapp, setClienteWhatsapp] = useState('')

  // Modal de selección rápida de variantes
  const [productParaAñadir, setProductParaAñadir] = useState(null)
  const [varianteSeleccionada, setVarianteSeleccionada] = useState('')

  // Avanzar del paso 4 al 5 del tutorial cuando el usuario abre el carrito
  useEffect(() => {
    if (tourStep === 4 && isCartOpen && setTourStep) {
      setTourStep(5)
    }
  }, [isCartOpen, tourStep, setTourStep])

  // Resetear el filtro de categorías al cerrar el carrito
  useEffect(() => {
    if (!isCartOpen) {
      setFiltroCartCategory('TODOS')
    }
  }, [isCartOpen])

  // Sincronización dual del carrito: localStorage + Firestore
  useEffect(() => {
    localStorage.setItem('carritoLeis', JSON.stringify(carrito))
    
    if (currentUser && loadingCartFromDb && !loadingCartFromDb.current) {
      const userRef = doc(db, 'usuarios', currentUser.uid)
      setDoc(userRef, { carrito }, { merge: true })
        .catch(err => console.error("Error al sincronizar carrito:", err))
    }
  }, [carrito, currentUser, loadingCartFromDb])

  // Totales calculados
  const totalCarrito = useMemo(() => {
    return carrito.reduce((acc, item) => acc + (item.precio * item.cantidad), 0)
  }, [carrito])

  const totalItems = useMemo(() => {
    return carrito.reduce((acc, item) => acc + item.cantidad, 0)
  }, [carrito])

  // Categorías presentes en los productos del carrito
  const categoriasEnCarrito = useMemo(() => {
    return [
      'TODOS',
      ...new Set(carrito.map(item => {
        const pObj = productos.find(p => p.id === item.productoId)
        return pObj?.coleccion ? pObj.coleccion.trim().toUpperCase() : 'JOYAS'
      }))
    ]
  }, [carrito, productos])

  // Animación de vuelo del producto al carrito
  const animateFlyToCart = (e, fotoUrl) => {
    const button = e.currentTarget
    if (!button) return
    const rect = button.getBoundingClientRect()
    
    const headerCartBtn = document.getElementById('header-cart-btn')
    const mobileCartFab = document.getElementById('mobile-cart-fab')
    
    let target = null
    if (mobileCartFab && window.getComputedStyle(mobileCartFab).display !== 'none') {
      target = mobileCartFab
    } else if (headerCartBtn) {
      target = headerCartBtn
    }
    
    if (!target) return
    
    const targetRect = target.getBoundingClientRect()
    
    const flyer = document.createElement('div')
    flyer.className = 'flyer-dot'
    
    flyer.style.position = 'fixed'
    flyer.style.top = `${rect.top + rect.height / 2 - 16}px`
    flyer.style.left = `${rect.left + rect.width / 2 - 16}px`
    flyer.style.width = '32px'
    flyer.style.height = '32px'
    flyer.style.borderRadius = '50%'
    flyer.style.zIndex = '9999'
    flyer.style.pointerEvents = 'none'
    
    if (fotoUrl) {
      flyer.style.backgroundImage = `url(${fotoUrl})`
      flyer.style.backgroundSize = 'cover'
      flyer.style.backgroundPosition = 'center'
      flyer.style.boxShadow = '0 8px 24px rgba(226, 189, 108, 0.4)'
      flyer.style.border = '2px solid #e2bd6c'
    } else {
      flyer.style.backgroundColor = '#e2bd6c'
      flyer.style.boxShadow = '0 0 12px #e2bd6c, 0 0 4px #e2bd6c'
    }
    
    document.body.appendChild(flyer)
    
    const startX = rect.left + rect.width / 2
    const startY = rect.top + rect.height / 2
    const endX = targetRect.left + targetRect.width / 2
    const endY = targetRect.top + targetRect.height / 2
    
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
    })
    
    setTimeout(() => {
      flyer.remove()
      target.classList.add('animate-cart-pop')
      setTimeout(() => {
        target.classList.remove('animate-cart-pop')
      }, 500)
    }, 750)
  }

  // Abrir modal de variantes o añadir directamente
  function abrirModalAñadir(p) {
    if (p.variantes && p.variantes.length > 0) {
      setProductParaAñadir(p)
      const preselectedName = selectedColorByProduct[p.id]
      const match = p.variantes.find(v => v.nombre === preselectedName && Number(v.stock) > 0)
        || p.variantes.find(v => Number(v.stock) > 0)
        || p.variantes[0]
      setVarianteSeleccionada(match || '')
    } else {
      añadirAlCarrito(p, null)
    }
  }

  // Añadir un item al carrito
  function añadirAlCarrito(producto, variante) {
    if (tourStep === 3 && setTourStep) {
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

  // Modificar cantidad de un item
  function actualizarCantidad(idCart, delta) {
    setCarrito(prev => prev.map(item => {
      if (item.idCart === idCart) {
        const nuevaCantidad = item.cantidad + delta
        if (nuevaCantidad > item.maxStock) {
          alert('Has alcanzado el límite de stock disponible.')
          return item
        }
        if (nuevaCantidad < 1) return item 
        return { ...item, cantidad: nuevaCantidad }
      }
      return item
    }))
  }

  // Eliminar un item del carrito
  function eliminarDelCarrito(idCart) {
    setCarrito(prev => prev.filter(item => item.idCart !== idCart))
  }

  // Preparar checkout
  function prepararCheckout() {
    if (carrito.length === 0) return alert('El carrito está vacío')
    setShowCheckout(true)
    setIsCartOpen(false)
    if (tourStep === 5 && setTourStep) {
      setTourStep(6)
    }
  }

  // Finalizar y enviar pedido por WhatsApp
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

    const url = `https://wa.me/${whatsappNumber}?text=${texto}`
    window.open(url, '_blank')
    
    setCarrito([])
    setShowCheckout(false)
    setClienteNombre('')

    if (tourStep === 6 && setTourStep) {
      setTourStep(7)
      setTimeout(() => {
        setTourStep(0)
      }, 7000)
    }
  }

  return {
    carrito,
    setCarrito,
    isCartOpen,
    setIsCartOpen,
    filtroCartCategory,
    setFiltroCartCategory,
    showCheckout,
    setShowCheckout,
    clienteNombre,
    setClienteNombre,
    clienteWhatsapp,
    setClienteWhatsapp,
    productParaAñadir,
    setProductParaAñadir,
    varianteSeleccionada,
    setVarianteSeleccionada,
    totalCarrito,
    totalItems,
    categoriasEnCarrito,
    animateFlyToCart,
    abrirModalAñadir,
    añadirAlCarrito,
    actualizarCantidad,
    eliminarDelCarrito,
    prepararCheckout,
    enviarPedidoWhatsApp
  }
}
