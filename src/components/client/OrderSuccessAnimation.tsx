import React, { useState, useEffect } from 'react';
import { Pedido } from '../../types/database.types';
import { DatosComprobante, buildWhatsAppComprobanteUrl } from '../../services/whatsappService';
import {
  CheckCircle2,
  Package,
  Sparkles,
  Send,
  ArrowRight,
  ShieldCheck,
  Zap,
  MapPin,
  Clock
} from 'lucide-react';

interface Props {
  order: Pedido;
  comprobanteData: DatosComprobante;
  onFinished: () => void;
}

export const OrderSuccessAnimation: React.FC<Props> = ({
  order,
  comprobanteData,
  onFinished
}) => {
  const [step, setStep] = useState<number>(1);
  const [countdown, setCountdown] = useState<number>(2.5);
  const whatsappUrl = buildWhatsAppComprobanteUrl(comprobanteData);

  useEffect(() => {
    // Paso 1 -> 2
    const t1 = setTimeout(() => setStep(2), 600);
    // Paso 2 -> 3
    const t2 = setTimeout(() => setStep(3), 1300);

    // Cuenta regresiva fluida a 60 FPS
    const startTime = Date.now();
    const duration = 2500; // 2.5s

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (duration - elapsed) / 1000);
      setCountdown(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
        handleRedirect();
      }
    }, 50);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, []);

  const handleRedirect = () => {
    if (typeof window !== 'undefined') {
      window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
    onFinished();
  };

  const progressPercent = Math.min(100, Math.max(0, ((2.5 - countdown) / 2.5) * 100));

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-2xl animate-fadeIn">
      {/* Luces de Fondo y Partículas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-pink-500/25 via-purple-500/25 to-cyan-500/25 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-cyan-500/20 rounded-full blur-2xl animate-pulse delay-700" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl bg-slate-900/95 border border-white/15 p-6 sm:p-8 shadow-2xl shadow-purple-950/50 text-center space-y-6 transform transition-all duration-300 scale-100">
        
        {/* Holograma Central 3D del Paquete */}
        <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          {/* Anillos giratorios de alta tasa de cuadros */}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-pink-500 via-purple-600 to-cyan-400 animate-spin blur-xs opacity-75" style={{ animationDuration: '3s' }} />
          <div className="absolute inset-1 rounded-3xl bg-slate-950" />
          
          <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-pink-500/20 via-purple-600/30 to-cyan-500/20 border border-white/20 flex flex-col items-center justify-center shadow-inner group">
            <Package className="w-10 h-10 sm:w-12 sm:h-12 text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)] animate-bounce" style={{ animationDuration: '1.8s' }} />
            <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-black tracking-wider flex items-center gap-1 shadow-md shadow-emerald-500/30">
              <ShieldCheck className="w-3 h-3" />
              <span>SELLADO</span>
            </div>
          </div>
        </div>

        {/* Textos de Estado */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-pink-500/10 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider animate-pulse">
            <Sparkles className="w-3.5 h-3.5 text-pink-400" />
            <span>¡Envío Registrado con Éxito!</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Preparando tu Comprobante
          </h2>
          <p className="text-xs text-slate-400 font-medium">
            Redirigiendo a WhatsApp en <span className="text-cyan-300 font-mono font-bold">{countdown.toFixed(1)}s</span> para enviar tu comprobante oficial.
          </p>
        </div>

        {/* Tarjeta de Datos Rápidos del Envío */}
        <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-white/10 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-slate-400 font-medium text-[11px]">Código de Seguimiento:</span>
            <span className="font-mono font-black text-cyan-300 text-sm">#{order.codigo_seguimiento}</span>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-tight">
              {comprobanteData.destinoDetalle}
            </span>
          </div>
        </div>

        {/* Micro-Timeline de Pasos */}
        <div className="space-y-2 text-left text-xs">
          <div className={`flex items-center gap-2.5 transition-all duration-300 ${step >= 1 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${step >= 1 ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>Orden generada con código #{order.codigo_seguimiento}</span>
          </div>

          <div className={`flex items-center gap-2.5 transition-all duration-300 ${step >= 2 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${step >= 2 ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>Rotulado oficial y geolocalización vinculada</span>
          </div>

          <div className={`flex items-center gap-2.5 transition-all duration-300 ${step >= 3 ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
            <div className={`w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent ${step >= 3 ? 'animate-spin' : 'border-slate-600'}`} />
            <span>Conectando con WhatsApp Oficial...</span>
          </div>
        </div>

        {/* Barra de Progreso Fluida */}
        <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 h-1.5 transition-all duration-75 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Botón de Acción Inmediata */}
        <button
          type="button"
          onClick={handleRedirect}
          className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-sm flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-900/40 transition-all active:scale-98 cursor-pointer group"
        >
          <Send className="w-4 h-4 fill-current group-hover:translate-x-0.5 transition-transform" />
          <span>Abrir WhatsApp Ahora</span>
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
