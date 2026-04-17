import React, { useEffect } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';

export default function BarcodeScanner({ onScan, onClose }) {
  useEffect(() => {
    // Configuración del escáner
    const scanner = new Html5QrcodeScanner("reader", {
      qrbox: { width: 250, height: 100 },
      fps: 10,
      rememberLastUsedCamera: true,
      supportedScanTypes: [] // Permite todos los tipos 1D y 2D
    });

    // Callback de éxito
    const onScanSuccess = (decodedText) => {
      // Al detectar correctamente, detenemos la lectura y enviamos el texto.
      scanner.clear().then(() => {
        onScan(decodedText);
      }).catch(err => {
        console.error("No se pudo limpiar el escáner.", err);
        onScan(decodedText);
      });
    };

    // Callback de error (continuo mientras no escanea nada, se ignora)
    const onScanFailure = (error) => {};

    scanner.render(onScanSuccess, onScanFailure);

    return () => {
      scanner.clear().catch(e => console.log('Escáner limpiado', e));
    };
  }, [onScan]);

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
        
        {/* Contenedor oficial del lector (html5-qrcode inyectará elementos aquí) */}
        <div className="p-4 bg-white/5 relative min-h-[300px] flex items-center justify-center">
          <div id="reader" className="w-full h-full overflow-hidden rounded-xl border border-outline-variant/20"></div>
        </div>

        <div className="p-4 text-center text-[10px] text-on-surface-variant font-label tracking-widest uppercase bg-surface-container-low border-t border-outline-variant/20">
          Apunta la cámara hacia el código de barras
        </div>
      </div>
    </div>
  );
}
