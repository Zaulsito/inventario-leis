import React from 'react';

export default function ResetPasswordModal({
  isOpen,
  onClose,
  isDark,
  currentUser,
  handleSendResetEmailLoggedIn,
  isResetEmailLoading,
  resetEmailError,
  resetEmailSuccess
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${
        isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'
      }`}>
        
        {/* Header */}
        <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
          <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
            Restablecer Contraseña
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
            Enviar enlace de recuperación
          </p>
          <button 
            type="button"
            onClick={onClose}
            className={`absolute top-4 right-4 w-10 h-10 flex items-center justify-center rounded-full transition-colors ${
              isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-variant/50 text-on-surface hover:bg-surface-variant'
            }`}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className={`p-4 rounded-2xl flex gap-3 items-start ${
            isDark ? 'bg-white/5 border border-white/10' : 'bg-surface-container border border-outline-variant/30'
          }`}>
            <span className={`material-symbols-outlined shrink-0 mt-0.5 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>info</span>
            <div className="space-y-1">
              <p className={`text-xs font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>Verificación de Correo</p>
              <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Se enviará un correo con un enlace seguro para restablecer tu contraseña a tu dirección registrada:
              </p>
              <p className={`text-xs font-black truncate mt-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
                {currentUser?.email}
              </p>
            </div>
          </div>

          {resetEmailError && (
            <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{resetEmailError}</span>
            </div>
          )}

          {resetEmailSuccess && (
            <div className="p-4 bg-green-500/10 border border-green-500/20 text-green-600 dark:text-green-400 text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{resetEmailSuccess}</span>
            </div>
          )}

          <div className="pt-4 flex gap-3">
            <button 
              type="button"
              onClick={onClose}
              className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-colors border ${
                isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'
              }`}
            >
              Cancelar
            </button>
            <button 
              type="button"
              onClick={handleSendResetEmailLoggedIn}
              disabled={isResetEmailLoading}
              className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${
                isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'
              }`}
            >
              {isResetEmailLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Enviar Correo'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
