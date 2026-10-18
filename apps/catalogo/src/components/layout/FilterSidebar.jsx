import { useState } from 'react'
import { getCategoriaIcon } from '../../utils/categories'

export default function FilterSidebar({
  isDark,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  searchTerm,
  setSearchTerm,
  precioMin,
  setPrecioMin,
  precioMax,
  setPrecioMax,
  filtroCategoria,
  setFiltroCategoria,
  categorySearchTerm,
  setCategorySearchTerm,
  categoriasUnicas,
  categoryCounts,
  setSoloDisponibles,
  setSoloConImagenes,
  totalResultados,
  tourStep,
  isAutoDemo,
  autoDemoStep
}) {
  const [isBusquedaExpanded, setIsBusquedaExpanded] = useState(true)
  const [isPrecioExpanded, setIsPrecioExpanded] = useState(true)
  const [isCategoriasExpanded, setIsCategoriasExpanded] = useState(true)

  const handleLimpiarFiltros = () => {
    setFiltroCategoria('TODAS')
    setSearchTerm('')
    setPrecioMin('')
    setPrecioMax('')
    setCategorySearchTerm('')
    setSoloDisponibles(false)
    setSoloConImagenes(false)
  }

  return (
    <>
      {/* OVERLAY MÓVIL PARA SIDEBAR */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm animate-in fade-in"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ── PANEL LATERAL (SIDEBAR) ── */}
      <aside className={`fixed md:relative top-0 left-0 h-full border-r z-50 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-2xl md:shadow-none 
        ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'} 
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} 
        ${isSidebarCollapsed ? 'md:w-0 md:-translate-x-full md:border-r-transparent' : 'md:w-[280px] md:translate-x-0'}`}
      >
        <div className={`flex-1 flex flex-col h-full min-w-[280px] transition-all duration-500 ${isSidebarCollapsed ? 'md:opacity-0 md:pointer-events-none' : 'opacity-100'}`}>
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
            <button 
              onClick={() => {
                if (window.innerWidth < 768) {
                  setIsSidebarOpen(false);
                } else {
                  setIsSidebarCollapsed(true);
                }
              }} 
              className={`p-2 rounded-full transition-colors cursor-pointer ${isDark ? 'text-gray-400 hover:bg-white/5 hover:text-white' : 'text-outline hover:bg-surface-variant hover:text-on-surface'}`}
              title="Cerrar Filtros"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>

          {/* CONTENIDO SIDEBAR (FILTROS) */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            
            {/* BÚSQUEDA */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsBusquedaExpanded(!isBusquedaExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">search</span>
                  Búsqueda
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isBusquedaExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isBusquedaExpanded && (
                <div className="relative animate-in fade-in slide-in-from-top-1 duration-200">
                  <span className={`material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    search
                  </span>
                  <input 
                    type="text" 
                    placeholder="Buscar producto..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className={`w-full border rounded-xl pl-9 pr-8 py-2.5 text-xs font-medium focus:outline-none focus:ring-4 transition-all ${isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50 focus:ring-[#e2bd6c]/5' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50 focus:ring-primary/5'} ${tourStep === 2 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-[1.02]' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-[1.02]') : ''} ${isAutoDemo && (autoDemoStep === 2 || autoDemoStep === 3 || autoDemoStep === 6) ? 'demo-highlight' : ''}`}
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
              )}
            </div>

            {/* PRECIO */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsPrecioExpanded(!isPrecioExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">payments</span>
                  Rango de Precio
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isPrecioExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isPrecioExpanded && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
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
              )}
            </div>

            {/* CATEGORÍAS */}
            <div className="space-y-3">
              <button 
                onClick={() => setIsCategoriasExpanded(!isCategoriasExpanded)}
                className="w-full flex items-center justify-between py-1 cursor-pointer select-none group focus:outline-none"
              >
                <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${isDark ? 'text-[#e2bd6c]/80' : 'text-outline'} group-hover:text-[#e2bd6c] transition-colors`}>
                  <span className="material-symbols-outlined text-sm">category</span>
                  Categorías
                </h3>
                <span className={`material-symbols-outlined text-sm transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isCategoriasExpanded ? 'rotate-180' : ''}`}>
                  expand_more
                </span>
              </button>
              
              {isCategoriasExpanded && (
                <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  {categoriasUnicas.length > 5 && (
                    <div className="relative mb-2">
                      <input 
                        type="text"
                        placeholder="Filtrar categoría..."
                        value={categorySearchTerm}
                        onChange={e => setCategorySearchTerm(e.target.value)}
                        className={`w-full border rounded-lg pl-3 pr-8 py-1.5 text-xs font-medium focus:outline-none ${
                          isDark ? 'bg-white/5 border-white/10 text-white focus:border-[#e2bd6c]/50' : 'bg-surface-container-low border-outline-variant/30 text-on-surface focus:border-primary/50'
                        }`}
                      />
                      {categorySearchTerm && (
                        <button 
                          onClick={() => setCategorySearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          <span className="material-symbols-outlined text-[10px]">close</span>
                        </button>
                      )}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 max-h-[380px] overflow-y-auto custom-scrollbar p-0.5">
                    {categoriasUnicas
                      .filter(c => c.toLowerCase().includes(categorySearchTerm.toLowerCase()))
                      .map(c => {
                        const isSelected = filtroCategoria === c;
                        const count = categoryCounts[c] || 0;
                        return (
                          <button
                            key={c}
                            onClick={() => {
                              setFiltroCategoria(c)
                            }}
                            className={`w-full py-2.5 px-3 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center justify-between border cursor-pointer select-none text-left
                              ${isSelected
                                ? (isDark 
                                    ? 'bg-gradient-to-r from-[#e2bd6c]/25 to-[#e2bd6c]/10 border-[#e2bd6c]/50 text-[#e2bd6c] shadow-[0_0_12px_rgba(226,189,108,0.2)]' 
                                    : 'bg-gradient-to-r from-primary/15 to-primary/5 border-primary/40 text-primary shadow-sm')
                                : (isDark 
                                    ? 'bg-white/5 border-white/5 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/10' 
                                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface-variant hover:text-on-surface hover:bg-surface-variant/40')
                              }`}
                          >
                            <div className="flex items-center gap-2.5 truncate pr-2">
                              <div className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                                isSelected 
                                  ? (isDark ? 'border-[#e2bd6c] bg-[#e2bd6c]' : 'border-primary bg-primary') 
                                  : (isDark ? 'border-white/20' : 'border-gray-300')
                              }`}>
                                {isSelected && (
                                  <span className={`material-symbols-outlined text-[10px] font-bold ${isDark ? 'text-black' : 'text-white'}`}>check</span>
                                )}
                              </div>
                              <span className={`material-symbols-outlined text-[16px] shrink-0 ${isSelected ? (isDark ? 'text-[#e2bd6c]' : 'text-primary') : 'text-gray-500'}`}>
                                {getCategoriaIcon(c)}
                              </span>
                              <span className="truncate">{c}</span>
                            </div>
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                              isSelected 
                                ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/20 text-primary') 
                                : (isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-variant text-on-surface-variant')
                            }`}>
                              {count}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}
            </div>

          </div>
          
          {/* FOOTER SIDEBAR STICKY */}
          <div className={`sticky bottom-0 p-5 border-t shrink-0 backdrop-blur-md flex flex-col gap-2.5 z-10 ${
            isDark ? 'border-white/10 bg-[#151515]/95 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]' : 'border-outline-variant/20 bg-white/95 shadow-[0_-10px_25px_rgba(0,0,0,0.05)]'
          }`}>
            <button 
              onClick={() => {
                if (window.innerWidth < 768) setIsSidebarOpen(false);
              }}
              className={`w-full py-3.5 rounded-xl font-headline font-bold text-xs md:text-sm uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg transition-all cursor-pointer active:scale-95 hover:scale-[1.02] ${
                isDark 
                  ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90 shadow-[#e2bd6c]/20' 
                  : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
              }`}
            >
              <span className="material-symbols-outlined text-base font-bold">tune</span>
              <span>Ver {totalResultados} {totalResultados === 1 ? 'resultado' : 'resultados'}</span>
            </button>

            <button 
              onClick={handleLimpiarFiltros}
              className={`w-full py-2 rounded-xl border font-bold text-[11px] uppercase tracking-widest transition-colors cursor-pointer ${
                isDark 
                  ? 'border-white/10 text-gray-400 hover:bg-white/5 hover:text-white' 
                  : 'border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/40'
              }`}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
