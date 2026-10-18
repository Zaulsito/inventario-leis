import React from 'react';

export default function CheckoutModal({
  isOpen,
  onClose,
  isDark,
  currentUser,
  clienteNombre,
  setClienteNombre,
  onEnviarPedido,
  onOpenAuth,
  isAutoDemo,
  autoDemoStep,
  tourStep
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
        onClick={onClose} 
      />
      <div className={`w-full max-w-sm rounded-[32px] shadow-2xl relative z-10 p-8 text-center animate-in zoom-in-95 duration-300 border ${
        isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'
      }`}>
        <div className="w-16 h-16 bg-[#25D366]/10 text-[#25D366] rounded-2xl flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-3xl">chat</span>
        </div>
        <h3 className={`font-headline font-bold text-xl mb-2 ${isDark ? 'text-white' : 'text-on-surface'}`}>
          Confirmar Pedido
        </h3>
        
        {currentUser ? (
          <p className={`text-sm mb-6 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
            Enviaremos tu pedido a nuestro WhatsApp.<br/>
            <span className={`text-[10px] uppercase font-bold ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
              Sesión iniciada como {currentUser.displayName}
            </span>
          </p>
        ) : (
          <div className="mb-6">
            <p className={`text-sm mb-2 ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
              Ingresa tu nombre para enviar el detalle de tu pedido directamente por WhatsApp.
            </p>
            <button 
              type="button"
              onClick={onOpenAuth} 
              className={`text-xs font-bold hover:underline ${isDark ? 'text-[#e2bd6c]' : 'text-primary'} ${
                isAutoDemo && autoDemoStep === 11 ? 'demo-highlight' : ''
              }`}
            >
              ¿Tienes cuenta? Inicia sesión aquí
            </button>
          </div>
        )}
        
        <form 
          onSubmit={(e) => { 
            e.preventDefault(); 
            onEnviarPedido(); 
          }} 
          autoComplete="off" 
          className="w-full"
        >
          {/* Dummy input to decoy Chrome's autocompletion away from the main input */}
          <input type="text" name="chrome-name-decoy" style={{ display: 'none' }} autoComplete="off" />
          <input 
            type="text"
            autoFocus
            autoComplete="new-name"
            value={clienteNombre}
            onChange={(e) => setClienteNombre(e.target.value)}
            placeholder="Tu nombre y apellido..."
            className={`w-full border-2 px-5 py-4 rounded-2xl text-center font-bold outline-none transition-all mb-6 ${
              isDark 
                ? 'bg-white/5 border-white/10 focus:border-[#e2bd6c] text-[#e2bd6c]' 
                : 'bg-surface-container-low border-primary/20 focus:border-primary text-primary'
            } ${isAutoDemo && autoDemoStep === 10 ? 'demo-highlight' : ''}`}
          />

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className={`flex-1 py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider transition-colors ${
                isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'
              }`}
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className={`flex-[2] bg-[#25D366] text-white py-3 rounded-2xl font-bold text-[11px] uppercase tracking-wider shadow-lg hover:scale-105 active:scale-95 transition-all flex justify-center items-center gap-2 ${
                tourStep === 6 ? 'ring-4 ring-[#25D366] animate-pulse shadow-[0_0_25px_rgba(37,211,102,0.9)] scale-105' : ''
              }`}
            >
              Enviar a WhatsApp
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
