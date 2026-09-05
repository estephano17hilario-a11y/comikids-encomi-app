import React, { useMemo } from 'react';
import { Pedido, TallerConfig, MetodoEnvio, BloqueRotuladoPersonalizado } from '../../types/database.types';
import { formatDate } from '../../utils/formatters';
import { InkSavingLevel, getInkSavingStyles } from '../../utils/inkSavingService';
import { extractShalomDni } from '../../utils/shalomExcelExporter';
import { ordersService } from '../../services/ordersService';
import { resolveOrderShippingMethod } from '../../utils/shippingMethodMatcher';

interface Props {
  pedido: Pedido;
  tallerConfig: TallerConfig;
  inkSavingLevel?: InkSavingLevel;
  estiloRotuloOverride?: 'estandar_oficial' | 'vision_modern' | 'eco_ink_saving';
  orientacionOverride?: 'horizontal' | 'vertical';
  customMethodOverride?: MetodoEnvio;
}

export const ShalomLabelPrint: React.FC<Props> = ({
  pedido,
  tallerConfig,
  inkSavingLevel = 0,
  estiloRotuloOverride,
  orientacionOverride,
  customMethodOverride,
}) => {
  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');
  const isOlva = pedido.metodo_envio_codigo === 'olva' || pedido.destino_detalle?.toLowerCase().includes('olva');

  // Rotulado inteligente: Resolución infalible del método de la agencia
  const currentMethod = useMemo(() => {
    if (customMethodOverride) return customMethodOverride;
    const methods = ordersService.getShippingMethods();
    return resolveOrderShippingMethod(pedido, methods);
  }, [customMethodOverride, pedido]);

  const cfgRotulado = currentMethod?.config_rotulado;

  // Extracción inteligente y exhaustiva de datos de Quién Recibe (Destinatario)
  const clientRecipientName = useMemo(() => {
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
  }, [pedido]);

  const clientDni = useMemo(() => {
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
  }, [pedido]);

  const clientPhone = useMemo(() => {
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
    if (pedido.usuario?.telefono_default) return pedido.usuario.telefono_default;
    if (pedido.usuario?.dni?.length === 9 && pedido.usuario.dni.startsWith('9')) return pedido.usuario.dni;
    return '';
  }, [pedido]);

  // Orientación efectiva: 'horizontal' (Echado - Primera Imagen) | 'vertical' (Parado - Segunda Imagen)
  const effectiveOrientation: 'horizontal' | 'vertical' =
    orientacionOverride ||
    currentMethod?.config_rotulado?.orientacion ||
    'horizontal';

  // Estilo de rotulado efectivo
  const effectiveStyle: 'estandar_oficial' | 'vision_modern' | 'eco_ink_saving' =
    estiloRotuloOverride ||
    currentMethod?.config_rotulado?.estilo_rotulo ||
    tallerConfig.estilo_rotulo_default ||
    'estandar_oficial';

  // Datos 100% Personalizables del Emisor (Remitente)
  const senderCustom = currentMethod?.config_rotulado?.remitente_personalizado?.usar_personalizado
    ? currentMethod.config_rotulado.remitente_personalizado
    : undefined;

  const senderNombre = senderCustom?.nombre || tallerConfig.remitente_default?.nombre || tallerConfig.nombre_taller || 'Comikids Envíos';
  const senderRucDni = senderCustom?.ruc_dni || tallerConfig.remitente_default?.ruc_dni || tallerConfig.remitente_dni || tallerConfig.ruc_dni || '42020312';
  const senderCelular = senderCustom?.celular || tallerConfig.remitente_default?.celular || tallerConfig.remitente_celular || tallerConfig.celular_taller || '927781412';
  const senderOrigen = senderCustom?.direccion || tallerConfig.remitente_default?.direccion || tallerConfig.direccion_taller || 'Av. Gamarra 1234, La Victoria, Lima';
  const senderObservaciones = senderCustom?.observaciones || tallerConfig.remitente_default?.observaciones || '';

  // Datos seleccionados del formulario para mostrar en el rótulo con etiquetas personalizadas
  const rotuladoFields = useMemo(() => {
    if (cfgRotulado?.incluir_campos_personalizados === false) return [];

    const visibleList: { label: string; valor: string }[] = [];
    const seenFieldIds = new Set<string>();

    // 1. Mapeo de campos configurados en la agencia
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

      // Si no estaba en campos_personalizados pero corresponde a un dato nativo capturado
      if (!val || !String(val).trim()) {
        const fId = field.id.toLowerCase();
        const fLbl = field.label.toLowerCase();
        if (fId === 'c-mot-nombre' || fLbl.includes('recibe') || fLbl.includes('destinatario')) {
          val = clientRecipientName !== 'Cliente' ? clientRecipientName : undefined;
        } else if (fId === 'c-shalom-dni' || fId === 'c-olva-dni' || fLbl.includes('dni') || fLbl.includes('documento')) {
          val = clientDni !== 'No registrado' ? clientDni : undefined;
        } else if (fId === 'c-mot-tel' || fLbl.includes('tel') || fLbl.includes('cel')) {
          val = clientPhone || undefined;
        } else if (fLbl.includes('referencia')) {
          val = pedido.observaciones_cliente || undefined;
        } else if (fLbl.includes('bordado') || fLbl.includes('prenda')) {
          val = pedido.detalles_bordado || undefined;
        }
      }

      // Evitar duplicar DNI si ya tiene su bloque prominente especial, salvo que tenga etiqueta personalizada
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

    // 2. Mapeo de cualquier otro dato en campos_personalizados del pedido
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
  }, [pedido, currentMethod, cfgRotulado, clientRecipientName, clientDni, clientPhone]);

  const eco = getInkSavingStyles(inkSavingLevel);

  // Helper para renderizar bloques libres / notas especiales
  const renderBloquesPersonalizados = (pos: 'arriba' | 'medio' | 'abajo') => {
    const bloques = (cfgRotulado?.bloques_personalizados || []).filter(b => (b.posicion || 'medio') === pos);
    if (bloques.length === 0) return null;

    return (
      <div className="my-2 space-y-1.5">
        {bloques.map((b: BloqueRotuladoPersonalizado) => {
          const isAviso = b.tipo === 'aviso';
          const isFlete = b.tipo === 'flete';
          const isDestacado = b.tipo === 'destacado';

          return (
            <div
              key={b.id}
              className={`p-2 rounded-xl text-center border font-bold text-xs ${
                isAviso
                  ? 'bg-amber-100 border-amber-400 text-amber-950 font-black'
                  : isFlete
                  ? 'bg-rose-100 border-rose-400 text-rose-950 font-black'
                  : isDestacado
                  ? 'bg-purple-100 border-purple-400 text-purple-950'
                  : 'bg-slate-100 border-slate-300 text-slate-900'
              }`}
            >
              {b.titulo && (
                <span className="block text-[9.5px] uppercase font-black tracking-wider leading-none mb-0.5">
                  {b.titulo}
                </span>
              )}
              <span className="block leading-snug">{b.contenido}</span>
            </div>
          );
        })}
      </div>
    );
  };

  // Helper para tamaño de DNI
  const getDniSizeClass = () => {
    const sz = cfgRotulado?.tamano_dni || 'gigante';
    if (sz === 'normal') return 'text-sm sm:text-base font-bold';
    if (sz === 'grande') return 'text-base sm:text-lg font-black';
    return 'text-xl sm:text-2xl font-black'; // gigante
  };

  // =========================================================================
  // MODO 1: ECHADO / HORIZONTAL (100% FIEL A LA PRIMERA IMAGEN DE ROTULADO)
  // =========================================================================
  if (effectiveOrientation === 'horizontal') {
    return (
      <div
        id="shalom-print-area"
        className={`w-full max-w-[430px] mx-auto p-3.5 sm:p-4 rounded-2xl bg-white text-slate-900 border-2 border-dashed ${
          inkSavingLevel >= 75 ? 'border-slate-700' : 'border-black'
        } shadow-xl print:shadow-none font-sans relative overflow-hidden transition-all`}
        style={{ fontFamily: eco.fontFamily }}
      >
        {/* Cabecera Superior: Logo ComiKids / Sender, Subtítulo & Badge Carrier / Tracking */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2 shrink-0">
          <div className="flex items-center gap-2">
            {cfgRotulado?.mostrar_logo_empresa !== false && (
              <img
                src={tallerConfig.logo_url || '/Comikids.png'}
                alt={senderNombre}
                className={`w-8 h-8 object-contain shrink-0 ${inkSavingLevel >= 75 ? 'grayscale' : ''}`}
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
              />
            )}
            <div>
              <h2 className="text-sm font-black uppercase text-black leading-none tracking-tight">
                {senderNombre}
              </h2>
              <span className="text-[8.5px] font-black uppercase tracking-widest text-slate-600 block mt-0.5">
                {cfgRotulado?.subtitulo_cabecera || 'ENCOMI ENVÍOS'}
              </span>
            </div>
          </div>

          <div className="text-right flex flex-col items-end">
            {cfgRotulado?.mostrar_logo_agencia !== false && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-black leading-none ${
                inkSavingLevel >= 50
                  ? 'bg-white text-black'
                  : isOlva ? 'bg-yellow-300 text-black' : isShalom ? 'bg-slate-100 text-black' : 'bg-slate-100 text-black'
              }`}>
                {currentMethod?.foto_url ? (
                  <>
                    <img src={currentMethod.foto_url} alt="" className="h-3 w-auto object-contain shrink-0" />
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                      {currentMethod.nombre}
                    </span>
                  </>
                ) : isOlva ? (
                  <>
                    <img src="/Olva-Courier-Logo.svg" alt="" className="h-3 w-auto object-contain shrink-0" />
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-black">OLVA COURIER</span>
                  </>
                ) : isShalom ? (
                  <>
                    <img src="/Shalom-Courier-Logo.webp" alt="" className="h-3 w-auto object-contain shrink-0" />
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-black">SHALOM VIP</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs leading-none">🛵</span>
                    <span className="text-[8.5px] font-black uppercase tracking-wider text-black">
                      {currentMethod?.nombre || 'MOTORIZADO LOCAL LIMA'}
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

        {/* Bloques Libres Arriba */}
        {renderBloquesPersonalizados('arriba')}

        {/* Barcode opcional en horizontal si está habilitado */}
        {cfgRotulado?.mostrar_barcode !== false && (
          <div className="mb-2 p-1.5 border border-slate-300 rounded-lg text-center bg-slate-50/50">
            <div className="flex justify-center items-center gap-0.5 h-6 mb-0.5">
              {[3, 1, 5, 2, 6, 2, 1, 4, 2, 5, 2, 1, 3, 5, 2, 4, 2, 6, 1, 3, 2, 5, 2, 3, 1, 5, 2, 2, 4, 1, 3].map((w, i) => (
                <div key={i} className="bg-black h-full" style={{ width: `${w}px` }} />
              ))}
            </div>
            <span className="font-mono text-[9px] font-black text-black">#{pedido.codigo_seguimiento}</span>
          </div>
        )}

        {/* Bloque Destinatario Principal (Idéntico a Primera Imagen) */}
        {cfgRotulado?.incluir_destinatario !== false && (
          <div className="border-b border-dashed border-slate-300 pb-1.5 mb-2">
            <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
              {cfgRotulado?.titulo_destinatario || 'DESTINATARIO:'}
            </span>
            {cfgRotulado?.mostrar_cliente_nombre !== false && (
              <h3 className="text-lg sm:text-xl font-black text-black block leading-tight pt-0.5 uppercase tracking-tight break-words">
                {clientRecipientName}
              </h3>
            )}
          </div>
        )}

        {/* Recuadro Destacado: DNI RECOJO & TELÉFONO */}
        {(cfgRotulado?.mostrar_cliente_dni !== false || cfgRotulado?.mostrar_cliente_telefono !== false) && (
          <div className={`p-2.5 rounded-xl border flex items-center mb-2.5 ${
            isShalom && cfgRotulado?.mostrar_cliente_telefono === false ? 'justify-center py-2.5' : 'justify-between'
          } ${
            inkSavingLevel >= 75
              ? 'bg-white border-black'
              : 'bg-slate-100/90 border-slate-300'
          }`}>
            {cfgRotulado?.mostrar_cliente_dni !== false && (
              <div className={isShalom && cfgRotulado?.mostrar_cliente_telefono === false ? 'text-center w-full' : ''}>
                <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-widest block leading-none mb-0.5">
                  {cfgRotulado?.titulo_cliente_dni || '🪪 DNI RECOJO:'}
                </span>
                <span className={`${getDniSizeClass()} font-mono text-black tracking-widest block leading-tight`}>
                  {clientDni}
                </span>
              </div>
            )}
            {cfgRotulado?.mostrar_cliente_telefono !== false && (
              <div className="text-right">
                <span className="text-[8.5px] font-black text-slate-600 uppercase tracking-widest block leading-none">
                  {cfgRotulado?.titulo_cliente_telefono || 'TELÉFONO:'}
                </span>
                <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 block leading-tight mt-0.5">
                  {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default ? `+51 ${pedido.usuario.telefono_default}` : '-')}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Bloques Libres Medio */}
        {renderBloquesPersonalizados('medio')}

        {/* Dirección o Sucursal Destino */}
        {cfgRotulado?.mostrar_destino !== false && (
          <div className="mb-2">
            <span className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest block leading-none">
              {cfgRotulado?.titulo_destino || (isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA:')}
            </span>
            <p className="text-[11.5px] sm:text-xs font-black text-black leading-snug pt-0.5 break-words">
              {pedido.destino_detalle}
            </p>
          </div>
        )}

        {/* Campos Personalizados de Rotulado Inteligente */}
        {rotuladoFields.length > 0 && (
          <div className="mb-2 pt-1 border-t border-dashed border-slate-300 grid grid-cols-2 gap-1 text-[8.5px]">
            {rotuladoFields.map(f => (
              <div key={f.label} className="p-1 rounded bg-slate-50 border border-slate-200">
                <span className="font-bold text-slate-500 uppercase">{f.label}: </span>
                <strong className="font-black text-black">{f.valor}</strong>
              </div>
            ))}
          </div>
        )}

        {/* Remitente opcional en modo horizontal */}
        {cfgRotulado?.incluir_remitente !== false && (
          <div className="mb-2 p-2 rounded-xl bg-slate-50 border border-slate-200 text-[9.5px] text-slate-700">
            <span className="font-black text-black uppercase block">
              {cfgRotulado?.titulo_remitente || 'REMITENTE:'} {cfgRotulado?.mostrar_remitente_nombre !== false ? senderNombre : ''}
            </span>
            <div className="flex items-center justify-between mt-0.5 text-[9px]">
              {cfgRotulado?.mostrar_remitente_ruc_dni !== false && (
                <span><strong>RUC/DNI:</strong> {senderRucDni}</span>
              )}
              {cfgRotulado?.mostrar_remitente_telefono !== false && (
                <span><strong>Cel:</strong> {senderCelular}</span>
              )}
            </div>
            {cfgRotulado?.mostrar_remitente_origen !== false && (
              <p className="text-[8.5px] text-slate-600 truncate mt-0.5"><strong>Origen:</strong> {senderOrigen}</p>
            )}
          </div>
        )}

        {/* Bloques Libres Abajo */}
        {renderBloquesPersonalizados('abajo')}

        {/* Footer Oficial Idéntico a Primera Imagen */}
        {cfgRotulado?.mostrar_fecha_sello !== false && (
          <div className="pt-2 border-t-2 border-black flex items-center justify-between text-[8.5px] font-black text-slate-700 leading-none shrink-0">
            <div className="flex items-center gap-1">
              <span>📦</span>
              <span>{cfgRotulado?.texto_sello_personalizado || 'Paquete de Despacho Seguro'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>★ {senderNombre || 'ComiKids'} ★</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // MODO 2: PARADO / VERTICAL (SEGUNDA IMAGEN)
  // VARIANTE 1: ESTILO MODERNO MINIMALISTA VISION
  // =========================================================================
  if (effectiveStyle === 'vision_modern') {
    return (
      <div
        id="shalom-print-area"
        className="w-full max-w-115 mx-auto p-4 sm:p-5 rounded-3xl border-2 border-slate-800 bg-white text-slate-900 shadow-2xl relative overflow-hidden transition-all duration-200 font-sans"
      >
        {/* Modern Header Banner */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            {cfgRotulado?.mostrar_logo_empresa !== false && (
              <img
                src={tallerConfig.logo_url || '/Comikids.png'}
                alt={tallerConfig.nombre_taller || 'Empresa'}
                className="w-10 h-10 object-contain rounded-xl border border-slate-200 shadow-sm shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
              />
            )}
            <div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-slate-950 leading-tight">
                  {senderNombre}
                </h2>
                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-slate-900 text-white tracking-wider">
                  VISION
                </span>
              </div>
              <span className="text-[10px] text-slate-500 font-medium block">
                {cfgRotulado?.subtitulo_cabecera || 'Guía de Despacho Prioritaria'}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            {cfgRotulado?.mostrar_logo_agencia !== false && (
              <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-300 text-slate-900 font-black text-[10px] uppercase">
                {currentMethod?.foto_url ? (
                  <img src={currentMethod.foto_url} alt="" className="h-3.5 w-auto object-contain" />
                ) : isOlva ? (
                  <img src="/Olva-Courier-Logo.svg" alt="" className="h-3 w-auto object-contain" />
                ) : isShalom ? (
                  <img src="/Shalom-Courier-Logo.webp" alt="" className="h-3 w-auto object-contain" />
                ) : (
                  <span>🚚</span>
                )}
                <span>{currentMethod?.nombre || 'EXPRESS'}</span>
              </div>
            )}
            {cfgRotulado?.mostrar_tracking !== false && (
              <p className="font-mono font-black text-xs text-slate-950 mt-1">
                #{pedido.codigo_seguimiento}
              </p>
            )}
          </div>
        </div>

        {/* Bloques Libres Arriba */}
        {renderBloquesPersonalizados('arriba')}

        {/* Barcode Modern Box */}
        {cfgRotulado?.mostrar_barcode !== false && (
          <div className="mb-3 p-2 rounded-2xl bg-slate-50 border border-slate-200 text-center">
            <div className="flex justify-center items-center gap-0.5 h-7 mb-1">
              {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 5, 3, 8, 2, 4, 3, 6, 2, 4, 2, 7, 2, 3, 5, 2, 4].map((w, i) => (
                <div key={i} className="bg-slate-900 h-full" style={{ width: `${w}px` }} />
              ))}
            </div>
            <span className="font-mono text-[10.5px] font-black text-slate-800 tracking-wider">
              *{pedido.codigo_seguimiento}*
            </span>
          </div>
        )}

        {/* Destino Banner */}
        {cfgRotulado?.mostrar_destino !== false && (
          <div className="mb-3 p-3 rounded-2xl bg-slate-950 text-white text-center shadow-md">
            <span className="text-[9.5px] font-bold uppercase tracking-widest text-slate-400 block mb-0.5">
              {cfgRotulado?.titulo_destino || '📍 DESTINO OFICIAL DE ENTREGA'}
            </span>
            <h3 className="text-base sm:text-lg font-black uppercase leading-tight tracking-tight text-white break-words">
              {pedido.destino_detalle}
            </h3>
          </div>
        )}

        {/* Card Destinatario */}
        {cfgRotulado?.incluir_destinatario !== false && (
          <div className="mb-3 p-3.5 rounded-2xl border border-slate-300 bg-white space-y-2">
            <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {cfgRotulado?.titulo_destinatario || '👤 DESTINATARIO'}
              </span>
              {cfgRotulado?.mostrar_badge_modalidad !== false && (
                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 uppercase">
                  {cfgRotulado?.texto_badge_modalidad || (isShalom || isOlva ? 'RECOJO EN AGENCIA' : 'ENTREGA A DOMICILIO')}
                </span>
              )}
            </div>

            {cfgRotulado?.mostrar_cliente_nombre !== false && (
              <div>
                <span className="text-[10px] text-slate-500 block font-medium">
                  {cfgRotulado?.titulo_cliente_nombre || 'Cliente:'}
                </span>
                <span className="text-base sm:text-lg font-black uppercase text-slate-950 leading-snug block">
                  {clientRecipientName}
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 pt-1">
              {cfgRotulado?.mostrar_cliente_dni !== false && (
                <div className={`p-2 rounded-xl bg-slate-100 border border-slate-200 ${cfgRotulado?.mostrar_cliente_telefono === false ? 'col-span-2 text-center' : ''}`}>
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500 block">
                    {cfgRotulado?.titulo_cliente_dni || '🪪 DNI / DOCUMENTO:'}
                  </span>
                  <span className={`${getDniSizeClass()} font-mono font-black text-slate-950 block leading-tight mt-0.5 tracking-wider`}>
                    {clientDni}
                  </span>
                </div>
              )}

              {cfgRotulado?.mostrar_cliente_telefono !== false && (
                <div className={`p-2 rounded-xl bg-slate-100 border border-slate-200 ${cfgRotulado?.mostrar_cliente_dni === false ? 'col-span-2' : ''}`}>
                  <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-500 block">
                    {cfgRotulado?.titulo_cliente_telefono || '📱 TELÉFONO / WHATSAPP:'}
                  </span>
                  <span className="text-xs sm:text-sm font-mono font-bold text-slate-900 block leading-tight mt-1">
                    {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default ? `+51 ${pedido.usuario.telefono_default}` : '-')}
                  </span>
                </div>
              )}
            </div>

            {rotuladoFields.length > 0 && (
              <div className="pt-2 border-t border-slate-100 grid grid-cols-2 gap-1.5">
                {rotuladoFields.map(f => (
                  <div key={f.label} className="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-[10px]">
                    <span className="font-bold text-slate-500 block text-[8px] uppercase">{f.label}:</span>
                    <span className="font-bold text-slate-900 truncate block">{f.valor}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bloques Libres Medio */}
        {renderBloquesPersonalizados('medio')}

        {/* Card Remitente (Personalizado o Global) */}
        {cfgRotulado?.incluir_remitente !== false && (
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-[10.5px] space-y-1">
            <div className="flex items-center justify-between font-black text-slate-800 text-[10px] uppercase">
              <span>{cfgRotulado?.titulo_remitente || '🏢 REMITENTE OFICIAL:'}</span>
              {cfgRotulado?.mostrar_remitente_nombre !== false && (
                <span className="font-bold text-slate-900">{senderNombre}</span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-700 pt-0.5">
              {cfgRotulado?.mostrar_remitente_ruc_dni !== false && (
                <p><strong className="text-slate-900">RUC/DNI:</strong> {senderRucDni}</p>
              )}
              {cfgRotulado?.mostrar_remitente_telefono !== false && (
                <p><strong className="text-slate-900">Cel:</strong> {senderCelular}</p>
              )}
            </div>
            {cfgRotulado?.mostrar_remitente_origen !== false && (
              <p className="text-slate-600 text-[10px] truncate"><strong className="text-slate-900">Origen:</strong> {senderOrigen}</p>
            )}
            {senderObservaciones && (
              <p className="text-purple-700 text-[9.5px] font-bold italic pt-0.5">Nota: {senderObservaciones}</p>
            )}
          </div>
        )}

        {/* Bloques Libres Abajo */}
        {renderBloquesPersonalizados('abajo')}

        {/* Footer Sello */}
        {cfgRotulado?.mostrar_fecha_sello !== false && (
          <div className="mt-2.5 pt-2 border-t border-slate-200 flex items-center justify-between text-[9.5px] text-slate-500 font-mono">
            <span>📦 {cfgRotulado?.texto_sello_personalizado || 'Paquete Inspeccionado y Seguro'}</span>
            <span>{formatDate(new Date().toISOString())}</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VARIANTE 2: ESTILO COMPACTO ECO ULTRA-AHORRO (100% LINEAL, 0% RELLENO NEGRO)
  // =========================================================================
  if (effectiveStyle === 'eco_ink_saving') {
    return (
      <div
        id="shalom-print-area"
        className="w-full max-w-115 mx-auto p-3.5 sm:p-4 rounded-2xl border-2 border-dashed border-slate-700 bg-white text-black shadow-none relative overflow-hidden font-sans text-xs"
      >
        {/* Header Eco */}
        <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
          <div className="flex items-center gap-2">
            {cfgRotulado?.mostrar_logo_empresa !== false && (
              <img
                src={tallerConfig.logo_url || '/Comikids.png'}
                alt="Logo"
                className="w-8 h-8 object-contain grayscale shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
              />
            )}
            <div>
              <h2 className="text-sm font-black uppercase text-black leading-none">{senderNombre}</h2>
              <span className="text-[9px] text-slate-600 font-bold block mt-0.5">
                {cfgRotulado?.subtitulo_cabecera || 'DESPACHO ECO AHORRO'}
              </span>
            </div>
          </div>

          <div className="text-right shrink-0">
            {cfgRotulado?.mostrar_logo_agencia !== false && (
              <span className="inline-block px-2 py-0.5 border border-black rounded text-[9px] font-black uppercase">
                {currentMethod?.nombre || 'OFICIAL'}
              </span>
            )}
            {cfgRotulado?.mostrar_tracking !== false && (
              <p className="font-mono font-black text-xs text-black mt-0.5">
                #{pedido.codigo_seguimiento}
              </p>
            )}
          </div>
        </div>

        {/* Bloques Libres Arriba */}
        {renderBloquesPersonalizados('arriba')}

        {/* Barcode Eco */}
        {cfgRotulado?.mostrar_barcode !== false && (
          <div className="mb-2 p-1.5 border border-slate-400 rounded-xl text-center">
            <div className="flex justify-center items-center gap-0.5 h-6 mb-0.5">
              {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 5, 3, 8, 2, 4, 3, 6, 2, 4, 2, 7, 2, 3, 5, 2, 4].map((w, i) => (
                <div key={i} className="bg-black h-full" style={{ width: `${Math.max(1, Math.round(w * 0.7))}px` }} />
              ))}
            </div>
            <span className="font-mono text-[10px] font-black text-black">
              #{pedido.codigo_seguimiento}
            </span>
          </div>
        )}

        {/* Destino Eco */}
        {cfgRotulado?.mostrar_destino !== false && (
          <div className="mb-2 p-2 border-2 border-black rounded-xl text-center">
            <span className="text-[9px] font-black uppercase tracking-wider text-slate-700 block">
              {cfgRotulado?.titulo_destino || 'DESTINO:'}
            </span>
            <h3 className="text-sm sm:text-base font-black uppercase text-black leading-tight break-words">
              {pedido.destino_detalle}
            </h3>
          </div>
        )}

        {/* Destinatario Eco */}
        {cfgRotulado?.incluir_destinatario !== false && (
          <div className="mb-2 p-2.5 border border-black rounded-xl space-y-1.5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1">
              <span className="text-[9px] text-slate-600 font-black uppercase">
                {cfgRotulado?.titulo_destinatario || 'DESTINATARIO:'}
              </span>
              {cfgRotulado?.mostrar_badge_modalidad !== false && (
                <span className="text-[8px] font-bold px-1.5 py-0.2 rounded border border-black uppercase">
                  {cfgRotulado?.texto_badge_modalidad || (isShalom || isOlva ? 'RECOJO AGENCIA' : 'DOMICILIO')}
                </span>
              )}
            </div>

            {cfgRotulado?.mostrar_cliente_nombre !== false && (
              <div>
                <span className="text-base font-black uppercase text-black leading-tight block">
                  {clientRecipientName}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between border-t border-slate-300 pt-1">
              {cfgRotulado?.mostrar_cliente_dni !== false && (
                <div>
                  <span className="text-[8px] font-bold uppercase text-slate-600 block">
                    {cfgRotulado?.titulo_cliente_dni || 'DNI / CE:'}
                  </span>
                  <span className={`${getDniSizeClass()} font-mono font-black text-black block leading-none`}>
                    {clientDni}
                  </span>
                </div>
              )}
              {cfgRotulado?.mostrar_cliente_telefono !== false && (
                <div className="text-right">
                  <span className="text-[8px] font-bold uppercase text-slate-600 block">
                    {cfgRotulado?.titulo_cliente_telefono || 'TELÉFONO:'}
                  </span>
                  <span className="text-xs font-mono font-bold text-black block leading-none">
                    {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default ? `+51 ${pedido.usuario.telefono_default}` : '-')}
                  </span>
                </div>
              )}
            </div>

            {rotuladoFields.length > 0 && (
              <div className="pt-1 border-t border-slate-200 grid grid-cols-2 gap-1 text-[9px]">
                {rotuladoFields.map(f => (
                  <p key={f.label}><strong className="text-black">{f.label}:</strong> {f.valor}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bloques Libres Medio */}
        {renderBloquesPersonalizados('medio')}

        {/* Remitente Eco */}
        {cfgRotulado?.incluir_remitente !== false && (
          <div className="p-2 border border-slate-400 rounded-xl text-[9.5px] space-y-0.5 text-slate-800">
            <p className="font-black text-black uppercase">
              {cfgRotulado?.titulo_remitente || 'REMITENTE:'} {cfgRotulado?.mostrar_remitente_nombre !== false ? senderNombre : ''}
            </p>
            <div className="flex items-center justify-between">
              {cfgRotulado?.mostrar_remitente_ruc_dni !== false && (
                <span><strong>DNI/RUC:</strong> {senderRucDni}</span>
              )}
              {cfgRotulado?.mostrar_remitente_telefono !== false && (
                <span><strong>Cel:</strong> {senderCelular}</span>
              )}
            </div>
            {cfgRotulado?.mostrar_remitente_origen !== false && (
              <p className="truncate"><strong>Origen:</strong> {senderOrigen}</p>
            )}
          </div>
        )}

        {/* Bloques Libres Abajo */}
        {renderBloquesPersonalizados('abajo')}

        {/* Sello Footer */}
        {cfgRotulado?.mostrar_fecha_sello !== false && (
          <div className="mt-1.5 pt-1 border-t border-slate-300 flex items-center justify-between text-[8.5px] text-slate-600">
            <span>📦 {cfgRotulado?.texto_sello_personalizado || 'Encomienda Eco'}</span>
            <span>{formatDate(new Date().toISOString())}</span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VARIANTE 3 (POR DEFECTO): ESTÁNDAR OFICIAL ENCOMI (CLÁSICO ALTA VISIBILIDAD)
  // =========================================================================
  return (
    <div
      id="shalom-print-area"
      className={`w-full max-w-110 mx-auto p-4 sm:p-5 rounded-3xl ${eco.containerBorder} shadow-2xl relative overflow-hidden transition-all duration-200 bg-white text-slate-900`}
      style={{ fontFamily: eco.fontFamily }}
    >
      {/* Top Header ComiKids & Badge con Logo Shalom / Olva / Moto */}
      <div className={`flex items-center justify-between border-b-2 border-dashed ${inkSavingLevel >= 50 ? 'border-slate-400' : 'border-pink-500'} pb-2.5 mb-2.5`}>
        <div className="flex items-center gap-2">
          {cfgRotulado?.mostrar_logo_empresa !== false && (
            <img
              src={tallerConfig.logo_url || '/Comikids.png'}
              alt={senderNombre}
              className={`w-10 h-10 object-contain rounded-xl shadow shrink-0 ${inkSavingLevel >= 75 ? 'grayscale contrast-125' : ''}`}
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/Comikids.png'; }}
            />
          )}
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 leading-none">
              {senderNombre}
            </h2>
            <span className="text-[10px] text-slate-500 font-bold block mt-0.5">
              {cfgRotulado?.subtitulo_cabecera || 'Envíos Seguros'}
            </span>
          </div>
        </div>

        <div className="text-right shrink-0">
          {cfgRotulado?.mostrar_logo_agencia !== false && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black text-[10px] uppercase mb-1 ${eco.badgeCarrier}`}>
              {currentMethod?.foto_url ? (
                <>
                  <img
                    src={currentMethod.foto_url}
                    alt={currentMethod.nombre}
                    className="h-4 w-auto max-w-16 object-contain"
                  />
                  <span>{currentMethod.nombre}</span>
                </>
              ) : isOlva ? (
                <>
                  <img
                    src="/Olva-Courier-Logo.svg"
                    alt="Olva"
                    className="h-3.5 w-auto object-contain"
                  />
                  <span>OLVA COURIER</span>
                </>
              ) : isShalom ? (
                <>
                  <img
                    src="/Shalom-Courier-Logo.webp"
                    alt="Shalom"
                    className="h-3.5 w-auto object-contain"
                  />
                  <span>SHALOM VIP</span>
                </>
              ) : (
                <>
                  <span>🛵</span>
                  <span>{currentMethod?.nombre || 'MOTORIZADO'}</span>
                </>
              )}
            </div>
          )}
          {cfgRotulado?.mostrar_tracking !== false && (
            <p className="font-mono font-black text-xs text-slate-900 pt-0.5">
              #{pedido.codigo_seguimiento}
            </p>
          )}
        </div>
      </div>

      {/* Bloques Libres Arriba */}
      {renderBloquesPersonalizados('arriba')}

      {/* Barcode Simulation */}
      {cfgRotulado?.mostrar_barcode !== false && (
        <div className={`my-2 p-2 rounded-2xl border ${inkSavingLevel >= 50 ? 'bg-white border-slate-400' : 'bg-cyan-50/70 border-cyan-300'} text-center`}>
          <div className={`flex justify-center items-center gap-0.5 ${eco.barcodeHeight} mb-1`}>
            {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 5, 3, 8, 2, 4, 3, 6, 2, 4, 2, 7, 2, 3, 5, 2, 4].map((w, i) => (
              <div
                key={i}
                className={`${eco.barcodeBar} h-full`}
                style={{ width: `${Math.max(1, Math.round(w * eco.barcodeMultiplier))}px` }}
              />
            ))}
          </div>
          <span className="font-mono text-[11px] tracking-widest font-black text-slate-900">
            ⭐ #{pedido.codigo_seguimiento} ⭐
          </span>
        </div>
      )}

      {/* DESTINO DESTACADO */}
      {cfgRotulado?.mostrar_destino !== false && (
        <div className={`${eco.destinoBox} rounded-2xl mb-2.5 text-center`}>
          <span className={`text-[10px] uppercase tracking-wider ${eco.destinoSub} flex items-center justify-center gap-1`}>
            <span>🚀</span>
            <span>
              {cfgRotulado?.titulo_destino || (isOlva ? 'DESTINO OLVA COURIER:' : isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA MOTORIZADO:')}
            </span>
          </span>
          <h2 className={`text-base sm:text-lg uppercase tracking-tight leading-tight mt-0.5 ${eco.destinoTitle} break-words`}>
            {pedido.destino_detalle}
          </h2>
        </div>
      )}

      {/* SECCIÓN CONSIGNATARIO (DESTINATARIO) CON DNI GIGANTE */}
      {cfgRotulado?.incluir_destinatario !== false && (
        <div className={`rounded-2xl p-3 mb-2.5 ${eco.sectionBg}`}>
          <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
            <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1">
              <span>👤</span>
              <span>{cfgRotulado?.titulo_destinatario || 'DESTINATARIO (CLIENTE)'}</span>
            </span>
            {cfgRotulado?.mostrar_badge_modalidad !== false && (
              <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300 uppercase">
                {cfgRotulado?.texto_badge_modalidad || (isShalom || isOlva ? 'RECOJO EN AGENCIA' : 'ENTREGA A DOMICILIO')}
              </span>
            )}
          </div>

          <div className="space-y-2 text-xs text-slate-900">
            {cfgRotulado?.mostrar_cliente_nombre !== false && (
              <div>
                <span className={eco.subtleText}>
                  {cfgRotulado?.titulo_cliente_nombre || 'Nombre del Cliente:'}
                </span>{' '}
                <span className="font-black text-lg sm:text-xl uppercase block text-slate-950 leading-snug tracking-tight">
                  {clientRecipientName}
                </span>
              </div>
            )}

            {/* DNI GIGANTE Y DESTACADO */}
            {(cfgRotulado?.mostrar_cliente_dni !== false || cfgRotulado?.mostrar_cliente_telefono !== false) && (
              <div className={`${eco.dniBox} rounded-xl flex items-center ${isShalom && cfgRotulado?.mostrar_cliente_telefono === false ? 'justify-center py-2' : 'justify-between'} shadow-xs`}>
                {cfgRotulado?.mostrar_cliente_dni !== false && (
                  <div className={isShalom && cfgRotulado?.mostrar_cliente_telefono === false ? 'text-center w-full' : ''}>
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block leading-none mb-0.5">
                      {cfgRotulado?.titulo_cliente_dni || '🪪 DNI / DOC RECOJO:'}
                    </span>
                    <span className={`${getDniSizeClass()} block leading-tight mt-0.5 ${eco.dniText} font-mono tracking-wider`}>
                      {clientDni}
                    </span>
                  </div>
                )}
                {cfgRotulado?.mostrar_cliente_telefono !== false && (
                  <div className="text-right">
                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block leading-none">
                      {cfgRotulado?.titulo_cliente_telefono || 'TELÉFONO:'}
                    </span>
                    <span className="text-sm sm:text-base font-mono font-bold text-slate-900 block leading-tight mt-0.5">
                      {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default ? `+51 ${pedido.usuario.telefono_default}` : '-')}
                    </span>
                  </div>
                )}
              </div>
            )}

            {!isShalom && (pedido.usuario?.email || pedido.usuario?.email_default) && (
              <p className="pt-0.5 text-[10.5px]">
                <span className={eco.subtleText}>Correo:</span>{' '}
                <span className="font-mono font-bold text-slate-800">{pedido.usuario.email || pedido.usuario.email_default}</span>
              </p>
            )}

            {/* CAMPOS PERSONALIZADOS - ROTULADO INTELIGENTE */}
            {rotuladoFields.length > 0 && (
              <div className="mt-2 pt-1.5 border-t border-slate-300 grid grid-cols-2 gap-1.5">
                {rotuladoFields.map(f => (
                  <div key={f.label} className="p-1.5 rounded-lg bg-white border border-slate-300">
                    <span className="text-[8px] font-black uppercase tracking-wider text-slate-500 block leading-none">
                      {f.label}:
                    </span>
                    <span className="text-xs font-bold text-slate-900 block truncate leading-tight mt-0.5">
                      {f.valor}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bloques Libres Medio */}
      {renderBloquesPersonalizados('medio')}

      {/* SECCIÓN REMITENTE (100% PERSONALIZABLE O GLOBAL) */}
      {cfgRotulado?.incluir_remitente !== false && (
        <div className={`rounded-xl p-2.5 mb-2 text-[10.5px] ${eco.sectionBg} space-y-0.5`}>
          <div className="font-black uppercase text-slate-800 mb-0.5 flex items-center justify-between">
            <span>{cfgRotulado?.titulo_remitente || 'REMITENTE OFICIAL:'}</span>
            {cfgRotulado?.mostrar_remitente_nombre !== false && (
              <span className="font-bold text-slate-900">{senderNombre}</span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-slate-700">
            {cfgRotulado?.mostrar_remitente_ruc_dni !== false && (
              <p><span className="font-bold">DNI/RUC:</span> {senderRucDni}</p>
            )}
            {cfgRotulado?.mostrar_remitente_telefono !== false && (
              <p><span className="font-bold">Celular:</span> {senderCelular}</p>
            )}
          </div>
          {cfgRotulado?.mostrar_remitente_origen !== false && (
            <p className="text-slate-600 text-[10px]"><span className="font-bold">Origen:</span> {senderOrigen}</p>
          )}
          {senderObservaciones && (
            <p className="text-purple-700 text-[9.5px] font-bold italic pt-0.5">Nota: {senderObservaciones}</p>
          )}
        </div>
      )}

      {/* Bloques Libres Abajo */}
      {renderBloquesPersonalizados('abajo')}

      {/* DETALLES DE PAQUETE */}
      {cfgRotulado?.mostrar_fecha_sello !== false && (
        <div className="border-t border-dashed border-slate-300 pt-1.5 flex items-center justify-between text-[10px] text-slate-600">
          <div className="flex items-center gap-1 font-bold text-slate-800">
            <span>📦</span>
            <span>{cfgRotulado?.texto_sello_personalizado || 'Paquete de Despacho Seguro'}</span>
          </div>
          <div className="font-bold text-slate-700">
            Impreso el {formatDate(new Date().toISOString())}
          </div>
        </div>
      )}
    </div>
  );
};
