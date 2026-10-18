export default function AutoDemoScreens({
  isDark,
  isAutoDemo,
  showDemoIntro,
  showDemoOutro,
  outroText,
  showOutroLeis,
  pointerStyle,
  pointerType,
  autoDemoCaption,
  autoDemoProgress
}) {
  return (
    <>
      {/* ── DEMO INTRO SCREEN OVERLAY (ESTRELLA FUGAZ - MODO CLARO) ── */}
      {showDemoIntro && (
        <div className="fixed inset-0 z-[250] bg-gradient-to-br from-[#fdfaf5] via-[#fdfbfa] to-[#ebdcb9] flex flex-col items-center justify-center overflow-hidden animate-out fade-out zoom-out-95 duration-700 delay-[2800ms]">
          {/* Subtle sparkling background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,189,108,0.12)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="relative flex flex-col items-center justify-center p-6 text-center select-none transform transition-transform duration-[3s] scale-95 animate-in zoom-in-95 duration-500">
            {/* Logo Container with star-sweep effect - perfectly circular and larger */}
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-[#e2bd6c]/50 shadow-[0_10px_40px_rgba(226,189,108,0.2)] relative bg-white/95 flex items-center justify-center star-sweep-effect animate-slow-breath">
              <img 
                src="/logo.jpeg" 
                alt="Logo Leis" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            
            {/* Glowing Aura under the logo */}
            <div className="absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-r from-[#e2bd6c] to-[#ebdcb9] opacity-40 blur-3xl -z-10 animate-pulse" />

            {/* Premium Slogan */}
            <div className="mt-8 space-y-2 animate-in slide-in-from-bottom-5 duration-700 delay-300">
              <h1 className="font-headline text-2xl sm:text-3xl font-black tracking-[0.3em] uppercase select-none drop-shadow-[0_0_20px_rgba(226,189,108,0.3)] flex items-center justify-center pl-[0.3em] min-h-[36px] sm:min-h-[44px]">
                {"LEIS".split("").map((letter, idx) => (
                  <span 
                    key={idx}
                    className="text-transparent bg-clip-text bg-gradient-to-r from-[#be9440] via-[#e2bd6c] to-[#be9440] inline-block animate-intro-letter text-glow-shine"
                    style={{ animationDelay: `${idx * 0.08}s` }}
                  >
                    {letter}
                  </span>
                ))}
              </h1>
              <p className="text-[9px] sm:text-[11px] font-bold tracking-[0.25em] text-[#5d3a28]/70 uppercase">
                Tu éxito está en nuestros productos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── DEMO OUTRO SCREEN OVERLAY (FINAL DE LUJO - MODO CLARO) ── */}
      {showDemoOutro && (
        <div className="fixed inset-0 z-[250] bg-gradient-to-br from-[#fdfaf5] via-[#fdfbfa] to-[#ebdcb9] flex flex-col items-center justify-center overflow-hidden animate-in fade-in duration-700">
          {/* Subtle sparkling background */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(226,189,108,0.12)_0%,transparent_70%)] pointer-events-none" />

          <div className="relative flex flex-col items-center justify-center p-6 text-center select-none transform transition-all duration-[3s] scale-100 animate-in zoom-in-95 duration-500">
            {/* Logo Container with star-sweep effect */}
            <div className="w-56 h-56 sm:w-72 sm:h-72 rounded-full overflow-hidden border border-[#e2bd6c]/50 shadow-[0_10px_40px_rgba(226,189,108,0.2)] relative bg-white/95 flex items-center justify-center star-sweep-effect animate-slow-breath">
              <img 
                src="/logo.jpeg" 
                alt="Logo Leis" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            
            {/* Glowing Aura under the logo */}
            <div className="absolute w-56 h-56 sm:w-72 sm:h-72 rounded-full bg-gradient-to-r from-[#e2bd6c] to-[#ebdcb9] opacity-40 blur-3xl -z-10 animate-pulse" />

            {/* Slogan with Shiny, Typewriter and Glowing Effect */}
            <div className="mt-10 space-y-4">
              <p className="min-h-[24px] text-xs sm:text-sm font-bold tracking-[0.25em] uppercase text-[#5d3a28]/70 drop-shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition-all duration-300">
                {outroText}
                <span className="animate-ping duration-300 text-[#e2bd6c]">|</span>
              </p>
              
              {showOutroLeis && (
                <h1 className="font-headline text-3xl sm:text-5xl font-black tracking-[0.3em] uppercase select-none drop-shadow-[0_0_20px_rgba(226,189,108,0.4)] flex items-center justify-center pl-[0.3em]">
                  {"LEIS".split("").map((letter, idx) => (
                    <span 
                      key={idx}
                      className="text-transparent bg-clip-text bg-gradient-to-r from-[#be9440] via-[#e2bd6c] to-[#be9440] inline-block animate-outro-letter text-glow-shine"
                      style={{ animationDelay: `${idx * 0.18}s` }}
                    >
                      {letter}
                    </span>
                  ))}
                </h1>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── DYNAMIC DEMO POINTER ARROW ── */}
      {isAutoDemo && pointerStyle.display !== 'none' && (
        <div style={pointerStyle}>
          {pointerType === 'left' ? (
            <svg width="55" height="24" viewBox="0 0 55 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-point-left drop-shadow-[0_0_12px_rgba(226,189,108,0.7)]">
              <defs>
                <linearGradient id="gold-grad-left" x1="100%" y1="50%" x2="0%" y2="50%">
                  <stop offset="0%" stopColor="#9a7629" />
                  <stop offset="50%" stopColor="#e2bd6c" />
                  <stop offset="100%" stopColor="#fff2cc" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="12" r="3" fill="url(#gold-grad-left)" />
              <path d="M47 12H5" stroke="url(#gold-grad-left)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M13 4L4.5 12.5L13 21" stroke="url(#gold-grad-left)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg width="55" height="24" viewBox="0 0 55 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="animate-point-right drop-shadow-[0_0_12px_rgba(226,189,108,0.7)]">
              <defs>
                <linearGradient id="gold-grad-right" x1="0%" y1="50%" x2="100%" y2="50%">
                  <stop offset="0%" stopColor="#9a7629" />
                  <stop offset="50%" stopColor="#e2bd6c" />
                  <stop offset="100%" stopColor="#fff2cc" />
                </linearGradient>
              </defs>
              <circle cx="5" cy="12" r="3" fill="url(#gold-grad-right)" />
              <path d="M8 12H50" stroke="url(#gold-grad-right)" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M42 4L50.5 12.5L42 21" stroke="url(#gold-grad-right)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      )}

      {/* ── AUTOMATED DEMO FLOATING SUBTITLES BANNER ── */}
      {isAutoDemo && !showDemoIntro && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] w-full max-w-xl px-4 animate-in slide-in-from-top-5 duration-300 pointer-events-none">
          {/* Mascot Leis (Gatita Yoshita) floating to the left, outside the card (desktop only) */}
          <div className="absolute -left-24 top-1/2 -translate-y-1/2 pointer-events-auto select-none hidden sm:block">
            <div className="relative group">
              <div className="absolute inset-0 rounded-full blur-md opacity-40 bg-[#e2bd6c]/30 scale-75 group-hover:scale-100 transition-transform duration-500 animate-pulse animate-duration-1000" />
              <img 
                src="/gatita.png" 
                alt="Mascota Leis" 
                className="w-20 h-20 object-contain relative z-10 drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)] animate-smooth-float"
                title="Leis 🐾"
              />
            </div>
          </div>

          <div className={`p-4 rounded-[24px] border shadow-2xl backdrop-blur-md flex flex-col gap-3 relative overflow-hidden pointer-events-auto ${
            isDark 
              ? 'bg-[#151515]/95 border-[#e2bd6c]/30 text-white shadow-black/85' 
              : 'bg-white/95 border-primary/20 text-on-surface shadow-black/20'
          }`}>
            {/* Mascot and Subtitle Caption */}
            <div className="flex items-center gap-3">
              {/* Mascot Leis (Gatita Yoshita) inside ONLY for mobile */}
              <div className="relative shrink-0 select-none sm:hidden">
                <div className="absolute inset-0 rounded-full blur-sm opacity-50 bg-[#e2bd6c]/20" />
                <img 
                  src="/gatita.png" 
                  alt="Mascota Leis" 
                  className="w-12 h-12 object-contain relative z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] animate-smooth-float"
                  title="Leis 🐾"
                />
              </div>
              <div className="flex-1">
                <p className="text-[10px] font-black tracking-widest uppercase mb-0.5 opacity-60 text-[#e2bd6c]">
                  Leis 🐾
                </p>
                <p className="text-[11px] sm:text-xs leading-relaxed font-bold italic">
                  "{autoDemoCaption}"
                </p>
              </div>
            </div>

            {/* Progress Bar (Hidden Detener button, stop with key P) */}
            <div className="flex items-center justify-between gap-4 mt-1">
              <div className="flex-1 h-1 bg-outline-variant/20 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-100 ease-linear ${isDark ? 'bg-[#e2bd6c]' : 'bg-primary'}`}
                  style={{ width: `${autoDemoProgress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
