import React, { useState, useMemo } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Icon } from '../../components/ui/Icon';
import { HyperGraph } from './HyperGraph';
import { YapesAnalyticsView } from './YapesAnalyticsView';
import { HistoryItem, Session, Product } from '../../types';
import { ShoppingBag, Smartphone } from 'lucide-react';

interface AnalyticsDashboardProps {
  history: HistoryItem[];
  sessions: Session[];
  products: Product[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ history, sessions, products }) => {
  const [metricTab, setMetricTab] = useState<'prendas' | 'yape'>('prendas');
  const [chartPeriod, setChartPeriod] = useState<'1S' | '1M' | '3M' | '1A'>('1S');
  const [referenceDate, setReferenceDate] = useState(new Date());

  const movePeriod = (direction: 'prev' | 'next') => {
    const newDate = new Date(referenceDate);
    if (chartPeriod === '1S') newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    else if (chartPeriod === '1M') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    else if (chartPeriod === '3M') newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 3 : -3));
    else if (chartPeriod === '1A') newDate.setFullYear(newDate.getFullYear() + (direction === 'next' ? 1 : -1));
    setReferenceDate(newDate);
  };

  const { chartData, costData, profitData, labels, dateRange, totalSales, totalRevenue, totalProfit } = useMemo(() => {
    const ref = new Date(referenceDate);
    const dataPoints: number[] = [];
    const costPoints: number[] = [];
    const profitPoints: number[] = [];
    const xLabels: string[] = [];

    let startLabel = '';
    let endLabel = '';

    const formatFullDate = (d: Date) => {
      const day = d.getDate();
      const month = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
      return `${day} DE ${month}`;
    };

    if (chartPeriod === '1S') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i);
        const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });
        const dateStr = d.toDateString();

        const dayItems = history.filter((h) => h.type === 'sale' && new Date(h.time).toDateString() === dateStr);
        const dailyTotal = dayItems.reduce((acc, curr) => acc + curr.price * curr.qty, 0);
        const dailyCost = dayItems.reduce((acc, curr) => acc + (curr.cost || 0) * curr.qty, 0);

        dataPoints.push(dailyTotal);
        costPoints.push(dailyCost);
        profitPoints.push(Math.max(0, dailyTotal - dailyCost));
        xLabels.push(dayName.slice(0, 3));
      }
      const startD = new Date(ref);
      startD.setDate(ref.getDate() - 6);
      startLabel = formatFullDate(startD);
      endLabel = formatFullDate(ref);
    } else {
      // Month
      for (let i = 29; i >= 0; i -= 5) {
        const d = new Date(ref);
        d.setDate(ref.getDate() - i);
        const dayNum = d.getDate();
        const dateStr = d.toDateString();

        const dayItems = history.filter((h) => h.type === 'sale' && new Date(h.time).toDateString() === dateStr);
        const dailyTotal = dayItems.reduce((acc, curr) => acc + curr.price * curr.qty, 0);
        const dailyCost = dayItems.reduce((acc, curr) => acc + (curr.cost || 0) * curr.qty, 0);

        dataPoints.push(dailyTotal);
        costPoints.push(dailyCost);
        profitPoints.push(Math.max(0, dailyTotal - dailyCost));
        xLabels.push(`${dayNum}`);
      }
      const startD = new Date(ref);
      startD.setDate(ref.getDate() - 29);
      startLabel = formatFullDate(startD);
      endLabel = formatFullDate(ref);
    }

    const salesFiltered = history.filter((h) => h.type === 'sale');
    const totRev = salesFiltered.reduce((acc, h) => acc + h.price * h.qty, 0);
    const totCost = salesFiltered.reduce((acc, h) => acc + (h.cost || 0) * h.qty, 0);
    const totProf = Math.max(0, totRev - totCost);
    const totItems = salesFiltered.reduce((acc, h) => acc + h.qty, 0);

    return {
      chartData: dataPoints,
      costData: costPoints,
      profitData: profitPoints,
      labels: xLabels,
      dateRange: `${startLabel} - ${endLabel}`,
      totalSales: totItems,
      totalRevenue: totRev,
      totalProfit: totProf
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
          {/* Top Controls */}
          <div className="flex justify-between items-center bg-white/4 p-2 rounded-2xl border border-white/8">
            <div className="flex gap-1">
              {(['1S', '1M', '3M', '1A'] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => setChartPeriod(period)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    chartPeriod === period
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => movePeriod('prev')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <Icon name="ArrowDown" size={14} className="rotate-90" />
              </button>
              <button
                type="button"
                onClick={() => setReferenceDate(new Date())}
                className="px-2 py-1 text-[10px] uppercase font-bold text-slate-400 hover:text-white cursor-pointer"
              >
                Hoy
              </button>
              <button
                type="button"
                onClick={() => movePeriod('next')}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 transition-colors cursor-pointer"
              >
                <Icon name="ArrowUp" size={14} className="rotate-90" />
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Ingresos</p>
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
              dateRange={dateRange}
              animateKey={`${chartPeriod}-${referenceDate.getTime()}`}
              title="Curva de Ventas y Rendimiento"
              showLegend={true}
              height={180}
            />
          </GlassPanel>

          {/* Recent History / Live Sessions */}
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
