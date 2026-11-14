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
  autoDemoStep,
  onScrollToTop
}) {
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  const handleScrollToTop = () => {
    if (onScrollToTop) {
      onScrollToTop();
    } else {
      const mainEl = document.querySelector('main');
      if (mainEl) {
        mainEl.scrollTo({ top: 0, behavior: 'smooth' });
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <header className={`sticky top-0 z-30 backdrop-blur-xl px-3.5 py-3 md:px-8 md:py-3.5 border-b flex items-center justify-between shrink-0 transition-colors duration-500 ${
      isDark ? 'bg-[#101010]/85 border-white/10 shadow-black/40' : 'bg-white/85 border-outline-variant/25 shadow-black/[0.03]'
    }`}>
      {/* ── LADO IZQUIERDO: TOGGLE FILTROS ── */}
      <div className="flex items-center gap-3 shrink-0">
        <button 
          onClick={() => {
            if (window.innerWidth < 768) {
              setIsSidebarOpen(!isSidebarOpen);
            } else {
              setIsSidebarCollapsed(!isSidebarCollapsed);
            }
          }}
          className={`px-3.5 py-2 rounded-full transition-all flex items-center gap-2 cursor-pointer font-black text-xs uppercase tracking-wider active:scale-95 border ${
            !isSidebarCollapsed
              ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c] border-[#e2bd6c]/40 shadow-sm' : 'bg-primary/10 text-primary border-primary/30 shadow-sm')
              : (isDark ? 'bg-[#181818] text-gray-300 hover:text-white hover:bg-white/10 border-white/10' : 'bg-white text-on-surface hover:text-primary hover:border-primary/40 border-outline-variant/35 shadow-xs')
          }`}
          title={isSidebarCollapsed ? "Mostrar Filtros Lateral" : "Ocultar Filtros (Pantalla Completa)"}
        >
          <span className="material-symbols-outlined text-[19px]">
            {isSidebarCollapsed ? 'menu' : 'menu_open'}
          </span>
          <span className="hidden sm:inline">
            {isSidebarCollapsed ? 'Filtros' : 'Ocultar'}
          </span>
        </button>
      </div>

      {/* ── CENTRO: IDENTIDAD DE MARCA / LOGO LEIS ── */}
      <div 
        onClick={handleScrollToTop}
        className="flex items-center gap-2.5 cursor-pointer select-none group px-2 py-1 rounded-2xl hover:opacity-90 transition-all active:scale-95"
        title="Volver al inicio"
      >
        <img 
          src="/logo.jpeg" 
          alt="Leis Logo" 
          className="w-9 h-9 md:w-10 md:h-10 rounded-full object-cover border border-[#e2bd6c]/40 shadow-sm group-hover:scale-105 transition-transform duration-300 shrink-0" 
        />
        <div className="flex flex-col text-left">
          <span className="font-headline font-black text-lg md:text-xl leading-none tracking-[0.12em] text-[#5d3a28] dark:text-[#e2bd6c]">
            LEIS
          </span>
          <span className="text-[7px] md:text-[8px] font-black tracking-[0.25em] text-[#8e6d3c] dark:text-[#e2bd6c]/80 uppercase mt-0.5 leading-none">
            JOYERÍA & COSMÉTICA
          </span>
        </div>
      </div>

      {/* ── LADO DERECHO: ACCIONES Y BOLSA DE COMPRAS ── */}
      <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
        {/* Botón de Apariencia (Modo Oscuro/Claro) */}
        <button 
          onClick={() => setIsDark(!isDark)}
          className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 border ${
            isDark 
              ? 'bg-[#181818] border-white/10 text-[#e2bd6c] hover:bg-white/10' 
              : 'bg-white border-outline-variant/35 text-on-surface hover:text-primary hover:border-primary/40 shadow-xs'
          } ${isAutoDemo && autoDemoStep === 1 ? 'demo-highlight' : ''}`}
          title={isDark ? "Cambiar a Modo Claro" : "Cambiar a Modo Oscuro"}
        >
          <span className="material-symbols-outlined text-[19px] transition-transform duration-300 hover:rotate-45">
            {isDark ? 'light_mode' : 'dark_mode'}
          </span>
        </button>

        {/* Botón de Guía de Compra / Ayuda */}
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
          className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 border ${
            showTutorial 
              ? (isDark ? 'bg-[#e2bd6c]/20 text-[#e2bd6c] border-[#e2bd6c]/40' : 'bg-primary/20 text-primary border-primary/30') 
              : (isDark ? 'bg-[#181818] border-white/10 text-gray-400 hover:text-white hover:bg-white/10' : 'bg-white border-outline-variant/35 text-on-surface hover:text-primary hover:border-primary/40 shadow-xs')
          }`}
          title="Guía de Compra / Ayuda"
        >
          <span className="material-symbols-outlined text-[19px]">help</span>
        </button>

        {/* Perfil de Usuario / Login */}
        {currentUser ? (
          <div className="relative">
            <button 
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 border ${
                isDark ? 'bg-[#e2bd6c]/15 text-[#e2bd6c] border-[#e2bd6c]/40 hover:bg-[#e2bd6c]/25' : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 shadow-xs'
              }`}
            >
              <span className="font-black text-xs md:text-sm">{currentUser.displayName ? currentUser.displayName.charAt(0).toUpperCase() : 'U'}</span>
            </button>
            {showProfileMenu && (
              <>
                <div className="fixed inset-0 z-[110]" onClick={() => setShowProfileMenu(false)} />
                <div className={`absolute right-0 top-full mt-2 w-52 border rounded-2xl shadow-2xl z-[120] p-1.5 backdrop-blur-xl animate-in fade-in slide-in-from-top-2 duration-200 ${
                  isDark ? 'bg-[#1e1e1e]/95 border-white/10 text-white shadow-black/80' : 'bg-white/95 border-outline-variant/25 text-on-surface shadow-black/15'
                }`}>
                  <div className={`px-3.5 py-2.5 border-b mb-1 ${isDark ? 'border-white/10' : 'border-outline-variant/10'}`}>
                    <p className={`text-xs font-black truncate ${isDark ? 'text-white' : 'text-on-surface'}`}>{currentUser.displayName}</p>
                    <p className={`text-[10px] truncate ${isDark ? 'text-gray-400' : 'text-outline'}`}>{currentUser.email}</p>
                  </div>
                  <button 
                    onClick={() => {
                      onOpenEditProfile();
                      setShowProfileMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                      isDark ? 'text-white hover:bg-white/10' : 'text-on-surface hover:bg-black/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">edit</span>
                    Editar Perfil
                  </button>
                  <button 
                    onClick={() => {
                      onOpenResetPassword();
                      setShowProfileMenu(false);
                    }}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer ${
                      isDark ? 'text-white hover:bg-white/10' : 'text-on-surface hover:bg-black/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[17px]">lock_reset</span>
                    Restablecer Contraseña
                  </button>
                  <button 
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className={`w-full text-left px-3.5 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer text-red-500 hover:bg-red-500/10 mt-1`}
                  >
                    <span className="material-symbols-outlined text-[17px]">logout</span>
                    Cerrar Sesión
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <button 
            onClick={() => setShowAuthModal(true)}
            className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 border ${
              isDark ? 'bg-[#181818] border-white/10 text-white hover:bg-white/10' : 'bg-white border-outline-variant/35 text-on-surface hover:text-primary hover:border-primary/40 shadow-xs'
            } ${tourStep === 2 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_20px_rgba(226,189,108,0.8)] scale-110' : 'ring-4 ring-primary animate-pulse shadow-[0_0_20px_rgba(67,56,202,0.8)] scale-110') : ''}`}
            title="Iniciar Sesión / Crear Cuenta"
          >
            <span className="material-symbols-outlined text-[19px]">person</span>
          </button>
        )}

        {/* ── BOTÓN BOLSA DE COMPRAS / CARRITO ── */}
        <button 
          id="header-cart-btn"
          onClick={() => setIsCartOpen(true)}
          className={`relative px-3 py-2 md:px-4 md:py-2 rounded-full transition-all flex items-center gap-2 cursor-pointer active:scale-95 border shadow-sm ${
            isDark 
              ? 'bg-[#181818] hover:bg-[#202020] text-[#e2bd6c] border-[#e2bd6c]/30 hover:border-[#e2bd6c]' 
              : 'bg-white hover:bg-surface-container-low text-primary border-primary/30 hover:border-primary'
          } ${tourStep === 4 ? (isDark ? 'ring-4 ring-[#e2bd6c] animate-pulse shadow-[0_0_25px_rgba(226,189,108,0.9)] scale-105' : 'ring-4 ring-primary animate-pulse shadow-[0_0_25px_rgba(67,56,202,0.9)] scale-105') : ''} ${isAutoDemo && autoDemoStep === 7 ? 'demo-highlight' : ''}`}
        >
          <span className="material-symbols-outlined text-[19px]">shopping_bag</span>
          <span className="hidden sm:inline text-xs font-black uppercase tracking-wider">Mi Bolsa</span>
          {totalItems > 0 && (
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black shadow-xs flex items-center justify-center ${
              isDark ? 'bg-[#e2bd6c] text-black' : 'bg-primary text-white'
            }`}>
              {totalItems}
            </span>
          )}
        </button>
      </div>
    </header>
  )
}
