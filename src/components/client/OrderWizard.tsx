import React, { useState } from 'react';
import { MessageCircle, Building2, PackagePlus } from 'lucide-react';
import { getWhatsAppBusinessChatUrl } from '../../services/whatsappService';
import { OrganicOrderFlow } from './OrganicOrderFlow';

interface Props {
  onSuccess?: () => void;
}

export const OrderWizard: React.FC<Props> = ({ onSuccess }) => {
  const [showDirectForm, setShowDirectForm] = useState(false);
  const whatsappUrl = getWhatsAppBusinessChatUrl('¡Hola Comikids! 👋 Deseo hacer un nuevo pedido de mercadería.');

  if (showDirectForm) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowDirectForm(false)}
            className="px-3.5 py-1.5 rounded-xl bg-white/6 hover:bg-white/12 text-slate-300 text-xs font-bold border border-white/10 transition-all cursor-pointer"
          >
            ← Volver a Atención
          </button>
        </div>
        <OrganicOrderFlow onSuccess={() => {
          setShowDirectForm(false);
          if (onSuccess) onSuccess();
        }} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-xl mx-auto space-y-6 animate-fadeIn">
      
      <div className="minimal-card p-6 sm:p-8 space-y-6 text-center">
        
        {/* Empresa Reciente Badge */}
        <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold shadow-md">
          <Building2 className="w-4 h-4 text-cyan-400" />
          <span>Empresa reciente:</span>
          <strong className="text-white font-black bg-cyan-500/25 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
            📦 ComiKids
          </strong>
        </div>

        {/* Hero Visual / Message */}
        <div className="space-y-2 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-3xl bg-linear-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center mx-auto text-2xl shadow-xl shadow-cyan-500/30">
            💬
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Atención y Nuevos Pedidos
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Comunícate directamente con nuestro equipo oficial de <strong>ComiKids</strong> en WhatsApp para cotizar, consultar catálogo y coordinar tu pedido.
          </p>
        </div>

        {/* Botón Principal de WhatsApp + Opción de registrar despacho */}
        <div className="pt-2 space-y-3">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-base sm:text-lg font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <MessageCircle className="w-6 h-6 fill-current" />
            <span>Hacer un nuevo pedido</span>
          </a>

          <button
            type="button"
            onClick={() => setShowDirectForm(true)}
            className="w-full py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-[0.98] text-cyan-300 text-xs font-bold flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer"
          >
            <PackagePlus className="w-4 h-4" />
            <span>Registrar otro despacho de mercadería</span>
          </button>
        </div>

      </div>

    </div>
  );
};
