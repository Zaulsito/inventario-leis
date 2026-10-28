import { esJoyería } from '../../utils/categories'

export default function CatalogHeaderControls({
  filtroCategoria,
  setFiltroCategoria,
  categoryCounts = {},
  heroBannerConfig = null,
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

  const categoriasJoyeriaConfig = (heroBannerConfig?.categoriasJoyeriaMenu && heroBannerConfig.categoriasJoyeriaMenu.length > 0)
    ? heroBannerConfig.categoriasJoyeriaMenu
    : ['AROS', 'COLLAR', 'CONJUNTO', 'ANILLOS'];

  const categoriasCapilarConfig = (heroBannerConfig?.categoriasCapilarMenu && heroBannerConfig.categoriasCapilarMenu.length > 0)
    ? heroBannerConfig.categoriasCapilarMenu
    : ['CUIDADO CAPILAR'];

  const esModoJoyeria = filtroCategoria === 'JOYERIA' 
    || filtroCategoria === 'JOYAS' 
    || esJoyería(filtroCategoria)
    || categoriasJoyeriaConfig.some(c => c.trim().toUpperCase() === (filtroCategoria || '').trim().toUpperCase());

  const esModoCapilar = !esModoJoyeria && (
    filtroCategoria === 'CAPILAR'
    || categoriasCapilarConfig.some(c => c.trim().toUpperCase() === (filtroCategoria || '').trim().toUpperCase())
    || (filtroCategoria || '').includes('CAPILAR')
  );

  const subcategoriasJoyeria = [
    { id: 'JOYERIA', label: '✨ Ver Todas', count: categoryCounts['JOYERIA'] || 0 },
    ...categoriasJoyeriaConfig.map(catKey => {
      const rawUpper = catKey.trim().toUpperCase();
      let friendlyLabel = catKey;
      if (rawUpper === 'AROS' || rawUpper === 'ARO') friendlyLabel = 'Aros';
      else if (rawUpper === 'COLLAR' || rawUpper === 'COLLARES') friendlyLabel = 'Collares';
      else if (rawUpper === 'CONJUNTO' || rawUpper === 'CONJUNTOS') friendlyLabel = 'Conjuntos';
      else if (rawUpper === 'ANILLOS' || rawUpper === 'ANILLO') friendlyLabel = 'Anillos';
      else if (rawUpper === 'PULSERA' || rawUpper === 'PULSERAS') friendlyLabel = 'Pulseras';

      const count = categoryCounts[rawUpper] || categoryCounts[catKey] || 0;
      return { id: rawUpper, label: friendlyLabel, count };
    })
  ].filter(item => item.id === 'JOYERIA' || item.count > 0);

  const subcategoriasCapilar = [
    { id: 'CAPILAR', label: '🌿 Ver Todos', count: categoryCounts['CAPILAR'] || 0 },
    ...categoriasCapilarConfig.map(catKey => {
      const rawUpper = catKey.trim().toUpperCase();
      let friendlyLabel = catKey;
      if (rawUpper === 'CUIDADO CAPILAR') friendlyLabel = 'Capilar';
      else if (rawUpper === 'CUIDADO FACIAL') friendlyLabel = 'Facial';
      else if (rawUpper === 'ROSTRO') friendlyLabel = 'Rostro';
      else if (rawUpper === 'LABIOS') friendlyLabel = 'Labios';
      else if (rawUpper === 'OJOS') friendlyLabel = 'Ojos';
      else if (rawUpper === 'PESTAÑAS') friendlyLabel = 'Pestañas';
      else if (rawUpper === 'CEJAS') friendlyLabel = 'Cejas';
      else if (rawUpper === 'CORPORAL') friendlyLabel = 'Corporal';
      else if (rawUpper === 'MANOS') friendlyLabel = 'Manos';
      else friendlyLabel = catKey.charAt(0).toUpperCase() + catKey.slice(1).toLowerCase();

      const count = categoryCounts[rawUpper] || categoryCounts[catKey] || 0;
      return { id: rawUpper, label: friendlyLabel, count };
    })
  ].filter(item => item.id === 'CAPILAR' || item.count > 0);

  // Título personalizado para Joyería y Capilar
  const tituloJoyeria = heroBannerConfig?.botonJoyeriaTexto
    ? heroBannerConfig.botonJoyeriaTexto.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() || 'Joyería en Plata 925'
    : 'Joyería en Plata 925';

  const tituloCapilar = heroBannerConfig?.botonCapilarTexto
    ? heroBannerConfig.botonCapilarTexto.replace(/^[^\w\s\u00C0-\u017F]+/, '').trim() || 'Cuidado Capilar & Cosmética'
    : 'Cuidado Capilar & Cosmética';

  return (
    <div className="mb-8 flex flex-col gap-4 px-2 animate-in fade-in slide-in-from-top-2 duration-300 border-b pb-5 border-white/5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            {esModoJoyeria && (
              <span className={`material-symbols-outlined text-2xl ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                diamond
              </span>
            )}
            {esModoCapilar && (
              <span className={`material-symbols-outlined text-2xl ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                spa
              </span>
            )}
            <h2 className={`font-headline text-2xl md:text-3xl font-bold italic leading-tight ${
              esModoCapilar
                ? (isDark ? 'text-emerald-400' : 'text-emerald-700')
                : (isDark ? 'text-[#e2bd6c]' : 'text-secondary')
            }`}>
              {filtroCategoria === 'TODAS'
                ? 'Todos los Productos'
                : filtroCategoria === 'JOYERIA' || filtroCategoria === 'JOYAS'
                ? tituloJoyeria
                : esModoJoyeria
                ? `Joyería: ${filtroCategoria}`
                : filtroCategoria === 'CAPILAR'
                ? tituloCapilar
                : esModoCapilar
                ? `Cuidado: ${filtroCategoria}`
                : filtroCategoria}
            </h2>
          </div>
          <p className={`text-xs font-medium mt-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
            {filtroCategoria === 'TODAS' 
              ? 'Explora nuestra colección completa de joyería y cuidado personal.' 
              : esModoJoyeria
              ? 'Piezas exclusivas en Plata de Ley 925 (Aros, Anillos, Collares y Conjuntos).'
              : esModoCapilar
              ? 'Fórmulas y productos seleccionados para el cuidado, brillo y tratamiento personal.'
              : `Mostrando productos de la categoría ${filtroCategoria}`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start sm:self-auto shrink-0">
          {/* Contador de Productos */}
          <span className={`text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-2xl border shadow-sm flex items-center gap-2 ${
            esModoCapilar
              ? (isDark ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700')
              : (isDark ? 'bg-white/5 border-white/10 text-[#e2bd6c]' : 'bg-surface-container-high border-outline-variant/30 text-primary')
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

      {/* SUB-FILTROS RÁPIDOS DE JOYERÍA (PÍLDORAS) */}
      {esModoJoyeria && setFiltroCategoria && subcategoriasJoyeria.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
            Filtrar Joya:
          </span>
          {subcategoriasJoyeria.map(sub => {
            const isSelected = (filtroCategoria === sub.id) || (sub.id === 'JOYERIA' && filtroCategoria === 'JOYAS');
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setFiltroCategoria(sub.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer border select-none ${
                  isSelected
                    ? (isDark
                        ? 'bg-gradient-to-r from-[#e2bd6c] to-[#d4ab55] text-black border-[#e2bd6c] shadow-[0_0_15px_rgba(226,189,108,0.35)] scale-[1.02]'
                        : 'bg-primary text-white border-primary shadow-sm scale-[1.02]')
                    : (isDark
                        ? 'bg-[#191919] border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20'
                        : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-primary hover:bg-surface-container-high')
                }`}
              >
                <span>{sub.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                  isSelected
                    ? (isDark ? 'bg-black/20 text-black' : 'bg-white/25 text-white')
                    : (isDark ? 'bg-white/5 text-[#e2bd6c]' : 'bg-black/5 text-primary')
                }`}>
                  {sub.count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* SUB-FILTROS RÁPIDOS DE CUIDADO CAPILAR & COSMÉTICA (PÍLDORAS) */}
      {esModoCapilar && setFiltroCategoria && subcategoriasCapilar.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
          <span className={`text-[11px] font-bold uppercase tracking-wider mr-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
            Filtrar Cuidado:
          </span>
          {subcategoriasCapilar.map(sub => {
            const isSelected = filtroCategoria === sub.id;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => setFiltroCategoria(sub.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 flex items-center gap-2 cursor-pointer border select-none ${
                  isSelected
                    ? (isDark
                        ? 'bg-gradient-to-r from-emerald-400 to-teal-400 text-black border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.35)] scale-[1.02]'
                        : 'bg-emerald-600 text-white border-emerald-600 shadow-sm scale-[1.02]')
                    : (isDark
                        ? 'bg-[#191919] border-white/10 text-gray-300 hover:text-white hover:bg-white/10 hover:border-emerald-400/20'
                        : 'bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-emerald-700 hover:bg-surface-container-high')
                }`}
              >
                <span>{sub.label}</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                  isSelected
                    ? (isDark ? 'bg-black/20 text-black' : 'bg-white/25 text-white')
                    : (isDark ? 'bg-white/5 text-emerald-400' : 'bg-black/5 text-emerald-700')
                }`}>
                  {sub.count}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  )
}
