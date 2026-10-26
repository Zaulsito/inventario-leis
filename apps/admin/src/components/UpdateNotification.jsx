import React, { useState, useEffect } from 'react';
import { APP_VERSION, RELEASE_DATE, LATEST_CHANGES } from '../config/updates';

export default function UpdateNotification() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion !== APP_VERSION) {
      // Apertura inmediata tras iniciar sesión o actualizar
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('app_version', APP_VERSION);
    setIsOpen(false);
  };

  const handleOpenProfileNotes = () => {
    localStorage.setItem('app_version', APP_VERSION);
    setIsOpen(false);
    // Notificar a Layout para abrir el Centro de Usuario directamente en la pestaña Novedades
    window.dispatchEvent(new CustomEvent('open-user-profile-tab', { detail: { tab: 2 } }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-300">
      <div className="bg-surface dark:bg-[#121212] w-full max-w-2xl rounded-[2.5rem] shadow-2xl border border-outline-variant/20 dark:border-white/10 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-300">
        
        {/* Header Decorativo Luxe */}
        <div className="relative py-7 px-8 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent dark:from-[#e2bd6c]/15 dark:via-[#e2bd6c]/5 dark:to-transparent border-b border-outline-variant/10 dark:border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-primary dark:bg-[#e2bd6c] rounded-2xl shadow-lg flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-on-primary dark:text-black text-2xl font-bold">new_releases</span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 bg-primary/20 dark:bg-[#e2bd6c]/20 text-primary dark:text-[#e2bd6c] rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/30 dark:border-[#e2bd6c]/30">
                  Versión {APP_VERSION}
                </span>
                <span className="text-[10px] text-outline dark:text-gray-400 font-bold tracking-wider">
                  • {RELEASE_DATE}
                </span>
              </div>
              <h2 className="font-headline text-2xl md:text-3xl font-bold text-on-surface dark:text-white leading-tight">
                ¡Novedades de la Actualización!
              </h2>
            </div>
          </div>
          <button 
            onClick={handleClose}
            className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant dark:text-gray-400 hover:text-error hover:bg-surface-variant/30 transition-all"
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Lista de Cambios Detallados */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-5 custom-scrollbar">
          {LATEST_CHANGES.map((change, idx) => (
            <div 
              key={idx} 
              className="p-5 rounded-2xl bg-surface-container-low dark:bg-white/[0.03] border border-outline-variant/10 dark:border-white/5 space-y-3 hover:border-primary/30 dark:hover:border-[#e2bd6c]/30 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                  <span className="material-symbols-outlined text-xl">{change.icon}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-primary dark:text-[#e2bd6c] bg-primary/10 dark:bg-[#e2bd6c]/10 px-2 py-0.5 rounded-md">
                      {change.tag}
                    </span>
                    <h3 className="font-bold text-sm md:text-base text-on-surface dark:text-white">
                      {change.title}
                    </h3>
                  </div>
                  <p className="text-xs text-on-surface-variant dark:text-gray-300 font-medium leading-relaxed">
                    {change.summary}
                  </p>
                </div>
              </div>

              {change.details && change.details.length > 0 && (
                <ul className="pl-14 space-y-1.5 pt-1 text-[11px] text-outline dark:text-gray-400 list-disc list-inside">
                  {change.details.map((detail, dIdx) => (
                    <li key={dIdx} className="leading-relaxed">
                      <span className="text-on-surface/90 dark:text-gray-200">{detail}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Botones de Pie */}
        <div className="p-6 bg-surface-container-lowest dark:bg-[#121212] border-t border-outline-variant/10 dark:border-white/5 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleOpenProfileNotes}
            className="flex-1 py-3.5 px-5 border border-primary/40 dark:border-[#e2bd6c]/40 text-primary dark:text-[#e2bd6c] hover:bg-primary/5 dark:hover:bg-[#e2bd6c]/5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-sm">person</span>
            Consultar siempre en Mi Perfil
          </button>
          <button
            onClick={handleClose}
            className="flex-1 py-3.5 px-6 bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black rounded-2xl font-bold text-xs uppercase tracking-[0.15em] shadow-lg hover:scale-[1.01] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            <span>Entendido y Continuar</span>
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

      </div>
    </div>
  );
}
