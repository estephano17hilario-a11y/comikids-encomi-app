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
      className="w-full max-w-[440px] mx-auto bg-white text-slate-900 p-5 rounded-3xl border-4 border-dashed border-pink-500 shadow-2xl font-sans relative overflow-hidden"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      {/* Top Header ComiKids & Disney / Comic Elements */}
      <div className="flex items-center justify-between border-b-2 border-dashed border-pink-500 pb-3 mb-3">
        <div className="flex items-center gap-2">
          <img
            src="/Comikids.png"
            alt="ComiKids"
            className="w-10 h-10 object-contain rounded-xl shadow"
          />
          <div>
            <h2 className="text-base font-black uppercase tracking-tight text-slate-900 leading-none">
              {tallerConfig.nombre_taller || 'ComiKids'}
            </h2>
            <span className="text-[10px] font-black text-pink-600 uppercase">
              ✨ Crea tu propia historia ✨
            </span>
          </div>
        </div>

        <div className="text-right flex flex-col items-end">
          <div className="flex items-center gap-1 px-2 py-0.5 bg-yellow-300 rounded border border-black mb-1">
            <img
              src="/Shalom-Courier-Logo.webp"
              alt="Shalom"
              className="h-3.5 w-auto object-contain"
            />
            <span className="text-slate-950 font-black text-[9px] uppercase">
              SHALOM VIP
            </span>
          </div>
          <p className="font-mono font-black text-xs text-slate-900 pt-0.5">
            {pedido.codigo_seguimiento}
          </p>
        </div>
      </div>

      {/* Barcode Simulation with Comic Stars */}
      <div className="my-2 p-2.5 bg-pink-50/70 rounded-2xl border-2 border-pink-300 text-center">
        <div className="flex justify-center items-center gap-[2px] h-9 mb-1">
          {[4, 2, 6, 2, 8, 3, 2, 5, 2, 7, 3, 2, 4, 6, 2, 5, 3, 8, 2, 4, 3, 6, 2, 4, 2, 7, 2, 3, 5, 2, 4].map((w, i) => (
            <div
              key={i}
              className="bg-slate-900 h-full"
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
        <span className="font-mono text-[11px] tracking-widest font-black text-slate-900">
          ⭐ {pedido.codigo_seguimiento} ⭐
        </span>
      </div>

      {/* DESTINO DESTACADO */}
      <div className="bg-slate-950 text-white p-3 rounded-2xl mb-3 text-center border-2 border-yellow-400">
        <span className="text-[10px] font-black uppercase tracking-wider text-yellow-300 flex items-center justify-center gap-1">
          <span>🚀</span>
          <span>DESTINO MÁGICO / AGENCIA SHALOM:</span>
        </span>
        <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white leading-tight mt-0.5">
          {pedido.destino_detalle}
        </h2>
      </div>

      {/* SECCIÓN CONSIGNATARIO (DESTINATARIO) */}
      <div className="border-2 border-dashed border-slate-900 rounded-2xl p-3 mb-3 bg-yellow-50/70">
        <div className="flex items-center justify-between border-b border-slate-300 pb-1 mb-2">
          <span className="text-[11px] font-black uppercase text-pink-700 flex items-center gap-1">
            <span>👤</span>
            <span>DESTINATARIO VIP (CLIENTE)</span>
          </span>
          <span className="text-[10px] font-bold text-slate-700 bg-white px-2 py-0.5 rounded border border-slate-300">
            CON AMOR
          </span>
        </div>
        <div className="space-y-1.5 text-xs text-slate-900">
          <p>
            <span className="font-bold text-slate-700">Nombre:</span>{' '}
            <span className="font-black text-sm uppercase">{pedido.usuario?.nombre_completo || 'Clienta'}</span>
          </p>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200">
            <p>
              <span className="font-bold text-slate-700">DNI / CE:</span>{' '}
              <span className="font-mono font-black">{pedido.usuario?.dni || 'No especificado'}</span>
            </p>
            <p>
              <span className="font-bold text-slate-700">WhatsApp:</span>{' '}
              <span className="font-mono font-bold text-pink-600">{pedido.usuario?.telefono_default ? `+51 ${pedido.usuario.telefono_default}` : '-'}</span>
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN REMITENTE (TALLER COMIKIDS) */}
      <div className="border border-slate-300 rounded-2xl p-2.5 mb-3 bg-slate-50 text-[11px] text-slate-800">
        <div className="font-black uppercase text-slate-700 mb-1 flex items-center justify-between">
          <span>REMITENTE OFICIAL:</span>
          <span className="text-pink-600">{tallerConfig.nombre_taller || 'ComiKids'}</span>
        </div>
        <p><span className="font-bold">RUC / DNI:</span> {tallerConfig.ruc_dni || '061625'}</p>
        <p><span className="font-bold">WhatsApp Taller:</span> {tallerConfig.celular_taller}</p>
        <p><span className="font-bold">Origen:</span> {tallerConfig.direccion_taller}</p>
      </div>

      {/* DETALLES DE PAQUETE */}
      <div className="border-t-2 border-dashed border-slate-300 pt-2 flex items-center justify-between text-[11px] text-slate-600">
        <div className="flex items-center gap-1 font-bold text-slate-800">
          <span>🎈</span>
          <span>Prenda Bordada Personalizada</span>
        </div>
        <div className="font-black text-pink-700 uppercase bg-pink-100 border border-pink-300 px-2 py-0.5 rounded-full text-[10px]">
          ★ 100% Hecho con Amor ★
        </div>
      </div>

      <div className="mt-2 text-center text-[9px] text-slate-400">
        Impreso el {formatDate(new Date().toISOString())} • ComiKids App
      </div>
    </div>
  );
};
