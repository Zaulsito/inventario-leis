import React from 'react';

export default function DeleteAccountModal({
  isOpen,
  onClose,
  isDark,
  deletePassword,
  setDeletePassword,
  handleDeleteAccount,
  isDeleteAccountLoading,
  deleteAccountError,
  deleteAccountSuccess
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${
        isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'
      }`}>
        
        {/* Header */}
        <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
          <h3 className="font-headline text-2xl font-black italic text-error">
            Eliminar Cuenta
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
            Esta acción es irreversible
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

        <form onSubmit={handleDeleteAccount} className="p-6 space-y-4" autoComplete="off">
          <div className="p-4 bg-error/5 border border-error/20 rounded-2xl flex gap-3 items-start">
            <span className="material-symbols-outlined text-error shrink-0 mt-0.5">warning</span>
            <div className="space-y-1">
              <p className="text-xs font-bold text-error">Advertencia de Seguridad</p>
              <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Al eliminar tu cuenta, todos tus datos de perfil, historial de carrito y acceso serán borrados de forma permanente.
              </p>
            </div>
          </div>

          {deleteAccountError && (
            <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{deleteAccountError}</span>
            </div>
          )}

          {deleteAccountSuccess && (
            <div className="p-4 bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 text-[#e2bd6c] text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{deleteAccountSuccess}</span>
            </div>
          )}

          {/* Confirmación con Contraseña */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
              Contraseña Actual
            </label>
            <div className="relative">
              <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                lock
              </span>
              <input 
                type="password" 
                required
                autoComplete="new-password"
                placeholder="Introduce tu contraseña para confirmar"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-error/50 transition-all border ${
                  isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'
                }`}
              />
            </div>
          </div>

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
              type="submit"
              disabled={isDeleteAccountLoading}
              className="flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center bg-error text-on-error hover:bg-error-container/80"
            >
              {isDeleteAccountLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Eliminar permanentemente'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
