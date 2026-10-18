import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getOptimizedImageUrl } from '../../utils/image';

export default function BeforeAfterSlider({ imgBefore, imgAfter, isDark, nombreProducto }) {
  const [sliderPos, setSliderPos] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef(null);

  const handleMove = useCallback((clientX) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const pct = Math.max(0, Math.min(100, (x / rect.width) * 100));
    setSliderPos(pct);
  }, []);

  const handleTouchMove = (e) => {
    if (e.touches && e.touches[0]) {
      handleMove(e.touches[0].clientX);
    }
  };

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging) handleMove(e.clientX);
    };
    const onMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isDragging, handleMove]);

  return (
    <div 
      ref={containerRef}
      className={`relative z-10 w-full max-w-full h-[55vh] md:h-[65vh] rounded-[40px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-8 select-none cursor-ew-resize flex items-center justify-center animate-in fade-in zoom-in-95 duration-300 ${
        isDark ? 'border-[#1e1e1e] bg-black/40' : 'border-white bg-white'
      }`}
      onMouseDown={(e) => {
        setIsDragging(true);
        handleMove(e.clientX);
      }}
      onTouchStart={(e) => {
        setIsDragging(true);
        if (e.touches && e.touches[0]) handleMove(e.touches[0].clientX);
      }}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDragging(false)}
    >
      {/* IMAGEN BASE: DESPUÉS (DERECHA) */}
      <img 
        src={getOptimizedImageUrl(imgAfter, 900)} 
        alt={`${nombreProducto} - Después`} 
        className="w-full h-full object-contain pointer-events-none select-none"
      />

      {/* IMAGEN RECORTADA: ANTES (IZQUIERDA) */}
      <div 
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
      >
        <img 
          src={getOptimizedImageUrl(imgBefore, 900)} 
          alt={`${nombreProducto} - Antes`} 
          className="w-full h-full object-contain pointer-events-none select-none"
        />
      </div>

      {/* LÍNEA DIVISORIA Y CONTROL DESLIZABLE */}
      <div 
        className="absolute top-0 bottom-0 z-20 w-1 bg-white/90 shadow-[0_0_15px_rgba(0,0,0,0.7)] pointer-events-none"
        style={{ left: `${sliderPos}%` }}
      >
        <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-11 h-11 rounded-full shadow-2xl flex items-center justify-center transition-transform active:scale-110 border-2 ${
          isDark ? 'bg-[#1e1e1e] border-[#e2bd6c] text-[#e2bd6c]' : 'bg-white border-primary text-primary'
        }`}>
          <div className="flex items-center gap-0.5 text-xs font-black">
            <span className="material-symbols-outlined text-[16px]">chevron_left</span>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
          </div>
        </div>
      </div>

      {/* ETIQUETAS ANTES Y DESPUÉS */}
      <div className="absolute top-4 left-4 z-20 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/70 text-white backdrop-blur-md shadow-md border border-white/20 pointer-events-none">
        Antes
      </div>
      <div className="absolute top-4 right-4 z-20 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e2bd6c] text-black backdrop-blur-md shadow-md font-black pointer-events-none">
        Después
      </div>

      {/* SUGERENCIA INFERIOR */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-black/60 text-white/90 backdrop-blur-md shadow pointer-events-none flex items-center gap-1.5 border border-white/10">
        <span className="material-symbols-outlined text-[13px] text-[#e2bd6c]">drag_indicator</span>
        <span>Desliza para comparar</span>
      </div>
    </div>
  );
}
