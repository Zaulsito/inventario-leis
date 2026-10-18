export default function InteractiveMascotTour({
  tourStep,
  setTourStep,
  isDialogMinimized,
  setIsDialogMinimized,
  isDark
}) {
  if (!tourStep || tourStep <= 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[90] flex flex-col items-end gap-3 pointer-events-none max-w-[280px] md:max-w-sm">
      {isDialogMinimized ? (
        <button 
          onClick={() => setIsDialogMinimized(false)}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-full border shadow-lg text-[10px] font-black uppercase tracking-wider animate-pulse transition-all hover:scale-105 active:scale-95 cursor-pointer ${
            isDark 
              ? 'bg-[#e2bd6c] text-black border-[#e2bd6c] shadow-[#e2bd6c]/20' 
              : 'bg-primary text-white border-primary shadow-primary/20'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">visibility</span>
          Mostrar Guía 🐾
        </button>
      ) : (
        /* Globo de diálogo / Speech Bubble */
        <div className={`pointer-events-auto p-5 rounded-[2rem] border shadow-2xl relative animate-in slide-in-from-bottom-5 duration-500 ${isDark ? 'bg-[#151515] border-white/10 text-white shadow-black/80' : 'bg-white border-outline-variant/30 text-on-surface shadow-black/10'}`}>
          {/* Pequeño indicador del triángulo del globo */}
          <div className={`absolute bottom-[-8px] right-8 w-4 h-4 rotate-45 border-r border-b ${isDark ? 'bg-[#151515] border-white/10' : 'bg-white border-outline-variant/30'}`} />
          
          <div className="flex items-center justify-between gap-3 mb-2 pb-2 border-b border-outline-variant/10">
            <span className={`text-[9px] md:text-[10px] font-black uppercase tracking-widest ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>
              Guía Yoshita 🐾
            </span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsDialogMinimized(true)}
                className={`text-[10px] font-bold flex items-center gap-1 hover:underline cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-outline hover:text-on-surface'}`}
                title="Ocultar globo de texto"
              >
                <span className="material-symbols-outlined text-[14px]">visibility_off</span>
                Ocultar
              </button>
              <span className="opacity-30">|</span>
              <button 
                onClick={() => setTourStep(0)}
                className={`text-[10px] font-bold hover:underline cursor-pointer ${isDark ? 'text-gray-400 hover:text-white' : 'text-outline hover:text-on-surface'}`}
              >
                Salir
              </button>
            </div>
          </div>

          <p className="text-[11px] md:text-xs leading-relaxed font-semibold">
            {tourStep === 1 && "🐾 ¡Hola! Miau~ Soy Yoshita 🐾 y te guiaré en este tutorial interactivo para realizar tu pedido. ¡Es súper fácil y rápido! Haz clic en Siguiente para empezar."}
            {tourStep === 2 && "🔍 ¡Paso 2! Aquí a la izquierda tienes la barra de búsqueda y filtros. Puedes escribir nombres (ej. 'Aceite') o filtrar por categoría. También, arriba a la derecha puedes pulsar el icono de usuario 👤 para crear una cuenta o iniciar sesión y guardar tus datos automáticamente."}
            {tourStep === 3 && "🛒 ¡Paso 3! Miau~ Ahora busquemos tu producto favorito (como el 'Aceite Collagen' de abajo) y haz clic en su botón Añadir al Carrito 🛒 para agregarlo."}
            {tourStep === 4 && "🛍️ ¡Paso 4! ¡Miau-tástico! Ya tienes el producto en tu bolso. Ahora, mira arriba a la derecha y haz clic en el botón del Carrito de Compras 🛒."}
            {tourStep === 5 && "📋 ¡Paso 5! Revisa que las cantidades y productos estén perfectos en tu bolsa. Luego, haz clic en el botón dorado Hacer Pedido 🚀 al final."}
            {tourStep === 6 && "📲 ¡Último paso! Escribe tu nombre para el pedido y haz clic en Enviar a WhatsApp 💬. ¡La asesora te confirmará stock al instante!"}
            {tourStep === 7 && "💖 ¡Miau! ¡Completaste el tutorial con éxito! Tu pedido está en camino a WhatsApp. Gracias por preferirnos. 🐾"}
          </p>

          {/* Acciones del Tour */}
          {tourStep < 7 && (
            <div className="mt-3 flex justify-between items-center gap-2">
              {/* Botón Atrás */}
              <button
                disabled={tourStep === 1}
                onClick={() => setTourStep(prev => Math.max(1, prev - 1))}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-30 ${isDark ? 'bg-white/5 text-gray-300 hover:bg-white/10' : 'bg-surface-container-high text-on-surface-variant hover:bg-surface-variant'}`}
              >
                Atrás
              </button>

              {/* Indicador de pasos (6 pasos interactivos) */}
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5, 6].map(stepNum => (
                  <div 
                    key={stepNum} 
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${tourStep === stepNum ? (isDark ? 'bg-[#e2bd6c] w-3.5' : 'bg-[#e2bd6c] w-3.5') : (isDark ? 'bg-white/10' : 'bg-outline-variant/30')}`}
                  />
                ))}
              </div>

              {/* Botón Siguiente */}
              <button
                onClick={() => {
                  if (tourStep < 6) {
                    setTourStep(prev => prev + 1);
                  } else {
                    setTourStep(0);
                  }
                }}
                className={`px-2.5 py-1.5 rounded-lg text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-colors cursor-pointer ${isDark ? 'bg-white/10 hover:bg-white/20 text-[#e2bd6c]' : 'bg-primary/10 hover:bg-primary/20 text-primary'}`}
              >
                {tourStep === 6 ? "Finalizar" : "Siguiente"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Imagen de la Gatita Flotante */}
      <div className="relative pointer-events-auto group">
        {/* Efecto de halo brillante */}
        <div className={`absolute inset-0 rounded-full blur-xl opacity-60 scale-95 group-hover:scale-105 transition-transform duration-500 animate-pulse ${isDark ? 'bg-[#e2bd6c]/20' : 'bg-primary/20'}`} />
        
        <img 
          src="/gatita.png" 
          alt="Gatita Yoshita Mascota" 
          className="w-40 h-40 md:w-56 md:h-56 object-contain relative z-10 drop-shadow-2xl animate-in slide-in-from-right-10 duration-500 hover:scale-110 active:scale-95 transition-transform cursor-pointer"
          onClick={() => {
            alert("🐾 ¡Miau! Soy Yoshita y estoy lista para guiarte en tu compra.");
          }}
        />
      </div>
    </div>
  )
}
