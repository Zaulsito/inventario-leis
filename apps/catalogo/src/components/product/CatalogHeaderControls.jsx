export default function CatalogHeaderControls({
  filtroCategoria,
  isDark,
  totalProductos,
  ordenamiento,
  setOrdenamiento,
  isSortOpen,
  setIsSortOpen
}) {
  const opcionesOrden = [
    { id: 'destacados', label: 'Ordenar por: Destacados', icon: 'auto_awesome' },
    { id: 'precio_asc', label: 'Precio: Menor a Mayor', icon: 'arrow_upward' },
    { id: 'precio_desc', label: 'Precio: Mayor a Menor', icon: 'arrow_downward' },
    { id: 'recientes', label: 'Más recientes', icon: 'schedule' },
    { id: 'mas_vendidos', label: 'Más vendidos', icon: 'local_fire_department' },
  ];
  const opcionActual = opcionesOrden.find(o => o.id === ordenamiento) || opcionesOrden[0];

  return (
    <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2 animate-in fade-in slide-in-from-top-2 duration-300 border-b pb-5 border-white/5">
      <div>
        <h2 className={`font-headline text-2xl md:text-3xl font-bold italic leading-tight ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
          {filtroCategoria === 'TODAS' ? 'Todos los Productos' : filtroCategoria}
        </h2>
        <p className={`text-xs font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
          {filtroCategoria === 'TODAS' 
            ? 'Explora nuestra colección completa de joyería y cuidado personal.' 
            : `Mostrando productos de la categoría ${filtroCategoria}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto shrink-0">
        {/* Contador de Productos */}
        <span className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-2xl border shadow-sm flex items-center gap-2 ${
          isDark ? 'bg-white/5 border-white/10 text-[#e2bd6c]' : 'bg-surface-container-high border-outline-variant/30 text-primary'
        }`}>
          <span className="material-symbols-outlined text-base">inventory_2</span>
          {totalProductos} {totalProductos === 1 ? 'PRODUCTO' : 'PRODUCTOS'}
        </span>

        {/* SELECTOR DE ORDENAMIENTO PERSONALIZADO LUXE (CUSTOM DROPDOWN) */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsSortOpen(!isSortOpen)}
            className={`px-4 py-2.5 rounded-2xl border text-xs font-bold uppercase tracking-wider cursor-pointer transition-all shadow-sm flex items-center gap-2.5 backdrop-blur-md select-none ${
              isDark 
                ? 'bg-[#151515] border-[#e2bd6c]/30 text-white hover:border-[#e2bd6c] hover:bg-white/5' 
                : 'bg-white border-outline-variant/30 text-on-surface hover:border-primary hover:bg-surface-container-low'
            }`}
          >
            <span className={`material-symbols-outlined text-base ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
              swap_vert
            </span>
            <span>{opcionActual.label}</span>
            <span className={`material-symbols-outlined text-base transition-transform duration-300 ${isDark ? 'text-gray-400' : 'text-outline'} ${isSortOpen ? 'rotate-180' : ''}`}>
              expand_more
            </span>
          </button>

          {/* MENÚ DESPLEGABLE CON DISEÑO REDONDEADO Y GLASSMORPHISM (POPOVER) */}
          {isSortOpen && (
            <>
              <div 
                className="fixed inset-0 z-40" 
                onClick={() => setIsSortOpen(false)} 
              />
              <div className={`absolute right-0 top-full mt-2.5 w-64 rounded-2xl border shadow-2xl z-50 p-2 space-y-1 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
                isDark 
                  ? 'bg-[#1e1e1e]/95 border-[#e2bd6c]/30 text-white shadow-black/80' 
                  : 'bg-white/95 border-outline-variant/20 text-on-surface shadow-black/10'
              }`}>
                {opcionesOrden.map(op => {
                  const isSelected = ordenamiento === op.id;
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => {
                        setOrdenamiento(op.id);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? (isDark 
                              ? 'bg-gradient-to-r from-[#e2bd6c]/25 to-[#e2bd6c]/10 border border-[#e2bd6c]/40 text-[#e2bd6c] shadow-sm' 
                              : 'bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 text-primary shadow-sm')
                          : (isDark 
                              ? 'text-gray-300 hover:bg-white/5 hover:text-white' 
                              : 'text-on-surface-variant hover:bg-surface-variant/40 hover:text-on-surface')
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`material-symbols-outlined text-base ${isSelected ? (isDark ? 'text-[#e2bd6c]' : 'text-primary') : 'text-gray-500'}`}>
                          {op.icon}
                        </span>
                        <span>{op.label}</span>
                      </div>
                      {isSelected && (
                        <span className={`material-symbols-outlined text-base font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                          check
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
