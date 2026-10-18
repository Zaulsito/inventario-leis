import React from 'react';
import { getOptimizedImageUrl } from '../../utils/image';
import { ProductImagePlaceholder } from '../common/Indicators';

export default function CartDrawerModal({
  isOpen,
  onClose,
  isDark,
  carrito,
  productos,
  categoriasEnCarrito,
  filtroCartCategory,
  setFiltroCartCategory,
  actualizarCantidad,
  eliminarDelCarrito,
  totalCarrito,
  prepararCheckout,
  tourStep,
  isAutoDemo,
  autoDemoStep
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6 overflow-y-auto bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="fixed inset-0" onClick={onClose} />
      
      <div className={`relative w-full max-w-4xl rounded-[2.5rem] shadow-[0_25px_60px_rgba(0,0,0,0.15)] overflow-hidden flex flex-col font-sans transition-all duration-300 ${
        isDark ? 'bg-[#18181b] text-white border border-white/5 shadow-black/90' : 'bg-[#fbf9f4] text-[#2a1b0a] border border-[#e2bd6c]/20'
      }`}>
        
        {/* Cabecera del Carrito (Diseño Exclusivo Leis con Categorías Dinámicas y Botón de Cerrar) */}
        <div className={`px-6 sm:px-8 py-5 flex flex-wrap items-center justify-between gap-4 border-b shrink-0 ${
          isDark ? 'border-white/5 bg-[#151515]/90' : 'border-[#e2bd6c]/10 bg-[#f4ede1]/30'
        }`}>
          {/* Logo elegante Leis Real */}
          <div className="flex items-center gap-3 select-none">
            <img src="/logo.jpeg" className="w-10 h-10 rounded-full object-cover border border-[#e2bd6c]/30 shadow-md shrink-0" alt="Leis Logo" />
            <div className="flex flex-col">
              <span className="font-headline font-black text-lg leading-none tracking-wide text-[#5d3a28] dark:text-[#e2bd6c]">LEIS</span>
              <span className="text-[7px] font-black tracking-widest text-[#8e6d3c] uppercase mt-0.5 leading-none">JOYERÍA & ACCESORIOS</span>
            </div>
          </div>

          {/* Categorías Dinámicas según productos agregados */}
          <div className="hidden sm:flex items-center gap-6 text-[10px] sm:text-xs font-black uppercase tracking-wider select-none">
            {carrito.length === 0 ? (
              <div className="relative py-1 cursor-default text-[#5d3a28] dark:text-[#e2bd6c]">
                Mi Bolsa
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d3a28] dark:bg-[#e2bd6c]" />
              </div>
            ) : (
              categoriasEnCarrito.map((cat, idx) => {
                const isSelected = filtroCartCategory === cat;
                return (
                  <button 
                    key={idx} 
                    onClick={() => setFiltroCartCategory(cat)}
                    className={`relative py-1 cursor-pointer transition-all hover:opacity-80 font-black uppercase tracking-wider border-none bg-transparent ${
                      isSelected ? 'text-[#5d3a28] dark:text-[#e2bd6c]' : 'text-gray-400 dark:text-gray-500'
                    } ${isAutoDemo && autoDemoStep === 8 ? 'demo-highlight' : ''}`}
                  >
                    {cat}
                    {isSelected && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#5d3a28] dark:bg-[#e2bd6c]" />}
                  </button>
                );
              })
            )}
          </div>

          {/* Controles de la derecha: Botón de cerrar X */}
          <div className="flex items-center gap-3">
            <button 
              onClick={onClose} 
              className={`w-9 h-9 rounded-full flex items-center justify-center transition-all border cursor-pointer ${
                isDark ? 'text-gray-400 border-white/10 hover:bg-white/5 hover:text-white' : 'text-[#5d3a28] border-gray-300 hover:bg-black/5 hover:text-black'
              }`}
              title="Cerrar pestaña"
            >
              <span className="material-symbols-outlined text-sm font-bold">close</span>
            </button>
          </div>
        </div>

        {/* Cuerpo del Carrito (Dividido en dos columnas principales) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8 overflow-y-auto max-h-[75vh]">
          
          {/* Columna Izquierda: Listado de Productos (md:col-span-7) */}
          <div className="md:col-span-7 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b pb-2 select-none">
              <span className="font-headline font-bold text-xs uppercase tracking-widest text-gray-500">Producto</span>
              <div className="flex gap-12 text-xs uppercase tracking-widest text-gray-500">
                <span>Variante</span>
                <span>Cantidad</span>
              </div>
            </div>

            <div className="space-y-3 overflow-y-auto max-h-[350px] pr-1 scrollbar-thin">
              {carrito.length === 0 ? (
                <div className="text-center py-10 opacity-50 flex flex-col items-center justify-center">
                  <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">shopping_bag</span>
                  <p className="text-xs font-bold text-gray-500">Tu carrito está vacío</p>
                </div>
              ) : (
                (() => {
                  const itemsFiltrados = filtroCartCategory === 'TODOS'
                    ? carrito
                    : carrito.filter(item => {
                        const pObj = productos.find(p => p.id === item.productoId);
                        const cat = pObj?.coleccion ? pObj.coleccion.trim().toUpperCase() : 'JOYAS';
                        return cat === filtroCartCategory;
                      });

                  if (itemsFiltrados.length === 0) {
                    return (
                      <div className="text-center py-10 opacity-50 flex flex-col items-center justify-center">
                        <span className="material-symbols-outlined text-4xl text-gray-400 mb-2">filter_alt_off</span>
                        <p className="text-xs font-bold text-gray-500">No hay productos en esta categoría</p>
                      </div>
                    );
                  }

                  return itemsFiltrados.map(item => {
                    // Buscar imagen real del producto
                    const pObj = productos.find(p => p.id === item.productoId);
                    const imgUrl = item.fotoUrl || pObj?.fotoUrl;
                    
                    return (
                      <div key={item.idCart} className={`flex items-center gap-3 p-3 rounded-2xl border transition-all ${
                        isDark ? 'bg-white/5 border-white/10' : 'bg-white border-[#e2bd6c]/15 shadow-[0_2px_8px_rgba(226,189,108,0.05)]'
                      }`}>
                        {/* Miniatura del producto */}
                        <div className={`w-14 h-14 rounded-xl overflow-hidden shrink-0 border ${
                          isDark ? 'border-white/5 bg-white/5' : 'border-[#e2bd6c]/20 bg-white/50'
                        }`}>
                          {imgUrl ? (
                            <img src={getOptimizedImageUrl(imgUrl, 200)} alt={item.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <ProductImagePlaceholder isDark={isDark} iconSize="text-base" showText={false} />
                          )}
                        </div>

                        {/* Info del producto */}
                        <div className="flex-1 min-w-0">
                          <p className={`font-bold text-xs sm:text-sm leading-tight truncate ${
                            isDark ? 'text-white' : 'text-[#2a1b0a]'
                          }`}>{item.nombre}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{item.marca || 'Leis Collection'}</p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className={`text-[11px] font-bold ${
                              isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'
                            }`}>${item.precio.toLocaleString('es-CL')}</span>
                          </div>
                        </div>

                        {/* Selector de cantidad y subtotal */}
                        <div className="flex items-center gap-3 shrink-0">
                          <div className={`flex items-center gap-1.5 rounded-full p-1 border ${
                            isDark ? 'bg-white/5 border-white/10' : 'bg-[#f4ede1] border-[#e2bd6c]/20'
                          }`}>
                            <button 
                              onClick={() => {
                                if(item.cantidad === 1) eliminarDelCarrito(item.idCart);
                                else actualizarCantidad(item.idCart, -1);
                              }} 
                              className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                                isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white/80 text-[#5d3a28]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] font-bold">remove</span>
                            </button>
                            <span className={`w-4 text-center text-[11px] font-black ${
                              isDark ? 'text-white' : 'text-[#2a1b0a]'
                            }`}>{item.cantidad}</span>
                            <button 
                              onClick={() => actualizarCantidad(item.idCart, 1)} 
                              className={`w-5 h-5 flex items-center justify-center rounded-full transition-colors ${
                                isDark ? 'hover:bg-white/10 text-white' : 'hover:bg-white/80 text-[#5d3a28]'
                              }`}
                            >
                              <span className="material-symbols-outlined text-[12px] font-bold">add</span>
                            </button>
                          </div>
                          
                          <span className={`text-[11px] font-black w-14 text-right ${
                            isDark ? 'text-white' : 'text-[#2a1b0a]'
                          }`}>
                            ${(item.precio * item.cantidad).toLocaleString('es-CL')}
                          </span>
                        </div>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Controles del fondo de la columna izquierda */}
            {carrito.length > 0 && (
              <div className="flex flex-col gap-3 mt-2 border-t pt-4">
                {/* Fila de acción compartir */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" defaultChecked className="rounded border-gray-300 dark:border-white/10 text-[#5d3a28] focus:ring-[#5d3a28] w-3.5 h-3.5" />
                    <span className="text-[10px] text-gray-500 font-bold">Acepto los términos de compra de Leis</span>
                  </label>
                  <button className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 ${
                    isDark ? 'bg-white/5 border-white/10 text-white hover:bg-white/10' : 'bg-[#5d3a28]/10 border-[#5d3a28]/20 text-[#5d3a28] hover:bg-[#5d3a28]/15'
                  }`}>
                    <span className="material-symbols-outlined text-[12px]">share</span>
                    Compartir Bolsa
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Columna Derecha: Revisión del Carrito (md:col-span-5) */}
          <div className="md:col-span-5">
            <div className={`p-6 rounded-[2rem] border flex flex-col justify-between h-full min-h-[350px] gap-6 ${
              isDark ? 'bg-[#151515] border-white/5' : 'bg-[#eedec9]/20 border-[#e2bd6c]/30'
            }`}>
              <div className="space-y-4">
                {/* Título de Revisión del Carrito */}
                <h3 className={`font-headline font-bold text-xl ${
                  isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'
                }`}>
                  Revisión del Carrito
                </h3>

                {/* Resumen explicativo (Resumen) */}
                <div className={`rounded-2xl p-4 border text-[10px] sm:text-[11px] leading-relaxed font-semibold ${
                  isDark ? 'bg-white/5 border-white/5 text-gray-300' : 'bg-white border-[#e2bd6c]/20 text-[#2a1b0a]/80 shadow-[0_2px_10px_rgba(226,189,108,0.05)]'
                }`}>
                  <p className={`font-bold mb-1 uppercase tracking-wider ${
                    isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'
                  }`}>Resumen</p>
                  Revisa tu producto en el carrito. Nos aseguramos de empacar cada artículo con el máximo cuidado y amor. La confirmación generará un resumen para que nuestro asesor verifique tu stock al instante.
                </div>

                {/* Desglose de Precios */}
                <div className="space-y-2 pt-2 border-t border-dashed border-gray-300 dark:border-white/10">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-bold">Subtotal de Compra:</span>
                    <span className={`font-mono font-bold ${
                      isDark ? 'text-white' : 'text-[#2a1b0a]'
                    }`}>
                      ${totalCarrito.toLocaleString('es-CL')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fila del Total a Pagar y Botón de Confirmación */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex justify-between items-end">
                  <span className="text-xs uppercase tracking-widest font-black text-gray-400">Total del Pedido:</span>
                  <span className={`font-headline text-2xl font-bold leading-none ${
                    isDark ? 'text-[#e2bd6c]' : 'text-[#5d3a28]'
                  }`}>
                    ${totalCarrito.toLocaleString('es-CL')}
                  </span>
                </div>

                {/* Botón de Confirmación y Puntero de Cursor de la captura */}
                {carrito.length > 0 ? (
                  <div className="relative group/checkout-btn">
                    <button
                      onClick={prepararCheckout}
                      className={`w-full py-4 rounded-2xl font-headline text-sm tracking-widest font-black uppercase shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all flex justify-center items-center gap-2 cursor-pointer ${
                        isDark ? 'bg-[#e2bd6c] text-black shadow-[#e2bd6c]/10 hover:bg-[#ebd59f]' : 'bg-[#5d3a28] text-white shadow-[#5d3a28]/10 hover:bg-[#4a2e20]'
                      } ${tourStep === 5 ? 'ring-4 ring-primary animate-pulse' : ''} ${isAutoDemo && autoDemoStep === 9 ? 'demo-highlight' : ''}`}
                    >
                      Confirmar Pedido
                    </button>
                    
                    {/* Simulación del Puntero de Cursor e Indicador de Toque (como en la captura) */}
                    <div className="absolute -bottom-1 right-[15%] pointer-events-none select-none z-20 flex items-center justify-center">
                      {/* Toque Ripple de onda concéntrica */}
                      <div className="absolute w-12 h-12 bg-[#5d3a28]/15 dark:bg-white/20 border border-white/30 rounded-full animate-ping animate-duration-1000" />
                      <div className="absolute w-8 h-8 bg-white/25 border border-white/40 rounded-full animate-pulse" />
                      
                      {/* Cursor flecha blanca clásica */}
                      <svg className="w-5 h-5 drop-shadow-[0_2px_4px_rgba(0,0,0,0.6)] text-white relative left-1 top-1.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M4 2l16 12-7.5 2 4.5 7.5-3 1.5-4.5-7.5-5.5 5.5v-21z" stroke="black" strokeWidth="1" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <button
                    disabled
                    className="w-full py-4 rounded-2xl font-headline text-sm tracking-widest font-black uppercase bg-gray-500/10 text-gray-500 border border-dashed border-gray-500/20 cursor-not-allowed text-center"
                  >
                    Carrito Vacío
                  </button>
                )}
              </div>
            </div>
          </div>
          
        </div>
        
      </div>
    </div>
  );
}
