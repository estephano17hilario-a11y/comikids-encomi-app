import React, { useState } from 'react';
import { OrganicOrderFlow } from './OrganicOrderFlow';
import { useOrders } from '../../context/OrderContext';
import { MessageCircle, Building2, ChevronRight, PackageCheck } from 'lucide-react';

interface Props {
  onSuccess?: () => void;
}

export const OrderWizard: React.FC<Props> = ({ onSuccess }) => {
  const { tallerConfig } = useOrders();
  const [showOrderForm, setShowOrderForm] = useState(false);

  const whatsappNumber = tallerConfig.whatsapp_pedidos || '51987654321';
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent('¡Hola Comikids! 👋 Deseo hacer un nuevo pedido de mercadería.')}`;

  if (showOrderForm) {
    return (
      <div className="space-y-4 animate-fadeIn">
        <div className="flex items-center justify-between px-1">
          <button
            type="button"
            onClick={() => setShowOrderForm(false)}
            className="text-xs font-bold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span>← Volver a inicio de pedidos</span>
          </button>
        </div>
        <OrganicOrderFlow onSuccess={onSuccess} />
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
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white flex items-center justify-center mx-auto text-2xl shadow-xl shadow-cyan-500/30">
            💬
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Atención y Nuevos Pedidos
          </h3>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Comunícate directamente con nuestro equipo oficial de <strong>ComiKids</strong> en WhatsApp para cotizar, consultar catálogo y coordinar tu pedido.
          </p>
        </div>

        {/* Botón Principal de WhatsApp */}
        <div className="space-y-3 pt-2">
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-4.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white text-base sm:text-lg font-black flex items-center justify-center gap-3 shadow-xl shadow-emerald-600/30 transition-all cursor-pointer"
          >
            <MessageCircle className="w-6 h-6 fill-current" />
            <span>Hacer un nuevo pedido</span>
          </a>

          {/* Botón secundario para registrar datos de despacho si ya tiene pedido */}
          <button
            type="button"
            onClick={() => setShowOrderForm(true)}
            className="w-full py-3 px-5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-slate-300 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer"
          >
            <PackageCheck className="w-4 h-4 text-cyan-400" />
            <span>¿Ya compraste? Registrar datos de envío y despacho</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
          </button>
        </div>

      </div>

    </div>
  );
};
