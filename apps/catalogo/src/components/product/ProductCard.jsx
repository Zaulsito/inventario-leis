import React from 'react';
import { getOptimizedImageUrl } from '../../utils/image';
import { getHexColor } from '../../utils/colors';
import { toTitleCase } from '../../utils/formatters';
import { ProductImagePlaceholder } from '../common/Indicators';

export default function ProductCard({
  p,
  pIndex,
  isDark,
  carrito,
  tourStep,
  isAutoDemo,
  autoDemoStep,
  demoProd1,
  demoProd2,
  selectedColorByProduct,
  setSelectedColorByProduct,
  openColorDropdownId,
  setOpenColorDropdownId,
  setProductoParaVer,
  abrirModalAñadir,
  añadirAlCarrito,
  actualizarCantidad,
  eliminarDelCarrito,
  animateFlyToCart
}) {
  const tieneVariantes = p.variantes && p.variantes.length > 0;
  const cartItem = !tieneVariantes ? carrito.find(item => item.productoId === p.id) : null;
  const totalEnCarritoVariants = tieneVariantes ? carrito.filter(item => item.productoId === p.id).reduce((sum, i) => sum + i.cantidad, 0) : 0;
  const tieneStock = tieneVariantes 
    ? p.variantes.some(v => Number(v.stock) > 0)
    : Number(p.stock) > 0;

  const isStep3Highlight = tourStep === 3 && pIndex === 0;
  const isGrayscaleTour = tourStep === 3 && pIndex !== 0;
  const isDemoHighlightedProduct = isAutoDemo && (
    ((autoDemoStep === 3 || autoDemoStep === 4) && p.id === demoProd1?.id) ||
    (autoDemoStep === 6 && (p.id === demoProd1?.id || p.id === demoProd2?.id))
  );

  const activeVarName = selectedColorByProduct[p.id];
  const activeVar = tieneVariantes
    ? (p.variantes.find(v => v.nombre === activeVarName) || p.variantes[0])
    : null;
  const cardFoto = (activeVar?.fotos && activeVar.fotos[0]) || activeVar?.fotoUrl || p.fotoUrl;
  const activeVarCover = (activeVar?.fotos && activeVar.fotos[0]) || activeVar?.fotoUrl;
  const activeVarHex = activeVar ? getHexColor(activeVar.nombre) : null;

  return (
    <div 
      className={`rounded-[24px] overflow-hidden border shadow-sm flex flex-col group hover:shadow-md transition-all ${
        isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-surface-container-low border-outline-variant/20'
      } ${!tieneStock ? 'grayscale opacity-70' : ''} ${
        isGrayscaleTour ? 'grayscale opacity-30 hover:grayscale-0 hover:opacity-90 duration-500 shadow-none border-dashed' : ''
      } ${isDemoHighlightedProduct ? 'demo-highlight' : ''}`}
    >
      {/* Imagen con Aspect Ratio Uniforme (Square 1:1) */}
      <div 
        className={`w-full aspect-square shrink-0 relative overflow-hidden flex items-center justify-center cursor-pointer ${
          isDark ? 'bg-white/5' : 'bg-white/60'
        }`}
        onClick={() => setProductoParaVer(p)}
      >
        {cardFoto ? (
          <img 
            key={cardFoto}
            src={getOptimizedImageUrl(cardFoto, 600)} 
            onError={(e) => { if (e.target.src !== cardFoto) e.target.src = cardFoto; }}
            alt={p.nombre} 
            loading="lazy" 
            decoding="async" 
            className="w-full h-full object-cover group-hover:scale-105 transition-all duration-500" 
          />
        ) : (
          <ProductImagePlaceholder isDark={isDark} iconSize="text-3xl" text="LEIS" />
        )}
      </div>

      {/* DESPLEGABLE REDONDEADO DE COLOR (NO CUADRADO, ESTILO BOUTIQUE) */}
      {tieneVariantes && (
        <div className="relative px-3 pt-2.5 pb-0 z-20">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpenColorDropdownId(openColorDropdownId === p.id ? null : p.id);
            }}
            className={`w-full flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-full border text-[11px] font-bold tracking-wide transition-all shadow-sm cursor-pointer select-none active:scale-95 ${
              isDark 
                ? 'bg-[#181818] border-white/10 hover:border-[#e2bd6c]/50 text-white/90 shadow-black/30' 
                : 'bg-white border-outline-variant/30 hover:border-primary/50 text-on-surface shadow-sm'
            }`}
          >
            <div className="flex items-center gap-1.5 truncate">
              {activeVarCover ? (
                <img src={getOptimizedImageUrl(activeVarCover, 100)} alt={activeVar?.nombre} className="w-4 h-4 rounded-full object-cover border border-white/20 shrink-0" />
              ) : activeVarHex ? (
                <span className="w-3 h-3 rounded-full border border-black/20 shrink-0 shadow-sm" style={{ backgroundColor: activeVarHex }} />
              ) : (
                <span className="material-symbols-outlined text-[13px] text-[#e2bd6c]">palette</span>
              )}
              <span className="truncate">
                Color: <span className={isDark ? 'text-[#e2bd6c] font-black' : 'text-primary font-black'}>{activeVar?.nombre || 'Elegir'}</span>
              </span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0 text-outline">
              <span className={`text-[10px] font-bold ${activeVar && Number(activeVar.stock) <= 0 ? 'text-rose-400' : 'opacity-70'}`}>
                ({activeVar ? Number(activeVar.stock) : 0})
              </span>
              <span className={`material-symbols-outlined text-base transition-transform duration-200 ${openColorDropdownId === p.id ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {/* MENÚ FLOTANTE CON CADA COLOR */}
          {openColorDropdownId === p.id && (
            <>
              <div 
                className="fixed inset-0 z-30" 
                onClick={(e) => { e.stopPropagation(); setOpenColorDropdownId(null); }} 
              />
              <div 
                className={`absolute left-3 right-3 top-full mt-1.5 z-40 rounded-2xl p-1.5 shadow-2xl border backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 max-h-52 overflow-y-auto custom-scrollbar ${
                  isDark ? 'bg-[#181818]/95 border-white/15 shadow-black/80' : 'bg-white/95 border-outline-variant/30 shadow-black/15'
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[9px] font-black uppercase tracking-wider text-outline/80 border-b border-outline-variant/10 mb-1">
                  Colores Disponibles
                </div>
                {p.variantes.map((v, vIdx) => {
                  const isSelected = activeVar?.nombre === v.nombre;
                  const vCover = (v.fotos && v.fotos[0]) || v.fotoUrl;
                  const vHex = getHexColor(v.nombre);
                  const hasStock = Number(v.stock) > 0;

                  return (
                    <button
                      key={vIdx}
                      type="button"
                      onClick={() => {
                        setSelectedColorByProduct(prev => ({ ...prev, [p.id]: v.nombre }));
                        setOpenColorDropdownId(null);
                      }}
                      className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all text-left cursor-pointer ${
                        isSelected 
                          ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 text-primary font-black') 
                          : (isDark ? 'hover:bg-white/5 text-white/80' : 'hover:bg-black/5 text-on-surface')
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {vCover ? (
                          <img src={getOptimizedImageUrl(vCover, 100)} alt={v.nombre} className="w-5 h-5 rounded-full object-cover border border-white/20 shrink-0" />
                        ) : vHex ? (
                          <span className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-sm" style={{ backgroundColor: vHex }} />
                        ) : null}
                        <span className="truncate">{v.nombre}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-md ${
                          hasStock 
                            ? (isDark ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-50 text-emerald-700') 
                            : (isDark ? 'bg-red-500/10 text-red-400' : 'bg-red-50 text-red-600')
                        }`}>
                          {hasStock ? `${v.stock} un.` : 'Agotado'}
                        </span>
                        {isSelected && (
                          <span className="material-symbols-outlined text-sm font-black">check</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
      
      {/* Info */}
      <div className="p-4 flex flex-col flex-1">
        {/* Marca: Reserva de espacio vertical constante (h-4) */}
        <div className="h-4 flex items-center mb-1">
          <p className={`text-[9px] md:text-[10px] font-bold uppercase tracking-widest truncate ${
            isDark ? 'text-[#e2bd6c]/70' : 'text-[#78350f]/60'
          }`}>
            {p.marca || 'LEIS COLLECTION'}
          </p>
        </div>

        {/* Título: Altura fija constante para 2 líneas con font-size optimizado */}
        <h3 
          className={`font-headline font-bold text-xs sm:text-sm md:text-base leading-snug line-clamp-2 h-[2.5rem] md:h-[2.75rem] flex items-start mb-1 cursor-pointer transition-colors ${
            isDark ? 'text-white hover:text-[#e2bd6c]' : 'text-on-surface hover:text-primary'
          }`}
          onClick={() => setProductoParaVer(p)}
          title={toTitleCase(p.nombre)}
        >
          {toTitleCase(p.nombre)}
        </h3>

        {/* Categoría: Truncada a 1 línea */}
        <p className={`text-[10px] md:text-xs uppercase tracking-wider mb-2 truncate ${
          isDark ? 'text-[#e2bd6c]/60' : 'text-outline'
        }`}>
          {(p.coleccion || 'JOYAS').toUpperCase()}
        </p>
        
        {/* Contenedor Inferior: mt-auto para alineación horizontal exacta del precio y botón */}
        <div className="mt-auto pt-2 flex flex-col justify-end">
          <div className="flex items-baseline justify-between mb-2">
            <p className={`font-bold text-base md:text-xl ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
              ${(p.precio || 0).toLocaleString('es-CL')}
            </p>
            {cartItem && (
              <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500 animate-in fade-in">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                En carro ({cartItem.cantidad})
              </span>
            )}
          </div>
          
          {/* BOTÓN O CONTROLES DE ANCHO COMPLETO */}
          {!tieneStock ? (
            <button 
              disabled
              className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-widest opacity-60 cursor-not-allowed ${
                isDark ? 'bg-white/5 border border-white/10 text-gray-400' : 'bg-surface-variant text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-sm">block</span>
              Agotado
            </button>
          ) : tieneVariantes ? (
            <button 
              onClick={() => abrirModalAñadir(p)}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-1.5 shadow-sm hover:scale-[1.02] active:scale-95 transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider cursor-pointer ${
                totalEnCarritoVariants > 0
                  ? (isDark 
                      ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30' 
                      : 'bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100')
                  : (isDark 
                      ? 'border border-[#e2bd6c]/70 text-[#e2bd6c] bg-transparent hover:bg-[#e2bd6c]/10 hover:border-[#e2bd6c]' 
                      : 'border border-primary/60 text-primary bg-transparent hover:bg-primary/10 hover:border-primary')
              } ${isStep3Highlight ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-105' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(142,109,60,0.8)] scale-105') : ''}`}
            >
              <span className="material-symbols-outlined text-sm md:text-base">tune</span>
              <span>Opciones</span>
              {totalEnCarritoVariants > 0 && (
                <span className="ml-auto px-1.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500 text-white shadow-sm flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[10px]">check</span> {totalEnCarritoVariants}
                </span>
              )}
            </button>
          ) : cartItem ? (
            <div className={`w-full flex items-center justify-between p-1 rounded-xl h-10 border transition-all animate-in zoom-in-95 ${
              isDark ? 'bg-white/5 border-[#e2bd6c]/40 text-white' : 'bg-primary/5 border-primary/30 text-primary'
            }`}>
              <button 
                onClick={() => {
                  if (cartItem.cantidad === 1) eliminarDelCarrito(cartItem.idCart);
                  else actualizarCantidad(cartItem.idCart, -1);
                }} 
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  cartItem.cantidad === 1 
                    ? 'hover:bg-red-500/20 text-red-500' 
                    : (isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-primary/10 text-primary')
                }`}
                title={cartItem.cantidad === 1 ? "Quitar del carrito" : "Restar uno"}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {cartItem.cantidad === 1 ? 'delete' : 'remove'}
                </span>
              </button>

              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-emerald-500 font-bold">check_circle</span>
                <span className={`font-extrabold text-xs ${isDark ? 'text-white' : 'text-on-surface'}`}>
                  {cartItem.cantidad} <span className="text-[10px] font-semibold opacity-75">en carro</span>
                </span>
              </div>

              <button 
                onClick={() => actualizarCantidad(cartItem.idCart, 1)} 
                className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                  isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-primary/10 text-primary'
                }`}
                title="Agregar otro"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={(e) => {
                animateFlyToCart(e, p.fotoUrl);
                añadirAlCarrito(p, null);
              }}
              className={`w-full py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 shadow-md hover:scale-[1.02] active:scale-95 transition-all text-[10px] md:text-xs font-bold uppercase tracking-wider cursor-pointer ${
                isDark 
                  ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90 shadow-[#e2bd6c]/20' 
                  : 'bg-primary text-on-primary hover:bg-primary/90 shadow-primary/20'
              } ${isStep3Highlight ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-105' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(142,109,60,0.8)] scale-105') : ''}`}
            >
              <span className="material-symbols-outlined text-sm md:text-base">add_shopping_cart</span>
              <span>Agregar</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
