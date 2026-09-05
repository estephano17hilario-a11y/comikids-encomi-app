import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pedido, TallerConfig } from '../../types/database.types';
import { X, Printer, Layers, Droplet } from 'lucide-react';
import { printMultipleElements } from '../../utils/nativePrintService';
import { InkSavingLevel, INK_SAVING_LEVELS, getInkSavingStyles } from '../../utils/inkSavingService';
import { extractShalomDni } from '../../utils/shalomExcelExporter';
import { ordersService } from '../../services/ordersService';
import { resolveOrderShippingMethod } from '../../utils/shippingMethodMatcher';

interface Props {
  pedidos: Pedido[];
  tallerConfig: TallerConfig;
  onClose: () => void;
  onPrintComplete?: (printedOrderIds: string[]) => void;
}

export const BulkPrintModal: React.FC<Props> = ({ pedidos, tallerConfig: _tallerConfig, onClose, onPrintComplete }) => {
  const [printing, setPrinting] = useState(false);
  const [inkSavingLevel, setInkSavingLevel] = useState<InkSavingLevel>(0);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Filtrar pedidos duplicados por id
  const uniquePedidos = Array.from(new Map(pedidos.map(p => [p.id, p])).values());

  const handlePrintDirect = async () => {
    setPrinting(true);
    try {
      await printMultipleElements(
        '.a4-print-page',
        `Rotulos_ComiKids_${uniquePedidos.length}pedidos_Eco${inkSavingLevel}`
      );
      if (onPrintComplete) {
        onPrintComplete(uniquePedidos.map(p => p.id));
      }
    } catch (err) {
      console.error('Error al imprimir por lotes:', err);
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  // Divide en grupos de exactamente 6 pedidos por cada hoja A4 (2 columnas x 3 filas)
  const chunkArray = <T,>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const pages = chunkArray(uniquePedidos, 6);

  const getShalomAgencyOnly = (fullDestino: string) => {
    let clean = fullDestino || '';
    clean = clean.replace(/Agencia Shalom:\s*/i, '');
    clean = clean.replace(/\(DNI\/CE.*?\)/i, '').trim();
    return clean;
  };

  const getClientDni = (pedido: Pedido) => {
    if (pedido.campos_personalizados) {
      for (const [key, val] of Object.entries(pedido.campos_personalizados)) {
        if (!val) continue;
        const lowerKey = key.toLowerCase();
        if (
          lowerKey === 'c-shalom-dni' ||
          lowerKey === 'c-olva-dni' ||
          lowerKey.includes('dni') ||
          lowerKey.includes('documento') ||
          lowerKey.includes('carnet') ||
          lowerKey.includes('ce')
        ) {
          const rawStr = String(val).trim();
          if (rawStr.length >= 6) return rawStr;
        }
      }
    }
    const extracted = extractShalomDni(pedido);
    if (extracted && extracted !== 'NCIADOS' && extracted.length >= 6) {
      return extracted;
    }
    if (pedido.usuario?.dni && pedido.usuario.dni.length >= 6 && !pedido.usuario.dni.startsWith('USR-') && !pedido.usuario.dni.startsWith('9')) {
      return pedido.usuario.dni;
    }
    if (pedido.usuario?.dni_default && pedido.usuario.dni_default.length >= 6) {
      return pedido.usuario.dni_default;
    }
    return 'No registrado';
  };

  const eco = getInkSavingStyles(inkSavingLevel);

  return createPortal(
    <div className="bulk-print-overlay fixed inset-0 z-9999 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      
      {/* Contenedor Principal en Pantalla */}
      <div className="bulk-print-modal-box w-full max-w-4xl max-h-[92vh] flex flex-col bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl">
        
        {/* Header de Controles (No imprimible) */}
        <div className="print:hidden p-3.5 sm:p-4 border-b border-white/10 flex flex-col gap-3 bg-slate-950/95 shrink-0" data-no-print="true">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg font-bold border border-cyan-500/30 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2 flex-wrap">
                  <span>Rótulos de Despacho (6 por Hoja A4)</span>
                  <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    {uniquePedidos.length} {uniquePedidos.length === 1 ? 'rótulo' : 'rótulos'} • {pages.length} {pages.length === 1 ? 'hoja A4' : 'hojas A4'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400 truncate">
                  DNI Grande & Recorte exacto 2x3 • Sin hojas en blanco intermedias
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Único botón: Imprimir Rótulos */}
              <button
                type="button"
                onClick={handlePrintDirect}
                disabled={printing}
                className="py-2.5 px-5 rounded-2xl bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-400 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm flex items-center gap-2 shadow-xl shadow-cyan-500/30 transition-all cursor-pointer disabled:opacity-50"
                title="Imprimir rótulos en tu impresora"
              >
                <Printer className="w-4 h-4 text-white" />
                <span>{printing ? 'Enviando a impresora...' : 'IMPRIMIR RÓTULOS'}</span>
              </button>

              {/* Botón Cerrar */}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* BARRA DE AHORRO DE TINTA / ECO-PRINT (0%, 25%, 50%, 75%, 90%) */}
          <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-slate-300">
              <Droplet className="w-3.5 h-3.5 text-cyan-400" />
              <span>Ahorro de Tinta:</span>
            </div>

            <div className="flex items-center gap-1">
              {(Object.keys(INK_SAVING_LEVELS) as unknown as InkSavingLevel[]).map((lvl) => {
                const opt = INK_SAVING_LEVELS[lvl];
                const isSelected = inkSavingLevel === Number(lvl);
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setInkSavingLevel(Number(lvl) as InkSavingLevel)}
                    className={`py-1 px-2.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500 text-slate-950 font-black shadow-md shadow-cyan-500/20'
                        : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    {opt.level}%
                  </button>
                );
              })}
            </div>

            <span className="text-[10px] text-slate-400 font-medium">
              💡 {INK_SAVING_LEVELS[inkSavingLevel].description}
            </span>
          </div>
        </div>

        {/* Área de Visualización y Rótulos Imprimibles */}
        <div className="flex-1 p-2 sm:p-4 overflow-y-auto bg-slate-950 print:bg-white print:p-0 print:m-0 print:overflow-visible flex flex-col items-center">
          
          {pages.map((pageOrders, pageIndex) => (
            <div
              key={pageIndex}
              className="a4-print-page bg-white text-black p-3 print:p-0 rounded-2xl print:rounded-none shadow-2xl print:shadow-none mb-6 print:mb-0 box-border"
              style={{
                width: '100%',
                maxWidth: '794px',
                minHeight: 'auto',
                boxSizing: 'border-box',
                fontFamily: eco.fontFamily,
              }}
            >
              <div className="grid grid-cols-2 grid-rows-3 gap-2.5 w-full h-full">
                {pageOrders.map((pedido) => {
                  const methods = ordersService.getShippingMethods();
                  const currentMethod = resolveOrderShippingMethod(pedido, methods);
                  const cfgRotulado = currentMethod?.config_rotulado;

                  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');
                  const isOlva = pedido.metodo_envio_codigo === 'olva' || pedido.destino_detalle?.toLowerCase().includes('olva');
                  const clientDni = getClientDni(pedido);
                  const shalomAgency = getShalomAgencyOnly(pedido.destino_detalle);

                  const recipientName = (() => {
                    if (pedido.campos_personalizados) {
                      for (const [key, val] of Object.entries(pedido.campos_personalizados)) {
                        if (!val || typeof val !== 'string' || !val.trim()) continue;
                        const lowerKey = key.toLowerCase();
                        if (
                          lowerKey === 'c-mot-nombre' ||
                          lowerKey.includes('recibe') ||
                          lowerKey.includes('destinatario') ||
                          lowerKey.includes('consignatario')
                        ) {
                          return val.trim();
                        }
                      }
                    }
                    return pedido.usuario?.nombre_completo || 'Cliente';
                  })();

                  const clientPhone = (() => {
                    if (pedido.campos_personalizados) {
                      for (const [key, val] of Object.entries(pedido.campos_personalizados)) {
                        if (!val) continue;
                        const lowerKey = key.toLowerCase();
                        if (
                          lowerKey === 'c-mot-tel' ||
                          lowerKey === 'c-shalom-tel' ||
                          lowerKey === 'c-olva-tel' ||
                          lowerKey.includes('tel') ||
                          lowerKey.includes('cel') ||
                          lowerKey.includes('whatsapp')
                        ) {
                          const rawStr = String(val).trim();
                          if (rawStr.length >= 7) return rawStr;
                        }
                      }
                    }
                    return pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');
                  })();

                  const rotuladoFields = (() => {
                    if (cfgRotulado?.incluir_campos_personalizados === false) return [];
                    const visibleList: { label: string; valor: string }[] = [];
                    const seenFieldIds = new Set<string>();

                    const configuredFields = currentMethod?.campos_personalizados || [];
                    for (const field of configuredFields) {
                      const isExplicitVisible = cfgRotulado?.campos_visibles
                        ? cfgRotulado.campos_visibles.includes(field.id)
                        : Boolean(field.mostrar_en_rotulado);

                      if (!isExplicitVisible) continue;

                      let val: string | undefined = undefined;
                      if (pedido.campos_personalizados) {
                        val = pedido.campos_personalizados[field.id] || pedido.campos_personalizados[field.label];
                      }

                      if (!val || !String(val).trim()) {
                        const fId = field.id.toLowerCase();
                        const fLbl = field.label.toLowerCase();
                        if (fId === 'c-mot-nombre' || fLbl.includes('recibe') || fLbl.includes('destinatario')) {
                          val = recipientName !== 'Cliente' ? recipientName : undefined;
                        } else if (fId === 'c-shalom-dni' || fId === 'c-olva-dni' || fLbl.includes('dni')) {
                          val = clientDni !== 'No registrado' ? clientDni : undefined;
                        } else if (fId === 'c-mot-tel' || fLbl.includes('tel') || fLbl.includes('cel')) {
                          val = clientPhone || undefined;
                        } else if (fLbl.includes('referencia')) {
                          val = pedido.observaciones_cliente || undefined;
                        }
                      }

                      const isDniField = field.id === 'c-shalom-dni' || field.id === 'c-olva-dni' || field.label.toLowerCase().includes('dni');
                      const hasCustomDniLabel = Boolean(cfgRotulado?.etiquetas_campos?.[field.id]);

                      if (val && String(val).trim() && (!isDniField || hasCustomDniLabel || cfgRotulado?.mostrar_cliente_dni === false)) {
                        seenFieldIds.add(field.id);
                        const customLabel = cfgRotulado?.etiquetas_campos?.[field.id] ||
                          cfgRotulado?.etiquetas_campos?.[field.label] ||
                          field.label;

                        visibleList.push({
                          label: customLabel,
                          valor: String(val).trim(),
                        });
                      }
                    }

                    if (pedido.campos_personalizados) {
                      for (const [key, val] of Object.entries(pedido.campos_personalizados)) {
                        if (!val || String(val).trim() === '') continue;
                        if (seenFieldIds.has(key)) continue;

                        const lowerK = key.toLowerCase();
                        if (['c-shalom-dni', 'c-olva-dni', 'c-mot-tel', 'c-mot-nombre'].includes(lowerK)) continue;

                        if (cfgRotulado?.campos_visibles && !cfgRotulado.campos_visibles.includes(key)) {
                          continue;
                        }

                        const customLabel = cfgRotulado?.etiquetas_campos?.[key] || key;
                        visibleList.push({
                          label: customLabel,
                          valor: String(val).trim(),
                        });
                      }
                    }

                    return visibleList;
                  })();

                  const getDniClass = () => {
                    const sz = cfgRotulado?.tamano_dni || 'gigante';
                    if (sz === 'normal') return 'text-base font-mono font-bold';
                    if (sz === 'grande') return 'text-lg sm:text-xl font-mono font-black';
                    return 'text-xl sm:text-2xl font-mono font-black';
                  };

                  return (
                    <div
                      key={pedido.id}
                      className={`a4-rotulo-card rounded-xl p-2.5 bg-white text-black flex flex-col justify-between break-inside-avoid relative overflow-hidden box-border h-[345px] max-h-[345px] ${
                        inkSavingLevel >= 75
                          ? 'border border-dashed border-slate-700'
                          : 'border-2 border-dashed border-black'
                      }`}
                    >
                      {/* Header: Logo Oficial ComiKids & Badge Shalom / Olva / Moto */}
                      <div className="flex items-center justify-between border-b-2 border-black pb-1.5 shrink-0">
                        <div className="flex items-center gap-2">
                          {cfgRotulado?.mostrar_logo_empresa !== false && (
                            <img 
                              src="/Comikids.png" 
                              alt="ComiKids" 
                              className={`w-8 h-8 object-contain shrink-0 ${inkSavingLevel >= 75 ? 'grayscale' : ''}`}
                            />
                          )}
                          <div>
                            <strong className="text-xs sm:text-sm font-black tracking-tight uppercase block leading-none text-black">
                              ComiKids
                            </strong>
                            <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-600 block mt-0.5">
                              {cfgRotulado?.subtitulo_cabecera || 'ENCOMI ENVÍOS'}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          {cfgRotulado?.mostrar_logo_agencia !== false && (
                            <div className={`flex items-center gap-1 px-2 py-0.5 rounded border border-black leading-none ${
                              inkSavingLevel >= 50
                                ? 'bg-white text-black'
                                : isOlva ? 'bg-yellow-300' : 'bg-slate-100'
                            }`}>
                              {currentMethod?.foto_url ? (
                                <>
                                  <img 
                                    src={currentMethod.foto_url} 
                                    alt={currentMethod.nombre} 
                                    className="h-3 w-auto object-contain shrink-0" 
                                  />
                                  <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                    {currentMethod.nombre}
                                  </span>
                                </>
                              ) : isOlva ? (
                                <>
                                  <img 
                                    src="/Olva-Courier-Logo.svg" 
                                    alt="Olva" 
                                    className="h-3 w-auto object-contain shrink-0" 
                                  />
                                  <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                    OLVA COURIER
                                  </span>
                                </>
                              ) : isShalom ? (
                                <>
                                  <img 
                                    src="/Shalom-Courier-Logo.webp" 
                                    alt="Shalom" 
                                    className="h-3 w-auto object-contain shrink-0" 
                                  />
                                  <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                    SHALOM
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="text-xs leading-none">🛵</span>
                                  <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                                    {currentMethod?.nombre || 'MOTORIZADO'}
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                          {cfgRotulado?.mostrar_tracking !== false && (
                            <span className="font-mono text-[9.5px] font-black text-slate-900 mt-0.5">
                              #{pedido.codigo_seguimiento}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Shipment Details */}
                      <div className="flex-1 flex flex-col justify-around py-1 space-y-1 overflow-hidden">
                        
                        {/* Destinatario */}
                        {cfgRotulado?.incluir_destinatario !== false && (
                          <div className="border-b border-dashed border-slate-300 pb-1">
                            <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                              {cfgRotulado?.titulo_destinatario || 'DESTINATARIO:'}
                            </span>
                            {cfgRotulado?.mostrar_cliente_nombre !== false && (
                              <strong className="text-base sm:text-lg font-black text-black block leading-tight pt-0.5 line-clamp-1 uppercase tracking-tight">
                                {recipientName}
                              </strong>
                            )}
                          </div>
                        )}

                        {/* DNI GIGANTE Y TELÉFONO */}
                        {(cfgRotulado?.mostrar_cliente_dni !== false || cfgRotulado?.mostrar_cliente_telefono !== false) && (
                          <div className={`p-1.5 rounded border flex items-center ${isShalom && cfgRotulado?.mostrar_cliente_telefono === false ? 'justify-center py-2' : 'justify-between'} ${
                            inkSavingLevel >= 75
                              ? 'bg-white border-black'
                              : 'bg-slate-100 border-slate-400'
                          }`}>
                            {cfgRotulado?.mostrar_cliente_dni !== false && (
                              <div className={isShalom && cfgRotulado?.mostrar_cliente_telefono === false ? 'text-center w-full' : ''}>
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block leading-none mb-0.5">
                                  {cfgRotulado?.titulo_cliente_dni || '🪪 DNI RECOJO:'}
                                </span>
                                <span className={`${getDniClass()} text-black tracking-widest block leading-tight`}>
                                  {clientDni}
                                </span>
                              </div>
                            )}
                            {cfgRotulado?.mostrar_cliente_telefono !== false && (
                              <div className="text-right">
                                <span className="text-[8px] font-black text-slate-600 uppercase tracking-widest block leading-none">
                                  {cfgRotulado?.titulo_cliente_telefono || 'TELÉFONO:'}
                                </span>
                                <span className="text-xs font-mono font-bold text-slate-900 block leading-tight">
                                  {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default || '-')}
                                </span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bloques Libres en Rótulo Masivo */}
                        {cfgRotulado?.bloques_personalizados && cfgRotulado.bloques_personalizados.length > 0 && (
                          <div className="space-y-0.5">
                            {cfgRotulado.bloques_personalizados.slice(0, 2).map(b => (
                              <div key={b.id} className="px-1.5 py-0.5 rounded border border-black text-center text-[7.5px] font-black uppercase">
                                {b.titulo && <span className="mr-1 text-slate-700">{b.titulo}:</span>}
                                <span>{b.contenido}</span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Agencia o Dirección Completa */}
                        {cfgRotulado?.mostrar_destino !== false && (
                          <div className="pt-0.5">
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block leading-none">
                              {cfgRotulado?.titulo_destino || (isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:')}
                            </span>
                            <p className="text-[10px] font-black text-black leading-tight pt-0.5 break-words">
                              {isShalom ? shalomAgency : pedido.destino_detalle}
                            </p>
                          </div>
                        )}

                        {/* Campos Personalizados de Rotulado Inteligente */}
                        {rotuladoFields.length > 0 && (
                          <div className="pt-0.5 border-t border-dashed border-slate-300 grid grid-cols-2 gap-1 text-[8px]">
                            {rotuladoFields.map(f => (
                              <div key={f.label} className="p-0.5 rounded bg-slate-50 border border-slate-300">
                                <span className="font-bold text-slate-500 uppercase">{f.label}: </span>
                                <strong className="font-black text-black">{f.valor}</strong>
                              </div>
                            ))}
                          </div>
                        )}

                      </div>

                      {/* Footer */}
                      <div className="pt-1 border-t-2 border-black flex items-center justify-between text-[8px] font-black text-slate-700 leading-none shrink-0">
                        <div className="flex items-center gap-1">
                          <span>📦</span>
                          <span>Paquete de Despacho Seguro</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span>★ ComiKids ★</span>
                        </div>
                      </div>

                    </div>
                  );
                })}
              </div>
            </div>
          ))}

        </div>

      </div>

    </div>,
    document.body
  );
};
