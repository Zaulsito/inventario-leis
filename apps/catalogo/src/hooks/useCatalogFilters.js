import { useState, useEffect, useRef, useMemo } from 'react'
import { esJoyería } from '../utils/categories'

export const ITEMS_POR_PAGINA_DEFAULT = 20

/**
 * Custom hook para gestionar filtros, ordenamiento, búsqueda,
 * categorías y paginación en el catálogo público.
 */
export function useCatalogFilters({ productos = [], mainScrollRef = null, heroBannerConfig = null } = {}) {
  // Filtros Avanzados
  const [filtroCategoria, setFiltroCategoria] = useState('TODAS')
  const [ordenamiento, setOrdenamiento] = useState('destacados')
  const [isSortOpen, setIsSortOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  // En PC (escritorio), el filtro permanece oculto por defecto
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true)
  const [precioMin, setPrecioMin] = useState('')
  const [precioMax, setPrecioMax] = useState('')
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [soloConImagenes, setSoloConImagenes] = useState(false)
  const [categorySearchTerm, setCategorySearchTerm] = useState('')
  const categoryContainerRef = useRef(null)

  // Paginación adaptable: 30 en PC (>= 768px), 20 en Móvil
  const [itemsPorPagina, setItemsPorPagina] = useState(() => {
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      return 30
    }
    return 20
  })

  useEffect(() => {
    const handleResize = () => {
      setItemsPorPagina(window.innerWidth >= 768 ? 30 : 20)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const [paginaActual, setPaginaActual] = useState(1)
  const [itemsVisiblesTodas, setItemsVisiblesTodas] = useState(itemsPorPagina)

  // Reset de página al cambiar categoría o items por página
  useEffect(() => {
    setPaginaActual(1)
    setItemsVisiblesTodas(itemsPorPagina)
  }, [filtroCategoria, itemsPorPagina])

  // Scroll al inicio al cambiar de página
  useEffect(() => {
    if (mainScrollRef?.current && filtroCategoria !== 'TODAS') {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [paginaActual, filtroCategoria, mainScrollRef])

  // --- DERIVADOS ---
  const productosVisibles = useMemo(() => {
    return productos.filter(p => p.visibleEnCatalogo !== false)
  }, [productos])

  // Categorías de Joyería configuradas (o por defecto)
  const categoriasJoyeriaConfig = useMemo(() => {
    return (heroBannerConfig?.categoriasJoyeriaMenu && heroBannerConfig.categoriasJoyeriaMenu.length > 0)
      ? heroBannerConfig.categoriasJoyeriaMenu
      : ['AROS', 'COLLAR', 'CONJUNTO', 'ANILLOS'];
  }, [heroBannerConfig?.categoriasJoyeriaMenu]);

  // Categorías de Capilar / Cosmética configuradas (o por defecto)
  const categoriasCapilarConfig = useMemo(() => {
    return (heroBannerConfig?.categoriasCapilarMenu && heroBannerConfig.categoriasCapilarMenu.length > 0)
      ? heroBannerConfig.categoriasCapilarMenu
      : ['CUIDADO CAPILAR'];
  }, [heroBannerConfig?.categoriasCapilarMenu]);

  const categoriasUnicas = useMemo(() => {
    const rawCats = Array.from(new Set(productosVisibles.map(p => (p.coleccion || '').trim().toUpperCase()).filter(Boolean)))
    const hayJoyas = productosVisibles.some(p => esJoyería((p.coleccion || '').trim().toUpperCase()))
    const catsSet = new Set(rawCats)
    if (hayJoyas) {
      catsSet.add('JOYERIA')
    }
    return ['TODAS', ...catsSet].sort((a, b) => {
      if (a === 'TODAS') return -1
      if (b === 'TODAS') return 1
      if (a === 'JOYERIA') return -1
      if (b === 'JOYERIA') return 1
      return a.localeCompare(b)
    })
  }, [productosVisibles])

  const categoryCounts = useMemo(() => {
    const counts = { TODAS: productosVisibles.length }
    let totalJoyas = 0
    let totalCapilar = 0
    productosVisibles.forEach(p => {
      const cat = (p.coleccion || '').trim().toUpperCase()
      if (cat) {
        counts[cat] = (counts[cat] || 0) + 1
      }
      if (esJoyería(cat) || categoriasJoyeriaConfig.includes(cat)) {
        totalJoyas++
      }
      const esDeCapilar = categoriasCapilarConfig.some(c => c.trim().toUpperCase() === cat) || cat.includes('CAPILAR');
      if (esDeCapilar) {
        totalCapilar++
      }
    })
    counts['JOYERIA'] = totalJoyas
    counts['JOYAS'] = totalJoyas
    counts['CAPILAR'] = totalCapilar
    return counts
  }, [productosVisibles, categoriasJoyeriaConfig, categoriasCapilarConfig])

  const productosFiltrados = useMemo(() => {
    return productosVisibles.filter(p => {
      const pCat = (p.coleccion || '').trim().toUpperCase();
      if (filtroCategoria !== 'TODAS') {
        if (filtroCategoria === 'JOYERIA' || filtroCategoria === 'JOYAS') {
          if (!esJoyería(pCat) && !categoriasJoyeriaConfig.includes(pCat)) return false;
        } else if (filtroCategoria === 'CAPILAR') {
          const esDeCapilar = categoriasCapilarConfig.some(c => c.trim().toUpperCase() === pCat) || pCat.includes('CAPILAR');
          if (!esDeCapilar) return false;
        } else if (pCat !== filtroCategoria) {
          return false;
        }
      }

      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase()
        const matchNombre = (p.nombre || '').toLowerCase().includes(s)
        const matchSku = (p.sku || '').toLowerCase().includes(s)
        const matchMarca = (p.marca || '').toLowerCase().includes(s)
        if (!(matchNombre || matchSku || matchMarca)) return false
      }

      if (precioMin !== '' && p.precio < Number(precioMin)) return false
      if (precioMax !== '' && p.precio > Number(precioMax)) return false

      if (soloDisponibles) {
        const tieneStock = p.variantes && p.variantes.length > 0 
          ? p.variantes.some(v => Number(v.stock) > 0)
          : Number(p.stock) > 0
        if (!tieneStock) return false
      }

      return true
    }).sort((a, b) => {
      if (ordenamiento === 'precio_asc') {
        return (Number(a.precio) || 0) - (Number(b.precio) || 0)
      }
      if (ordenamiento === 'precio_desc') {
        return (Number(b.precio) || 0) - (Number(a.precio) || 0)
      }
      if (ordenamiento === 'recientes') {
        const dateA = new Date(a.fechaIngreso || a.createdAt || 0).getTime()
        const dateB = new Date(b.fechaIngreso || b.createdAt || 0).getTime()
        return dateB - dateA
      }
      if (ordenamiento === 'mas_vendidos') {
        const ventasA = Number(a.ventasTotal || a.ventasCount || a.stockInvertido || 0)
        const ventasB = Number(b.ventasTotal || b.ventasCount || b.stockInvertido || 0)
        if (ventasB !== ventasA) return ventasB - ventasA
      }

      // Por defecto (Destacados): productos con fotos primero
      const aTieneFoto = !!(a.fotoUrl || (a.fotos && a.fotos.length > 0 && a.fotos[0]))
      const bTieneFoto = !!(b.fotoUrl || (b.fotos && b.fotos.length > 0 && b.fotos[0]))
      if (aTieneFoto && !bTieneFoto) return -1
      if (!aTieneFoto && bTieneFoto) return 1
      return 0
    })
  }, [productosVisibles, filtroCategoria, searchTerm, precioMin, precioMax, soloDisponibles, ordenamiento, categoriasJoyeriaConfig, categoriasCapilarConfig])

  // Paginación derivada
  const isTodas = filtroCategoria === 'TODAS'
  const totalPaginas = isTodas ? 1 : Math.ceil(productosFiltrados.length / itemsPorPagina)
  const productosPaginados = useMemo(() => {
    return isTodas
      ? productosFiltrados.slice(0, itemsVisiblesTodas)
      : productosFiltrados.slice((paginaActual - 1) * itemsPorPagina, paginaActual * itemsPorPagina)
  }, [isTodas, productosFiltrados, itemsVisiblesTodas, paginaActual, itemsPorPagina])

  // Lógica de páginas visibles (mostrar máximo 3 páginas)
  const paginasVisibles = useMemo(() => {
    const pags = []
    let inicioPag = Math.max(1, paginaActual - 1)
    let finPag = Math.min(totalPaginas, paginaActual + 1)

    if (finPag - inicioPag < 2 && totalPaginas >= 3) {
      if (inicioPag === 1) finPag = 3
      else if (finPag === totalPaginas) inicioPag = totalPaginas - 2
    }

    for (let i = inicioPag; i <= finPag; i++) {
      pags.push(i)
    }
    return pags
  }, [paginaActual, totalPaginas])

  const scrollCategories = (direction) => {
    if (categoryContainerRef.current) {
      const scrollAmount = direction === 'left' ? -200 : 200
      categoryContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' })
    }
  }

  const limpiarFiltros = () => {
    setFiltroCategoria('TODAS')
    setSearchTerm('')
    setPrecioMin('')
    setPrecioMax('')
    setCategorySearchTerm('')
    setSoloDisponibles(false)
    setSoloConImagenes(false)
  }

  return {
    filtroCategoria,
    setFiltroCategoria,
    ordenamiento,
    setOrdenamiento,
    isSortOpen,
    setIsSortOpen,
    searchTerm,
    setSearchTerm,
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
    precioMin,
    setPrecioMin,
    precioMax,
    setPrecioMax,
    soloDisponibles,
    setSoloDisponibles,
    soloConImagenes,
    setSoloConImagenes,
    categorySearchTerm,
    setCategorySearchTerm,
    categoryContainerRef,
    paginaActual,
    setPaginaActual,
    itemsVisiblesTodas,
    setItemsVisiblesTodas,
    ITEMS_POR_PAGINA: itemsPorPagina,
    productosVisibles,
    categoriasUnicas,
    categoryCounts,
    productosFiltrados,
    isTodas,
    totalPaginas,
    productosPaginados,
    paginasVisibles,
    scrollCategories,
    limpiarFiltros
  }
}
export default useCatalogFilters
