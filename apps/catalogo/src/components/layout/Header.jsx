import { useState } from 'react'

export default function Header({
  isDark,
  setIsDark,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  setIsSidebarCollapsed,
  showTutorial,
  setShowTutorial,
  currentUser,
  userData,
  handleLogout,
  onOpenEditProfile,
  onOpenResetPassword,
  setShowAuthModal,
  totalItems,
  setIsCartOpen,
  tourStep,
  isAutoDemo,
  autoDemoStep
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-md px-4 py-4 md:px-8 md:py-6 border-b flex items-center justify-between shrink-0 transition-colors duration-500 ${isDark ? 'bg-[#0c0c0c]/80 border-white/5' : 'bg-white/80 border-outline-variant/20'}`}>
      <div className="flex items-center gap-3">
        {/* Botón de 3 Líneas (Hamburguesa / Toggle de Filtros Lateral) */}
        <button 
          onClick={() => {
            if (window.innerWidth < 768) {
              setIsSidebarOpen(!isSidebarOpen);
            } else {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
          className={`p-3 rounded-2xl transition-all flex items-center gap-2 cursor-pointer font-bold text-xs uppercase tracking-wider ${
            !isSidebarCollapsed
              ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c] border border-[#e2bd6c]/40' : 'bg-primary/10 text-primary border border-primary/30')
              : (isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/5' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant border border-outline-variant/20')
          }`}
          title={isSidebarCollapsed ? "Mostrar Filtros Lateral" : "Ocultar Filtros (Pantalla Completa)"}
        >
          <span className="material-symbols-outlined text-xl">
            {isSidebarCollapsed ? 'menu' : 'menu_open'}
          </span>
          <span className="hidden sm:inline">
            {isSidebarCollapsed ? 'Filtros' : 'Ocultar Filtros'}
          </span>
        </button>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Botón de Apariencia (Modo Oscuro/Claro) */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className={`p-3 rounded-2xl transition-all shrink-0 ${isDark ? 'bg-white/5 text-[#e2bd6c] hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'} ${isAutoDemo && autoDemoStep === 1 ? 'demo-highlight' : ''}`}
          title={isDark ? "Modo Claro" : "Modo Oscuro"}
        >
          <span className="material-symbols-outlined">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Botón de Guía de Compra / Ayuda (Signo de pregunta) */}
        <button 
          onClick={() => {
            setShowTutorial(prev => {
              const newVal = !prev;
              if (!newVal) {
                localStorage.setItem('hide_catalogo_tutorial', 'true');
              } else {
                localStorage.removeItem('hide_catalogo_tutorial');
              }
              return newVal;
            });
          }}
          className={`p-3 rounded-2xl transition-colors shrink-0 ml-1 ${showTutorial ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/20 text-primary') : (isDark ? 'bg-white/5 text-gray-400 hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant')}`}
          title="Guía de Compra / Ayuda"
        >
          <span className="material-symbols-outlined">help</span>
        </button>

        {currentUser ? (
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors cursor-pointer ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] hover:bg-[#e2bd6c]/20' : 'bg-secondary/10 text-secondary hover:bg-secondary/20'}`}
            >
              <span className="font-bold text-sm">{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</span>
            </button>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-[110]" onClick={() => setShowProfileMenu(false)} />
                <div className={`absolute right-0 top-full mt-2 w-48 border rounded-2xl shadow-xl z-[120] py-2 animate-in fade-in slide-in-from-top-2 ${isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-surface-container-lowest border-outline-variant/20'}`}>
                  <div className={`px-4 py-2 border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
                    <p className={`text-xs font-bold truncate ${isDark ? 'text-white' : 'text-on-surface'}`}>{currentUser.displayName}</p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-on-surface-variant'}`}>{currentUser.email}</p>
                  </div>
                  <button 
                    onClick={() => {
                      onOpenEditProfile();
                      setShowProfileMenu(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 border-b cursor-pointer ${isDark ? 'text-white border-white/5 hover:bg-white/5' : 'text-on-surface border-outline-variant/10 hover:bg-surface-variant/20'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">edit</span>
                    Editar Perfil
                  </button>
                  <button 
                    onClick={() => {
                      onOpenResetPassword();
                      setShowProfileMenu(false);
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 border-b cursor-pointer ${isDark ? 'text-white border-white/5 hover:bg-white/5' : 'text-on-surface border-outline-variant/10 hover:bg-surface-variant/20'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">lock_reset</span>
                    Restablecer Contraseña
                  </button>
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className={`w-full text-left px-4 py-3 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${isDark ? 'text-gray-300 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/20'}`}
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    Cerrar Sesión
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button 
            onClick={() => setShowAuthModal(true)}
            className={`p-3 rounded-2xl transition-all shrink-0 cursor-pointer ${isDark ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-surface-container-high text-on-surface hover:bg-surface-variant'} ${tourStep === 2 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-110') : ''}`}
            title="Iniciar Sesión / Crear Cuenta"
          >
            <span className="material-symbols-outlined">person</span>
          </button>
        )}

        <button 
          id="header-cart-btn"
          onClick={() => setIsCartOpen(true)}
          className={`relative p-3 rounded-2xl transition-all shrink-0 ml-1 cursor-pointer ${isDark ? 'bg-[#e2bd6c]/10 text-[#e2bd6c] hover:bg-[#e2bd6c]/20' : 'bg-primary/10 text-primary hover:bg-primary/20'} ${tourStep === 4 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_25px_rgba(226,189,108,0.9)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_25px_rgba(67,56,202,0.9)] scale-110') : ''} ${isAutoDemo && autoDemoStep === 7 ? 'demo-highlight' : ''}`}
        >
          <span className="material-symbols-outlined">shopping_cart</span>
          {totalItems > 0 && (
            <span className="absolute -top-2 -right-2 bg-error text-on-error text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full shadow-md animate-in zoom-in">
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
