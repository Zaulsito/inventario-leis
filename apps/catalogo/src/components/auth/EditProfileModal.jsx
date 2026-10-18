import React from 'react';

export default function EditProfileModal({
  isOpen,
  onClose,
  isDark,
  editProfileForm,
  setEditProfileForm,
  handleUpdateProfile,
  isEditProfileLoading,
  editProfileError,
  editProfileSuccess,
  onOpenDeleteAccount
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
            Editar Perfil
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
            Mantén tus datos actualizados
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

        <form onSubmit={handleUpdateProfile} className="p-6 space-y-4">
          {editProfileError && (
            <div className="p-4 bg-error/10 border border-error/20 text-error text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              <span>{editProfileError}</span>
            </div>
          )}

          {editProfileSuccess && (
            <div className="p-4 bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 text-[#e2bd6c] text-xs font-bold rounded-2xl animate-in fade-in slide-in-from-top-1 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              <span>{editProfileSuccess}</span>
            </div>
          )}

          {/* Nombre completo */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
              Nombre Completo
            </label>
            <div className="relative">
              <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                person
              </span>
              <input 
                type="text"
                required
                placeholder="Tu nombre completo"
                value={editProfileForm.nombre}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, nombre: e.target.value })}
                className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2bd6c]/50 transition-all border ${
                  isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'
                }`}
              />
            </div>
          </div>

          {/* WhatsApp */}
          <div className="space-y-1.5">
            <label className={`text-[10px] font-bold uppercase tracking-widest block ml-1 ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>
              Número de WhatsApp
            </label>
            <div className="relative">
              <span className={`material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-[20px] ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                phone
              </span>
              <input 
                type="tel"
                required
                placeholder="Ej: 56912345678"
                value={editProfileForm.whatsapp}
                onChange={(e) => setEditProfileForm({ ...editProfileForm, whatsapp: e.target.value })}
                className={`w-full pl-12 pr-4 py-4 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#e2bd6c]/50 transition-all border ${
                  isDark ? 'bg-black/20 border-white/5 text-white' : 'bg-surface-container-low border-outline-variant/30 text-on-surface'
                }`}
              />
            </div>
            <span className={`text-[9px] block ml-1 ${isDark ? 'text-gray-500' : 'text-outline'}`}>
              Formato internacional sin el símbolo "+" (ej: 56912345678).
            </span>
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
              disabled={isEditProfileLoading}
              className={`flex-1 py-4 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${
                isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'
              }`}
            >
              {isEditProfileLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              ) : (
                'Guardar Cambios'
              )}
            </button>
          </div>

          {/* Sección Peligro: Eliminar Cuenta */}
          <div className={`pt-4 border-t flex flex-col items-center ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
            <button 
              type="button"
              onClick={onOpenDeleteAccount}
              className="text-error hover:underline text-[10px] font-extrabold uppercase tracking-widest flex items-center gap-1.5 py-2 px-4 rounded-xl hover:bg-error/10 transition-all duration-300"
            >
              <span className="material-symbols-outlined text-[16px]">delete_forever</span>
              Eliminar Cuenta
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
