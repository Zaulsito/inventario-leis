import React, { useState, useEffect, useRef } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onScan, onClose }) {
  const [hasPermission, setHasPermission] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const scannerRef = useRef(null);

  // Limpiar recursos al cerrar o desmontar
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(e => console.log('Error al detener escáner:', e));
      }
    };
  }, []);

  const requestPermissionAndStart = async () => {
    setErrorMsg('');
    try {
      // Solicitar acceso. Esto levanta el aviso nativo del navegador si es la primera vez.
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setHasPermission(true);
        
        // Inicializar instancia base pura sin UI fea
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;
        
        // Iniciar escaneo forzando cámara trasera (facingMode: environment)
        await html5QrCode.start(
          { facingMode: "environment" },
          { 
            fps: 10, 
            qrbox: { width: 250, height: 100 },
            aspectRatio: 1.0 
          },
          (decodedText) => {
            // Al escuchar éxito, detener todo y enviar string
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
            // Ignorado, html5qrcode lanza esto en cada frame que no lee nada
          }
        );
      } else {
        setErrorMsg('No se detectaron cámaras en tu dispositivo.');
      }
    } catch (err) {
      setErrorMsg('Debes otorgar permisos de cámara para poder escanear.');
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="bg-surface w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-outline-variant/20 flex flex-col">
        <div className="p-5 border-b border-outline-variant/20 flex justify-between items-center bg-surface-container-low">
          <h3 className="font-headline font-bold text-lg text-primary flex items-center gap-2">
            <span className="material-symbols-outlined">barcode_scanner</span>
            Escanear Código
          </h3>
          <button onClick={onClose} className="text-outline hover:text-error transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        
        {/* Contenedor oficial del lector nativo (solo inserta video) */}
        <div className="p-4 bg-white/5 relative min-h-[300px] flex items-center justify-center flex-col">
          {!hasPermission ? (
             <div className="text-center space-y-4 px-4 w-full">
               <div className="w-16 h-16 bg-primary-container text-primary rounded-2xl flex items-center justify-center mx-auto mb-2 opacity-80">
                 <span className="material-symbols-outlined text-3xl">photo_camera</span>
               </div>
               <p className="text-sm text-on-surface-variant font-label">Para que esta app pueda leer los códigos de barra automáticamente, necesita acceso temporal a tu cámara.</p>
               {errorMsg && (
                 <div className="bg-error-container text-error text-[11px] p-3 rounded-lg font-bold">
                   {errorMsg}
                 </div>
               )}
               <button 
                 onClick={requestPermissionAndStart}
                 className="w-full flex justify-center items-center gap-2 bg-primary text-on-primary py-3 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-primary/90 transition-colors"
               >
                 Aceptar y encender cámara
               </button>
             </div>
          ) : (
            <>
              {/* Este div será reemplazado visualmente por el stream de video */}
              <div id="reader" className="w-full h-full overflow-hidden rounded-xl bg-black border border-outline-variant/20"></div>
            </>
          )}
        </div>

        {hasPermission && (
          <div className="p-4 text-center text-[10px] text-on-surface-variant font-label tracking-widest uppercase bg-surface-container-low border-t border-outline-variant/20">
            Apunta la cámara hacia el código de barras
          </div>
        )}
      </div>
    </div>
  );
}
