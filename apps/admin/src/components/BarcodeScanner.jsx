import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan, onClose }) {
  const [hasPermission, setHasPermission] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [zoomSettings, setZoomSettings] = useState({
    supported: false,
    min: 1,
    max: 1,
    step: 0.1,
    current: 1
  });
  const scannerRef = useRef(null);

  // Limpiar recursos al cerrar o desmontar
  useEffect(() => {
    // Iniciar automáticamente al montar (aprovechando el gesto del usuario al abrir el scanner)
    // Agregamos un pequeño delay para asegurar que el DOM esté listo
    const timer = setTimeout(() => {
      requestPermissionAndStart();
    }, 300);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current.stop().catch(e => console.log('Error al detener escáner:', e));
      }
    };
  }, []);

  const requestPermissionAndStart = async () => {
    setErrorMsg('');
    try {
      // Verificar que el elemento exista en el DOM
      const element = document.getElementById("reader");
      if (!element) {
        throw new Error("El contenedor de la cámara no está disponible.");
      }

      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;
      
      await html5QrCode.start(
        { facingMode: "environment" },
        { 
          fps: 10, 
          qrbox: { width: 250, height: 100 },
          aspectRatio: 1.0 
        },
        (decodedText) => {
          if (scannerRef.current) {
            scannerRef.current.stop().then(() => {
              onScan(decodedText);
            }).catch(() => {
              onScan(decodedText);
            });
            scannerRef.current = null;
          }
        },
        (errorMessage) => {
          // console.log(errorMessage)
        }
      );

      // Detectar capacidades de zoom después de iniciar
      try {
        const capabilities = html5QrCode.getRunningTrackCapabilities();
        if (capabilities.zoom) {
          setZoomSettings({
            supported: true,
            min: capabilities.zoom.min,
            max: capabilities.zoom.max,
            step: capabilities.zoom.step || 0.1,
            current: 1 // Empezamos en zoom 1
          });
        }
      } catch (capErr) {
        console.warn("No se pudieron obtener capacidades de cámara:", capErr);
      }
    } catch (err) {
      // Si el usuario deniega el permiso explícitamente o el teléfono no logra abrirla
      setHasPermission(false);
      setErrorMsg('Error al iniciar cámara: ' + (err.message || 'Permiso denegado.'));
      console.error("Error al iniciar cámara:", err);
    }
  };

  const handleZoomChange = async (e) => {
    const value = parseFloat(e.target.value);
    if (scannerRef.current && zoomSettings.supported) {
      try {
        await scannerRef.current.applyVideoConstraints({
          advanced: [{ zoom: value }]
        });
        setZoomSettings(prev => ({ ...prev, current: value }));
      } catch (err) {
        console.error("Error al aplicar zoom:", err);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-surface dark:bg-[#121212] w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 dark:border-white/10 flex flex-col">
        <div className="p-5 border-b border-outline-variant/20 dark:border-white/10 flex justify-between items-center bg-surface-container-low dark:bg-[#1e1e1e]">
          <h3 className="font-headline font-bold text-lg text-primary dark:text-[#e2bd6c] flex items-center gap-2">
            <span className="material-symbols-outlined">barcode_scanner</span>
            Escanear Código
          </h3>
          <button onClick={onClose} className="text-outline dark:text-gray-400 hover:text-error transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Contenedor oficial del lector nativo */}
        <div className="p-4 bg-white/5 relative min-h-[300px] flex items-center justify-center flex-col">
          
          {/* Pantalla de permisos / Carga (Solo visible si NO hay permisos o está cargando) */}
          <div className={`text-center space-y-4 px-4 w-full ${hasPermission && !errorMsg ? 'hidden' : 'block'}`}>
            <div className="w-16 h-16 bg-primary-container dark:bg-[#e2bd6c]/10 text-primary dark:text-[#e2bd6c] rounded-2xl flex items-center justify-center mx-auto mb-2 opacity-80 animate-pulse">
              <span className="material-symbols-outlined text-3xl">photo_camera</span>
            </div>
            
            {!errorMsg ? (
              <p className="text-sm text-on-surface-variant dark:text-gray-400 font-label">Iniciando cámara...</p>
            ) : (
              <>
                <p className="text-sm text-on-surface-variant dark:text-gray-400 font-label">Para que esta app pueda leer los códigos de barra automáticamente, necesita acceso temporal a tu cámara.</p>
                <div className="bg-error-container text-error text-[11px] p-3 rounded-lg font-bold">
                  {errorMsg}
                </div>
                <button 
                  onClick={requestPermissionAndStart}
                  className="w-full flex justify-center items-center gap-2 bg-primary dark:bg-[#e2bd6c] text-on-primary dark:text-black py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors"
                >
                  Intentar de nuevo
                </button>
              </>
            )}
          </div>

          {/* Div siempre presente en el DOM para que la librería no de crash al buscarlo. Se oculta si no tiene permisos. */}
          <div 
            id="reader" 
            className={`w-full overflow-hidden rounded-xl bg-black border border-outline-variant/20 ${hasPermission ? 'block' : 'hidden'}`}
            style={{ minHeight: '250px' }}
          ></div>

          {/* Control de Zoom si está soportado */}
          {hasPermission && zoomSettings.supported && (
            <div className="w-full mt-4 px-2 space-y-2">
              <div className="flex justify-between text-[10px] text-on-surface-variant dark:text-gray-400 font-bold uppercase tracking-widest">
                <span>Zoom</span>
                <span>{zoomSettings.current.toFixed(1)}x</span>
              </div>
              <input 
                type="range"
                min={zoomSettings.min}
                max={zoomSettings.max}
                step={zoomSettings.step}
                value={zoomSettings.current}
                onChange={handleZoomChange}
                className="w-full h-2 bg-outline-variant dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-primary dark:accent-[#e2bd6c]"
              />
            </div>
          )}
        </div>

        {hasPermission && (
          <div className="p-4 text-center text-[10px] text-on-surface-variant dark:text-[#e2bd6c]/60 font-label tracking-widest uppercase bg-surface-container-low dark:bg-[#1e1e1e] border-t border-outline-variant/20 dark:border-white/10">
            Apunta la cámara hacia el código de barras
          </div>
        )}
      </div>

      {/* Forzar tamaño del video inyectado por html5-qrcode para evitar cajas blancas o colapsos */}
      <style dangerouslySetInnerHTML={{__html: `
        #reader video {
          width: 100% !important;
          height: auto !important;
          min-height: 250px;
          object-fit: cover !important;
        }
      `}} />
    </div>
  );
}
