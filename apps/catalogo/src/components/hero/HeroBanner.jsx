import { useState, useEffect, useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '../../config/firebase'
import { getOptimizedImageUrl } from '../../utils/image'
import { esJoyería } from '../../utils/categories'

export default function HeroBanner({
  isDark,
  categoriasUnicas = [],
  filtroCategoria,
  setFiltroCategoria,
  soloDisponibles,
  setSoloDisponibles,
  productos = [],
  setProductoParaVer
}) {
  const [heroIndex, setHeroIndex] = useState(0)
  const [heroBannerConfig, setHeroBannerConfig] = useState(null)
  const heroTimerRef = useRef(null)
  const heroTouchStartXRef = useRef(null)

  // Suscripción en tiempo real a la configuración del Hero
  useEffect(() => {
    const unsubHero = onSnapshot(doc(db, 'configuracion', 'heroBanner'), (docSnap) => {
      if (docSnap.exists()) {
        setHeroBannerConfig(docSnap.data())
      }
    })
    return () => unsubHero()
  }, [])

  // Rotación automática cada 5 segundos
  const resetHeroTimer = useCallback(() => {
    if (heroTimerRef.current) {
      clearInterval(heroTimerRef.current)
    }
    heroTimerRef.current = setInterval(() => {
      setHeroIndex(prev => prev + 1)
    }, 5000)
  }, [])

  useEffect(() => {
    resetHeroTimer()
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current)
    }
  }, [resetHeroTimer])

  const handlePrevHero = useCallback((mobileItemsCount) => {
    resetHeroTimer()
    setHeroIndex(prev => {
      const count = mobileItemsCount || 1
      const cur = ((prev % count) + count) % count
      return (cur - 1 + count) % count
    })
  }, [resetHeroTimer])

  const handleNextHero = useCallback((mobileItemsCount) => {
    resetHeroTimer()
    setHeroIndex(prev => {
      const count = mobileItemsCount || 1
      const cur = ((prev % count) + count) % count
      return (cur + 1) % count
    })
  }, [resetHeroTimer])

  const handleSelectHero = useCallback((idx) => {
    resetHeroTimer()
    setHeroIndex(idx)
  }, [resetHeroTimer])

  // Filtrado y armado de listas de fotos destacadas
  const productosConFoto = productos.filter(p => p.fotoUrl || (p.fotos && p.fotos.length > 0))
  
  const prodJoyaList = productosConFoto.filter(p => {
    const cat = (p.coleccion || '').toUpperCase()
    const nom = (p.nombre || '').toUpperCase()
    return cat.includes('JOYA') || cat.includes('ANILLO') || cat.includes('AROS') || cat.includes('COLLAR') || nom.includes('ARO') || nom.includes('PLATA')
  })

  const prodCapilarList = productosConFoto.filter(p => {
    const cat = (p.coleccion || '').toUpperCase()
    const nom = (p.nombre || '').toUpperCase()
    return cat.includes('CAPILAR') || cat.includes('CABELLO') || cat.includes('COSMETICA') || nom.includes('ACEITE') || nom.includes('SHOCK') || nom.includes('KERATINA')
  })

  const list1 = prodJoyaList.length > 0 ? prodJoyaList : productosConFoto
  const list2 = prodCapilarList.length > 0 ? prodCapilarList : (productosConFoto.length > 1 ? productosConFoto.slice(1) : productosConFoto)

  const heroProd1 = list1.length > 0 ? list1[heroIndex % list1.length] : null
  const heroProd2 = list2.length > 0 ? list2[(heroIndex + 1) % list2.length] : null

  const list1Images = (heroBannerConfig?.imagenes1 && heroBannerConfig.imagenes1.length > 0)
    ? heroBannerConfig.imagenes1
    : (heroBannerConfig?.imagen1Url ? [heroBannerConfig.imagen1Url] : list1.map(p => p.fotoUrl).filter(Boolean))

  const list2Images = (heroBannerConfig?.imagenes2 && heroBannerConfig.imagenes2.length > 0)
    ? heroBannerConfig.imagenes2
    : (heroBannerConfig?.imagen2Url ? [heroBannerConfig.imagen2Url] : list2.map(p => p.fotoUrl).filter(Boolean))

  const img1Url = list1Images.length > 0 ? list1Images[heroIndex % list1Images.length] : null
  const img2Url = list2Images.length > 0 ? list2Images[(heroIndex + 1) % list2Images.length] : null

  const label1 = heroBannerConfig?.imagen1Label || '✨ Joyería'
  const label2 = heroBannerConfig?.imagen2Label || '🌿 Cosmética'

  const mobileItems = []
  list1Images.forEach((img, idx) => {
    mobileItems.push({
      img,
      prod: list1[idx % (list1.length || 1)],
      label: label1,
      isJoya: true
    })
  })
  list2Images.forEach((img, idx) => {
    mobileItems.push({
      img,
      prod: list2[idx % (list2.length || 1)],
      label: label2,
      isJoya: false
    })
  })

  const currentMobileItem = mobileItems.length > 0 ? mobileItems[heroIndex % mobileItems.length] : null

  return (
    <div className={`mb-8 p-6 md:p-10 rounded-[2.5rem] border relative overflow-hidden transition-all duration-500 shadow-2xl animate-in fade-in slide-in-from-top-4 duration-700 ${
      isDark 
        ? 'bg-gradient-to-r from-neutral-900 via-stone-900 to-neutral-950 border-amber-500/20 text-white shadow-black/60' 
        : 'bg-gradient-to-r from-[#fdfbf7] via-[#f7f0e4] to-[#ede3d1] border-[#e2bd6c]/30 text-[#2a1b0a] shadow-black/5'
    }`}>
      {/* Luces de fondo difuminadas */}
      <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-[#e2bd6c]/15 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
        
        {/* COLUMNA IZQUIERDA: TEXTOS Y FILTROS RÁPIDOS */}
        <div className="flex-1 space-y-4 text-center md:text-left">
          {/* Isotipo sutil */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#e2bd6c]/30 backdrop-blur-md bg-white/5">
            <img src="/logo.jpeg" alt="Leis" className="w-5 h-5 rounded-full object-cover" />
            <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#e2bd6c]">LEIS COLLECTION</span>
          </div>

          {/* Título Principal */}
          <h1 className={`font-headline text-2xl md:text-4xl lg:text-5xl font-extrabold italic leading-tight ${isDark ? 'text-white' : 'text-[#2a1b0a]'}`}>
            {heroBannerConfig?.titulo ? (
              heroBannerConfig.titulo
            ) : (
              <>
                NUEVA COLECCIÓN & <br className="hidden lg:inline" />
                <span className={isDark ? 'text-[#e2bd6c]' : 'text-[#785427]'}>CUIDADO PERSONAL</span>
              </>
            )}
          </h1>

          {/* Subtítulo */}
          <p className={`text-xs md:text-sm max-w-xl font-medium leading-relaxed ${isDark ? 'text-gray-300' : 'text-[#5d3a28]/80'}`}>
            {heroBannerConfig?.subtitulo || "Joyería en Plata 925 y cosmética capilar seleccionada para realzar tu estilo."}
          </p>

          {/* CHIPS / FILTROS RÁPIDOS */}
          <div className="pt-2 flex flex-wrap items-center justify-center md:justify-start gap-2.5">
            <button
              onClick={() => {
                setFiltroCategoria('JOYERIA');
              }}
              className={`px-4 py-2.5 rounded-2xl text-[11px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 border ${
                filtroCategoria === 'JOYERIA' || filtroCategoria === 'JOYAS' || (esJoyería(filtroCategoria) && filtroCategoria !== 'TODAS')
                  ? (isDark ? 'bg-[#e2bd6c] text-black border-[#e2bd6c]' : 'bg-primary text-on-primary border-primary')
                  : (isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-[#e2bd6c]/40' : 'bg-white/80 border-[#e2bd6c]/30 text-[#2a1b0a] hover:bg-white')
              }`}
            >
              <span>{heroBannerConfig?.botonJoyeriaTexto || '✨ Ver Joyería'}</span>
            </button>

            <button
              onClick={() => {
                setFiltroCategoria('CAPILAR');
              }}
              className={`px-4 py-2.5 rounded-2xl text-[11px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 border ${
                filtroCategoria === 'CAPILAR' || (heroBannerConfig?.categoriasCapilarMenu?.includes(filtroCategoria) && filtroCategoria !== 'TODAS') || (filtroCategoria.includes('CAPILAR') && filtroCategoria !== 'TODAS')
                  ? (isDark ? 'bg-emerald-400 text-black border-emerald-400' : 'bg-emerald-600 text-white border-emerald-600')
                  : (isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-emerald-400/40' : 'bg-white/80 border-emerald-400/30 text-[#2a1b0a] hover:bg-white')
              }`}
            >
              <span>{heroBannerConfig?.botonCapilarTexto || '🌿 Cuidado Capilar'}</span>
            </button>

            <button
              onClick={() => {
                setFiltroCategoria('TODAS');
                setSoloDisponibles(true);
              }}
              className={`px-4 py-2.5 rounded-2xl text-[11px] md:text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-md hover:scale-105 active:scale-95 border ${
                soloDisponibles && filtroCategoria === 'TODAS'
                  ? (isDark ? 'bg-[#e2bd6c] text-black border-[#e2bd6c]' : 'bg-primary text-on-primary border-primary')
                  : (isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-[#e2bd6c]/40' : 'bg-white/80 border-[#e2bd6c]/30 text-[#2a1b0a] hover:bg-white')
              }`}
            >
              <span>🔥 Lo más vendido</span>
            </button>
          </div>
        </div>

        {/* COLUMNA DERECHA ESCRITORIO: COMPOSICIÓN FOTOGRÁFICA CON CROSSFADE SUAVE */}
        <div className="hidden md:flex items-center justify-center shrink-0 relative w-72 lg:w-96 h-56 lg:h-64 select-none">
          {list1Images.length > 0 && (
            <div 
              onClick={() => heroProd1 && setProductoParaVer(heroProd1)}
              className={`absolute left-1 top-2 w-36 lg:w-44 aspect-square rounded-2xl overflow-hidden border-2 shadow-2xl transition-all duration-700 ease-out ${heroProd1 ? 'cursor-pointer hover:z-30 hover:scale-110' : ''} -rotate-6 hover:rotate-0 ${
                isDark ? 'border-[#e2bd6c]/50 bg-[#1e1e1e] shadow-black/80' : 'border-[#e2bd6c]/60 bg-white shadow-black/20'
              }`}
              title={heroProd1 ? `Ver ${heroProd1.nombre}` : 'Destacado 1'}
            >
              {list1Images.map((img, idx) => {
                const isCurrent = (heroIndex % list1Images.length) === idx;
                return (
                  <img 
                    key={img + idx}
                    src={getOptimizedImageUrl(img, 600)} 
                    alt="Destacado 1"
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
                      isCurrent 
                        ? 'opacity-100 scale-100 z-10' 
                        : 'opacity-0 scale-110 z-0 pointer-events-none'
                    }`} 
                  />
                );
              })}
              <span className="absolute top-2 left-2 z-20 px-2.5 py-1 rounded-full text-[9px] font-black bg-[#e2bd6c] text-black shadow-md uppercase tracking-wider backdrop-blur-md">
                {label1}
              </span>
            </div>
          )}

          {list2Images.length > 0 && (
            <div 
              onClick={() => heroProd2 && setProductoParaVer(heroProd2)}
              className={`absolute right-1 bottom-2 w-36 lg:w-44 aspect-square rounded-2xl overflow-hidden border-2 shadow-2xl transition-all duration-700 ease-out ${heroProd2 ? 'cursor-pointer hover:z-30 hover:scale-110' : ''} rotate-6 hover:rotate-0 ${
                isDark ? 'border-[#e2bd6c]/50 bg-[#1e1e1e] shadow-black/80' : 'border-[#e2bd6c]/60 bg-white shadow-black/20'
              }`}
              title={heroProd2 ? `Ver ${heroProd2.nombre}` : 'Destacado 2'}
            >
              {list2Images.map((img, idx) => {
                const isCurrent = ((heroIndex + 1) % list2Images.length) === idx;
                return (
                  <img 
                    key={img + idx}
                    src={getOptimizedImageUrl(img, 600)} 
                    alt="Destacado 2"
                    className={`absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-in-out ${
                      isCurrent 
                        ? 'opacity-100 scale-100 z-10' 
                        : 'opacity-0 scale-110 z-0 pointer-events-none'
                    }`} 
                  />
                );
              })}
              <span className="absolute top-2 right-2 z-20 px-2.5 py-1 rounded-full text-[9px] font-black bg-emerald-500 text-white shadow-md uppercase tracking-wider backdrop-blur-md">
                {label2}
              </span>
            </div>
          )}

          {/* Badge flotante central */}
          <div className={`absolute bottom-0 z-30 px-3.5 py-1 rounded-full border backdrop-blur-md shadow-xl flex items-center gap-1.5 select-none ${
            isDark ? 'bg-black/80 border-[#e2bd6c]/40 text-[#e2bd6c]' : 'bg-white/90 border-[#e2bd6c]/50 text-[#785427]'
          }`}>
            <span className="material-symbols-outlined text-xs animate-pulse text-[#e2bd6c]">auto_awesome</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Exclusividad & Estilo</span>
          </div>
        </div>

        {/* RULETA DE IMÁGENES MÓVIL AUTOMÁTICA (SOLO APP / CELULAR) */}
        {currentMobileItem?.img && (
          <div className="md:hidden mt-4 w-full flex flex-col items-center justify-center animate-in fade-in duration-500">
            <div 
              onClick={() => currentMobileItem.prod && setProductoParaVer(currentMobileItem.prod)}
              onTouchStart={(e) => {
                heroTouchStartXRef.current = e.touches[0].clientX
              }}
              onTouchEnd={(e) => {
                if (heroTouchStartXRef.current === null) return
                const diff = heroTouchStartXRef.current - e.changedTouches[0].clientX
                if (diff > 45) {
                  handleNextHero(mobileItems.length)
                } else if (diff < -45) {
                  handlePrevHero(mobileItems.length)
                }
                heroTouchStartXRef.current = null
              }}
              className={`relative w-64 h-64 sm:w-72 sm:h-72 rounded-3xl overflow-hidden border-2 shadow-2xl transition-all duration-700 ease-out cursor-pointer transform active:scale-95 ${
                isDark ? 'border-[#e2bd6c]/50 bg-[#1e1e1e] shadow-black/80' : 'border-[#e2bd6c]/60 bg-white shadow-black/20'
              }`}
            >
              <img 
                key={currentMobileItem.img}
                src={getOptimizedImageUrl(currentMobileItem.img, 600)} 
                alt={currentMobileItem.prod?.nombre || "Destacado"} 
                className="w-full h-full object-cover transition-opacity duration-700" 
              />
              <span className={`absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md shadow-md ${
                currentMobileItem.isJoya ? 'bg-[#e2bd6c] text-black' : 'bg-emerald-500 text-white'
              }`}>
                {currentMobileItem.label}
              </span>
              {currentMobileItem.prod?.nombre && (
                <div className={`absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t ${isDark ? 'from-black/90 via-black/60 to-transparent text-white' : 'from-black/80 via-black/50 to-transparent text-white'} backdrop-blur-[2px]`}>
                  <p className="text-xs font-bold truncate text-center">{currentMobileItem.prod.nombre}</p>
                  {currentMobileItem.prod.precioVenta && (
                    <p className="text-[11px] font-extrabold text-[#e2bd6c] text-center">${Number(currentMobileItem.prod.precioVenta).toLocaleString('es-CL')}</p>
                  )}
                </div>
              )}

              {/* Flechas de navegación para la ruleta móvil */}
              {mobileItems.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePrevHero(mobileItems.length)
                    }}
                    aria-label="Anterior destacado"
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 active:scale-90 text-white backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleNextHero(mobileItems.length)
                    }}
                    aria-label="Siguiente destacado"
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-black/55 hover:bg-black/80 active:scale-90 text-white backdrop-blur-md border border-white/25 flex items-center justify-center shadow-lg transition-all cursor-pointer"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </>
              )}
            </div>

            {mobileItems.length > 1 && (
              <div className="flex items-center gap-1.5 mt-3 select-none">
                {mobileItems.map((_, idx) => (
                  <button 
                    key={idx}
                    type="button"
                    onClick={() => handleSelectHero(idx)}
                    aria-label={`Ir a destacado ${idx + 1}`}
                    className={`h-2 rounded-full transition-all duration-300 p-0 border-0 cursor-pointer ${
                      (heroIndex % mobileItems.length) === idx 
                        ? 'w-6 bg-[#e2bd6c] shadow-sm' 
                        : (isDark ? 'w-2 bg-white/25 hover:bg-white/50' : 'w-2 bg-black/25 hover:bg-black/50')
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
