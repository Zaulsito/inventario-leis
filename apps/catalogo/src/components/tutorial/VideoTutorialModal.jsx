import React, { useState, useRef, useEffect } from 'react';

export default function VideoTutorialModal({ isOpen, onClose, isDark }) {
  const videoRef = useRef(null);
  const simulatorRef = useRef(null);
  const [videoIsPlaying, setVideoIsPlaying] = useState(false);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(25);
  const [videoIsMuted, setVideoIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const formatVideoTime = (seconds) => {
    const secs = Math.floor(seconds || 0);
    return `0:${secs < 10 ? '0' : ''}${secs}`;
  };

  const toggleFullscreen = () => {
    if (!simulatorRef.current) return;
    
    if (!document.fullscreenElement && 
        !document.webkitFullscreenElement && 
        !document.mozFullScreenElement && 
        !document.msFullscreenElement) {
      const req = simulatorRef.current.requestFullscreen || 
                  simulatorRef.current.webkitRequestFullscreen || 
                  simulatorRef.current.mozRequestFullScreen || 
                  simulatorRef.current.msRequestFullscreen;
      if (req) {
        req.call(simulatorRef.current).catch(err => {
          console.error("Error entering fullscreen:", err);
        });
      }
    } else {
      const exit = document.exitFullscreen || 
                   document.webkitExitFullscreen || 
                   document.mozCancelFullScreen || 
                   document.msExitFullscreen;
      if (exit) {
        exit.call(document);
      }
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFull = !!(
        document.fullscreenElement || 
        document.webkitFullscreenElement || 
        document.mozFullScreenElement || 
        document.msFullscreenElement
      );
      setIsFullscreen(isCurrentlyFull);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Controlar la reproducción del video al abrir/cerrar el modal
  useEffect(() => {
    if (isOpen) {
      const playTimer = setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.play().catch((err) => {
            console.log("El navegador bloqueó el autoplay", err);
          });
        }
      }, 150);
      return () => clearTimeout(playTimer);
    } else {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.currentTime = 0;
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex flex-col items-center justify-start sm:justify-center overflow-y-auto p-2 xs:p-4 py-8">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-md" onClick={onClose} />
      
      <div className={`relative w-full max-w-3xl border rounded-[2rem] sm:rounded-[2.5rem] p-4 xs:p-6 md:p-8 shadow-2xl overflow-hidden animate-in zoom-in duration-300 ${
        isDark ? 'bg-[#151515] border-white/10 text-white shadow-black/90' : 'bg-white border-outline-variant/20 text-on-surface shadow-black/20'
      }`}>
        
        {/* Brillos dorados de fondo en el modal */}
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-[#e2bd6c]/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        {/* Header del modal */}
        <div className="flex items-start justify-between gap-4 mb-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isDark ? 'bg-[#e2bd6c]/10 border-[#e2bd6c]/20 text-[#e2bd6c]' : 'bg-primary/10 border-primary/20 text-primary'
            }`}>
              <span className="material-symbols-outlined font-bold">smart_display</span>
            </div>
            <div>
              <h2 className="font-headline text-base xs:text-lg md:text-xl font-bold">Video Tutorial de Compra</h2>
              <p className={`text-[10px] md:text-xs font-medium ${isDark ? 'text-gray-400' : 'text-outline'}`}>
                Aprende cómo realizar tus pedidos en la plataforma Leis
              </p>
            </div>
          </div>
          
          <button 
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark ? 'hover:bg-white/10 text-gray-400 hover:text-white' : 'hover:bg-surface-variant text-outline hover:text-on-surface'
            }`}
            title="Cerrar"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Custom Premium HTML5 Video Tutorial Player */}
        <div 
          ref={simulatorRef}
          className={`relative overflow-hidden border border-[#e2bd6c]/20 dark:border-white/5 bg-[#0f0f12] select-none group transition-all duration-300 ${
            isFullscreen 
              ? 'w-full h-full rounded-none p-4 sm:p-8' 
              : 'h-[350px] xs:h-[370px] sm:h-auto sm:aspect-video rounded-3xl mb-5 shadow-2xl'
          }`}
        >
          {/* Real Video Element */}
          <video
            ref={videoRef}
            src="/tutorial.mp4"
            className="w-full h-full object-contain absolute inset-0 z-10"
            onPlay={() => setVideoIsPlaying(true)}
            onPause={() => setVideoIsPlaying(false)}
            onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime)}
            onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 25)}
            onClick={() => {
              if (videoRef.current) {
                if (videoIsPlaying) {
                  videoRef.current.pause();
                } else {
                  videoRef.current.play().catch(err => console.log(err));
                }
              }
            }}
          />

          {/* Watermark de Marca */}
          <div className={`absolute z-20 flex items-center gap-2 pointer-events-none transition-opacity ${
            isFullscreen 
              ? 'top-4 left-4 opacity-80' 
              : 'top-3 left-3 sm:top-4 sm:left-4 opacity-40 group-hover:opacity-80'
          }`}>
            <span className="w-1.5 h-1.5 rounded-full bg-[#e2bd6c]" />
            <span className="text-[7px] sm:text-[8px] font-bold tracking-widest text-[#e2bd6c] uppercase font-headline">
              Leis Catalog Tutorial
            </span>
          </div>

          {/* Controles del Video Player Premium */}
          <div className={`absolute bottom-0 left-0 right-0 z-30 p-3 sm:p-4 bg-gradient-to-t from-black/95 via-black/50 to-transparent flex flex-col gap-1.5 sm:gap-2 transition-transform ${
            isFullscreen 
              ? 'translate-y-0' 
              : 'translate-y-0 sm:translate-y-2 sm:group-hover:translate-y-0'
          }`}>
            
            {/* Línea de Tiempo / Progress Bar */}
            <div 
              className="w-full py-1.5 cursor-pointer relative group/timeline"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const width = rect.width;
                const newPct = clickX / width;
                const newTime = newPct * videoDuration;
                if (videoRef.current) {
                  videoRef.current.currentTime = newTime;
                }
                setVideoCurrentTime(newTime);
              }}
            >
              <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden relative">
                <div 
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#e2bd6c] to-primary transition-all duration-75"
                  style={{ width: `${(videoCurrentTime / videoDuration) * 100}%` }}
                />
                <div 
                  className="absolute h-2.5 w-2.5 rounded-full bg-white border border-[#e2bd6c] -top-[3px] -ml-1 opacity-0 sm:group-hover/timeline:opacity-100 transition-opacity pointer-events-none"
                  style={{ left: `${(videoCurrentTime / videoDuration) * 100}%` }}
                />
              </div>
            </div>

            {/* Fila de Botones del Reproductor */}
            <div className="flex items-center justify-between text-white text-xs">
              
              {/* Controles de la izquierda (Play, Pause, Tiempo) */}
              <div className="flex items-center gap-2 sm:gap-4">
                <button 
                  type="button"
                  onClick={() => {
                    if (videoRef.current) {
                      if (videoIsPlaying) {
                        videoRef.current.pause();
                      } else {
                        videoRef.current.play().catch(err => console.log(err));
                      }
                    }
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors cursor-pointer text-white border-0"
                  title={videoIsPlaying ? 'Pausar' : 'Reproducir'}
                >
                  <span className="material-symbols-outlined text-base sm:text-lg">
                    {videoIsPlaying ? 'pause' : 'play_arrow'}
                  </span>
                </button>

                <button 
                  type="button"
                  onClick={() => {
                    if (videoRef.current) {
                      videoRef.current.currentTime = 0;
                      videoRef.current.play().catch(err => console.log(err));
                    }
                  }}
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center bg-white/5 hover:bg-white/10 transition-colors cursor-pointer text-white border-0"
                  title="Reiniciar"
                >
                  <span className="material-symbols-outlined text-xs sm:text-sm">replay</span>
                </button>

                {/* Tiempo Transcurrido */}
                <span className="text-[9px] sm:text-[10px] font-mono text-gray-300">
                  {formatVideoTime(videoCurrentTime)} / {formatVideoTime(videoDuration)}
                </span>
              </div>

              {/* Leyenda del Video */}
              <span className="text-[8px] sm:text-[9px] uppercase tracking-widest font-black text-[#e2bd6c] hidden xs:inline-block bg-[#e2bd6c]/10 border border-[#e2bd6c]/20 px-2 py-0.5 rounded">
                Reproduciendo Tutorial
              </span>

              {/* Controles de la derecha (Silenciar, Pantalla Completa) */}
              <div className="flex items-center gap-2 sm:gap-3">
                <button 
                  type="button"
                  onClick={() => {
                    const newMuted = !videoIsMuted;
                    setVideoIsMuted(newMuted);
                    if (videoRef.current) {
                      videoRef.current.muted = newMuted;
                    }
                  }}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-white border-0"
                  title={videoIsMuted ? 'Activar Sonido' : 'Silenciar'}
                >
                  <span className="material-symbols-outlined text-sm sm:text-base">
                    {videoIsMuted ? 'volume_off' : 'volume_up'}
                  </span>
                </button>
                
                <span className="text-[8px] text-gray-400 font-semibold tracking-wider bg-white/5 px-2 py-0.5 rounded hidden sm:inline-block">
                  {videoIsMuted ? 'Silenciado' : 'Sonido'}
                </span>

                <button 
                  type="button"
                  onClick={toggleFullscreen}
                  className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors cursor-pointer text-white border-0"
                  title={isFullscreen ? 'Salir de Pantalla Completa' : 'Pantalla Completa'}
                >
                  <span className="material-symbols-outlined text-sm sm:text-base">
                    {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                  </span>
                </button>
              </div>

            </div>

          </div>

        </div>

        {/* Footer informativo modal */}
        <div className={`flex items-center gap-4 p-4 rounded-2xl border relative z-10 ${
          isDark ? 'bg-white/5 border-white/5' : 'bg-surface-container-low border-outline-variant/10'
        }`}>
          <span className="text-2xl shrink-0">🎬</span>
          <p className={`text-[10px] md:text-xs leading-relaxed font-semibold ${isDark ? 'text-gray-300' : 'text-on-surface-variant'}`}>
            <strong className={isDark ? 'text-[#e2bd6c]' : 'text-primary'}>Video Tutorial:</strong> En este video te mostramos el paso a paso detallado para realizar tus compras de forma fácil y rápida: buscar productos, agregarlos a tu bolsa de compras y enviar tu pedido directamente a nuestra asesora por WhatsApp. ¡Esperamos que te sea de ayuda!
          </p>
        </div>

      </div>
    </div>
  );
}
