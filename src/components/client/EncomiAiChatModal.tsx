import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pedido } from '../../types/database.types';
import {
  ChatMessage,
  generateEncomiAiResponse,
  getDailyMessageLimitStatus,
  consumeDailyMessage,
} from '../../services/encomiAiService';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Clock,
  Package,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  ShieldCheck
} from 'lucide-react';

interface Props {
  initialOrder?: Pedido | null;
  allUserOrders?: Pedido[];
  clientName?: string;
  clientId?: string;
  isEmpresa?: boolean;
  onClose: () => void;
}

export const EncomiAiChatModal: React.FC<Props> = ({
  initialOrder,
  allUserOrders = [],
  clientName = 'Cliente',
  clientId = 'guest',
  isEmpresa = false,
  onClose,
}) => {
  const [selectedOrder, setSelectedOrder] = useState<Pedido | null>(() => {
    if (initialOrder) return initialOrder;
    if (allUserOrders.length > 0) return allUserOrders[0];
    return null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [limitStatus, setLimitStatus] = useState(() => getDailyMessageLimitStatus(clientId, isEmpresa));
  const [showOrderSelectorModal, setShowOrderSelectorModal] = useState(false);
  const [manualOrderCode, setManualOrderCode] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  // Mensaje inicial de bienvenida sin descontar ningún mensaje
  useEffect(() => {
    const orderCode = selectedOrder?.codigo_seguimiento || 'Vigente';
    const destination = selectedOrder?.destino_detalle || 'Agencia Shalom';

    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      sender: 'assistant',
      text: `¡Hola ${clientName}! 👋 Soy **Encomi AI**, tu asistente logístico inteligente de ComiKids.

📍 **Agencia Destino:** ${destination}
🚚 **Entrega de Lote:** Sede Central de Shalom (9:00 PM - Turno Noche)
⏰ **Salida de Flota:** Al día siguiente en la mañana/tarde hacia tu región.

Presiona el botón de pregunta frecuente abajo o escribe tu duda sobre la entrega.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);
  }, [selectedOrder?.id]);

  const handleSendMessage = async (textToSend: string, targetOrder: Pedido | null = selectedOrder) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const currentLimit = getDailyMessageLimitStatus(clientId, isEmpresa);
    if (!currentLimit.canSend) {
      const limitMsg: ChatMessage = {
        id: `limit-${Date.now()}`,
        sender: 'system',
        text: '⚠️ Has alcanzado el límite de 3 consultas con Encomi AI por hoy. Vuelve mañana para más consultas o contáctanos por WhatsApp oficial.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, limitMsg]);
      return;
    }

    // Consumir 1 crédito sólo cuando el usuario realmente envía una consulta
    consumeDailyMessage(clientId, isEmpresa);
    setLimitStatus(getDailyMessageLimitStatus(clientId, isEmpresa));

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await generateEncomiAiResponse(text, targetOrder, clientName, isEmpresa);
      const aiMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        sender: 'assistant',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error Encomi AI:', err);
      const errorMsg: ChatMessage = {
        id: `error-${Date.now()}`,
        sender: 'assistant',
        text: 'Tu paquete se entrega en la Sede Central de Shalom a las 9:00 PM y saldrá al día siguiente en la flota interprovincial. Recuerda que ComiKids te enviará tu código de 4 dígitos por WhatsApp.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // Al presionar la pregunta frecuente, abrir el recuadro para elegir el pedido
  const handleFaqClick = () => {
    setShowOrderSelectorModal(true);
  };

  const handleConfirmOrderForTransit = (orderToUse: Pedido) => {
    setSelectedOrder(orderToUse);
    setShowOrderSelectorModal(false);
    handleSendMessage('¿Cuánto tiempo demorará mi paquete en llegarme?', orderToUse);
  };

  const handleManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderCode.trim()) return;

    // Buscar en los pedidos del usuario o crear pedido simulado con el código
    const found = allUserOrders.find(
      o => o.codigo_seguimiento.toLowerCase() === manualOrderCode.trim().toLowerCase()
    );

    const orderToUse: Pedido = found || {
      id: 'manual-ord',
      codigo_seguimiento: manualOrderCode.trim().toUpperCase(),
      destino_detalle: selectedOrder?.destino_detalle || 'Agencia Shalom Nacional',
      metodo_envio_codigo: 'shalom',
      metodo_envio_nombre: 'Shalom',
      detalles_bordado: '',
      estado_envio: 'pendiente',
      estado_produccion: 'en_cola',
      created_at: new Date().toISOString(),
      usuario_id: clientId,
    };

    setSelectedOrder(orderToUse);
    setShowOrderSelectorModal(false);
    handleSendMessage(`¿Cuánto tiempo demorará mi paquete #${orderToUse.codigo_seguimiento} en llegarme?`, orderToUse);
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-xl h-[90vh] max-h-[720px] rounded-3xl glass-panel border border-cyan-500/40 shadow-2xl flex flex-col overflow-hidden bg-slate-900/95">
        
        {/* Modal Top Header */}
        <div className="p-4 border-b border-white/10 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Encomi AI</h3>
                <span className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  Asistente Logístico
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Sede Central Shalom (9:00 PM) • Salida al día siguiente
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Indicador de límite de 3 mensajes diarios (o Ilimitado para ComiKids) */}
            <span
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                isEmpresa
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 font-black'
                  : limitStatus.remaining > 0
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
            >
              <span>💬</span>
              <span>{isEmpresa ? 'Ilimitado 👑' : `${limitStatus.remaining}/3 hoy`}</span>
            </span>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selected Order Context Card */}
        <div className="p-3 bg-linear-to-r from-purple-950/40 via-slate-900 to-cyan-950/40 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0">
                <Package className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <span className="text-[10px] text-slate-400 block truncate">
                  Pedido Vigente en Consulta:
                </span>
                <strong className="text-xs font-black text-white block truncate">
                  #{selectedOrder?.codigo_seguimiento || 'Vigente'} • {selectedOrder?.destino_detalle || 'Agencia Shalom'}
                </strong>
              </div>
            </div>

            <button
              onClick={() => setShowOrderSelectorModal(true)}
              className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-cyan-300 shrink-0 cursor-pointer"
            >
              Cambiar Pedido
            </button>
          </div>
        </div>

        {/* Chat History Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-slate-950/60">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSystem = msg.sender === 'system';

            if (isSystem) {
              return (
                <div key={msg.id} className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{msg.text}</span>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-bold ${
                    isUser
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-linear-to-tr from-purple-600 to-indigo-600 text-white shadow-md'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-3.5 text-xs sm:text-sm leading-relaxed shadow-lg ${
                    isUser
                      ? 'bg-cyan-600 text-white rounded-tr-none'
                      : 'bg-slate-800/90 text-slate-100 border border-white/10 rounded-tl-none space-y-2'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {msg.text}
                  </div>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      isUser ? 'text-cyan-200' : 'text-slate-400'
                    }`}
                  >
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}

          {isTyping && (
            <div className="flex items-center gap-2 text-xs text-slate-400 p-2 animate-pulse">
              <Bot className="w-4 h-4 text-cyan-400" />
              <span>Encomi AI está calculando los tiempos de tu agencia...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ÚNICA Pregunta Frecuente Requerida */}
        <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center justify-center shrink-0">
          <button
            onClick={handleFaqClick}
            className="w-full py-2.5 px-4 rounded-2xl bg-linear-to-r from-purple-600/30 via-indigo-600/30 to-cyan-600/30 hover:from-purple-600/40 hover:to-cyan-600/40 border border-purple-500/40 text-purple-200 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>¿Cuánto tiempo demorará mi paquete en llegarme?</span>
          </button>
        </div>

        {/* Message Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="p-3 bg-slate-900 border-t border-white/10 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={!limitStatus.canSend || isTyping}
            placeholder={
              limitStatus.canSend
                ? 'Escribe tu consulta a Encomi AI...'
                : 'Límite de 3 consultas por hoy alcanzado'
            }
            className="flex-1 px-4 py-2.5 rounded-2xl bg-slate-950 border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || !limitStatus.canSend || isTyping}
            className="p-2.5 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed shadow-lg transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

      {/* Recuadro / Modal Emergente para Seleccionar o Ingresar el Pedido */}
      {showOrderSelectorModal && (
        <div className="fixed inset-0 z-10000 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-slate-900 rounded-3xl border-2 border-cyan-500/50 p-5 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-cyan-400" />
                <h4 className="text-base font-black text-white">¿Sobre qué pedido deseas consultar?</h4>
              </div>
              <button
                onClick={() => setShowOrderSelectorModal(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Selecciona tu pedido registrado para que Encomi AI calcule la fecha exacta de llegada según la agencia de destino:
            </p>

            {/* Lista de Pedidos del Usuario si existen */}
            {allUserOrders.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {allUserOrders.map((ord) => (
                  <button
                    key={ord.id}
                    onClick={() => handleConfirmOrderForTransit(ord)}
                    className="w-full p-3 rounded-2xl bg-white/5 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500 text-left transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <div className="min-w-0">
                      <strong className="text-xs text-white block group-hover:text-cyan-300 font-mono">
                        #{ord.codigo_seguimiento}
                      </strong>
                      <span className="text-[11px] text-slate-400 block truncate">
                        📍 {ord.destino_detalle}
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-cyan-500/20 text-cyan-300 text-[10px] font-black shrink-0">
                      Consultar
                    </span>
                  </button>
                ))}
              </div>
            ) : selectedOrder ? (
              <div className="p-3 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-left space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 block">Pedido Actual:</span>
                  <strong className="text-sm font-mono text-cyan-300 block">#{selectedOrder.codigo_seguimiento}</strong>
                  <span className="text-xs text-slate-200 block">📍 {selectedOrder.destino_detalle}</span>
                </div>
                <button
                  onClick={() => handleConfirmOrderForTransit(selectedOrder)}
                  className="w-full py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs transition-all cursor-pointer"
                >
                  Consultar este Pedido
                </button>
              </div>
            ) : (
              <p className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                No tienes pedidos vigentes listados. Ingresa el código de tu pedido a continuación:
              </p>
            )}

            {/* O ingreso manual de código */}
            <form onSubmit={handleManualOrderSubmit} className="pt-2 border-t border-white/10 space-y-2">
              <label className="text-[11px] font-bold text-slate-300 block">
                O ingresa manualmente el código de tu pedido:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualOrderCode}
                  onChange={(e) => setManualOrderCode(e.target.value)}
                  placeholder="Ej. JWL-2026-9379"
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-white/15 text-xs text-white uppercase font-mono focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="submit"
                  disabled={!manualOrderCode.trim()}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black disabled:opacity-40 cursor-pointer"
                >
                  Consultar
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>,
    document.body
  );
};
