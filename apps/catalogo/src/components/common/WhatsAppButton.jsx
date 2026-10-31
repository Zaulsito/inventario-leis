import React, { useState, useEffect } from 'react';

export default function WhatsAppButton({
  phoneNumber = "56973000390",
  isDark = false
}) {
  const [showTooltip, setShowTooltip] = useState(() => {
    try {
      return sessionStorage.getItem('leis_wa_tooltip_closed') !== 'true';
    } catch {
      return true;
    }
  });

  const handleCloseTooltip = (e) => {
    e.stopPropagation();
    setShowTooltip(false);
    try {
      sessionStorage.setItem('leis_wa_tooltip_closed', 'true');
    } catch {}
  };

  const defaultMessage = encodeURIComponent("¡Hola! Estoy viendo el catálogo de Leis Joyas & Cosmética y quisiera hacer una consulta.");
  const waUrl = `https://wa.me/${phoneNumber}?text=${defaultMessage}`;

  return (
    <div className="fixed bottom-6 right-5 md:bottom-8 md:right-8 z-30 flex items-center select-none pointer-events-auto">
      {/* ── GLOBO DE TEXTO / TOOLTIP FLOTANTE A LA IZQUIERDA ── */}
      {showTooltip && (
        <div 
          onClick={() => window.open(waUrl, '_blank')}
          className={`relative mr-3 px-4 py-3 rounded-2xl shadow-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-95 animate-in fade-in slide-in-from-right-3 max-w-[210px] sm:max-w-xs ${
            isDark 
              ? 'bg-[#181818] border-white/10 text-white shadow-black/60' 
              : 'bg-white border-gray-100 text-gray-900 shadow-xl'
          }`}
        >
          {/* Botón Cerrar '✕' */}
          <button
            type="button"
            onClick={handleCloseTooltip}
            className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-md border transition-all cursor-pointer ${
              isDark 
                ? 'bg-[#222] border-white/20 text-gray-300 hover:text-white hover:bg-[#333]' 
                : 'bg-white border-gray-200 text-gray-500 hover:text-black hover:bg-gray-100'
            }`}
            title="Cerrar mensaje"
            aria-label="Cerrar mensaje"
          >
            ✕
          </button>

          <p className="text-xs sm:text-sm font-semibold leading-snug pr-1">
            Envíanos un mensaje de WhatsApp
          </p>

          {/* Flecha hacia el botón */}
          <div 
            className={`absolute top-1/2 -right-2 -translate-y-1/2 w-0 h-0 border-y-8 border-y-transparent border-l-8 ${
              isDark ? 'border-l-[#181818]' : 'border-l-white'
            }`}
          />
        </div>
      )}

      {/* ── BOTÓN FLOTANTE CIRCULAR VERDE OFICIAL DE WHATSAPP ── */}
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-[#25D366] hover:bg-[#20ba5a] text-white flex items-center justify-center shadow-[0_4px_25px_rgba(37,211,102,0.5)] hover:shadow-[0_6px_30px_rgba(37,211,102,0.7)] transition-all duration-300 hover:scale-110 active:scale-95 shrink-0 group"
      >
        <svg 
          viewBox="0 0 32 32" 
          className="w-8 h-8 md:w-9 md:h-9 fill-current transition-transform duration-300 group-hover:rotate-6"
        >
          <path d="M16.002 2.667C8.64 2.667 2.667 8.64 2.667 16c0 2.48.675 4.805 1.854 6.805L2.667 29.333l6.732-1.764A13.256 13.256 0 0 0 16.002 29.333c7.36 0 13.333-5.973 13.333-13.333 0-7.36-5.973-13.333-13.333-13.333zm7.747 18.773c-.32.907-1.587 1.667-2.587 1.893-.68.147-1.573.28-4.573-.96-3.827-1.587-6.293-5.507-6.48-5.76-.187-.253-1.547-2.067-1.547-3.947 0-1.88.987-2.8 1.333-3.187.347-.387.76-.48 1.013-.48.253 0 .507.003.733.013.24.013.56-.093.88.667.333.787 1.133 2.76 1.227 2.96.093.2.16.44.027.707-.133.267-.2.427-.4.667-.2.24-.413.533-.587.72-.2.2-.413.413-.173.827.24.413 1.067 1.76 2.307 2.867 1.587 1.413 2.933 1.853 3.347 2.067.413.2.667.173.907-.107.24-.28.1.04-.373.533-.76.16-.24.32-.493.48-.733.16-.24.32-.2.48-.133.16.067 1.027.48 2.027.973 1 .493 1.667.813 1.907.973.24.16.36.4.28 1.013z"/>
        </svg>
      </a>
    </div>
  );
}
