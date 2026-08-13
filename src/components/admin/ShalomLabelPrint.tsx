import React from 'react';
import { Pedido, TallerConfig } from '../../types/database.types';
import { formatDate } from '../../utils/formatters';

interface Props {
  pedido: Pedido;
  tallerConfig: TallerConfig;
}

export const ShalomLabelPrint: React.FC<Props> = ({ pedido, tallerConfig }) => {
  return (
    <div
      id="shalom-print-area"
      className="w-full max-w-[420px] mx-auto bg-white text-slate-900 p-5 rounded-2xl border-2 border-slate-900 shadow-2xl font-sans"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Top Header Shalom Style */}
      <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-red-600 text-yellow-300 font-black px-2.5 py-1 text-base tracking-wider rounded">
            SHALOM
          </div>
          <span className="text-[11px] font-bold text-slate-600 uppercase">
            Rótulo de Envío
          </span>
        </div>
        <div className="text-right">
          <span className="text-[10px] font-mono font-bold text-slate-500">ORDEN:</span>
          <p className="font-mono font-black text-xs text-slate-900">
            {pedido.codigo_seguimiento}
          </p>
        </div>
      </div>

      {/* Barcode Simulation */}
      <div className="my-2 p-2 bg-slate-50 rounded border border-slate-300 text-center">
        <div className="flex justify-center items-center gap-[2px] h-9 mb-1">
          {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 5, 3, 8, 2, 4, 3, 6, 2, 4, 2, 7, 2, 3, 5, 2, 4].map((w, i) => (
            <div
              key={i}
              className="bg-slate-900 h-full"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] tracking-widest font-black text-slate-800">
          *{pedido.codigo_seguimiento.replace(/[^A-Z0-9]/g, '')}*
        </span>
      </div>

      {/* DESTINO DESTACADO */}
      <div className="bg-slate-900 text-white p-3 rounded-xl mb-3 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-yellow-400">
          DESTINO / AGENCIA LLEGADA:
        </span>
        <h2 className="text-lg font-black uppercase tracking-tight text-white leading-tight mt-0.5">
          {pedido.destino_detalle}
        </h2>
      </div>

      {/* SECCIÓN CONSIGNATARIO (DESTINATARIO) */}
      <div className="border-2 border-slate-900 rounded-xl p-3 mb-3 bg-yellow-50/50">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
          <span className="text-[11px] font-black uppercase text-red-700">
            CONSIGNATARIO (CLIENTA)
          </span>
          <span className="text-[10px] font-bold text-slate-600">PAGO EN DESTINO</span>
        </div>
        <div className="space-y-1 text-xs text-slate-900">
          <p>
            <span className="font-bold text-slate-700">Nombre:</span>{' '}
            <span className="font-black text-sm uppercase">{pedido.usuario?.nombre_completo || 'Clienta'}</span>
          </p>
          <div className="grid grid-cols-2 gap-2">
            <p>
              <span className="font-bold text-slate-700">DNI / CE:</span>{' '}
              <span className="font-mono font-bold">{pedido.usuario?.dni || 'No especificado'}</span>
            </p>
            <p>
              <span className="font-bold text-slate-700">Edad:</span>{' '}
              <span>{pedido.usuario?.edad ? `${pedido.usuario.edad} años` : '-'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN REMITENTE (TALLER COMIKIDS) */}
      <div className="border border-slate-300 rounded-xl p-2.5 mb-3 bg-slate-50 text-[11px] text-slate-800">
        <div className="font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
          <span>REMITENTE:</span>
          <span>{tallerConfig.nombre_taller}</span>
        </div>
        <p><span className="font-semibold">RUC / DNI:</span> {tallerConfig.ruc_dni}</p>
        <p><span className="font-semibold">Teléfono:</span> {tallerConfig.celular_taller}</p>
        <p><span className="font-semibold">Origen:</span> {tallerConfig.direccion_taller}</p>
      </div>

      {/* DETALLES DE PAQUETE */}
      <div className="border-t border-slate-300 pt-2 flex items-center justify-between text-[11px] text-slate-600">
        <div>
          <span className="font-bold text-slate-800">Contenido:</span> Prenda Bordada Personalizada
        </div>
        <div className="font-black text-red-600 uppercase border border-red-500 px-1.5 py-0.5 rounded text-[10px]">
          ⚠️ FRÁGIL / TEXTIL
        </div>
      </div>

      <div className="mt-2 text-center text-[9px] text-slate-400">
        Impreso el {formatDate(new Date().toISOString())} • Incomi / Comikids App
      </div>
    </div>
  );
};
