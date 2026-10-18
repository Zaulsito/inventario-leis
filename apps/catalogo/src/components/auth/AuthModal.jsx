import React from 'react';

export default function AuthModal({
  isOpen,
  onClose,
  isDark,
  authTab,
  setAuthTab,
  authForm,
  setAuthForm,
  handleAuthSubmit,
  isAuthLoading,
  authError,
  setAuthError,
  authSuccess,
  setAuthSuccess,
  forgotEmail,
  setForgotEmail,
  handleSendResetEmailForgot,
  isResetEmailLoading,
  resetEmailError,
  setResetEmailError,
  resetEmailSuccess,
  setResetEmailSuccess,
  isAutoDemo,
  autoDemoStep
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[150] flex items-center justify-center p-4">
      <div className={`w-full max-w-md rounded-3xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-200 border ${
        isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'
      } ${isAutoDemo && autoDemoStep === 11 ? 'demo-highlight' : ''}`}>
        
        {/* Header del Modal */}
        <div className={`p-6 text-center relative border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
          <h3 className={`font-headline text-2xl font-black italic ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
            {authTab === 'login' ? 'Iniciar Sesión' : authTab === 'register' ? 'Crear Cuenta' : 'Recuperar Contraseña'}
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mt-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
            {authTab === 'login' ? 'Bienvenido de vuelta' : authTab === 'register' ? 'Únete a nosotros' : 'Restablece tus credenciales'}
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

        {authTab !== 'forgot' ? (
          <>
            {/* Pestañas */}
            <div className={`flex border-b ${isDark ? 'border-white/5' : 'border-outline-variant/10'}`}>
              <button
                type="button"
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                  authTab === 'login' 
                    ? (isDark ? 'text-[#e2bd6c] border-b-2 border-[#e2bd6c]' : 'text-primary border-b-2 border-primary') 
                    : (isDark ? 'text-gray-400 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/30')
                }`}
                onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); }}
              >
                Ingresar
              </button>
              <button
                type="button"
                className={`flex-1 py-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                  authTab === 'register' 
                    ? (isDark ? 'text-[#e2bd6c] border-b-2 border-[#e2bd6c]' : 'text-primary border-b-2 border-primary') 
                    : (isDark ? 'text-gray-400 hover:bg-white/5' : 'text-on-surface-variant hover:bg-surface-variant/30')
                }`}
                onClick={() => { setAuthTab('register'); setAuthError(''); setAuthSuccess(''); }}
              >
                Registrarse
              </button>
            </div>

            {/* Formulario de Login/Registro */}
            <form onSubmit={handleAuthSubmit} className="p-6 space-y-4" autoComplete="off">
              {/* Dummy fields to divert Chrome autofill away from real inputs */}
              <input type="text" name="chrome-username-dummy" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} autoComplete="username" />
              <input type="password" name="chrome-password-dummy" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} autoComplete="new-password" />

              {authTab === 'register' && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    Nombre Completo
                  </label>
                  <input 
                    type="text" 
                    autoComplete="new-name"
                    value={authForm.nombre}
                    onChange={e => setAuthForm({...authForm, nombre: e.target.value})}
                    required
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${
                      isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'
                    }`}
                    placeholder="Ej. Juan Pérez"
                  />
                </div>
              )}
              
              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                  Correo Electrónico
                </label>
                <input 
                  type="email" 
                  autoComplete="new-email"
                  value={authForm.email}
                  onChange={e => setAuthForm({...authForm, email: e.target.value})}
                  required
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${
                    isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'
                  }`}
                  placeholder="tu@correo.com"
                />
              </div>

              {authTab === 'register' && (
                <div>
                  <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    Número de WhatsApp
                  </label>
                  <input 
                    type="tel" 
                    autoComplete="new-whatsapp"
                    value={authForm.whatsapp}
                    onChange={e => setAuthForm({...authForm, whatsapp: e.target.value})}
                    required
                    className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${
                      isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'
                    }`}
                    placeholder="+56 9 1234 5678"
                  />
                  <p className={`text-[10px] mt-1 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                    Se usará para autocompletar tus pedidos.
                  </p>
                </div>
              )}

              <div>
                <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                  Contraseña
                </label>
                {/* Decoy credentials for Chrome password manager */}
                <input type="text" name="chrome_username_decoy" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} autoComplete="username" />
                <input type="password" name="chrome_password_decoy" style={{ position: 'absolute', left: '-9999px', width: '1px', height: '1px', opacity: 0 }} autoComplete="current-password" />
                <input 
                  type="password" 
                  autoComplete="new-password"
                  value={authForm.password}
                  onChange={e => setAuthForm({...authForm, password: e.target.value})}
                  required
                  minLength={6}
                  className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${
                    isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'
                  }`}
                  placeholder="••••••"
                />
                {authTab === 'login' && (
                  <div className="text-right mt-1.5">
                    <button 
                      type="button"
                      onClick={() => { setAuthTab('forgot'); setAuthError(''); setAuthSuccess(''); setResetEmailSuccess(''); setResetEmailError(''); }}
                      className={`text-[10px] font-extrabold uppercase tracking-wider transition-colors ${
                        isDark ? 'text-gray-400 hover:text-[#e2bd6c]' : 'text-outline hover:text-primary'
                      }`}
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </div>
                )}
              </div>

              {authError && (
                <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-xs font-bold text-center border border-error/20">
                  {authError}
                </div>
              )}

              {authSuccess && (
                <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-xs font-bold text-center border border-green-500/20 animate-in fade-in">
                  {authSuccess}
                </div>
              )}

              <div className="pt-2">
                <button 
                  type="submit"
                  disabled={isAuthLoading}
                  className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${
                    isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'
                  }`}
                >
                  {isAuthLoading ? (
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  ) : (
                    authTab === 'login' ? 'Iniciar Sesión' : 'Crear Cuenta'
                  )}
                </button>
              </div>

              <div className="text-center pt-2">
                <button 
                  type="button"
                  onClick={onClose}
                  className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                    isDark ? 'text-gray-400 hover:text-[#e2bd6c]' : 'text-outline hover:text-on-surface'
                  }`}
                >
                  Continuar como invitado
                </button>
              </div>
            </form>
          </>
        ) : (
          /* Formulario de Recuperación de Contraseña */
          <form onSubmit={handleSendResetEmailForgot} className="p-6 space-y-4">
            <div className={`p-4 rounded-2xl flex gap-3 items-start ${
              isDark ? 'bg-white/5 border border-white/10' : 'bg-surface-container border border-outline-variant/30'
            }`}>
              <span className={`material-symbols-outlined shrink-0 mt-0.5 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>mail</span>
              <p className={`text-[10px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
                Ingresa tu correo electrónico a continuación. Si la cuenta existe, te enviaremos un enlace seguro para restablecer tu contraseña.
              </p>
            </div>

            <div>
              <label className={`block text-[10px] font-bold uppercase tracking-widest mb-1.5 ml-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                Correo Electrónico
              </label>
              <input 
                type="email" 
                value={forgotEmail}
                onChange={e => setForgotEmail(e.target.value)}
                required
                className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none font-medium ${
                  isDark ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-white' : 'bg-surface-container border-outline-variant/30 focus:border-primary text-on-surface'
                }`}
                placeholder="tu@correo.com"
              />
            </div>

            {resetEmailError && (
              <div className="bg-error/10 text-error px-4 py-3 rounded-xl text-xs font-bold text-center border border-error/20">
                {resetEmailError}
              </div>
            )}

            {resetEmailSuccess && (
              <div className="bg-green-500/10 text-green-600 dark:text-green-400 px-4 py-3 rounded-xl text-xs font-bold text-center border border-green-500/20 animate-in fade-in">
                {resetEmailSuccess}
              </div>
            )}

            <div className="pt-2 space-y-3">
              <button 
                type="submit"
                disabled={isResetEmailLoading}
                className={`w-full py-4 rounded-2xl font-bold text-sm uppercase tracking-widest transition-all shadow-md disabled:opacity-50 flex items-center justify-center ${
                  isDark ? 'bg-[#e2bd6c] text-black hover:bg-[#e2bd6c]/90' : 'bg-primary text-on-primary hover:bg-primary/90'
                }`}
              >
                {isResetEmailLoading ? (
                  <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                ) : (
                  'Enviar Enlace'
                )}
              </button>

              <button 
                type="button"
                onClick={() => { setAuthTab('login'); setAuthError(''); setAuthSuccess(''); setResetEmailSuccess(''); setResetEmailError(''); }}
                className={`w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider transition-colors border ${
                  isDark ? 'bg-transparent border-white/10 text-white hover:bg-white/5' : 'bg-transparent border-outline-variant text-on-surface hover:bg-surface-variant/30'
                }`}
              >
                Volver a Iniciar Sesión
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
