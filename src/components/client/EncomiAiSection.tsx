import React, { useState, useEffect, useRef } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
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
  Send,
  Bot,
  User,
  Clock,
  MapPin,
  HelpCircle,
  Package,
  ShieldCheck,
  AlertCircle,
  CheckCircle2
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
  const [limitStatus, setLimitStatus] = useState(() => getDailyMessageLimitStatus(currentUser?.id || 'guest'));

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Mensaje inicial de bienvenida
  useEffect(() => {
    const clientName = currentUser?.nombre_completo || 'Cliente';
    const destination = selectedOrder?.destino_detalle || 'Agencia Shalom Nacional';

    const welcomeMsg: ChatMessage = {
      id: 'welcome-section',
      sender: 'assistant',
      text: `¡Hola ${clientName}! ✨ Te doy la bienvenida a **Encomi AI**, tu inteligencia artificial especializada en logística y seguimiento de encomiendas.

📌 **Información Clave de Despacho:**
• **Origen Fijo:** Sede Central Shalom (Av. 28 de Julio / Lima Central)
• **Horario de Salida:** **9:00 PM (21:00 hrs)** todos los días.
• **Pedido Seleccionado:** #${selectedOrder?.codigo_seguimiento || 'Vigente'} (${destination})

¿En qué puedo ayudarte hoy? Puedes presionar las preguntas frecuentes sugeridas abajo o escribir tu consulta.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);
  }, [selectedOrder?.id, currentUser?.nombre_completo]);

  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const currentLimit = getDailyMessageLimitStatus(currentUser?.id || 'guest');
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

    // Consumir 1 crédito diario
    consumeDailyMessage(currentUser?.id || 'guest');
    setLimitStatus(getDailyMessageLimitStatus(currentUser?.id || 'guest'));

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
        text: 'Todos los pedidos son entregados en la Sede Central de Shalom para salir en los camiones de las 9:00 PM. Por favor inténtalo de nuevo en unos momentos.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
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
              Despachos diarios 9:00 PM desde Sede Central Shalom
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

      {/* Order Context Selector if user has multiple orders */}
      {userOrders.length > 0 && (
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate">
              Consultando sobre: <strong>#{selectedOrder?.codigo_seguimiento}</strong> ({selectedOrder?.destino_detalle})
            </span>
          </div>

          {userOrders.length > 1 && (
            <select
              value={selectedOrder?.id || ''}
              onChange={(e) => {
                const found = userOrders.find(o => o.id === e.target.value);
                if (found) setSelectedOrder(found);
              }}
              className="px-2.5 py-1 rounded-xl bg-slate-950 border border-white/10 text-xs text-cyan-300 font-bold focus:outline-none focus:border-cyan-500 shrink-0"
            >
              {userOrders.map(o => (
                <option key={o.id} value={o.id}>
                  #{o.codigo_seguimiento} - {o.destino_detalle}
                </option>
              ))}
            </select>
          )}
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

        {/* Quick FAQ Suggestion Chips */}
        <div className="p-2.5 bg-slate-950/80 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0">
          <button
            onClick={() => handleSendMessage('¿Cuánto tiempo demorará el envío hasta que me llegue?')}
            className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
          >
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span>¿Cuánto tiempo demorará?</span>
          </button>

          <button
            onClick={() => handleSendMessage('¿Qué documentos necesito para recoger mi paquete en Shalom?')}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Requisitos con DNI</span>
          </button>

          <button
            onClick={() => handleSendMessage('¿Cuánto se paga de flete en la agencia de destino?')}
            className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1"
          >
            <span>💰</span>
            <span>Costo de flete</span>
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

    </div>
  );
};
