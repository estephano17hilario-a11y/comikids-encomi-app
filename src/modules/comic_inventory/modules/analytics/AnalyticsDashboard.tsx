import React, { useState, useMemo } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Icon } from '../../components/ui/Icon';
import { HyperGraph } from './HyperGraph';
import { YapesAnalyticsView } from './YapesAnalyticsView';
import { HistoryItem, Session, Product } from '../../types';
import { ShoppingBag, Smartphone, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

interface AnalyticsDashboardProps {
  history: HistoryItem[];
  sessions: Session[];
  products: Product[];
}

type ChartPeriod = '1S' | '1M' | '3M' | '1A';

function getPeriodLabel(period: ChartPeriod, ref: Date): string {
  const fmt = (d: Date) => {
    const day = d.getDate();
    const mon = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
    return `${day} ${mon}`;
  };

  if (period === '1S') {
    const start = new Date(ref);
    start.setDate(ref.getDate() - 6);
    return `${fmt(start)} – ${fmt(ref)}`;
  }
  if (period === '1M') {
    const start = new Date(ref);
    start.setDate(ref.getDate() - 29);
    return `${fmt(start)} – ${fmt(ref)}`;
  }
  if (period === '3M') {
    const start = new Date(ref);
    start.setMonth(ref.getMonth() - 3);
    return `${fmt(start)} – ${fmt(ref)}`;
  }
  // 1A
  return ref.getFullYear().toString();
}

function isToday(ref: Date): boolean {
  const t = new Date();
  return ref.toDateString() === t.toDateString();
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ history, sessions, products }) => {
  const [metricTab, setMetricTab] = useState<'prendas' | 'yape'>('prendas');
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('1S');
  // The "anchor" date – by default today, can be moved back/forward
  const [referenceDate, setReferenceDate] = useState(() => new Date());

  const movePeriod = (direction: 'prev' | 'next') => {
    setReferenceDate(prev => {
      const d = new Date(prev);
      const step = direction === 'next' ? 1 : -1;
      if (chartPeriod === '1S') d.setDate(d.getDate() + step * 7);
      else if (chartPeriod === '1M') d.setMonth(d.getMonth() + step);
      else if (chartPeriod === '3M') d.setMonth(d.getMonth() + step * 3);
      else if (chartPeriod === '1A') d.setFullYear(d.getFullYear() + step);
      return d;
    });
  };

  const goToToday = () => setReferenceDate(new Date());

  const periodLabel = useMemo(() => getPeriodLabel(chartPeriod, referenceDate), [chartPeriod, referenceDate]);
  const isTodayRef = useMemo(() => isToday(referenceDate), [referenceDate]);

  const { chartData, profitData, labels, totalSales, totalRevenue, totalProfit } = useMemo(() => {
    const ref = new Date(referenceDate);
    const dataPoints: number[] = [];
    const profitPoints: number[] = [];
    const xLabels: string[] = [];

    const addDay = (d: Date) => {
      const dateStr = d.toDateString();
      const dayItems = history.filter(h => h.type === 'sale' && new Date(h.time).toDateString() === dateStr);
      const total = dayItems.reduce((acc, h) => acc + h.price * h.qty, 0);
      const cost = dayItems.reduce((acc, h) => acc + (h.cost || 0) * h.qty, 0);
      dataPoints.push(total);
      profitPoints.push(Math.max(0, total - cost));
    };

    if (chartPeriod === '1S') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i);
        addDay(d);
        xLabels.push(d.toLocaleDateString('es-ES', { weekday: 'short' }).slice(0, 3));
      }
    } else if (chartPeriod === '1M') {
      // Buckets: 6 puntos de ~5 días cada uno
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i * 5);
        // acumular 5 días
        let total = 0; let cost = 0;
        for (let j = 0; j < 5; j++) {
          const dd = new Date(d);
          dd.setDate(d.getDate() - j);
          const dayStr = dd.toDateString();
          const items = history.filter(h => h.type === 'sale' && new Date(h.time).toDateString() === dayStr);
          total += items.reduce((a, h) => a + h.price * h.qty, 0);
          cost += items.reduce((a, h) => a + (h.cost || 0) * h.qty, 0);
        }
        dataPoints.push(total);
        profitPoints.push(Math.max(0, total - cost));
        xLabels.push(`${d.getDate()}/${d.getMonth() + 1}`);
      }
    } else if (chartPeriod === '3M') {
      // 6 semanas hacia atrás
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i * 14);
        let total = 0; let cost = 0;
        for (let j = 0; j < 14; j++) {
          const dd = new Date(d);
          dd.setDate(d.getDate() - j);
          const dayStr = dd.toDateString();
          const items = history.filter(h => h.type === 'sale' && new Date(h.time).toDateString() === dayStr);
          total += items.reduce((a, h) => a + h.price * h.qty, 0);
          cost += items.reduce((a, h) => a + (h.cost || 0) * h.qty, 0);
        }
        dataPoints.push(total);
        profitPoints.push(Math.max(0, total - cost));
        const mon = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
        xLabels.push(`${mon} ${d.getDate()}`);
      }
    } else {
      // 1A: 12 meses
      for (let m = 11; m >= 0; m--) {
        const d = new Date(ref);
        d.setDate(1);
        d.setMonth(ref.getMonth() - m);
        const yr = d.getFullYear();
        const mo = d.getMonth();
        const items = history.filter(h => {
          const hd = new Date(h.time);
          return h.type === 'sale' && hd.getFullYear() === yr && hd.getMonth() === mo;
        });
        const total = items.reduce((a, h) => a + h.price * h.qty, 0);
        const cost = items.reduce((a, h) => a + (h.cost || 0) * h.qty, 0);
        dataPoints.push(total);
        profitPoints.push(Math.max(0, total - cost));
        xLabels.push(d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase());
      }
    }

    // Totals (all time)
    const sales = history.filter(h => h.type === 'sale');
    const totRev = sales.reduce((a, h) => a + h.price * h.qty, 0);
    const totCost = sales.reduce((a, h) => a + (h.cost || 0) * h.qty, 0);
    return {
      chartData: dataPoints,
      profitData: profitPoints,
      labels: xLabels,
      totalSales: sales.reduce((a, h) => a + h.qty, 0),
      totalRevenue: totRev,
      totalProfit: Math.max(0, totRev - totCost),
    };
  }, [history, referenceDate, chartPeriod]);

  return (
    <div className="space-y-4 animate-fadeIn text-left">
      {/* Metric Mode Subtabs */}
      <div className="flex p-1 bg-slate-900 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setMetricTab('prendas')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            metricTab === 'prendas'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-[1.02]'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>Ventas de Prendas</span>
        </button>

        <button
          type="button"
          onClick={() => setMetricTab('yape')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            metricTab === 'yape'
              ? 'bg-linear-to-r from-pink-600 to-purple-600 text-white shadow-md shadow-pink-600/30 scale-[1.02]'
              : 'text-purple-300 hover:text-white'
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>Inteligencia Yape 📱</span>
        </button>
      </div>

      {metricTab === 'yape' ? (
        <YapesAnalyticsView />
      ) : (
        <div className="space-y-4 animate-fadeIn">
          {/* ─── Period Selector ─── */}
          <div className="bg-slate-900/80 rounded-2xl border border-white/10 overflow-hidden">
            {/* Pill selector */}
            <div className="flex gap-1 p-2">
              {(['1S', '1M', '3M', '1A'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => { setChartPeriod(period); }}
                  className={`flex-1 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                    chartPeriod === period
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  {period === '1S' ? '1 Sem' : period === '1M' ? '1 Mes' : period === '3M' ? '3 Meses' : '1 Año'}
                </button>
              ))}
            </div>

            {/* Date navigator */}
            <div className="flex items-center justify-between px-3 pb-3 gap-2">
              <button
                type="button"
                onClick={() => movePeriod('prev')}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer active:scale-90"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex-1 text-center">
                <div className="flex items-center justify-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-cyan-400" />
                  <span className="text-xs font-bold text-white">{periodLabel}</span>
                </div>
                {isTodayRef && (
                  <span className="text-[9px] font-bold text-cyan-400 uppercase tracking-widest">Período actual</span>
                )}
              </div>

              <button
                type="button"
                onClick={() => movePeriod('next')}
                disabled={isTodayRef && chartPeriod === '1S'}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            {/* Quick return to today */}
            {!isTodayRef && (
              <button
                type="button"
                onClick={goToToday}
                className="w-full py-2 text-[10px] font-bold text-cyan-400 hover:text-cyan-300 uppercase tracking-widest border-t border-white/5 transition-colors cursor-pointer"
              >
                ↩ Volver al período actual
              </button>
            )}
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Ingresos Totales</p>
              <p className="text-base sm:text-xl font-mono font-black text-cyan-300 mt-1">
                S/ {totalRevenue.toLocaleString()}
              </p>
            </GlassPanel>

            <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Ganancia Neta</p>
              <p className="text-base sm:text-xl font-mono font-black text-emerald-400 mt-1">
                S/ {totalProfit.toLocaleString()}
              </p>
            </GlassPanel>

            <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Prendas Vendidas</p>
              <p className="text-base sm:text-xl font-mono font-black text-white mt-1">{totalSales} u.</p>
            </GlassPanel>
          </div>

          {/* Main HyperGraph Card */}
          <GlassPanel className="p-4 bg-slate-900/90 border-white/10" noHover>
            <HyperGraph
              datasets={[
                { data: chartData, color: '#38bdf8', label: 'Ventas Totales', areaColor: '#38bdf8' },
                { data: profitData, color: '#34d399', label: 'Ganancia Neta', areaColor: '#34d399' }
              ]}
              labels={labels}
              dateRange={periodLabel}
              animateKey={`${chartPeriod}-${referenceDate.getTime()}`}
              title="Curva de Ventas y Rendimiento"
              showLegend={true}
              height={180}
            />
          </GlassPanel>

          {/* Recent History */}
          <div className="space-y-2">
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold px-1">
              Historial de Transacciones de Prendas
            </h3>
            <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar">
              {history.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 bg-white/3 rounded-2xl border border-white/5">
                  Sin registros de ventas aún.
                </div>
              ) : (
                history
                  .slice()
                  .reverse()
                  .slice(0, 15)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/80 border border-white/6"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-white truncate">{item.product}</p>
                        <p className="text-[10px] text-slate-400 uppercase">
                          {item.variant} • <span className="font-mono text-cyan-300">{item.qty} u.</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-mono font-bold text-emerald-400">
                          + S/ {(item.price * item.qty).toLocaleString()}
                        </span>
                        <span className="block text-[9px] text-slate-500 font-mono">
                          {new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
