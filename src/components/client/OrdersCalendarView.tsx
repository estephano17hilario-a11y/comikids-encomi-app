import React, { useState, useMemo } from 'react';
import { Pedido } from '../../types/database.types';
import { formatDate } from '../../utils/formatters';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Package,
  MapPin,
  MessageCircle,
  Clock,
  Boxes,
  PackageCheck,
  Truck,
  RotateCcw
} from 'lucide-react';

interface Props {
  orders: Pedido[];
  whatsappNumber: string;
  clientName: string;
  onBackToList: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const DAYS_OF_WEEK = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export const OrdersCalendarView: React.FC<Props> = ({
  orders,
  whatsappNumber,
  clientName,
  onBackToList
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth());
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);

  // Mapear pedidos por fecha YYYY-MM-DD
  const ordersByDate = useMemo(() => {
    const map: Record<string, Pedido[]> = {};
    orders.forEach((p) => {
      const d = new Date(p.created_at);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${year}-${month}-${day}`;
        if (!map[key]) map[key] = [];
        map[key].push(p);
      }
    });
    return map;
  }, [orders]);

  // Generar días del mes actual
  const { calendarCells, totalDaysInMonth } = useMemo(() => {
    const firstDayIndex = new Date(currentYear, currentMonth, 1).getDay();
    const daysCount = new Date(currentYear, currentMonth + 1, 0).getDate();

    const cells: Array<{ dayNum: number | null; dateStr: string | null; orders: Pedido[] }> = [];

    // Celdas vacías antes del día 1
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ dayNum: null, dateStr: null, orders: [] });
    }

    // Días del mes
    for (let day = 1; day <= daysCount; day++) {
      const mStr = String(currentMonth + 1).padStart(2, '0');
      const dStr = String(day).padStart(2, '0');
      const dateKey = `${currentYear}-${mStr}-${dStr}`;
      cells.push({
        dayNum: day,
        dateStr: dateKey,
        orders: ordersByDate[dateKey] || []
      });
    }

    return { calendarCells: cells, totalDaysInMonth: daysCount };
  }, [currentYear, currentMonth, ordersByDate]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
    setSelectedDateStr(null);
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
    setSelectedDateStr(null);
  };

  const handleGoToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    const mStr = String(today.getMonth() + 1).padStart(2, '0');
    const dStr = String(today.getDate()).padStart(2, '0');
    setSelectedDateStr(`${today.getFullYear()}-${mStr}-${dStr}`);
  };

  const selectedOrders = selectedDateStr ? (ordersByDate[selectedDateStr] || []) : [];

  const getStepProgress = (pedido: Pedido) => {
    if (pedido.estado_envio === 'entregado' || pedido.estado_envio === 'en_camino') return 4;
    if (pedido.estado_produccion === 'completado') return 3;
    if (pedido.estado_produccion === 'bordando') return 2;
    return 1;
  };

  const steps = [
    { num: 1, title: 'En Almacén', icon: Clock },
    { num: 2, title: 'En Embalaje', icon: Boxes },
    { num: 3, title: 'Por Despachar', icon: PackageCheck },
    { num: 4, title: 'En Camino', icon: Truck },
  ];

  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (Math.abs(diff) > 45) {
      if (diff > 0) {
        handleNextMonth();
      } else {
        handlePrevMonth();
      }
    }
    setTouchStartX(null);
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      
      {/* Barra Superior con Navegación y Botón Volver */}
      <div className="flex flex-wrap items-center justify-between gap-3 minimal-card p-4 sm:p-5">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">Mapa de Calendario</h3>
            <p className="text-xs text-slate-400">Desliza o usa las flechas para explorar meses</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToList}
          className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-slate-200 border border-white/10 text-xs font-bold transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Ver en Lista</span>
        </button>
      </div>

      {/* Calendario Interactivo con Deslizamiento Táctil */}
      <div
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className="minimal-card p-5 sm:p-7 space-y-5 select-none"
      >
        
        {/* Controles Pasantes de Mes y Año */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
          <button
            type="button"
            onClick={handlePrevMonth}
            className="p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/10 transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Mes Anterior"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="hidden sm:inline">Anterior</span>
          </button>

          <div className="flex items-center gap-3 text-center">
            <h4 className="text-lg sm:text-xl font-black text-white tracking-tight flex items-center gap-2">
              <span className="text-cyan-300">{MONTH_NAMES[currentMonth]}</span>
              <span className="text-slate-400 font-mono">{currentYear}</span>
            </h4>

            <button
              type="button"
              onClick={handleGoToday}
              className="px-2.5 py-1 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-[11px] font-black transition-all cursor-pointer"
            >
              Hoy
            </button>
          </div>

          <button
            type="button"
            onClick={handleNextMonth}
            className="p-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.12] text-slate-200 border border-white/10 transition-all active:scale-95 cursor-pointer flex items-center gap-1 text-xs font-bold"
            title="Mes Siguiente"
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Encabezados de Días de la Semana */}
        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS_OF_WEEK.map((d, i) => (
            <div
              key={d}
              className={`text-xs font-black uppercase tracking-wider py-1.5 ${
                i === 0 || i === 6 ? 'text-amber-400' : 'text-slate-400'
              }`}
            >
              {d}
            </div>
          ))}
        </div>

        {/* Celdas del Calendario */}
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {calendarCells.map((cell, idx) => {
            if (!cell.dayNum || !cell.dateStr) {
              return (
                <div
                  key={`empty-${idx}`}
                  className="min-h-[52px] sm:min-h-[64px] rounded-2xl bg-white/[0.01] border border-transparent"
                />
              );
            }

            const hasOrders = cell.orders.length > 0;
            const isSelected = selectedDateStr === cell.dateStr;
            const isToday =
              today.getFullYear() === currentYear &&
              today.getMonth() === currentMonth &&
              today.getDate() === cell.dayNum;

            return (
              <button
                key={cell.dateStr}
                type="button"
                onClick={() => setSelectedDateStr(cell.dateStr)}
                className={`min-h-[52px] sm:min-h-[64px] p-1.5 sm:p-2 rounded-2xl border transition-all flex flex-col items-center justify-between text-left cursor-pointer relative ${
                  isSelected
                    ? 'bg-cyan-500/25 border-cyan-400 ring-2 ring-cyan-400/30 shadow-lg shadow-cyan-500/20'
                    : hasOrders
                    ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 shadow-md'
                    : 'bg-white/[0.03] hover:bg-white/[0.06] border-white/5 text-slate-400'
                }`}
              >
                <div className="w-full flex items-center justify-between">
                  <span
                    className={`text-xs sm:text-sm font-bold font-mono ${
                      isToday
                        ? 'w-6 h-6 rounded-full bg-cyan-500 text-white flex items-center justify-center font-black'
                        : isSelected
                        ? 'text-cyan-300 font-black'
                        : hasOrders
                        ? 'text-emerald-300 font-black'
                        : 'text-slate-400'
                    }`}
                  >
                    {cell.dayNum}
                  </span>

                  {hasOrders && (
                    <span className="text-[10px] sm:text-xs">📦</span>
                  )}
                </div>

                {hasOrders && (
                  <div className="w-full mt-1">
                    <span className="block text-[10px] font-black text-center text-emerald-300 bg-emerald-500/25 px-1.5 py-0.5 rounded-lg border border-emerald-500/30 truncate">
                      {cell.orders.length} {cell.orders.length === 1 ? 'pedido' : 'pedidos'}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Leyenda */}
        <div className="flex items-center justify-center gap-4 text-xs text-slate-400 pt-2 border-t border-white/5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md bg-emerald-500/30 border border-emerald-500/50 inline-block" />
            <span>Días con envíos</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-cyan-500 inline-block" />
            <span>Día actual</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-md border-2 border-cyan-400 inline-block" />
            <span>Seleccionado</span>
          </div>
        </div>

      </div>

      {/* Detalle de Pedidos del Día Seleccionado */}
      {selectedDateStr && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between px-2">
            <h4 className="text-sm font-black text-white flex items-center gap-2">
              <span>📅 Envíos del {selectedDateStr}</span>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-xs font-mono font-bold border border-cyan-500/30">
                {selectedOrders.length} {selectedOrders.length === 1 ? 'paquete' : 'paquetes'}
              </span>
            </h4>
          </div>

          {selectedOrders.length === 0 ? (
            <div className="minimal-card p-6 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No realizaste ningún despacho en este día seleccionado.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {selectedOrders.map((pedido) => {
                const currentStep = getStepProgress(pedido);
                const queryText = `¡Hola Comikids! 📦\nSoy *${clientName}*, deseo consultar el estado de mi envío *#${pedido.codigo_seguimiento}* del día ${selectedDateStr}.\n\n*Destino:* ${pedido.destino_detalle}`;
                const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(queryText)}`;

                return (
                  <div key={pedido.id} className="minimal-card p-5 sm:p-6 space-y-5 border-cyan-500/30">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] pb-3.5">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-base font-black text-cyan-400">
                          #{pedido.codigo_seguimiento}
                        </span>
                        <span className="px-3 py-1 rounded-xl text-xs font-bold bg-white/[0.06] text-slate-200 border border-white/10">
                          {pedido.metodo_envio_nombre}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {formatDate(pedido.created_at)}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Destino de Entrega
                      </p>
                      <p className="text-sm font-bold text-white flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span>{pedido.destino_detalle}</span>
                      </p>
                      {pedido.latitud && pedido.longitud && (
                        <div className="pt-1.5">
                          <a
                            href={`https://www.google.com/maps?q=${pedido.latitud},${pedido.longitud}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 text-xs font-bold transition-all shadow-sm"
                          >
                            <span>📍 Ver en Google Maps</span>
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-white/[0.08]">
                      <div className="grid grid-cols-4 gap-2">
                        {steps.map((step) => {
                          const isPast = currentStep > step.num;
                          const isCurrent = currentStep === step.num;
                          const StepIcon = step.icon;

                          return (
                            <div key={step.num} className="flex flex-col items-center text-center">
                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
                                  isPast
                                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20'
                                    : isCurrent
                                    ? 'bg-cyan-500 text-white animate-pulse shadow-xl shadow-cyan-500/40 ring-2 ring-cyan-400/20'
                                    : 'bg-white/[0.04] text-slate-600 border border-white/10'
                                }`}
                              >
                                <StepIcon className="w-4 h-4" />
                              </div>
                              <p
                                className={`text-[11px] font-black mt-1.5 leading-tight ${
                                  isCurrent ? 'text-cyan-400' : isPast ? 'text-emerald-400' : 'text-slate-500'
                                }`}
                              >
                                {step.title}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <a
                      href={waUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 px-4 rounded-2xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center justify-center gap-2 transition-all active:scale-98 shadow-sm"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>Consultar sobre este paquete en WhatsApp</span>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
};
