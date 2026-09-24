import React, { useState, useEffect } from 'react';
import { Pedido } from '../../types/database.types';
import {
  DatosComprobante,
  buildWhatsAppComprobanteUrl,
  buildWhatsAppNativeUrl,
  enviarComprobanteAWhatsapp,
  isMobileDevice
} from '../../services/whatsappService';
import {
  CheckCircle2,
  Package,
  Sparkles,
  Send,
  ArrowRight,
  ShieldCheck,
  Zap,
  MapPin,
  Clock,
  X
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
  const [countdown, setCountdown] = useState<number>(1.4);
  const isMobile = typeof window !== 'undefined' && isMobileDevice();
  const whatsappUrl = isMobile 
    ? buildWhatsAppNativeUrl(comprobanteData) 
    : buildWhatsAppComprobanteUrl(comprobanteData);

  useEffect(() => {
    // Micro-pasos ultra veloces a 60 FPS
    const t1 = setTimeout(() => setStep(2), 300);
    const t2 = setTimeout(() => setStep(3), 700);

    const startTime = Date.now();
    const duration = 1400; // 1.4s ultra rápido

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (duration - elapsed) / 1000);
      setCountdown(remaining);

      if (elapsed >= duration) {
        clearInterval(interval);
        try {
          enviarComprobanteAWhatsapp(comprobanteData);
        } catch (e) {
          console.warn('Auto redirect error:', e);
        }
        setTimeout(() => {
          onFinished();
        }, 1200);
      }
    }, 40);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearInterval(interval);
    };
  }, []);

  const handleManualClick = () => {
    try {
      enviarComprobanteAWhatsapp(comprobanteData);
    } catch (e) {
      console.warn('Manual WhatsApp click error:', e);
    }
    setTimeout(() => {
      onFinished();
    }, 300);
  };

  const progressPercent = Math.min(100, Math.max(0, ((1.4 - countdown) / 1.4) * 100));

  return (
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-2xl animate-fadeIn">
      {/* Luces de Fondo y Partículas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-gradient-to-tr from-emerald-500/30 via-cyan-500/30 to-pink-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-cyan-500/25 rounded-full blur-2xl animate-pulse delay-500" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl bg-slate-900/98 border-2 border-emerald-400/50 p-6 sm:p-8 shadow-2xl shadow-emerald-950/60 text-center space-y-5 transform transition-all duration-300 scale-100 hud-glow-pulse">
        
        {/* Botón de Cierre Superior */}
        <button
          type="button"
          onClick={onFinished}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          title="Cerrar ventana"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Holograma Central 3D del Paquete */}
        <div className="relative mx-auto w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-tr from-emerald-400 via-cyan-400 to-pink-500 animate-spin blur-xs opacity-90" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-1 rounded-3xl bg-slate-950" />
          
          <div className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-emerald-500/30 via-cyan-600/30 to-purple-500/30 border border-emerald-400/40 flex flex-col items-center justify-center shadow-inner group">
            <Package className="w-10 h-10 sm:w-12 sm:h-12 text-emerald-300 drop-shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-bounce" style={{ animationDuration: '1.2s' }} />
          </div>
        </div>

        {/* ⚡ TEXTO DESTACADO EN EL MEDIO: PAQUETE EN EL SISTEMA */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500/20 border-2 border-emerald-400/60 text-emerald-300 text-xs sm:text-sm font-black uppercase tracking-wider shadow-lg shadow-emerald-500/25 animate-pulse">
            <Zap className="w-4 h-4 text-emerald-400 fill-current" />
            <span>⚡ PAQUETE EN EL SISTEMA</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            ¡Envío Confirmado!
          </h2>
          <p className="text-xs text-slate-300 font-medium">
            Abriendo WhatsApp en <span className="text-emerald-400 font-mono font-black text-sm">{countdown.toFixed(1)}s</span> para enviar tu comprobante.
          </p>
        </div>

        {/* Tarjeta de Datos Rápidos del Envío */}
        <div className="p-3.5 rounded-2xl bg-slate-950/90 border border-white/10 text-left space-y-2 text-xs">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <span className="text-slate-400 font-medium text-[11px]">Código de Seguimiento:</span>
            <span className="font-mono font-black text-emerald-400 text-sm">#{order.codigo_seguimiento}</span>
          </div>

          <div className="flex items-start gap-2 text-[11px] text-slate-300">
            <MapPin className="w-3.5 h-3.5 text-pink-400 shrink-0 mt-0.5" />
            <span className="line-clamp-2 leading-tight">
              {comprobanteData.destinoDetalle}
            </span>
          </div>
        </div>

        {/* Micro-Timeline de Pasos */}
        <div className="space-y-1.5 text-left text-xs">
          <div className={`flex items-center gap-2.5 transition-all duration-200 ${step >= 1 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${step >= 1 ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>1. Código #{order.codigo_seguimiento} registrado</span>
          </div>

          <div className={`flex items-center gap-2.5 transition-all duration-200 ${step >= 2 ? 'text-emerald-300 font-bold' : 'text-slate-500'}`}>
            <CheckCircle2 className={`w-4 h-4 shrink-0 ${step >= 2 ? 'text-emerald-400' : 'text-slate-600'}`} />
            <span>2. Rótulo y datos sincronizados</span>
          </div>

          <div className={`flex items-center gap-2.5 transition-all duration-200 ${step >= 3 ? 'text-cyan-300 font-bold' : 'text-slate-500'}`}>
            <div className={`w-4 h-4 rounded-full border-2 border-cyan-400 border-t-transparent ${step >= 3 ? 'animate-spin' : 'border-slate-600'}`} />
            <span>3. Conectando con WhatsApp...</span>
          </div>
        </div>

        {/* Barra de Progreso Fluida */}
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div
            className="bg-gradient-to-r from-emerald-400 via-cyan-400 to-pink-500 h-2 transition-all duration-75 ease-out rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Botón de Acción Inmediata */}
        <button
          type="button"
          onClick={handleManualClick}
          className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-sm sm:text-base flex items-center justify-center gap-2.5 shadow-xl shadow-emerald-500/40 transition-all active:scale-95 cursor-pointer group"
        >
          <Send className="w-5 h-5 fill-current group-hover:translate-x-0.5 transition-transform" />
          <span>ABRIR WHATSAPP AHORA</span>
          <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    </div>
  );
};
