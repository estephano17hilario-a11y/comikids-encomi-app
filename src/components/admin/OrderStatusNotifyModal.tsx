import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Pedido } from '../../types/database.types';
import { buildWhatsAppStatusNotifyUrl } from '../../services/whatsappService';
import { ShalomApiService } from '../../services/shalomApiService';
import {
  MessageCircle,
  CheckCircle2,
  X,
  Sparkles,
  Phone,
  Edit2,
  Check,
  ArrowRight,
  Package,
  Clock,
  ExternalLink,
  ThumbsUp,
  Send,
  Loader2,
  Zap
} from 'lucide-react';

interface Props {
  orders: Pedido[];
  statusName: string;
  onClose: () => void;
}

interface ToDoItemState {
  orderId: string;
  phone: string;
  isEditingPhone: boolean;
  sent: boolean;
}

export const OrderStatusNotifyModal: React.FC<Props> = ({
  orders,
  statusName,
  onClose,
}) => {
  // Inicializar estado de tareas con los teléfonos disponibles
  const [items, setItems] = useState<ToDoItemState[]>(() => {
    return orders.map(order => {
      const defaultPhone =
        order.usuario?.telefono_default ||
        (order.usuario as any)?.telefono ||
        '';
      return {
        orderId: order.id,
        phone: defaultPhone,
        isEditingPhone: false,
        sent: false,
      };
    });
  });

  const [dismissCompleted, setDismissCompleted] = useState(false);
  const [isSendingAllAuto, setIsSendingAllAuto] = useState(false);


  const pendingItems = items.filter(it => !it.sent);
  const completedItems = items.filter(it => it.sent);
  const totalCount = items.length;
  const completedCount = completedItems.length;
  const isAllCompleted = completedCount === totalCount && totalCount > 0;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  const handleSendAllAuto = async () => {
    if (isSendingAllAuto) return;
    setIsSendingAllAuto(true);
    const pendingItemsList = items.filter(it => !it.sent);
    const payload = pendingItemsList.map(it => {
      const o = orders.find(ord => ord.id === it.orderId);
      return {
        phone: it.phone,
        customerName: o?.usuario?.nombre_completo || 'Clienta',
        trackingCode: o?.codigo_seguimiento || '',
        guideNumber: o?.shalom_numero_guia || (statusName.includes('Shalom') ? 'En camino a Agencia Shalom' : statusName),
        agencyName: o?.destino_detalle || 'Destino',
        orderCode: o?.codigo_seguimiento || it.orderId,
      };
    });


    try {
      await ShalomApiService.syncDispatchedWhatsApp(payload);
      setItems(prev => prev.map(it => ({ ...it, sent: true })));
    } catch (err) {
      console.error('[AUTO WHATSAPP NOTIFY ERROR]', err);
    } finally {
      setIsSendingAllAuto(false);
    }
  };

  const handleSendWhatsApp = (order: Pedido, itemState: ToDoItemState) => {
    const clientName = order.usuario?.nombre_completo || 'Cliente';
    const destination = order.destino_detalle || 'Destino';
    const phoneToUse = itemState.phone || '';

    const url = buildWhatsAppStatusNotifyUrl({
      phone: phoneToUse,
      clientName,
      orderCode: order.codigo_seguimiento,
      destination,
      statusName,
    });

    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }

    // Marcar como enviado en la lista
    setItems(prev =>
      prev.map(it => (it.orderId === order.id ? { ...it, sent: true } : it))
    );
  };

  const handleMarkAsSentDirectly = (orderId: string) => {
    setItems(prev =>
      prev.map(it => (it.orderId === orderId ? { ...it, sent: true } : it))
    );
  };

  const handleUpdatePhone = (orderId: string, newPhone: string) => {
    setItems(prev =>
      prev.map(it => (it.orderId === orderId ? { ...it, phone: newPhone } : it))
    );
  };

  const toggleEditPhone = (orderId: string) => {
    setItems(prev =>
      prev.map(it =>
        it.orderId === orderId ? { ...it, isEditingPhone: !it.isEditingPhone } : it
      )
    );
  };

  const displayedPending = dismissCompleted ? pendingItems : items;

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-5 bg-black/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-xl max-h-[90vh] rounded-3xl bg-slate-900 border-2 border-cyan-500/50 shadow-2xl shadow-cyan-500/20 flex flex-col overflow-hidden animate-scaleUp">
        
        {/* Header con gradiente e información del estado */}
        <div className="p-4 sm:p-5 border-b border-white/10 bg-linear-to-r from-cyan-950/60 via-slate-900 to-purple-950/60 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0 shadow-lg shadow-emerald-500/20">
              <MessageCircle className="w-5 h-5 fill-current" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-black text-white">
                  Notificar por WhatsApp
                </h3>
                <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  {statusName}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Envía la actualización a cada clienta desde la línea <strong className="text-emerald-400">+51 927 781 412</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Barra de Progreso To-Do */}
        <div className="px-5 py-3 bg-slate-950/80 border-b border-white/5 shrink-0 flex items-center justify-between gap-4">
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-slate-300">
                Progreso: {completedCount} de {totalCount} {totalCount === 1 ? 'clienta notificada' : 'clientas notificadas'}
              </span>
              <span className="text-cyan-400 font-mono font-black">{progressPercent}%</span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-linear-to-r from-emerald-500 via-cyan-400 to-blue-500 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          {pendingItems.length > 0 && (
            <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer select-none shrink-0">
              <input
                type="checkbox"
                checked={dismissCompleted}
                onChange={e => setDismissCompleted(e.target.checked)}
                className="rounded border-slate-700 text-cyan-500 focus:ring-0"
              />
              <span>Ocultar enviadas</span>
            </label>
          )}
        </div>

        {/* Lista interactiva de tareas To-Do */}
        <div className="flex-1 p-4 sm:p-5 overflow-y-auto space-y-3 bg-slate-950/50">
          {isAllCompleted ? (
            /* Estado de Felicitación / Todos Completados */
            <div className="py-8 px-4 text-center space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 text-2xl">
                🎉
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-white">
                  ¡Excelente trabajo!
                </h4>
                <p className="text-xs text-slate-300 max-w-sm mx-auto">
                  Todas las clientas seleccionadas han recibido su mensaje privado de actualización al estado <strong className="text-cyan-300 font-semibold">{statusName}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="py-3 px-8 rounded-2xl bg-linear-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm shadow-xl shadow-emerald-500/25 transition-all cursor-pointer active:scale-95"
              >
                Finalizar y Cerrar
              </button>
            </div>
          ) : displayedPending.length === 0 && dismissCompleted ? (
            <div className="py-8 text-center text-slate-400 text-xs space-y-2">
              <p>¡Todas las tareas pendientes fueron enviadas!</p>
              <button
                onClick={() => setDismissCompleted(false)}
                className="text-cyan-400 underline font-bold"
              >
                Ver todas ({totalCount})
              </button>
            </div>
          ) : (
            displayedPending.map(item => {
              const order = orders.find(o => o.id === item.orderId);
              if (!order) return null;

              const clientName = order.usuario?.nombre_completo || 'Cliente';
              const cleanPhone = (item.phone || '').trim();

              return (
                <div
                  key={order.id}
                  className={`p-3.5 sm:p-4 rounded-2xl border transition-all space-y-3 ${
                    item.sent
                      ? 'bg-emerald-950/20 border-emerald-500/30 opacity-75'
                      : 'bg-slate-900/90 border-white/10 hover:border-cyan-500/40 shadow-lg shadow-black/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex items-start gap-2.5">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 font-bold text-xs ${
                        item.sent
                          ? 'bg-emerald-500 text-slate-950'
                          : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                      }`}>
                        {item.sent ? '✓' : '📦'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-xs sm:text-sm font-black text-white truncate block">
                            {clientName}
                          </strong>
                          <span className="font-mono text-[10px] text-cyan-400 font-bold bg-cyan-500/10 px-1.5 py-0.2 rounded border border-cyan-500/20">
                            #{order.codigo_seguimiento}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          📍 {order.destino_detalle}
                        </p>
                      </div>
                    </div>

                    {item.sent && (
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0">
                        Enviado ✓
                      </span>
                    )}
                  </div>

                  {/* Fila de Teléfono con opción de edición */}
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5 text-xs">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {item.isEditingPhone ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input
                            type="tel"
                            value={item.phone}
                            onChange={e => handleUpdatePhone(order.id, e.target.value)}
                            placeholder="Ej. 987654321"
                            className="px-2 py-1 rounded-lg bg-slate-950 border border-cyan-500 text-xs text-white w-32 font-mono"
                          />
                          <button
                            type="button"
                            onClick={() => toggleEditPhone(order.id)}
                            className="p-1 rounded bg-cyan-500 text-slate-950 hover:bg-cyan-400"
                            title="Guardar"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className={`font-mono font-bold text-xs ${cleanPhone ? 'text-slate-200' : 'text-amber-400 italic'}`}>
                            {cleanPhone ? `+51 ${cleanPhone.replace(/^51/, '')}` : 'Sin teléfono'}
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEditPhone(order.id)}
                            className="text-slate-500 hover:text-cyan-400 p-0.5"
                            title="Editar teléfono"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Botón de Enviar WhatsApp */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!item.sent ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleMarkAsSentDirectly(order.id)}
                            className="py-1.5 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-[11px] font-bold transition-all cursor-pointer"
                            title="Marcar como enviado sin abrir WhatsApp"
                          >
                            Omitir
                          </button>

                          <button
                            type="button"
                            onClick={() => handleSendWhatsApp(order, item)}
                            className="py-2 px-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-600/30 transition-all cursor-pointer"
                          >
                            <MessageCircle className="w-3.5 h-3.5 fill-current" />
                            <span>Enviar WhatsApp</span>
                            <ArrowRight className="w-3 h-3" />
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSendWhatsApp(order, item)}
                          className="py-1.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-3 h-3 text-emerald-400" />
                          <span>Reenviar</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-slate-900 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-bold text-xs cursor-pointer transition-colors w-full sm:w-auto"
          >
            {isAllCompleted ? 'Cerrar' : 'Cerrar / Omitir restantes'}
          </button>

          {!isAllCompleted && (
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
              <button
                type="button"
                disabled={isSendingAllAuto}
                onClick={handleSendAllAuto}
                className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-600/25 cursor-pointer disabled:opacity-50 active:scale-95 transition-all"
              >
                {isSendingAllAuto ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enviando por WhatsApp API (+51 927 781 412)...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-yellow-300" />
                    <span>Enviar Todos Automático por WhatsApp</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={isSendingAllAuto}
                onClick={() => {
                  const firstPending = items.find(it => !it.sent);
                  if (firstPending) {
                    const order = orders.find(o => o.id === firstPending.orderId);
                    if (order) handleSendWhatsApp(order, firstPending);
                  }
                }}
                className="flex-1 sm:flex-none py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs flex items-center justify-center gap-1.5 shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50"
              >
                <span>Enviar Siguiente Manual</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
};

