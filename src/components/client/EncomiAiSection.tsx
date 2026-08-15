import React, { useState, useEffect, useRef } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Pedido } from '../../types/database.types';
import {
  ChatMessage,
  generateEncomiAiResponse,
  getDailyMessageLimitStatus,
  consumeDailyMessage,
} from '../../services/encomiAiService';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Clock,
  Package,
  AlertCircle,
  X
} from 'lucide-react';

export const EncomiAiSection: React.FC = () => {
  const { pedidos } = useOrders();
  const { currentUser } = useAuth();

  const userOrders = pedidos.filter(p => p.usuario_id === currentUser?.id);
  const [selectedOrder, setSelectedOrder] = useState<Pedido | null>(() => {
    return userOrders.length > 0 ? userOrders[0] : null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [limitStatus, setLimitStatus] = useState(() => getDailyMessageLimitStatus(currentUser?.id || 'guest', false));
  const [showOrderSelectorModal, setShowOrderSelectorModal] = useState(false);
  const [manualOrderCode, setManualOrderCode] = useState('');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Mensaje inicial de bienvenida sin cobrar nada
  useEffect(() => {
    const clientName = currentUser?.nombre_completo || 'Cliente';
    const destination = selectedOrder?.destino_detalle || 'Agencia Shalom Nacional';

    const welcomeMsg: ChatMessage = {
      id: 'welcome-section',
      sender: 'assistant',
      text: `¡Hola ${clientName}! ✨ Te doy la bienvenida a **Encomi AI**, tu inteligencia artificial especializada en logística de ComiKids.

📌 **Información Clave de Despacho:**
• **Entrega de Carga en Shalom:** **9:00 PM (Turno Noche)**
• **Salida de Flota Interprovincial:** Al día siguiente en la mañana/tarde hacia tu región.
• **Pedido en Consulta:** #${selectedOrder?.codigo_seguimiento || 'Vigente'} (${destination})

Presiona la pregunta frecuente abajo o escribe tu consulta.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);
  }, [selectedOrder?.id, currentUser?.nombre_completo]);

  const handleSendMessage = async (textToSend: string, targetOrder: Pedido | null = selectedOrder) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const currentLimit = getDailyMessageLimitStatus(currentUser?.id || 'guest', false);
    if (!currentLimit.canSend) {
      const limitMsg: ChatMessage = {
        id: `limit-${Date.now()}`,
        sender: 'system',
        text: '⚠️ Has alcanzado el límite de 3 consultas con Encomi AI por hoy. Vuelve mañana para más consultas o contáctanos directamente a nuestro WhatsApp oficial.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, limitMsg]);
      return;
    }

    // Consumir 1 crédito solo cuando envía la pregunta
    consumeDailyMessage(currentUser?.id || 'guest', false);
    setLimitStatus(getDailyMessageLimitStatus(currentUser?.id || 'guest', false));

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
      const clientName = currentUser?.nombre_completo || 'Cliente';
      const response = await generateEncomiAiResponse(text, targetOrder, clientName, false);
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
        text: 'Los paquetes se entregan en la Sede Central de Shalom a las 9:00 PM y salen al día siguiente en los camiones interprovinciales. ComiKids te enviará tu código de 4 dígitos por WhatsApp.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleConfirmOrderForTransit = (orderToUse: Pedido) => {
    setSelectedOrder(orderToUse);
    setShowOrderSelectorModal(false);
    handleSendMessage('¿Cuánto tiempo demorará mi paquete en llegarme?', orderToUse);
  };

  const handleManualOrderSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualOrderCode.trim()) return;

    const found = userOrders.find(
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
      usuario_id: currentUser?.id || 'guest',
    };

    setSelectedOrder(orderToUse);
    setShowOrderSelectorModal(false);
    handleSendMessage(`¿Cuánto tiempo demorará mi paquete #${orderToUse.codigo_seguimiento} en llegarme?`, orderToUse);
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* Top Banner */}
      <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-r from-purple-950/40 via-slate-900 to-cyan-950/40 border border-cyan-500/30 flex flex-wrap items-center justify-between gap-3 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-linear-to-tr from-cyan-500 to-purple-600 flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-500/25">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg sm:text-xl font-black text-white">Encomi AI</h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                IA Logística
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Despachos Shalom 9:00 PM • Salida de flota al día siguiente
            </p>
          </div>
        </div>

        {/* Limit Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-2xl text-xs font-black border flex items-center gap-1.5 shadow-md ${
              limitStatus.remaining > 0
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <span>💬</span>
            <span>Consultas: {limitStatus.remaining}/3 hoy</span>
          </span>
        </div>
      </div>

      {/* Order Context Selector */}
      {userOrders.length > 0 && (
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate">
              Consultando sobre: <strong>#{selectedOrder?.codigo_seguimiento}</strong> ({selectedOrder?.destino_detalle})
            </span>
          </div>

          <button
            onClick={() => setShowOrderSelectorModal(true)}
            className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold shrink-0 cursor-pointer"
          >
            Cambiar
          </button>
        </div>
      )}

      {/* Chat Container Box */}
      <div className="h-[480px] sm:h-[520px] rounded-3xl glass-panel border border-white/10 flex flex-col overflow-hidden bg-slate-900/90 shadow-2xl">
        
        {/* Messages List */}
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
              <span>Encomi AI está procesando la información...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ÚNICA Pregunta Frecuente */}
        <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center justify-center shrink-0">
          <button
            onClick={() => setShowOrderSelectorModal(true)}
            className="w-full py-2.5 px-4 rounded-2xl bg-linear-to-r from-purple-600/30 via-indigo-600/30 to-cyan-600/30 hover:from-purple-600/40 hover:to-cyan-600/40 border border-purple-500/40 text-purple-200 hover:text-white text-xs sm:text-sm font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <Clock className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>¿Cuánto tiempo demorará mi paquete en llegarme?</span>
          </button>
        </div>

        {/* Input Box */}
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
                ? 'Escribe tu consulta sobre tu envío a Encomi AI...'
                : 'Límite diario de 3 consultas alcanzado'
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

      {/* Recuadro para Seleccionar o Ingresar el Pedido */}
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
              Selecciona tu pedido registrado para que Encomi AI calcule la fecha exacta de llegada:
            </p>

            {/* Lista de Pedidos del Usuario */}
            {userOrders.length > 0 ? (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                {userOrders.map((ord) => (
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
            ) : (
              <p className="text-xs text-amber-300 bg-amber-500/10 p-2.5 rounded-xl border border-amber-500/20">
                No tienes pedidos vigentes registrados. Ingresa el código de tu pedido a continuación:
              </p>
            )}

            {/* Ingreso manual de código */}
            <form onSubmit={handleManualOrderSubmit} className="pt-2 border-t border-white/10 space-y-2">
              <label className="text-[11px] font-bold text-slate-300 block">
                O ingresa el código de tu pedido:
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

    </div>
  );
};
