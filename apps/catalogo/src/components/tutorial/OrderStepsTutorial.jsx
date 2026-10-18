export default function OrderStepsTutorial({
  isDark,
  setShowTutorial,
  setShowVideoModal,
  setTourStep
}) {
  return (
    <div className={`mb-8 p-6 md:p-8 rounded-[2rem] border relative overflow-hidden transition-all duration-500 animate-in fade-in slide-in-from-top-4 duration-700 ${
      isDark 
        ? 'bg-[#151515]/90 border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]' 
        : 'bg-white/70 border-outline-variant/30 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)]'
    } backdrop-blur-md`}>
      {/* Brillos decorativos */}
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[#e2bd6c]/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      
      {/* Header del tutorial */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className={`font-headline text-lg md:text-2xl font-bold flex items-center gap-2 mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
            <span className="material-symbols-outlined text-[#e2bd6c] animate-bounce">auto_awesome</span>
            ¿Cómo realizar tu pedido?
          </h2>
          <p className={`text-xs md:text-sm ${isDark ? 'text-gray-400' : 'text-outline'}`}>
            Sigue esta sencilla guía de 3 pasos para asegurar tus productos favoritos al instante.
          </p>
        </div>
        <button 
          onClick={() => {
            setShowTutorial(false);
            localStorage.setItem('hide_catalogo_tutorial', 'true');
          }}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer ${
            isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-surface-variant text-outline hover:text-on-surface'
          }`}
          title="Ocultar Guía"
        >
          <span className="material-symbols-outlined text-lg">close</span>
        </button>
      </div>

      {/* Grid de 3 pasos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* Paso 1 */}
        <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${
          isDark ? 'bg-white/5 border-white/5 hover:border-[#e2bd6c]/30' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
            isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <span className="material-symbols-outlined font-bold">add_shopping_cart</span>
          </div>
          <div>
            <h3 className={`font-bold text-xs md:text-sm uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
              1. Agrega al Carrito
            </h3>
            <p className={`text-[11px] md:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-outline'}`}>
              Explora el catálogo, elige tus productos o variantes ideales y haz clic en **Añadir al Carrito**.
            </p>
          </div>
        </div>

        {/* Paso 2 */}
        <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${
          isDark ? 'bg-white/5 border-white/5 hover:border-[#e2bd6c]/30' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
            isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <span className="material-symbols-outlined font-bold">receipt_long</span>
          </div>
          <div>
            <h3 className={`font-bold text-xs md:text-sm uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
              2. Confirma tu Carro
            </h3>
            <p className={`text-[11px] md:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-outline'}`}>
              Abre tu bolsa de compras arriba a la derecha, revisa tus cantidades y pulsa **Confirmar Pedido**.
            </p>
          </div>
        </div>

        {/* Paso 3 */}
        <div className={`p-5 rounded-2xl border transition-all hover:scale-[1.02] flex gap-4 ${
          isDark ? 'bg-white/5 border-white/5 hover:border-[#e2bd6c]/30' : 'bg-surface-container-lowest border-outline-variant/20 hover:border-primary/30'
        }`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${
            isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'
          }`}>
            <span className="material-symbols-outlined font-bold">chat</span>
          </div>
          <div>
            <h3 className={`font-bold text-xs md:text-sm uppercase tracking-wider mb-1 ${isDark ? 'text-white' : 'text-on-surface'}`}>
              3. Envía por WhatsApp
            </h3>
            <p className={`text-[11px] md:text-xs leading-relaxed ${isDark ? 'text-gray-400' : 'text-outline'}`}>
              Se generará un mensaje automático. Envíalo a la asesora para **confirmar stock al instante** y coordinar el pago.
            </p>
          </div>
        </div>
      </div>

      {/* Botones de acción del tutorial */}
      <div className="mt-6 flex flex-col sm:flex-row justify-center items-center gap-3">
        <button
          onClick={() => setShowVideoModal(true)}
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 shadow-lg cursor-pointer ${
            isDark ? 'bg-[#e2bd6c] text-black shadow-[#e2bd6c]/20' : 'bg-primary text-on-primary shadow-primary/20'
          }`}
        >
          <span className="material-symbols-outlined text-sm">smart_display</span>
          Ver Video Tutorial 🎬
        </button>

        <button
          onClick={() => setTourStep(1)}
          className={`w-full sm:w-auto px-6 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-widest transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-2 border cursor-pointer ${
            isDark 
              ? 'border-[#e2bd6c]/30 text-[#e2bd6c] hover:bg-[#e2bd6c]/10 bg-[#e2bd6c]/10 shadow-md shadow-[#e2bd6c]/10' 
              : 'border-primary/30 text-primary hover:bg-primary/5 bg-primary/10 shadow-sm'
          }`}
        >
          <span className="material-symbols-outlined text-sm animate-pulse">play_circle</span>
          Iniciar viaje de prueba 🐾
        </button>
      </div>
    </div>
  )
}
