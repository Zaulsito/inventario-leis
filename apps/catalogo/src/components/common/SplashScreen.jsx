import React, { useState, useEffect } from 'react'

export default function SplashScreen({
  isDark = true,
  title = "LEIS COLLECTION",
  subtitle = "Joyería en Plata 925 & Cosmética",
  logoSrc = null,
  duration = 2000,
  isLoading = false,
  onFinish = null
}) {
  const [isExiting, setIsExiting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [minTimeElapsed, setMinTimeElapsed] = useState(false)

  const activeLogo = logoSrc || (isDark ? "/logo-dark.png" : "/logo.jpeg")

  // Control del tiempo mínimo y barra de progreso
  useEffect(() => {
    const timerProgress = setTimeout(() => {
      setProgress(isLoading ? 85 : 100)
    }, 50)

    const timerMin = setTimeout(() => {
      setMinTimeElapsed(true)
    }, Math.max(duration - 400, 800))

    return () => {
      clearTimeout(timerProgress)
      clearTimeout(timerMin)
    }
  }, [duration])

  // Desvanecimiento suave cuando termina la carga y el tiempo mínimo
  useEffect(() => {
    if (minTimeElapsed && !isLoading && !isExiting) {
      setProgress(100)
      setIsExiting(true)
      const t = setTimeout(() => {
        if (onFinish) onFinish()
      }, 500)
      return () => clearTimeout(t)
    }
  }, [minTimeElapsed, isLoading, isExiting, onFinish])

  const handleSkip = () => {
    if (isLoading) return // Esperar a que al menos carguen los datos
    setIsExiting(true)
    setTimeout(() => {
      if (onFinish) onFinish()
    }, 300)
  }

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[99999] flex flex-col items-center justify-center select-none cursor-pointer overflow-hidden transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] ${
        isExiting
          ? 'opacity-0 scale-105 pointer-events-none'
          : 'opacity-100 scale-100 pointer-events-auto'
      } ${
        isDark
          ? 'bg-[#0a0a0a] text-white'
          : 'bg-[#faf7f2] text-[#2a1b0a]'
      }`}
    >
      {/* ── HALOS DE LUZ AMBIENTAL (GLOW DORADO) ── */}
      <div className="absolute w-96 h-96 rounded-full bg-[#e2bd6c]/15 blur-[120px] pointer-events-none animate-pulse duration-1000" />
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full bg-[#d4ab55]/10 blur-[100px] pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-80 h-80 rounded-full bg-[#e2bd6c]/10 blur-[100px] pointer-events-none" />

      {/* ── CONTENIDO CENTRAL CON ANIMACIONES ESCALONADAS ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 max-w-sm">
        
        {/* CONTENEDOR DEL LOGO CON MARCO Y SOMBRA RADIANTE */}
        <div className="relative mb-6 group">
          {/* Halo decorativo exterior */}
          <div className="absolute -inset-2 rounded-[2.2rem] bg-gradient-to-tr from-[#e2bd6c]/40 via-[#e2bd6c]/10 to-transparent blur-md opacity-75 animate-pulse" />
          
          <div className={`relative w-28 h-28 md:w-32 md:h-32 rounded-[2.2rem] p-3 border shadow-2xl flex items-center justify-center backdrop-blur-xl transition-transform duration-700 hover:scale-105 ${
            isDark
              ? 'bg-[#151515]/90 border-[#e2bd6c]/40 shadow-[0_0_40px_rgba(226,189,108,0.25)]'
              : 'bg-white/95 border-[#e2bd6c]/50 shadow-[0_0_35px_rgba(226,189,108,0.3)]'
          }`}>
            <img
              src={activeLogo}
              alt="Logo Leis"
              className="w-full h-full object-contain rounded-[1.8rem] animate-in zoom-in-75 fade-in duration-700 ease-out"
            />

            {/* Efecto Shimmer (Destello de luz diagonal) */}
            <div className="absolute inset-0 rounded-[1.8rem] overflow-hidden pointer-events-none">
              <div className="absolute -inset-full bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-45 animate-[shimmer_2s_infinite]" />
            </div>
          </div>
        </div>

        {/* TIPOGRAFÍA DE MARCA */}
        <div className="space-y-1.5 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-200 fill-mode-forwards">
          <h1 className={`font-headline text-2xl md:text-3xl font-black italic tracking-[0.25em] uppercase ${
            isDark ? 'text-[#e2bd6c]' : 'text-[#785427]'
          }`}>
            {title}
          </h1>
          <p className={`text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] ${
            isDark ? 'text-gray-300' : 'text-[#5d3a28]/80'
          }`}>
            {subtitle}
          </p>
        </div>

        {/* BARRA DE PROGRESO DORADA MINIMALISTA */}
        <div className="w-48 mt-8 space-y-2 animate-in fade-in duration-700 delay-300">
          <div className={`w-full h-1 rounded-full overflow-hidden ${
            isDark ? 'bg-white/10' : 'bg-black/10'
          }`}>
            <div
              className="h-full bg-gradient-to-r from-[#e2bd6c] via-[#f7d98d] to-[#d4ab55] rounded-full transition-all duration-[1700ms] ease-out shadow-[0_0_10px_rgba(226,189,108,0.8)]"
              style={{ width: `${progress}%` }}
            />
          </div>
          
          <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-gray-400 font-bold px-0.5">
            <span className="flex items-center gap-1">
              <span className="inline-block w-1 h-1 rounded-full bg-[#e2bd6c] animate-ping" />
              Cargando
            </span>
            <span className="text-[8px] text-gray-500 hover:text-gray-300 transition-colors">
              Toca para omitir
            </span>
          </div>
        </div>

      </div>

      {/* ESTILO PERSONALIZADO PARA ANIMACIÓN SHIMMER */}
      <style>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%) rotate(45deg); }
          100% { transform: translateX(200%) rotate(45deg); }
        }
      `}</style>
    </div>
  )
}
