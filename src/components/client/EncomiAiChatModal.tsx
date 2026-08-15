import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Pedido } from '../../types/database.types';
import {
  ChatMessage,
  generateEncomiAiResponse,
  getDailyMessageLimitStatus,
  consumeDailyMessage,
  calculateShalomTransitTime,
} from '../../services/encomiAiService';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Clock,
  MapPin,
  HelpCircle,
  AlertCircle,
  Package,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';

interface Props {
  initialOrder?: Pedido | null;
  allUserOrders?: Pedido[];
  clientName?: string;
  clientId?: string;
  initialQuestion?: string;
  onClose: () => void;
}

export const EncomiAiChatModal: React.FC<Props> = ({
  initialOrder,
  allUserOrders = [],
  clientName = 'Cliente',
  clientId = 'guest',
  initialQuestion = '¿Cuánto tiempo demorará el envío hasta que me llegue?',
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
  const [limitStatus, setLimitStatus] = useState(() => getDailyMessageLimitStatus(clientId));
  const [showOrderSelector, setShowOrderSelector] = useState(false);

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

  // Mensaje inicial de bienvenida con la orden seleccionada
  useEffect(() => {
    const orderCode = selectedOrder?.codigo_seguimiento || 'Vigente';
    const destination = selectedOrder?.destino_detalle || 'Agencia Shalom';

    const welcomeMsg: ChatMessage = {
      id: 'welcome',
      sender: 'assistant',
      text: `¡Hola ${clientName}! 👋 Soy **Encomi AI**, tu asistente logístico especializado en despachos nacionales.

📍 **Agencia Destino:** ${destination}
🚚 **Origen Fijo:** Sede Central de Shalom en Lima
⏰ **Hora de Salida de Camiones:** **9:00 PM (21:00 hrs)** todos los días.

Puedes hacerme cualquier pregunta sobre los tiempos de llegada, requisitos de recojo con DNI o costos de flete.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);

    // Si viene con pregunta inicial (ej. "¿Cuánto tiempo demorará el envío hasta que me llegue?"), responder automáticamente
    if (initialQuestion) {
      setTimeout(() => {
        handleQuickQuestion(initialQuestion);
      }, 500);
    }
  }, []);

  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const currentLimit = getDailyMessageLimitStatus(clientId);
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

    // Consumir 1 crédito diario
    consumeDailyMessage(clientId);
    setLimitStatus(getDailyMessageLimitStatus(clientId));

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
      const response = await generateEncomiAiResponse(text, selectedOrder, clientName);
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
        text: 'Tu paquete saldrá hoy a las 9:00 PM desde la Sede Central de Shalom en Lima hacia tu agencia de destino. Por favor intenta consultar nuevamente en un momento.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleQuickQuestion = (question: string) => {
    handleSendMessage(question);
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
                Sede Central Shalom • Salida diaria 9:00 PM
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Indicador de límite de 3 mensajes diarios */}
            <span
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border flex items-center gap-1 ${
                limitStatus.remaining > 0
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
              }`}
              title="Límite diario de 3 consultas por cliente"
            >
              <span>💬</span>
              <span>{limitStatus.remaining}/3 hoy</span>
            </span>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Selected Order Context Card / Selector de Pedido Vigente */}
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

            {allUserOrders.length > 1 && (
              <button
                onClick={() => setShowOrderSelector(!showOrderSelector)}
                className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-cyan-300 shrink-0 cursor-pointer"
              >
                {showOrderSelector ? 'Ocultar' : 'Cambiar Pedido'}
              </button>
            )}
          </div>

          {/* Selector desplegable de pedidos si el cliente tiene más de uno */}
          {showOrderSelector && allUserOrders.length > 1 && (
            <div className="mt-2 pt-2 border-t border-white/10 space-y-1.5 animate-fadeIn">
              <span className="text-[10px] text-slate-400 font-bold block">Elige el pedido a consultar:</span>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {allUserOrders.map(ord => (
                  <button
                    key={ord.id}
                    onClick={() => {
                      setSelectedOrder(ord);
                      setShowOrderSelector(false);
                    }}
                    className={`w-full text-left p-2 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                      selectedOrder?.id === ord.id
                        ? 'bg-cyan-500/20 border-cyan-500 text-cyan-200 font-black'
                        : 'bg-slate-800/60 border-white/5 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <span className="truncate">#{ord.codigo_seguimiento} - {ord.destino_detalle}</span>
                    <span className="text-[10px] font-mono shrink-0 ml-2">{ord.metodo_envio_codigo}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
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

        {/* Quick FAQ Chips */}
        <div className="p-2.5 bg-slate-950/80 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            onClick={() => handleQuickQuestion('¿Cuánto tiempo demorará el envío hasta que me llegue?')}
            className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>¿Cuánto tiempo demorará?</span>
          </button>

          <button
            onClick={() => handleQuickQuestion('¿Qué documentos necesito para recoger mi paquete en Shalom?')}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>¿Qué necesito para recoger?</span>
          </button>

          <button
            onClick={() => handleQuickQuestion('¿Cuánto se paga de flete en la agencia de destino?')}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
          >
            <span>💰</span>
            <span>Costo de flete</span>
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
    </div>,
    document.body
  );
};
