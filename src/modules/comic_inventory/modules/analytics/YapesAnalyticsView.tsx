import React, { useState, useEffect, useMemo } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Icon } from '../../components/ui/Icon';
import { HyperGraph } from './HyperGraph';
import { yapeReaderService, YapeTransaction } from '../../../../services/yapeReaderService';
import { Smartphone, TrendingUp, Calendar, User, CheckCircle2, ShieldCheck, DollarSign, Filter } from 'lucide-react';

interface ClientSpending {
  name: string;
  total: number;
  weekly: number;
  monthly: number;
  count: number;
  lastPayment: number;
}

export const YapesAnalyticsView: React.FC = () => {
  const [yapes, setYapes] = useState<YapeTransaction[]>(() => yapeReaderService.getLocalYapes());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'live' | 'normal'>('all');

  useEffect(() => {
    // Sincronizar con nativo y eventos
    yapeReaderService.syncNativeYapes().then(setYapes);
    const unbind = yapeReaderService.listenNativeEvents(() => {
      setYapes(yapeReaderService.getLocalYapes());
    });

    const handleUpdate = (e: any) => {
      setYapes(e.detail || yapeReaderService.getLocalYapes());
    };
    window.addEventListener('yapes_updated', handleUpdate);

    return () => {
      unbind();
      window.removeEventListener('yapes_updated', handleUpdate);
    };
  }, []);

  const now = Date.now();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const ONE_MONTH_MS = 30 * 24 * 60 * 60 * 1000;

  // Cálculos por cliente (Gasto Semanal, Mensual, Total)
  const clientSpendingList: ClientSpending[] = useMemo(() => {
    const map = new Map<string, { total: number; weekly: number; monthly: number; count: number; lastPayment: number }>();

    yapes.forEach((y) => {
      const name = (y.sender || 'Cliente Yape').trim();
      const existing = map.get(name) || { total: 0, weekly: 0, monthly: 0, count: 0, lastPayment: 0 };
      const amt = Number(y.amount) || 0;
      const isWeek = now - y.timestamp <= ONE_WEEK_MS;
      const isMonth = now - y.timestamp <= ONE_MONTH_MS;

      existing.total += amt;
      if (isWeek) existing.weekly += amt;
      if (isMonth) existing.monthly += amt;
      existing.count += 1;
      if (y.timestamp > existing.lastPayment) existing.lastPayment = y.timestamp;

      map.set(name, existing);
    });

    return Array.from(map.entries())
      .map(([name, data]) => ({
        name,
        ...data
      }))
      .sort((a, b) => b.total - a.total);
  }, [yapes, now]);

  // Totales generales
  const totalYapesAmount = useMemo(() => yapes.reduce((acc, y) => acc + (Number(y.amount) || 0), 0), [yapes]);
  const liveYapesAmount = useMemo(
    () => yapes.filter((y) => y.isLive).reduce((acc, y) => acc + (Number(y.amount) || 0), 0),
    [yapes]
  );
  const normalYapesAmount = totalYapesAmount - liveYapesAmount;

  // Gráfica de últimos 7 días de Yapeos
  const { chartData, labels, dateRange } = useMemo(() => {
    const daysData: number[] = [];
    const dayLabels: string[] = [];
    const ref = new Date();

    for (let i = 6; i >= 0; i--) {
      const d = new Date(ref);
      d.setDate(ref.getDate() - i);
      const dateStr = d.toDateString();
      const dayName = d.toLocaleDateString('es-ES', { weekday: 'short' });

      const dayTotal = yapes
        .filter((y) => new Date(y.timestamp).toDateString() === dateStr)
        .reduce((acc, y) => acc + (Number(y.amount) || 0), 0);

      daysData.push(dayTotal);
      dayLabels.push(dayName.slice(0, 3));
    }

    const startD = new Date(ref);
    startD.setDate(ref.getDate() - 6);
    const startStr = `${startD.getDate()} ${startD.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}`;
    const endStr = `${ref.getDate()} ${ref.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase()}`;

    return {
      chartData: daysData,
      labels: dayLabels,
      dateRange: `${startStr} - ${endStr}`
    };
  }, [yapes]);

  const filteredTransactions = useMemo(() => {
    return yapes.filter((y) => {
      if (filterType === 'live' && !y.isLive) return false;
      if (filterType === 'normal' && y.isLive) return false;
      if (searchTerm.trim() && !y.sender.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      return true;
    });
  }, [yapes, filterType, searchTerm]);

  return (
    <div className="space-y-4 animate-fadeIn text-left">
      {/* Top Header Card */}
      <GlassPanel className="p-4 bg-linear-to-r from-purple-950/80 via-slate-900 to-slate-900 border-purple-500/30" noHover>
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-purple-300 tracking-wider">
                Monitor Inteligente de Pagos Yape
              </p>
              <h2 className="text-lg font-black text-white">Ingresos & Fidelización de Clientes</h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-black flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              Captura 24/7 en Segundo Plano
            </span>
          </div>
        </div>
      </GlassPanel>

      {/* KPI Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Total Yapeado</p>
          <p className="text-base sm:text-xl font-mono font-black text-purple-300 mt-1">
            S/ {totalYapesAmount.toLocaleString()}
          </p>
          <span className="text-[9px] text-slate-500 font-mono">{yapes.length} transferencias</span>
        </GlassPanel>

        <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
          <p className="text-[10px] uppercase tracking-wider text-rose-400 font-bold">Yapes en Live 🔴</p>
          <p className="text-base sm:text-xl font-mono font-black text-rose-300 mt-1">
            S/ {liveYapesAmount.toLocaleString()}
          </p>
          <span className="text-[9px] text-rose-400/80 font-mono">Con voz automática</span>
        </GlassPanel>

        <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
          <p className="text-[10px] uppercase tracking-wider text-cyan-400 font-bold">Yapes Estándar 📦</p>
          <p className="text-base sm:text-xl font-mono font-black text-cyan-300 mt-1">
            S/ {normalYapesAmount.toLocaleString()}
          </p>
          <span className="text-[9px] text-cyan-400/80 font-mono">Captura silenciosa</span>
        </GlassPanel>
      </div>

      {/* Graph Card */}
      <GlassPanel className="p-4 bg-slate-900/90 border-white/10" noHover>
        <HyperGraph
          datasets={[
            { data: chartData, color: '#a855f7', label: 'Flujo de Yapes (S/)', areaColor: '#a855f7' }
          ]}
          labels={labels}
          dateRange={dateRange}
          animateKey={`yapes-chart-${now}`}
          title="Curva de Recaudación por Yape (Últimos 7 Días)"
          showLegend={false}
          height={160}
          unit="S/"
        />
      </GlassPanel>

      {/* Client Spending Leaderboard (Weekly, Monthly, Total) */}
      <div className="space-y-2">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs uppercase tracking-wider text-slate-300 font-bold flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-purple-400" />
            <span>Aporte y Gasto por Cliente ({clientSpendingList.length})</span>
          </h3>
          <span className="text-[10px] text-slate-500 font-mono">Semanal • Mensual • Histórico</span>
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
          {clientSpendingList.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500 bg-white/3 rounded-2xl border border-white/5">
              Sin transferencias de Yape registradas aún.
            </div>
          ) : (
            clientSpendingList.map((client, idx) => (
              <GlassPanel key={client.name + idx} className="p-3 bg-slate-900/85 border-white/8" noHover>
                <div className="flex justify-between items-center gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-xl bg-purple-600/20 text-purple-300 font-bold text-xs flex items-center justify-center shrink-0 border border-purple-500/30">
                      #{idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-black text-white truncate">{client.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {client.count} pago{client.count > 1 ? 's' : ''} • Último:{' '}
                        <span className="text-slate-300 font-mono">
                          {new Date(client.lastPayment).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 text-right">
                    <div>
                      <span className="text-[9px] uppercase text-slate-400 block font-bold">Semanal</span>
                      <span className="text-xs font-mono font-bold text-cyan-300">
                        S/ {client.weekly.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-[9px] uppercase text-slate-400 block font-bold">Mensual</span>
                      <span className="text-xs font-mono font-bold text-emerald-400">
                        S/ {client.monthly.toLocaleString()}
                      </span>
                    </div>

                    <div className="bg-purple-950/80 px-2.5 py-1 rounded-xl border border-purple-500/30">
                      <span className="text-[9px] uppercase text-purple-300 block font-black">Total</span>
                      <span className="text-xs font-mono font-black text-purple-200">
                        S/ {client.total.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              </GlassPanel>
            ))
          )}
        </div>
      </div>

      {/* Transactions Feed & Filter Bar */}
      <div className="space-y-2 pt-2 border-t border-white/10">
        <div className="flex flex-wrap justify-between items-center gap-2">
          <h3 className="text-xs uppercase tracking-wider text-slate-300 font-bold">
            Registro Detallado de Notificaciones ({filteredTransactions.length})
          </h3>

          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                filterType === 'all' ? 'bg-purple-600 text-white shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilterType('live')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                filterType === 'live' ? 'bg-rose-600 text-white shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              🔴 En Live
            </button>
            <button
              type="button"
              onClick={() => setFilterType('normal')}
              className={`px-2.5 py-1 rounded-xl text-[10px] font-bold cursor-pointer transition-all ${
                filterType === 'normal' ? 'bg-cyan-600 text-white shadow-md' : 'bg-white/5 text-slate-400 hover:text-white'
              }`}
            >
              📦 Estándar
            </button>
          </div>
        </div>

        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="🔍 Buscar por nombre del remitente de Yape..."
          className="w-full p-2.5 bg-slate-900/90 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-bold"
        />

        <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 bg-white/3 rounded-xl border border-white/5">
              No hay transferencias con este criterio.
            </div>
          ) : (
            filteredTransactions.map((y) => (
              <div
                key={y.id}
                className="flex justify-between items-center p-2.5 rounded-xl bg-slate-900/90 border border-white/6 hover:bg-slate-800/80 transition-colors"
              >
                <div className="min-w-0 pr-2">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-white truncate">{y.sender}</p>
                    {y.isLive ? (
                      <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-black border border-rose-500/30">
                        LIVE
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-bold border border-cyan-500/30">
                        24/7
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {new Date(y.timestamp).toLocaleDateString([], { day: '2-digit', month: 'short' })} •{' '}
                    {new Date(y.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-sm font-mono font-black text-emerald-400 block">
                    + S/ {(Number(y.amount) || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
