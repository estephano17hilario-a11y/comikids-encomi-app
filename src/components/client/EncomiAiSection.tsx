import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import { Pedido } from '../../types/database.types';
import {
  ChatMessage,
  generateEncomiAiResponse,
  getDailyMessageLimitStatus,
  consumeDailyMessage,
  AdminDataContext,
} from '../../services/encomiAiService';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Clock,
  Package,
  AlertCircle,
  BarChart3,
  Truck,
  Users,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';

interface Props {
  isAdmin?: boolean;
}

export const EncomiAiSection: React.FC<Props> = ({ isAdmin: propsIsAdmin }) => {
  const { pedidos } = useOrders();
  const { currentUser } = useAuth();

  const isAdmin = Boolean(propsIsAdmin || currentUser?.rol === 'empresa');

  const userOrders = useMemo(() => {
    if (isAdmin) return pedidos;
    return pedidos.filter(p => p.usuario_id === currentUser?.id);
  }, [pedidos, currentUser?.id, isAdmin]);

  const [selectedOrder, setSelectedOrder] = useState<Pedido | null>(() => {
    return userOrders.length > 0 ? userOrders[0] : null;
  });

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [limitStatus, setLimitStatus] = useState(() =>
    getDailyMessageLimitStatus(currentUser?.id || (isAdmin ? 'empresa' : 'guest'), isAdmin)
  );
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Datos administrativos en tiempo real para la IA
  const adminData: AdminDataContext = useMemo(() => {
    const uniqueClients = new Set(pedidos.map(p => p.usuario?.telefono_default || p.usuario?.dni || p.usuario_id).filter(Boolean));
    return {
      totalOrders: pedidos.length,
      pedidosEnCola: pedidos.filter(p => p.estado_produccion === 'en_cola' && p.estado_envio === 'pendiente').length,
      pedidosAlistando: pedidos.filter(p => p.estado_produccion === 'bordando' && p.estado_envio === 'pendiente').length,
      pedidosEnCamino: pedidos.filter(p => p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')).length,
      pedidosEntregados: pedidos.filter(p => p.estado_envio === 'entregado').length,
      shalomCount: pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')).length,
      motorizadoCount: pedidos.filter(p => p.metodo_envio_codigo === 'motorizado' || p.destino_detalle?.toLowerCase().includes('motorizado')).length,
      clientsCount: uniqueClients.size,
      recentOrders: pedidos.slice(0, 10),
    };
  }, [pedidos]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Mensaje inicial de bienvenida (SIN COBRAR MENSAJE)
  useEffect(() => {
    const clientName = isAdmin ? 'ComiKids' : currentUser?.nombre_completo || 'Cliente';
    const destination = selectedOrder?.destino_detalle || 'Agencia Shalom Nacional';

    const welcomeMsg: ChatMessage = {
      id: 'welcome-section',
      sender: 'assistant',
      text: isAdmin
        ? `¡Hola equipo de **ComiKids**! 👑 Soy **Encomi AI**, su asistente con acceso total a métricas, pedidos, agenda de clientes y despachos en tiempo real.

📊 **Resumen Rápido:** Tienen **${adminData.pedidosEnCola + adminData.pedidosAlistando} paquetes en preparación**, **${adminData.pedidosEnCamino} en camino a Shalom** y **${adminData.totalOrders} órdenes totales**.

Tienen consultas ilimitadas. ¿Desean un reporte detallado del día o buscar algún pedido?`
        : `¡Hola ${clientName}! ✨ Te doy la bienvenida a **Encomi AI**, tu especialista en logística y seguimiento.

📌 **Información Clave de Despacho:**
• **Entrega en Sede Central:** 9:00 PM (Turno Noche)
• **Salida de Flota Shalom:** Al día siguiente en la mañana / tarde.
• **Pedido Seleccionado:** #${selectedOrder?.codigo_seguimiento || 'Vigente'} (${destination})

Presiona el botón de abajo para consultar el **tiempo estimado de llegada** a tu agencia.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);
  }, [isAdmin, selectedOrder?.id]);

  const handleSendMessage = async (textToSend: string, orderToUse?: Pedido | null) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const currentLimit = getDailyMessageLimitStatus(currentUser?.id || (isAdmin ? 'empresa' : 'guest'), isAdmin);
    if (!currentLimit.canSend) {
      const limitMsg: ChatMessage = {
        id: `limit-${Date.now()}`,
        sender: 'system',
        text: '⚠️ Has alcanzado el límite de 3 consultas con Encomi AI por hoy. Vuelve mañana o contáctanos por WhatsApp oficial.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, limitMsg]);
      return;
    }

    // Consumir 1 crédito sólo al enviar
    consumeDailyMessage(currentUser?.id || (isAdmin ? 'empresa' : 'guest'), isAdmin);
    setLimitStatus(getDailyMessageLimitStatus(currentUser?.id || (isAdmin ? 'empresa' : 'guest'), isAdmin));

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
      const clientName = isAdmin ? 'ComiKids' : currentUser?.nombre_completo || 'Cliente';
      const targetOrder = orderToUse !== undefined ? orderToUse : selectedOrder;
      const response = await generateEncomiAiResponse(text, targetOrder, clientName, isAdmin, adminData);
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
        text: 'Los paquetes se entregan a las 9:00 PM en Sede Central y salen al día siguiente con Shalom. Por favor intenta de nuevo en unos instantes.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleTriggerTransitQuestion = () => {
    setShowOrderPicker(true);
  };

  const handleConfirmOrderForTransit = (order: Pedido) => {
    setSelectedOrder(order);
    setShowOrderPicker(false);
    handleSendMessage(`¿Cuánto tiempo demorará mi paquete en llegarme para el pedido #${order.codigo_seguimiento} a ${order.destino_detalle}?`, order);
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
                {isAdmin ? 'Cuenta ComiKids • Modo Empresa' : 'IA Logística'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              {isAdmin ? 'Inteligencia Operativa & Control Total' : 'Sede Central Shalom • Salida al día siguiente'}
            </p>
          </div>
        </div>

        {/* Limit Badge */}
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1.5 rounded-2xl text-xs font-black border flex items-center gap-1.5 shadow-md ${
              limitStatus.isUnlimited
                ? 'bg-purple-500/15 text-purple-300 border-purple-500/30'
                : limitStatus.remaining > 0
                ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            <span>💬</span>
            <span>{limitStatus.isUnlimited ? 'Mensajes: Ilimitado ∞' : `Consultas: ${limitStatus.remaining}/3 hoy`}</span>
          </span>
        </div>
      </div>

      {/* Order Context Selector Card */}
      {userOrders.length > 0 && !isAdmin && (
        <div className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Package className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-xs text-slate-300 truncate">
              Consultando sobre: <strong>#{selectedOrder?.codigo_seguimiento}</strong> ({selectedOrder?.destino_detalle})
            </span>
          </div>

          <button
            onClick={() => setShowOrderPicker(!showOrderPicker)}
            className="px-2.5 py-1 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 text-xs font-bold border border-cyan-500/30 shrink-0 cursor-pointer"
          >
            {showOrderPicker ? 'Cerrar' : 'Cambiar Pedido'}
          </button>
        </div>
      )}

      {/* Order Picker Dropdown for Clients */}
      {showOrderPicker && userOrders.length > 0 && !isAdmin && (
        <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/40 space-y-2 animate-slideDown shadow-xl">
          <span className="text-xs font-black text-cyan-300 block">
            Selecciona el pedido que deseas consultar:
          </span>
          <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
            {userOrders.map(ord => (
              <button
                key={ord.id}
                onClick={() => handleConfirmOrderForTransit(ord)}
                className={`w-full text-left p-2.5 rounded-xl text-xs flex items-center justify-between border transition-all cursor-pointer ${
                  selectedOrder?.id === ord.id
                    ? 'bg-cyan-500/20 border-cyan-500 text-white font-bold'
                    : 'bg-slate-800/80 border-white/10 text-slate-300 hover:bg-slate-800'
                }`}
              >
                <div className="truncate">
                  <strong className="text-cyan-300 block">#{ord.codigo_seguimiento}</strong>
                  <span className="text-[11px] text-slate-300 truncate block">{ord.destino_detalle}</span>
                </div>
                <ChevronRight className="w-4 h-4 text-cyan-400 shrink-0 ml-2" />
              </button>
            ))}
          </div>
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

        {/* Acciones Rápidas */}
        {isAdmin ? (
          /* Chips para Administrador ComiKids */
          <div className="p-2.5 bg-slate-950/80 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto shrink-0">
            <button
              onClick={() => handleSendMessage('Dame un reporte general de los pedidos y estados del taller')}
              className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <BarChart3 className="w-3.5 h-3.5 text-purple-400" />
              <span>📊 Resumen General</span>
            </button>

            <button
              onClick={() => handleSendMessage('¿Cuántos pedidos de Shalom están pendientes de entrega hoy?')}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Truck className="w-3.5 h-3.5 text-cyan-400" />
              <span>🚚 Envíos Shalom</span>
            </button>

            <button
              onClick={() => handleSendMessage('¿Cuántos clientes tenemos registrados en la agenda?')}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Users className="w-3.5 h-3.5 text-emerald-400" />
              <span>👥 Agenda Clientes</span>
            </button>
          </div>
        ) : (
          /* Preguntas Rápidas para Clientes */
          <div className="p-2.5 sm:p-3 bg-slate-950/90 border-t border-white/10 shrink-0 grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleTriggerTransitQuestion}
              className="w-full py-2 px-3 rounded-2xl bg-linear-to-r from-purple-600/30 via-indigo-600/30 to-cyan-600/30 hover:from-purple-600/40 hover:to-cyan-600/40 border border-purple-500/40 text-purple-200 hover:text-white text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-purple-950/20 truncate"
            >
              <Clock className="w-3.5 h-3.5 text-cyan-300 animate-pulse shrink-0" />
              <span className="truncate">¿Cuándo llegará mi pedido?</span>
            </button>

            <button
              type="button"
              onClick={() => handleSendMessage('¿Qué es Encomi y cómo asociarse con ellos para enviar 10 veces más rápido?')}
              className="w-full py-2 px-3 rounded-2xl bg-linear-to-r from-cyan-600/30 via-blue-600/30 to-purple-600/30 hover:from-cyan-600/40 hover:to-purple-600/40 border border-cyan-500/40 text-cyan-200 hover:text-white text-[11px] sm:text-xs font-black flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer shadow-lg shadow-cyan-950/20 truncate"
            >
              <span className="shrink-0">🚀</span>
              <span className="truncate">¿Qué es Encomi y asociarse?</span>
            </button>
          </div>
        )}

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
              isAdmin
                ? 'Escribe tu consulta ejecutiva a Encomi AI (Ilimitado)...'
                : limitStatus.canSend
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
