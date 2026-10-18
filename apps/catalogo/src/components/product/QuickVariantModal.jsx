import React from 'react';
import { getOptimizedImageUrl } from '../../utils/image';
import { getHexColor } from '../../utils/colors';

export default function QuickVariantModal({
  isOpen,
  onClose,
  isDark,
  productParaAñadir,
  varianteSeleccionada,
  setVarianteSeleccionada,
  carrito,
  setSelectedColorByProduct,
  animateFlyToCart,
  añadirAlCarrito
}) {
  if (!isOpen || !productParaAñadir) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
        onClick={onClose} 
      />
      <div className={`w-full max-w-sm rounded-[32px] sm:rounded-[32px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col max-h-[90vh] border ${
        isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'
      }`}>
        <div className={`p-6 border-b shrink-0 flex justify-between items-center ${
          isDark ? 'border-white/5 bg-[#151515]' : 'border-outline-variant/10 bg-surface-container-low'
        }`}>
          <h3 className={`font-headline font-bold text-lg pr-4 ${isDark ? 'text-white' : 'text-on-surface'}`}>
            Selecciona una opción
          </h3>
          <button 
            onClick={onClose} 
            className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${
              isDark ? 'bg-white/5 text-gray-400' : 'bg-surface-variant text-outline'
            }`}
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-3 custom-scrollbar">
          <div className={`flex items-center gap-4 mb-4 pb-4 border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
            {(() => {
              const modalFoto = (varianteSeleccionada?.fotos && varianteSeleccionada.fotos[0]) 
                || varianteSeleccionada?.fotoUrl 
                || productParaAñadir.fotoUrl;
              return modalFoto ? (
                <img 
                  key={modalFoto}
                  src={getOptimizedImageUrl(modalFoto, 200)} 
                  alt={productParaAñadir.nombre} 
                  className={`w-16 h-16 rounded-2xl object-cover border transition-all duration-300 shadow-md ${
                    isDark ? 'bg-white/5 border-white/10' : 'bg-surface-variant border-outline-variant/20'
                  }`} 
                />
              ) : null;
            })()}
            <div>
              <p className={`font-bold text-sm leading-tight mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                {productParaAñadir.nombre}
              </p>
              <p className={`font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                ${(productParaAñadir.precio || 0).toLocaleString('es-CL')}
              </p>
              {varianteSeleccionada && (
                <p className={`text-[11px] font-bold mt-0.5 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
                  Color: {varianteSeleccionada.nombre}
                </p>
              )}
            </div>
          </div>

          {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).map((v, i) => {
            const idCartVariante = `${productParaAñadir.id}-${v.nombre}`;
            const inCart = carrito.find(item => item.idCart === idCartVariante);
            const isSelected = varianteSeleccionada?.nombre === v.nombre;
            const vCover = (v.fotos && v.fotos[0]) || v.fotoUrl;
            const vHex = getHexColor(v.nombre);
            
            return (
              <button
                key={i}
                onClick={() => {
                  setVarianteSeleccionada(v);
                  setSelectedColorByProduct(prev => ({ ...prev, [productParaAñadir.id]: v.nombre }));
                }}
                className={`w-full flex justify-between items-center p-3 sm:p-4 rounded-[20px] border-2 transition-all cursor-pointer ${
                  isSelected 
                    ? (isDark ? 'border-[#e2bd6c] bg-[#e2bd6c]/10 shadow-md' : 'border-primary bg-primary/10 shadow-md') 
                    : (isDark ? 'border-white/10 bg-[#151515] hover:border-[#e2bd6c]/30' : 'border-outline-variant/10 bg-surface hover:border-primary/30')
                }`}
              >
                <div className="flex items-center gap-3">
                  {vCover ? (
                    <img src={getOptimizedImageUrl(vCover, 100)} alt={v.nombre} className="w-8 h-8 rounded-full object-cover border border-white/20 shadow-sm shrink-0" />
                  ) : vHex ? (
                    <span className="w-5 h-5 rounded-full border border-black/20 shrink-0 shadow-sm" style={{ backgroundColor: vHex }} />
                  ) : null}
                  <span className={`font-bold text-sm uppercase flex items-center gap-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                    {v.nombre}
                    {inCart && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${
                        isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/20 text-primary'
                      }`}>
                        {inCart.cantidad} en pedido
                      </span>
                    )}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                  isDark ? 'text-[#e2bd6c] bg-[#e2bd6c]/10' : 'text-secondary bg-secondary/10'
                }`}>
                  {v.stock} disp.
                </span>
              </button>
            );
          })}
          
          {productParaAñadir.variantes.filter(v => Number(v.stock) > 0).length === 0 && (
            <p className={`text-center text-sm font-bold py-4 ${isDark ? 'text-red-400' : 'text-error'}`}>
              No hay stock disponible en ninguna variante.
            </p>
          )}
        </div>

        <div className={`p-6 border-t shrink-0 ${isDark ? 'bg-[#151515] border-white/5' : 'bg-surface-container border-outline-variant/10'}`}>
          <button 
            disabled={!varianteSeleccionada}
            onClick={(e) => {
              const photoToFly = (varianteSeleccionada?.fotos && varianteSeleccionada.fotos[0]) 
                || varianteSeleccionada?.fotoUrl 
                || productParaAñadir.fotoUrl;
              animateFlyToCart(e, photoToFly);
              añadirAlCarrito(productParaAñadir, varianteSeleccionada);
            }}
            className={`w-full py-4 rounded-2xl font-bold uppercase tracking-widest text-xs transition-all ${
              varianteSeleccionada 
                ? (isDark ? 'bg-[#e2bd6c] text-black shadow-lg hover:scale-[1.02]' : 'bg-primary text-on-primary shadow-lg hover:scale-[1.02]') 
                : (isDark ? 'bg-white/5 text-gray-500 opacity-50 cursor-not-allowed' : 'bg-surface-variant text-outline opacity-50 cursor-not-allowed')
            }`}
          >
            Añadir al Carrito
          </button>
        </div>
      </div>
    </div>
  );
}
