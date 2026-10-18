import { useState, useEffect, useMemo, useRef } from 'react'
import { getOptimizedImageUrl } from '../utils/image'

export function useProductGallery({ selectedColorByProduct = {} } = {}) {
  // Modal de detalle del producto
  const [productoParaVer, setProductoParaVer] = useState(null)
  const [varianteDetalle, setVarianteDetalle] = useState(null)

  // Animación de cambio de fotos
  const [animacion, setAnimacion] = useState('') // '', 'hoja-pasar-adelante-salir', etc.
  const [indexImagenActual, setIndexImagenActual] = useState(0)
  const [mostrarIndicador, setMostrarIndicador] = useState(false)
  const [mostrarControlesZoom, setMostrarControlesZoom] = useState(true)
  const [expandedImage, setExpandedImage] = useState(null)
  const [isModalImgLoading, setIsModalImgLoading] = useState(false)
  const [modoAntesDespues, setModoAntesDespues] = useState(false)
  const [indexFotoAntes, setIndexFotoAntes] = useState(0)
  const [indexFotoDespues, setIndexFotoDespues] = useState(1)

  // Swipe táctil para móviles
  const [touchStart, setTouchStart] = useState(null)
  const [touchEnd, setTouchEnd] = useState(null)
  const minSwipeDistance = 50

  // ZOOM y PAN en visor ampliado
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [lastTouch, setLastTouch] = useState({ x: 0, y: 0 })
  const [distanciaInicial, setDistanciaInicial] = useState(0)

  // Fotos reactivas del producto o su variante seleccionada
  const fotosProducto = useMemo(() => {
    if (!productoParaVer) return []
    if (varianteDetalle) {
      const vFotos = Array.isArray(varianteDetalle.fotos) ? varianteDetalle.fotos.filter(Boolean) : (varianteDetalle.fotoUrl ? [varianteDetalle.fotoUrl] : [])
      if (vFotos.length > 0) return vFotos
    }
    return productoParaVer.fotos && productoParaVer.fotos.length > 0
      ? productoParaVer.fotos
      : (productoParaVer.fotoUrl ? [productoParaVer.fotoUrl] : [])
  }, [productoParaVer, varianteDetalle])

  // Navegación de imágenes con transición
  function anteriorImagen() {
    if (fotosProducto.length <= 1 || animacion) return
    setAnimacion('hoja-pasar-atras-salir')
    setTimeout(() => {
      setIsModalImgLoading(true)
      setIndexImagenActual(prev => (prev === 0 ? fotosProducto.length - 1 : prev - 1))
      setAnimacion('hoja-pasar-atras-entrar')
      setTimeout(() => setAnimacion(''), 320)
    }, 280)
  }

  function siguienteImagen() {
    if (fotosProducto.length <= 1 || animacion) return
    setAnimacion('hoja-pasar-adelante-salir')
    setTimeout(() => {
      setIsModalImgLoading(true)
      setIndexImagenActual(prev => (prev === fotosProducto.length - 1 ? 0 : prev + 1))
      setAnimacion('hoja-pasar-adelante-entrar')
      setTimeout(() => setAnimacion(''), 320)
    }, 280)
  }

  function irAImagen(targetIndex) {
    if (targetIndex === indexImagenActual || animacion || targetIndex < 0 || targetIndex >= fotosProducto.length) return
    const esAdelante = targetIndex > indexImagenActual
    setAnimacion(esAdelante ? 'hoja-pasar-adelante-salir' : 'hoja-pasar-atras-salir')
    setTimeout(() => {
      setIsModalImgLoading(true)
      setIndexImagenActual(targetIndex)
      setAnimacion(esAdelante ? 'hoja-pasar-adelante-entrar' : 'hoja-pasar-atras-entrar')
      setTimeout(() => setAnimacion(''), 320)
    }, 280)
  }

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const selectedColorRef = useRef(selectedColorByProduct)
  useEffect(() => {
    selectedColorRef.current = selectedColorByProduct
  }, [selectedColorByProduct])

  // Al abrir o cambiar productoParaVer
  useEffect(() => {
    if (productoParaVer) {
      if (productoParaVer.variantes && productoParaVer.variantes.length > 0) {
        const preselectedName = selectedColorRef.current[productoParaVer.id]
        const initial = productoParaVer.variantes.find(v => v.nombre === preselectedName) || productoParaVer.variantes[0]
        setVarianteDetalle(initial)
      } else {
        setVarianteDetalle(null)
      }
    } else {
      setVarianteDetalle(null)
    }
    setIndexImagenActual(0)
    setAnimacion('')
    setIsModalImgLoading(false)
    setModoAntesDespues(false)
    setIndexFotoAntes(0)
    setIndexFotoDespues(1)
  }, [productoParaVer])

  // Precarga automática en memoria
  useEffect(() => {
    if (fotosProducto && fotosProducto.length > 0) {
      fotosProducto.forEach(url => {
        if (url) {
          const img = new Image()
          img.src = getOptimizedImageUrl(url, 900)
        }
      })
    }
  }, [fotosProducto])

  // Navegación con teclado
  useEffect(() => {
    function handleKeyDown(e) {
      if (!productoParaVer) return
      if (e.key === 'ArrowLeft') anteriorImagen()
      if (e.key === 'ArrowRight') siguienteImagen()
      if (e.key === 'Escape') setProductoParaVer(null)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [productoParaVer, fotosProducto, animacion])

  // Reset zoom cuando cambia la imagen o se cierra el modal ampliado
  useEffect(() => {
    if (!expandedImage) resetZoom()
  }, [expandedImage, indexImagenActual])

  // Indicador de foto
  useEffect(() => {
    if (productoParaVer) {
      setMostrarIndicador(true)
      const t = setTimeout(() => setMostrarIndicador(false), 3000)
      return () => clearTimeout(t)
    }
  }, [indexImagenActual, productoParaVer])

  // Controles de zoom
  useEffect(() => {
    if (expandedImage) {
      setMostrarControlesZoom(true)
      const t = setTimeout(() => setMostrarControlesZoom(false), 2000)
      return () => clearTimeout(t)
    }
  }, [expandedImage, indexImagenActual])

  // Touch handlers
  const handleTouchStart = (e) => {
    if (e.touches.length === 2 && expandedImage) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      )
      setDistanciaInicial(dist)
      return
    }

    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
    
    if (scale > 1) {
      setLastTouch({ x: e.touches[0].pageX, y: e.touches[0].pageY })
    }
  }

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && expandedImage) {
      const dist = Math.hypot(
        e.touches[0].pageX - e.touches[1].pageX,
        e.touches[0].pageY - e.touches[1].pageY
      )
      if (distanciaInicial > 0) {
        const delta = dist / distanciaInicial
        setScale(prev => Math.min(Math.max(1, prev * delta), 4))
      }
      setDistanciaInicial(dist)
      return
    }

    if (scale > 1 && expandedImage) {
      const deltaX = e.touches[0].pageX - lastTouch.x
      const deltaY = e.touches[0].pageY - lastTouch.y
      setPosition(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }))
      setLastTouch({ x: e.touches[0].pageX, y: e.touches[0].pageY })
      return
    }

    setTouchEnd(e.targetTouches[0].clientX)
  }

  const handleTouchEnd = () => {
    setDistanciaInicial(0)
    if (scale > 1) return

    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) siguienteImagen()
    if (isRightSwipe) anteriorImagen()
  }

  return {
    productoParaVer,
    setProductoParaVer,
    varianteDetalle,
    setVarianteDetalle,
    animacion,
    setAnimacion,
    indexImagenActual,
    setIndexImagenActual,
    mostrarIndicador,
    setMostrarIndicador,
    mostrarControlesZoom,
    setMostrarControlesZoom,
    expandedImage,
    setExpandedImage,
    isModalImgLoading,
    setIsModalImgLoading,
    modoAntesDespues,
    setModoAntesDespues,
    indexFotoAntes,
    setIndexFotoAntes,
    indexFotoDespues,
    setIndexFotoDespues,
    scale,
    setScale,
    position,
    setPosition,
    fotosProducto,
    anteriorImagen,
    siguienteImagen,
    irAImagen,
    resetZoom,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  }
}
