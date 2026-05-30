import React, { useState, useEffect } from 'react';
import { APP_VERSION, LATEST_CHANGES } from '../config/updates';

export default function UpdateNotification() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const lastVersion = localStorage.getItem('app_version');
    if (lastVersion !== APP_VERSION) {
      // Pequeño delay para que no salga de golpe al cargar
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem('app_version', APP_VERSION);
    setIsOpen(false);
    // Forzar la recarga limpia para asegurar que se rendericen correctamente todas las fuentes e iconos
    window.location.reload();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-500">
      <div className="bg-surface dark:bg-[#121212] w-full max-w-xl rounded-[2.5rem] shadow-2xl border border-outline-variant/20 dark:border-white/10 overflow-hidden animate-in zoom-in-95 duration-500">
        
        {/* Header Decorativo */}
        <div className="relative h-32 bg-primary/10 dark:bg-[#e2bd6c]/5 flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary/50 to-transparent" />
          </div>
          <div className="relative text-center">
            <div className="w-16 h-16 bg-primary dark:bg-[#e2bd6c] rounded-2xl shadow-lg flex items-center justify-center mx-auto mb-2 transform -rotate-3">
              <span className="material-symbols-outlined text-on-primary dark:text-black text-3xl font-bold">new_releases</span>
            </div>
          </div>
        </div>

        <div className="p-8 md:p-10">
          <div className="mb-8">
            <h2 className="font-headline text-3xl font-bold text-on-surface dark:text-white mb-2">¡Aplicación Actualizada!</h2>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 bg-primary/10 dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] rounded-full text-[10px] font-black uppercase tracking-widest border border-primary/20 dark:border-[#e2bd6c]/20">
                Versión {APP_VERSION}
              </span>
              <div className="h-px flex-1 bg-outline-variant/10 dark:bg-white/5" />
            </div>
          </div>

          <div className="space-y-6 mb-10 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
            {LATEST_CHANGES.map((change, idx) => (
              <div key={idx} className="flex gap-5 group">
                <div className="w-12 h-12 bg-surface-container dark:bg-white/5 rounded-2xl flex items-center justify-center shrink-0 border border-outline-variant/10 dark:border-white/5 group-hover:scale-110 transition-transform">
                  <span className="material-symbols-outlined text-primary dark:text-[#e2bd6c] text-xl">{change.icon}</span>
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-on-surface dark:text-white/90">{change.title}</h3>
                  <p className="text-xs text-on-surface-variant dark:text-gray-400 leading-relaxed">{change.description}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={handleClose}
            className="w-full bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black py-4 rounded-2xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
          >
            Comenzar a explorar
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>
      </div>
    </div>
  );
}
