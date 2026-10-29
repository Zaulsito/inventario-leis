import React from 'react';
import { getOptimizedImageUrl } from '../../utils/image';
import { getHexColor } from '../../utils/colors';
import { ProductImagePlaceholder } from '../common/Indicators';

export default function ProductDetailModal({
  isOpen,
  onClose,
  isDark,
  productoParaVer,
  fotosProducto,
  indexImagenActual,
  setIndexImagenActual,
  animacion,
  setAnimacion,
  isModalImgLoading,
  setIsModalImgLoading,
  irAImagen,
  anteriorImagen,
  siguienteImagen,
  mostrarIndicador,
  setExpandedImage,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  varianteDetalle,
  setVarianteDetalle,
  selectedColorByProduct,
  setSelectedColorByProduct,
  animateFlyToCart,
  añadirAlCarrito,
  isAutoDemo,
  autoDemoStep
}) {
  if (!isOpen || !productoParaVer) return null;

  return (
    <div className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in" 
        onClick={onClose} 
      />
      
      <div 
        className={`w-full max-w-lg md:max-w-7xl rounded-[32px] md:rounded-[48px] shadow-2xl relative z-10 animate-in slide-in-from-bottom sm:zoom-in-95 duration-300 overflow-hidden flex flex-col md:flex-row h-full max-h-[92vh] md:h-[90vh] overscroll-contain border ${
          isDark ? 'bg-[#1e1e1e] border-white/5' : 'bg-white border-outline-variant/20'
        }`}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* BOTÓN CERRAR FLOTANTE PARA MÓVIL / ESCRITORIO */}
        <button 
          onClick={onClose} 
          className={`absolute top-4 right-4 z-[70] w-10 h-10 flex items-center justify-center rounded-full transition-all shadow-lg cursor-pointer ${
            isDark ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-black/10 hover:bg-black/20 text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined">close</span>
        </button>
        
        <div className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden custom-scrollbar">
          {/* COLUMNA IZQUIERDA: GALERÍA CON EFECTO HOJA / LÁMINA */}
          <div className={`w-full md:w-[60%] flex flex-col border-b md:border-b-0 md:border-r shrink-0 ${
            isDark ? 'bg-[#0c0c0c] border-white/5' : 'bg-white border-outline-variant/10'
          }`}>
            <div className={`flex-1 relative group/gallery overflow-hidden flex items-center justify-center p-6 md:p-12 perspective-gallery ${
              isDark ? 'bg-[#0c0c0c]' : 'bg-[#fcfcfc]'
            }`}>

              <div className={`absolute inset-4 md:inset-8 rounded-[48px] overflow-hidden z-0 backdrop-blur-sm shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)] ${
                isDark ? 'bg-black/40' : 'bg-white/50'
              }`}>
                {/* FONDO DIFUMINADO DINÁMICO */}
                {fotosProducto[indexImagenActual] && (
                  <div className="absolute inset-0">
                    <img 
                      key={`bg-${indexImagenActual}-${fotosProducto[indexImagenActual]}`}
                      src={getOptimizedImageUrl(fotosProducto[indexImagenActual], 100)} 
                      className="w-full h-full object-cover blur-3xl scale-150 opacity-40 transition-all duration-700 ease-in-out" 
                      alt="Dynamic background"
                    />
                    <div className={`absolute inset-0 ${isDark ? 'bg-black/20' : 'bg-white/10'}`} />
                  </div>
                )}
              </div>

              {fotosProducto[indexImagenActual] ? (
                <div 
                  className={`relative z-10 max-w-full max-h-full cursor-zoom-in active:scale-95 flex items-center justify-center ${animacion}`}
                  onClick={() => setExpandedImage(fotosProducto[indexImagenActual])}
                >
                  {/* Estado de carga si la nueva foto aún no se descargó */}
                  {isModalImgLoading && (
                    <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-[40px] bg-black/10 dark:bg-black/40 backdrop-blur-sm animate-pulse min-h-[220px] min-w-[220px]">
                      <span className="material-symbols-outlined text-4xl text-[#e2bd6c] animate-spin mb-2">progress_activity</span>
                      <span className="text-[10px] font-black tracking-widest text-[#e2bd6c] uppercase">Cargando...</span>
                    </div>
                  )}

                  <img 
                    key={fotosProducto[indexImagenActual]}
                    src={getOptimizedImageUrl(fotosProducto[indexImagenActual], 900)} 
                    onLoad={() => setIsModalImgLoading(false)}
                    onError={(e) => { 
                      setIsModalImgLoading(false);
                      if (e.target.src !== fotosProducto[indexImagenActual]) e.target.src = fotosProducto[indexImagenActual]; 
                    }}
                    alt={productoParaVer.nombre} 
                    className={`max-w-full max-h-[70vh] w-auto h-auto object-contain rounded-[40px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] border-8 transition-opacity duration-200 ${
                      isModalImgLoading ? 'opacity-0' : 'opacity-100'
                    } ${isDark ? 'border-[#1e1e1e]' : 'border-white'}`} 
                  />
                  <div className={`absolute inset-0 rounded-[40px] transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`} />
                </div>
              ) : (
                <div className="relative z-10 w-64 h-64 sm:w-80 sm:h-80 rounded-[40px] overflow-hidden shadow-xl">
                  <ProductImagePlaceholder isDark={isDark} iconSize="text-5xl" text="LEIS COLLECTION" />
                </div>
              )}

              {/* FLECHAS INTERNAS */}
              {fotosProducto.length > 1 && (
                <>
                  <button 
                    onClick={(e) => { e.stopPropagation(); anteriorImagen(); }}
                    className={`absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full transition-all opacity-0 group-hover/gallery:opacity-100 cursor-pointer ${
                      isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant hover:scale-110 shadow-xl'
                    }`}
                    title="Foto anterior"
                  >
                    <span className="material-symbols-outlined text-2xl">chevron_left</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); siguienteImagen(); }}
                    className={`absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full transition-all opacity-0 group-hover/gallery:opacity-100 cursor-pointer ${
                      isDark ? 'bg-white/10 text-[#e2bd6c] hover:bg-white/20' : 'bg-white text-secondary hover:bg-surface-variant hover:scale-110 shadow-xl'
                    }`}
                    title="Foto siguiente"
                  >
                    <span className="material-symbols-outlined text-2xl">chevron_right</span>
                  </button>
                </>
              )}

              {/* INDICADOR NUMÉRICO REFINADO (AUTO-OCULTABLE) */}
              {fotosProducto.length > 1 && mostrarIndicador && (
                <div className={`absolute bottom-10 right-10 z-20 flex items-center gap-2 backdrop-blur-md px-4 py-2 rounded-2xl shadow-xl border md:hidden animate-in fade-in zoom-in duration-500 animate-out fade-out zoom-out ${
                  isDark ? 'bg-[#1e1e1e]/90 border-white/5' : 'bg-white/90 border-outline-variant/10'
                }`}>
                  <span className={`material-symbols-outlined text-sm ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>imagesmode</span>
                  <span className={`text-[11px] font-black tracking-[0.1em] ${isDark ? 'text-white' : 'text-on-surface'}`}>
                    {indexImagenActual + 1} <span className="text-outline/40 mx-0.5">/</span> {fotosProducto.length}
                  </span>
                </div>
              )}
            </div>

            {/* MINIATURAS EN ESCRITORIO */}
            {fotosProducto.length > 1 && (
              <div className={`hidden md:flex gap-2 p-4 ${fotosProducto.length > 5 ? 'justify-start' : 'justify-center'} border-t overflow-x-auto custom-scrollbar ${
                isDark ? 'border-white/5' : 'border-outline-variant/5'
              }`}>
                {fotosProducto.map((f, i) => (
                  <button 
                    key={i}
                    onClick={() => irAImagen(i)}
                    className={`w-20 h-20 rounded-2xl border-2 overflow-hidden transition-all shrink-0 p-1 cursor-pointer ${
                      isDark ? 'bg-[#1e1e1e]' : 'bg-white'
                    } ${
                      indexImagenActual === i 
                        ? (isDark ? 'border-[#e2bd6c] shadow-lg scale-110' : 'border-primary shadow-lg scale-110') 
                        : (isDark ? 'border-white/10 opacity-60 hover:opacity-100 hover:border-[#e2bd6c]/30' : 'border-outline-variant/10 opacity-60 hover:opacity-100 hover:border-primary/30')
                    }`}
                    title={`Ver foto ${i + 1}`}
                  >
                    <img src={getOptimizedImageUrl(f, 200)} className="w-full h-full object-cover rounded-xl" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* COLUMNA DERECHA: INFO */}
          <div className={`w-full md:w-[40%] flex flex-col md:overflow-y-auto custom-scrollbar ${
            isDark ? 'bg-[#121212]' : 'bg-surface-container-low'
          }`}>
            <div className="p-8 md:p-12 flex-1 space-y-10">
              {/* CABECERA: NOMBRE Y MARCA CENTRALIZADA ABAJO */}
              <div className="animate-in fade-in slide-in-from-right duration-500 delay-100 text-center">
                <h2 className={`font-headline font-bold text-3xl md:text-5xl leading-[1.1] mb-2 ${
                  isDark ? 'text-white' : 'text-on-surface'
                }`}>{productoParaVer.nombre}</h2>
                <p className={`text-xs md:text-sm font-medium uppercase tracking-[0.2em] opacity-60 mb-6 ${
                  isDark ? 'text-[#e2bd6c]/60' : 'text-outline'
                }`}>{(productoParaVer.coleccion || 'SIN CATEGORÍA').toUpperCase()}</p>
                
                <div className="flex items-center gap-4 justify-center">
                  <div className={`h-[1px] flex-1 bg-gradient-to-r ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                  <p className={`text-xs md:text-sm font-bold uppercase tracking-[0.4em] px-2 ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>{productoParaVer.marca || 'GENÉRICO'}</p>
                  <div className={`h-[1px] flex-1 bg-gradient-to-l ${isDark ? 'from-transparent to-[#e2bd6c]/20' : 'from-transparent to-primary/20'}`} />
                </div>
              </div>

              {/* SELECTOR INTERACTIVO DE COLOR / VARIANTE */}
              {productoParaVer.variantes && productoParaVer.variantes.length > 0 && (
                <div className="space-y-3 p-5 rounded-3xl border backdrop-blur-sm animate-in fade-in slide-in-from-right duration-500 delay-200 border-outline-variant/15 dark:border-white/5 bg-surface-container-lowest/50 dark:bg-white/[0.02]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`material-symbols-outlined text-lg ${isDark ? 'text-[#e2bd6c]' : 'text-primary'}`}>palette</span>
                      <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.2em] ${isDark ? 'text-white' : 'text-on-surface'}`}>
                        Color: <span className={isDark ? 'text-[#e2bd6c]' : 'text-primary'}>{varianteDetalle?.nombre || 'Seleccionar'}</span>
                      </p>
                    </div>
                    <span className="text-[10px] font-bold text-outline opacity-75">
                      {productoParaVer.variantes.filter(v => v.visible !== false).length} colores disponibles
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {productoParaVer.variantes.filter(v => v.visible !== false).map((v, i) => {
                      const isSelected = (varianteDetalle?.nombre || productoParaVer.variantes[0]?.nombre) === v.nombre;
                      const vCover = (v.fotos && v.fotos[0]) || v.fotoUrl;
                      const vHex = getHexColor(v.nombre);
                      const hasStock = Number(v.stock) > 0;
                      return (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            if (varianteDetalle?.nombre !== v.nombre) {
                              setAnimacion('hoja-pasar-adelante-salir');
                              setTimeout(() => {
                                setVarianteDetalle(v);
                                setSelectedColorByProduct(prev => ({ ...prev, [productoParaVer.id]: v.nombre }));
                                setIndexImagenActual(0);
                                setAnimacion('hoja-pasar-adelante-entrar');
                                setTimeout(() => setAnimacion(''), 320);
                              }, 280);
                            }
                          }}
                          className={`flex items-center gap-2 px-3.5 py-2 rounded-full border-2 transition-all cursor-pointer ${
                            isSelected 
                              ? (isDark ? 'border-[#e2bd6c] bg-[#e2bd6c]/15 text-[#e2bd6c] shadow-lg scale-105' : 'border-primary bg-primary/10 text-primary shadow-md scale-105') 
                              : (isDark ? 'border-white/10 hover:border-white/20 bg-white/5 text-white/80' : 'border-outline-variant/30 hover:border-primary/40 bg-white text-on-surface')
                          } ${!hasStock ? 'opacity-40' : ''}`}
                        >
                          {vCover ? (
                            <img src={getOptimizedImageUrl(vCover, 100)} alt={v.nombre} className="w-4 h-4 rounded-full object-cover border border-white/20 shrink-0" />
                          ) : vHex ? (
                            <span className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0 shadow-sm" style={{ backgroundColor: vHex }} />
                          ) : null}
                          <span className="text-xs font-bold uppercase">{v.nombre}</span>
                          
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* DESCRIPCIÓN REFINADA */}
              <div className="space-y-5 animate-in fade-in slide-in-from-right duration-500 delay-300">
                <div className="flex items-center gap-3">
                  <span className={`material-symbols-outlined text-xl ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>description</span>
                  <p className={`text-[10px] md:text-xs font-black uppercase tracking-[0.3em] ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>Descripción Detallada</p>
                </div>
                
                <div className="space-y-4">
                  {productoParaVer.descripcion ? (
                    <div className="space-y-4">
                      {(() => {
                        const renderContent = (txt) => {
                          if (!txt.includes('**')) return txt;
                          const parts = txt.split(/(\*\*.*?\*\*)/g);
                          return parts.map((part, i) => {
                            if (part.startsWith('**') && part.endsWith('**')) {
                              const cleanText = part.slice(2, -2);
                              return (
                                <strong
                                  key={i}
                                  className={`font-black tracking-wide ${
                                    isDark ? 'text-[#e2bd6c]' : 'text-primary'
                                  }`}
                                >
                                  {cleanText}
                                </strong>
                              );
                            }
                            return part;
                          });
                        };

                        const lineas = productoParaVer.descripcion.split('\n');
                        const secciones = [];
                        let seccionActual = { title: '', contentLines: [] };

                        lineas.forEach(linea => {
                          const trimmed = linea.trim();
                          if (trimmed === '') {
                            if (seccionActual.contentLines.length > 0 || seccionActual.title) {
                              seccionActual.contentLines.push(linea);
                            }
                            return;
                          }

                          const esTituloStars = trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length >= 4;
                          const esTituloNumber = /^\d+\./.test(trimmed) && trimmed.length <= 35;
                          const esTitulo = esTituloStars || esTituloNumber;

                          if (esTitulo) {
                            if (seccionActual.title || seccionActual.contentLines.length > 0) {
                              secciones.push(seccionActual);
                            }

                            let cleanTitle = linea;
                            if (esTituloStars) {
                              const startIdx = linea.indexOf('**');
                              const endIdx = linea.lastIndexOf('**');
                              cleanTitle = linea.substring(0, startIdx) + linea.substring(startIdx + 2, endIdx) + linea.substring(endIdx + 2);
                            }

                            seccionActual = { title: cleanTitle, contentLines: [] };
                          } else {
                            seccionActual.contentLines.push(linea);
                          }
                        });

                        if (seccionActual.title || seccionActual.contentLines.length > 0) {
                          secciones.push(seccionActual);
                        }

                        return secciones.map((seccion, idx) => {
                          const hasTitle = seccion.title.trim().length > 0;
                          const matchNum = seccion.title.trim().match(/^(\d+)\s*[\.\-]?\s*(.*)$/);

                          let titleNode = null;
                          if (hasTitle) {
                            if (matchNum) {
                              const num = matchNum[1];
                              const textTitle = matchNum[2];
                              titleNode = (
                                <div className="flex items-center gap-2.5 mb-3">
                                  <span className="w-6 h-6 md:w-7 md:h-7 flex items-center justify-center text-[10px] md:text-xs font-black bg-[#e2bd6c]/15 text-[#e2bd6c] border border-[#e2bd6c]/30 rounded-full shrink-0 shadow-sm animate-pulse">
                                    {num}
                                  </span>
                                  <h4 className={`text-xs md:text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                    {renderContent(textTitle)}
                                  </h4>
                                </div>
                              );
                            } else {
                              titleNode = (
                                <div className="flex items-center gap-2 mb-3 border-l-2 border-[#e2bd6c] pl-2.5">
                                  <h4 className={`text-xs md:text-sm font-black uppercase tracking-wider ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                    {renderContent(seccion.title)}
                                  </h4>
                                </div>
                              );
                            }
                          }

                          return (
                            <div
                              key={idx}
                              className={`backdrop-blur-sm p-5 md:p-6 rounded-[24px] border shadow-sm transition-all duration-300 hover:scale-[1.01] ${
                                isDark
                                  ? 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.3)]'
                                  : 'bg-black/[0.01] hover:bg-black/[0.03] border-outline-variant/10 shadow-[0_2px_8px_-2px_rgba(0,0,0,0.03)]'
                              }`}
                            >
                              {titleNode}
                              <div className="space-y-2 leading-relaxed">
                                {seccion.contentLines.map((line, lIdx) => {
                                  const trimmedLine = line.trim();
                                  if (trimmedLine === '') return <div key={lIdx} className="h-2" />;
                                  
                                  const esViñeta = trimmedLine.startsWith('•') || trimmedLine.startsWith('-') || trimmedLine.startsWith('*');
                                  if (esViñeta) {
                                    const cleanLine = trimmedLine.replace(/^[•\-*]\s*/, '');
                                    return (
                                      <div key={lIdx} className="flex items-start gap-2 text-xs md:text-sm">
                                        <span className="text-[#e2bd6c] font-black select-none mt-0.5">•</span>
                                        <p className={`${isDark ? 'text-white/80 font-normal opacity-90' : 'text-on-surface-variant font-normal opacity-90'} flex-1`}>
                                          {renderContent(cleanLine)}
                                        </p>
                                      </div>
                                    );
                                  }

                                  const matchNumero = trimmedLine.match(/^(\d+)(?:\.|\-|\.\-|\-\.|\s)*\s+(.*)$/);
                                  if (matchNumero) {
                                    const num = matchNumero[1];
                                    const cleanLine = matchNumero[2];
                                    return (
                                      <div key={lIdx} className="flex items-start gap-2.5 text-xs md:text-sm py-0.5 animate-fadeIn">
                                        <span className="text-[#e2bd6c] font-black select-none shrink-0">{num}.</span>
                                        <p className={`flex-1 font-semibold ${isDark ? 'text-white' : 'text-on-surface'}`}>
                                          {renderContent(cleanLine)}
                                        </p>
                                      </div>
                                    );
                                  }

                                  return (
                                    <p
                                      key={lIdx}
                                      className={`text-xs md:text-sm ${
                                        isDark ? 'text-white/80 font-normal opacity-90' : 'text-on-surface-variant font-normal opacity-90'
                                      }`}
                                    >
                                      {renderContent(line)}
                                    </p>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  ) : (
                    <div className={`backdrop-blur-sm p-8 rounded-[24px] border shadow-inner text-center space-y-3 ${
                      isDark ? 'bg-white/5 border-white/5 text-white/30' : 'bg-white/50 border-outline-variant/10 text-outline/50'
                    }`}>
                      <span className="material-symbols-outlined text-3xl">info</span>
                      <p className="text-xs md:text-sm italic">
                        No hay una descripción detallada disponible para este producto en este momento.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* BARRA DE ACCIÓN INFERIOR CON PRECIO Y BOTÓN */}
            <div className={`p-6 md:p-8 backdrop-blur-2xl border-t sticky bottom-0 z-20 animate-in fade-in slide-in-from-bottom duration-700 delay-500 ${
              isDark ? 'bg-[#121212]/90 border-white/5' : 'bg-white/90 border-outline-variant/10'
            }`}>
              <div className="flex flex-col md:flex-row items-center gap-6">
                {/* PRECIO COMPACTO EN EL FOOTER */}
                <div className="flex flex-col items-center md:items-start shrink-0">
                  <p className={`text-[9px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-gray-400' : 'text-outline'}`}>Precio Internet</p>
                  <div className="flex items-baseline gap-1">
                    <span className={`text-xl font-light ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>$</span>
                    <p className={`font-black text-4xl md:text-5xl tracking-tighter ${isDark ? 'text-[#e2bd6c]' : 'text-secondary'}`}>
                      {(productoParaVer.precio || 0).toLocaleString('es-CL')}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={(e) => {
                    const hasVariants = productoParaVer.variantes && productoParaVer.variantes.length > 0;
                    if (hasVariants) {
                      const chosenVariant = varianteDetalle || productoParaVer.variantes.find(v => v.nombre === selectedColorByProduct[productoParaVer.id]) || productoParaVer.variantes[0];
                      if (chosenVariant && Number(chosenVariant.stock) <= 0) {
                        alert('La variante seleccionada no tiene stock disponible.');
                        return;
                      }
                      const photoToFly = (chosenVariant?.fotos && chosenVariant.fotos[0]) || chosenVariant?.fotoUrl || productoParaVer.fotoUrl;
                      animateFlyToCart(e, photoToFly);
                      añadirAlCarrito(productoParaVer, chosenVariant);
                    } else {
                      if (Number(productoParaVer.stock) <= 0) {
                        alert('Este producto no tiene stock disponible.');
                        return;
                      }
                      animateFlyToCart(e, productoParaVer.fotoUrl);
                      añadirAlCarrito(productoParaVer, null);
                    }
                    onClose();
                  }}
                  className={`group relative flex-1 w-full py-5 md:py-6 rounded-[28px] font-black uppercase tracking-[0.2em] text-xs md:text-sm shadow-xl transition-all duration-300 active:scale-[0.98] cursor-pointer ${
                    isDark 
                      ? 'bg-gradient-to-r from-[#d4af37] via-[#e2bd6c] to-[#f0d088] text-black shadow-[#e2bd6c]/20 hover:shadow-[0_10px_35px_rgba(226,189,108,0.45)] hover:scale-[1.02] hover:brightness-105' 
                      : 'bg-gradient-to-r from-[#8e6d3c] via-[#b88e4f] to-[#8e6d3c] text-white shadow-[#8e6d3c]/25 hover:shadow-[0_10px_35px_rgba(142,109,60,0.45)] hover:scale-[1.02] hover:brightness-105'
                  } ${isAutoDemo && (autoDemoStep === 4 || autoDemoStep === 5) ? 'demo-highlight' : ''}`}
                >
                  <div className="relative flex justify-center items-center gap-3">
                    <span className="material-symbols-outlined text-2xl md:text-3xl group-hover:scale-110 group-hover:-translate-y-0.5 transition-transform duration-300">shopping_cart_checkout</span>
                    <span>Añadir al Pedido</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
