import React from 'react';

export const PulsingRing = ({ className, style }) => (
  <div className={`absolute pointer-events-none z-40 flex items-center justify-center ${className || ''}`} style={style}>
    <span className="absolute inline-flex h-full w-full rounded-full bg-current opacity-75 animate-ping" />
    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-current shadow-lg border border-white" />
  </div>
);

export const GlowingHighlight = ({ className, style }) => (
  <div className={`absolute pointer-events-none z-30 rounded-lg bg-current/10 border-2 border-current/40 animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.5)] ${className || ''}`} style={style} />
);

export const FloatingArrow = ({ className, style, direction = 'down' }) => {
  const iconMap = {
    down: 'arrow_downward',
    left: 'arrow_back',
    right: 'arrow_forward',
    up: 'arrow_upward',
    diagonal: 'south_west'
  };
  return (
    <div className={`absolute pointer-events-none z-50 text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] animate-bounce ${className || ''}`} style={style}>
      <span className="material-symbols-outlined text-2xl font-black text-[#e2bd6c]">
        {iconMap[direction]}
      </span>
    </div>
  );
};

// Placeholder elegante para productos sin imagen
export const ProductImagePlaceholder = ({ className = "w-full h-full", iconSize = "text-3xl", showText = true, isDark = true, text = "LEIS" }) => (
  <div className={`relative overflow-hidden flex flex-col items-center justify-center select-none ${
    isDark 
      ? 'bg-gradient-to-br from-[#1e1c18] via-[#141414] to-[#0f0e0d] text-[#e2bd6c]/50 border border-[#e2bd6c]/15 shadow-inner' 
      : 'bg-gradient-to-br from-[#fdfbf7] via-[#f5efe4] to-[#ebe1d1] text-[#785427]/60 border border-[#e2bd6c]/30 shadow-inner'
  } ${className}`}>
    <div className={`absolute inset-0 pointer-events-none ${
      isDark 
        ? 'bg-[radial-gradient(circle_at_center,rgba(226,189,108,0.12)_0%,transparent_75%)]' 
        : 'bg-[radial-gradient(circle_at_center,rgba(226,189,108,0.25)_0%,transparent_75%)]'
    }`} />
    <div className={`absolute inset-1.5 rounded-[inherit] pointer-events-none border ${
      isDark ? 'border-[#e2bd6c]/10' : 'border-[#785427]/15'
    }`} />
    <div className="flex flex-col items-center justify-center gap-1 z-10 p-2 text-center transition-transform duration-300 group-hover:scale-105">
      <span className={`material-symbols-outlined ${iconSize} ${
        isDark ? 'text-[#e2bd6c]/70' : 'text-[#785427]/80'
      } drop-shadow-sm`}>
        auto_awesome
      </span>
      {showText && (
        <span className={`font-headline italic font-black uppercase tracking-[0.25em] text-[9px] sm:text-[10px] ${
          isDark ? 'text-[#e2bd6c]/70' : 'text-[#785427]/80'
        }`}>
          {text}
        </span>
      )}
    </div>
  </div>
);
