import React from 'react';

export default function ImageViewerModal({
  isOpen,
  onClose,
  fotosProducto,
  indexImagenActual,
  mostrarControlesZoom,
  anteriorImagen,
  siguienteImagen,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  animacion,
  position,
  scale,
  setScale,
  resetZoom
}) {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-2xl p-4 md:p-12 animate-in fade-in duration-300"
      onClick={onClose}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* BOTÓN CERRAR */}
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 md:top-12 md:right-12 text-white/40 hover:text-white transition-colors z-[210] p-4 cursor-pointer"
      >
        <span className="material-symbols-outlined text-5xl">close</span>
      </button>

      {/* FLECHAS DE NAVEGACIÓN EN ZOOM (AUTO-OCULTABLES) */}
      {fotosProducto.length > 1 && mostrarControlesZoom && (
        <>
          <button 
            onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
            className="absolute left-4 md:left-12 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[210] backdrop-blur-md animate-in fade-in slide-in-from-left duration-300 cursor-pointer"
          >
            <span className="material-symbols-outlined text-4xl">chevron_left</span>
          </button>
          <button 
            onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
            className="absolute right-4 md:right-12 top-1/2 -translate-y-1/2 w-16 h-16 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-all z-[210] backdrop-blur-md animate-in fade-in slide-in-from-right duration-300 cursor-pointer"
          >
            <span className="material-symbols-outlined text-4xl">chevron_right</span>
          </button>
        </>
      )}

      <div 
        className={`relative z-[205] max-w-full max-h-full transition-transform duration-500 ease-out ${animacion}`}
        style={{ 
          transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
          touchAction: 'none'
        }}
        onDoubleClick={() => scale > 1 ? resetZoom() : setScale(2.5)}
      >
        <img 
          key={fotosProducto[indexImagenActual]}
          src={fotosProducto[indexImagenActual]} 
          className="max-w-full max-h-[90vh] object-contain rounded-xl shadow-2xl select-none pointer-events-none" 
          alt="Imagen ampliada"
        />
        {/* INDICADOR NUMÉRICO EN ZOOM (Solo si no hay zoom aplicado) */}
        {fotosProducto.length > 1 && scale === 1 && (
          <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 bg-white/10 text-white/60 px-4 py-1.5 rounded-full text-xs font-black tracking-widest backdrop-blur-md border border-white/10">
            {indexImagenActual + 1} / {fotosProducto.length}
          </div>
        )}
      </div>

      {/* BOTÓN RESET ZOOM (Solo aparece si hay zoom) */}
      {scale > 1 && (
        <button 
          onClick={(e) => { e.stopPropagation(); resetZoom(); }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-primary text-on-primary px-6 py-3 rounded-full font-bold shadow-2xl z-[220] flex items-center gap-2 animate-in slide-in-from-bottom cursor-pointer"
        >
          <span className="material-symbols-outlined">zoom_out</span>
          <span>Resetear Zoom</span>
        </button>
      )}
    </div>
  );
}
