import React from 'react';
import { Pedido, TallerConfig } from '../../types/database.types';
import { formatDate } from '../../utils/formatters';
import { InkSavingLevel, getInkSavingStyles } from '../../utils/inkSavingService';
import { extractShalomDni } from '../../utils/shalomExcelExporter';

interface Props {
  pedido: Pedido;
  tallerConfig: TallerConfig;
  inkSavingLevel?: InkSavingLevel;
}

export const ShalomLabelPrint: React.FC<Props> = ({ pedido, tallerConfig, inkSavingLevel = 0 }) => {
  const isShalom = pedido.metodo_envio_codigo === 'shalom' || pedido.destino_detalle?.toLowerCase().includes('shalom');
  const isOlva = pedido.metodo_envio_codigo === 'olva' || pedido.destino_detalle?.toLowerCase().includes('olva');
  const clientPhone = pedido.usuario?.telefono_default || (pedido.usuario?.dni?.length === 9 ? pedido.usuario.dni : '');

  const getClientDni = () => {
    const extracted = extractShalomDni(pedido);
    if (extracted && extracted !== 'NCIADOS' && extracted.length >= 6) {
      return extracted;
    }
    if (pedido.usuario?.dni && pedido.usuario.dni.length >= 8 && !pedido.usuario.dni.startsWith('9')) {
      return pedido.usuario.dni;
    }
    if (pedido.usuario?.dni_default) {
      return pedido.usuario.dni_default;
    }
    return 'No registrado';
  };

  const clientDni = getClientDni();
  const eco = getInkSavingStyles(inkSavingLevel);

  return (
    <div
      id="shalom-print-area"
      className={`w-full max-w-110 mx-auto p-4 sm:p-5 rounded-3xl ${eco.containerBorder} shadow-2xl relative overflow-hidden transition-all duration-200`}
      style={{ fontFamily: eco.fontFamily }}
    >
      {/* Top Header ComiKids & Badge con Logo Shalom / Olva / Moto */}
      <div className={`flex items-center justify-between border-b-2 border-dashed ${inkSavingLevel >= 50 ? 'border-slate-400' : 'border-pink-500'} pb-2.5 mb-2.5`}>
        <div className="flex items-center gap-2">
          <img
            src="/Comikids.png"
            alt="ComiKids"
            className={`w-10 h-10 object-contain rounded-xl shadow ${inkSavingLevel >= 75 ? 'grayscale contrast-125' : ''}`}
          />
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 leading-none">
              ComiKids
            </h2>
            <span className="text-[10px] text-slate-500 font-bold">Envíos Seguros</span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-black text-[10px] uppercase mb-1 ${eco.badgeCarrier}`}>
            {isOlva ? (
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
                <span>MOTORIZADO</span>
              </>
            )}
          </div>
          <p className="font-mono font-black text-xs text-slate-900 pt-0.5">
            #{pedido.codigo_seguimiento}
          </p>
        </div>
      </div>

      {/* Barcode Simulation with Eco-Print calculation */}
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

      {/* DESTINO DESTACADO */}
      <div className={`${eco.destinoBox} rounded-2xl mb-2.5 text-center`}>
        <span className={`text-[10px] uppercase tracking-wider ${eco.destinoSub} flex items-center justify-center gap-1`}>
          <span>🚀</span>
          <span>{isOlva ? 'DESTINO OLVA COURIER:' : isShalom ? 'SUCURSAL / AGENCIA SHALOM:' : 'DIRECCIÓN DE ENTREGA MOTORIZADO:'}</span>
        </span>
        <h2 className={`text-base sm:text-lg uppercase tracking-tight leading-tight mt-0.5 ${eco.destinoTitle}`}>
          {pedido.destino_detalle}
        </h2>
      </div>

      {/* SECCIÓN CONSIGNATARIO (DESTINATARIO) CON DNI GIGANTE */}
      <div className={`rounded-2xl p-3 mb-2.5 ${eco.sectionBg}`}>
        <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
          <span className="text-[11px] font-black uppercase text-slate-800 flex items-center gap-1">
            <span>👤</span>
            <span>DESTINATARIO (CLIENTE)</span>
          </span>
          <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300">
            RECOJO EN AGENCIA
          </span>
        </div>

        <div className="space-y-2 text-xs text-slate-900">
          <div>
            <span className={eco.subtleText}>Nombre del Cliente:</span>{' '}
            <span className="font-black text-lg sm:text-xl uppercase block text-slate-950 leading-snug tracking-tight">{pedido.usuario?.nombre_completo || 'Cliente'}</span>
          </div>

          {/* DNI GIGANTE Y DESTACADO (REQ: DNI MAS GRANDE EN ROTULADO Y SIN TELÉFONO EN SHALOM) */}
          <div className={`${eco.dniBox} rounded-xl flex items-center ${isShalom ? 'justify-center py-2' : 'justify-between'} shadow-xs`}>
            <div className={isShalom ? 'text-center w-full' : ''}>
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block leading-none mb-0.5">
                🪪 DNI / DOC RECOJO:
              </span>
              <span className={`${eco.dniText} block leading-tight mt-0.5`}>
                {clientDni}
              </span>
            </div>
            {!isShalom && (
              <div className="text-right">
                <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block leading-none">
                  TELÉFONO:
                </span>
                <span className="text-sm sm:text-base font-mono font-bold text-slate-900 block leading-tight mt-0.5">
                  {clientPhone ? `+51 ${clientPhone}` : (pedido.usuario?.telefono_default ? `+51 ${pedido.usuario.telefono_default}` : '-')}
                </span>
              </div>
            )}
          </div>

          {!isShalom && (pedido.usuario?.email || pedido.usuario?.email_default) && (
            <p className="pt-0.5 text-[10.5px]">
              <span className={eco.subtleText}>Correo:</span>{' '}
              <span className="font-mono font-bold text-slate-800">{pedido.usuario.email || pedido.usuario.email_default}</span>
            </p>
          )}
        </div>
      </div>

      {/* SECCIÓN REMITENTE (ENCOMI ENVÍOS / COMIKIDS) */}
      <div className={`rounded-xl p-2 mb-2 text-[10.5px] ${eco.sectionBg} space-y-0.5`}>
        <div className="font-black uppercase text-slate-800 mb-0.5 flex items-center justify-between">
          <span>REMITENTE OFICIAL:</span>
          <span className="font-bold text-slate-900">{tallerConfig.nombre_taller || 'Comikids Envíos'}</span>
        </div>
        <div className="grid grid-cols-2 gap-1 text-slate-700">
          <p><span className="font-bold">DNI/RUC:</span> {tallerConfig.remitente_dni || tallerConfig.ruc_dni || '42020312'}</p>
          <p><span className="font-bold">Celular:</span> {tallerConfig.remitente_celular || tallerConfig.celular_taller || '927781412'}</p>
        </div>
        <p className="text-slate-600 text-[10px]"><span className="font-bold">Origen:</span> {tallerConfig.direccion_taller}</p>
      </div>

      {/* DETALLES DE PAQUETE */}
      <div className="border-t border-dashed border-slate-300 pt-1.5 flex items-center justify-between text-[10px] text-slate-600">
        <div className="flex items-center gap-1 font-bold text-slate-800">
          <span>📦</span>
          <span>Paquete de Despacho Seguro</span>
        </div>
        <div className="font-bold text-slate-700">
          Impreso el {formatDate(new Date().toISOString())}
        </div>
      </div>
    </div>
  );
};

