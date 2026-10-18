export default function ProductPagination({
  isDark,
  isTodas,
  itemsVisiblesTodas,
  setItemsVisiblesTodas,
  ITEMS_POR_PAGINA,
  totalProductos,
  productosPaginadosCount,
  totalPaginas,
  paginaActual,
  setPaginaActual,
  paginasVisibles,
  mainScrollRef
}) {
  const scrollToTop = () => {
    if (mainScrollRef?.current) {
      mainScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  if (isTodas) {
    /* MODO 'VER MÁS' PARA CATEGORÍA 'TODAS' */
    return (
      <div className="mt-12 flex flex-col items-center justify-center gap-3">
        {itemsVisiblesTodas < totalProductos ? (
          <>
            <p className={`text-xs uppercase font-bold tracking-wider ${isDark ? 'text-gray-400' : 'text-outline'}`}>
              Viendo <span className={isDark ? 'text-[#e2bd6c]' : 'text-primary'}>{productosPaginadosCount}</span> de <span className={isDark ? 'text-white' : 'text-on-surface'}>{totalProductos}</span> productos
            </p>
            <button
              onClick={() => setItemsVisiblesTodas(prev => prev + ITEMS_POR_PAGINA)}
              className={`px-8 py-3.5 rounded-2xl font-headline font-bold text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 hover:scale-105 ${
                isDark 
                  ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90 shadow-[#e2bd6c]/20' 
                  : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-lg font-bold">expand_more</span>
              <span>Ver más productos</span>
            </button>
          </>
        ) : (
          totalProductos > 0 && (
            <div className={`py-3 px-6 rounded-2xl border text-xs font-bold uppercase tracking-wider ${
              isDark ? 'bg-white/5 border-white/10 text-gray-400' : 'bg-surface-variant/40 border-outline-variant/20 text-outline'
            }`}>
              ✨ Has visto todos los {totalProductos} productos
            </div>
          )
        )}
      </div>
    )
  }

  /* PAGINACIÓN NUMÉRICA (1, 2, 3...) PARA CATEGORÍAS ESPECÍFICAS */
  if (totalPaginas <= 1) return null

  return (
    <div className="mt-10 flex justify-center items-center gap-2 flex-wrap">
      <button
        onClick={() => {
          setPaginaActual(prev => Math.max(prev - 1, 1))
          scrollToTop()
        }}
        disabled={paginaActual === 1}
        className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer ${
          isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
        }`}
        title="Página anterior"
      >
        <span className="material-symbols-outlined text-sm">chevron_left</span>
      </button>

      {paginasVisibles.map(pag => (
        <button
          key={pag}
          onClick={() => {
            setPaginaActual(pag)
            scrollToTop()
          }}
          className={`w-10 h-10 flex items-center justify-center rounded-xl font-bold text-sm transition-all cursor-pointer ${
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
          scrollToTop()
        }}
        disabled={paginaActual === totalPaginas}
        className={`w-10 h-10 flex items-center justify-center rounded-xl border disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer ${
          isDark ? 'border-white/10 text-gray-300 hover:bg-white/5' : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant'
        }`}
        title="Página siguiente"
      >
        <span className="material-symbols-outlined text-sm">chevron_right</span>
      </button>
    </div>
  )
}
