import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useOrders } from '../../context/OrderContext';
import { useAuth } from '../../context/AuthContext';
import {
  ChatMessage,
  generateEncomiAiResponse,
  AdminAnalyticsContext,
} from '../../services/encomiAiService';
import {
  Sparkles,
  Send,
  Bot,
  User,
  Crown,
  BarChart3,
  Users,
  Package,
  TrendingUp,
  Clock,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export const EncomiAiAdminMasterTab: React.FC = () => {
  const { pedidos, tallerConfig, colaboradores } = useOrders();
  const { currentUser } = useAuth();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  // Contexto ejecutivo en tiempo real para Encomi AI Master
  const adminContext = useMemo<AdminAnalyticsContext>(() => {
    const totalOrders = pedidos.length;
    const activeOrders = pedidos.filter(p => p.estado_envio !== 'entregado').length;
    const deliveredOrders = pedidos.filter(p => p.estado_envio === 'entregado').length;
    const enColaCount = pedidos.filter(p => p.estado_produccion === 'en_cola' && p.estado_envio === 'pendiente').length;
    const alistandoCount = pedidos.filter(p => p.estado_produccion === 'bordando' && p.estado_envio === 'pendiente').length;
    const dejandoShalomCount = pedidos.filter(p => p.estado_envio === 'en_camino' || (p.estado_produccion === 'completado' && p.estado_envio === 'pendiente')).length;
    const shalomOrdersCount = pedidos.filter(p => p.metodo_envio_codigo === 'shalom' || p.destino_detalle?.toLowerCase().includes('shalom')).length;
    const motorizadoOrdersCount = pedidos.filter(p => p.metodo_envio_codigo === 'motorizado' || p.destino_detalle?.toLowerCase().includes('motorizado')).length;

    // Calcular facturación aproximada (S/ 25 por pedido base)
    const totalRevenue = pedidos.reduce((acc) => acc + 25, 0);

    // Agrupar clientes únicos
    const clientMap = new Map<string, { name: string; count: number }>();
    pedidos.forEach(p => {
      const name = p.usuario?.nombre_completo || 'Clienta';
      const existing = clientMap.get(name) || { name, count: 0 };
      existing.count += 1;
      clientMap.set(name, existing);
    });

    const clientsCount = clientMap.size;
    const topClients = Array.from(clientMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .map(c => `${c.name} (${c.count} pedidos)`)
      .join(', ');

    // Pedidos de hoy
    const todayStr = new Date().toISOString().slice(0, 10);
    const todayOrdersCount = pedidos.filter(p => p.created_at?.slice(0, 10) === todayStr).length;

    return {
      totalOrders,
      activeOrders,
      deliveredOrders,
      enColaCount,
      alistandoCount,
      dejandoShalomCount,
      shalomOrdersCount,
      motorizadoOrdersCount,
      totalRevenue,
      clientsCount,
      topClientsSummary: topClients || 'Sin historial reciente',
      todayOrdersCount,
    };
  }, [pedidos]);

  // Mensaje de bienvenida inicial ejecutivo
  useEffect(() => {
    const welcomeMsg: ChatMessage = {
      id: 'admin-welcome',
      sender: 'assistant',
      text: `👑 ¡Bienvenido, equipo directivo de **ComiKids**! 

Soy **Encomi AI Master**, tu copiloto ejecutivo de inteligencia artificial con **acceso total e ilimitado** a todos los datos de tu empresa:

📊 **Visión General en Vivo:**
• **Pedidos Activos:** ${adminContext.activeOrders} órdenes en proceso
• **En Almacén:** ${adminContext.enColaCount} | **En Alistamiento:** ${adminContext.alistandoCount} | **En Camino a Shalom:** ${adminContext.dejandoShalomCount}
• **Clientas en Agenda:** ${adminContext.clientsCount} registradas
• **Facturación Estimada:** S/ ${adminContext.totalRevenue.toFixed(2)}

Puedes preguntarme sobre estadísticas de ventas, estado de cualquier pedido, clientas frecuentes o cuellos de botella de despacho.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages([welcomeMsg]);
  }, []);

  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text || isTyping) return;

    const userMsg: ChatMessage = {
      id: `admin-user-${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);

    try {
      const response = await generateEncomiAiResponse(
        text,
        pedidos[0] || null,
        'ComiKids Admin',
        true, // isEmpresa = true (Master Access)
        adminContext
      );

      const aiMsg: ChatMessage = {
        id: `admin-ai-${Date.now()}`,
        sender: 'assistant',
        text: response,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (err) {
      console.error('Error Encomi AI Master:', err);
      const errorMsg: ChatMessage = {
        id: `admin-error-${Date.now()}`,
        sender: 'assistant',
        text: 'Error al consultar datos ejecutivos. Por favor intenta de nuevo.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="space-y-4 animate-fadeIn">
      
      {/* Top Vision Master Banner */}
      <div className="p-5 sm:p-6 rounded-3xl bg-linear-to-r from-amber-500/15 via-slate-900 to-purple-900/30 border-2 border-amber-500/40 shadow-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-tr from-amber-500 to-purple-600 flex items-center justify-center text-white text-2xl shadow-xl shadow-amber-500/30">
            <Crown className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl sm:text-2xl font-black text-white">Encomi AI Master</h2>
              <span className="px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                Control Total ComiKids 👑
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Acceso confidencial en tiempo real a métricas, pedidos, clientas y logística
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3.5 py-2 rounded-2xl text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-2 shadow-lg">
            <span>✨ Mensajes Ilimitados</span>
          </span>
        </div>
      </div>

      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-2xl bg-white/4 border border-white/10 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Pedidos Activos</span>
          <strong className="text-xl font-black text-cyan-400 font-mono">{adminContext.activeOrders}</strong>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/4 border border-white/10 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">En Almacén</span>
          <strong className="text-xl font-black text-amber-400 font-mono">{adminContext.enColaCount}</strong>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/4 border border-white/10 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Clientas CRM</span>
          <strong className="text-xl font-black text-purple-400 font-mono">{adminContext.clientsCount}</strong>
        </div>
        <div className="p-3.5 rounded-2xl bg-white/4 border border-white/10 text-center">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Facturación</span>
          <strong className="text-xl font-black text-emerald-400 font-mono">S/ {adminContext.totalRevenue.toFixed(0)}</strong>
        </div>
      </div>

      {/* Main Executive Chat Box */}
      <div className="h-[520px] rounded-3xl glass-panel border border-white/10 flex flex-col overflow-hidden bg-slate-900/95 shadow-2xl">
        
        {/* Messages List */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-950/60">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';

            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
              >
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 text-sm font-black shadow-lg ${
                    isUser
                      ? 'bg-cyan-500 text-slate-950 shadow-cyan-500/20'
                      : 'bg-linear-to-tr from-amber-500 to-purple-600 text-white shadow-amber-500/30'
                  }`}
                >
                  {isUser ? <User className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
                </div>

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed shadow-xl ${
                    isUser
                      ? 'bg-cyan-600 text-white rounded-tr-none'
                      : 'bg-slate-800/95 text-slate-100 border border-white/10 rounded-tl-none space-y-2'
                  }`}
                >
                  <div className="whitespace-pre-wrap">
                    {msg.text}
                  </div>
                  <span
                    className={`block text-[9px] mt-1.5 text-right ${
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
            <div className="flex items-center gap-2 text-xs text-amber-300 p-2 animate-pulse">
              <Crown className="w-4 h-4 text-amber-400" />
              <span>Encomi AI Master está analizando las bases de datos de ComiKids...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Executive Command Chips */}
        <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => handleSendMessage('Dame un resumen ejecutivo completo de los pedidos de hoy y su estado')}
            className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
            <span>📊 Resumen Ejecutivo</span>
          </button>

          <button
            onClick={() => handleSendMessage('¿Cuántos pedidos hay en cola de almacén y cuántos alistando?')}
            className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span>📦 Cola & Alistamiento</span>
          </button>

          <button
            onClick={() => handleSendMessage('¿Quiénes son las clientas más activas en la agenda y cuántos pedidos tienen?')}
            className="px-3 py-1.5 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-200 text-xs font-bold shrink-0 transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Users className="w-3.5 h-3.5 text-purple-400" />
            <span>👥 Top Clientas CRM</span>
          </button>
        </div>

        {/* Master Input Box */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputText);
          }}
          className="p-3.5 bg-slate-900 border-t border-white/10 flex items-center gap-2 shrink-0"
        >
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isTyping}
            placeholder="Pregúntale a Encomi AI Master sobre métricas, finanzas, clientas o pedidos..."
            className="flex-1 px-4 py-3 rounded-2xl bg-slate-950 border border-white/10 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-500"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || isTyping}
            className="p-3 rounded-2xl bg-linear-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-bold disabled:opacity-40 shadow-lg shadow-amber-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

      </div>

    </div>
  );
};
