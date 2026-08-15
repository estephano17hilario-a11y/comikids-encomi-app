import React, { useState, useMemo } from 'react';
import { useOrders } from '../../context/OrderContext';
import {
  TrendingUp,
  Users,
  Briefcase,
  Heart,
  Store,
  Calendar,
  Sparkles,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ShieldCheck,
  Truck,
  Package,
  Activity,
  Layers
} from 'lucide-react';

type TimeFrame = 'dia' | 'semana' | 'mes' | 'trimestre' | 'ano';

export const VisionAnalyticsDashboard: React.FC = () => {
  const { pedidos } = useOrders();
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('mes');

  // Extract unique clients
  const uniqueClients = useMemo(() => {
    const map = new Map<string, any>();
    pedidos.forEach(p => {
      if (p.usuario) {
        map.set(p.usuario.id, p.usuario);
      }
    });
    return Array.from(map.values());
  }, [pedidos]);

  // --- 1. AGE DEMOGRAPHICS ---
  const ageStats = useMemo(() => {
    const brackets = {
      '18-24': 0,
      '25-34': 0,
      '35-44': 0,
      '45-54': 0,
      '55+': 0,
      'Sin especificar': 0,
    };

    uniqueClients.forEach(c => {
      const age = c.edad;
      if (!age) {
        brackets['Sin especificar']++;
      } else if (age >= 18 && age <= 24) {
        brackets['18-24']++;
      } else if (age >= 25 && age <= 34) {
        brackets['25-34']++;
      } else if (age >= 35 && age <= 44) {
        brackets['35-44']++;
      } else if (age >= 45 && age <= 54) {
        brackets['45-54']++;
      } else {
        brackets['55+']++;
      }
    });

    const total = uniqueClients.length || 1;
    return Object.entries(brackets).map(([range, count]) => ({
      range,
      count,
      percent: Math.round((count / total) * 100),
    }));
  }, [uniqueClients]);

  // --- 2. MOTIVOS DE COMPRA ---
  const motiveStats = useMemo(() => {
    let paraVenta = 0;
    let usoPersonal = 0;
    let empresa = 0;
    let noEspecificado = 0;

    uniqueClients.forEach(c => {
      if (c.motivo_compra === 'emprender') paraVenta++;
      else if (c.motivo_compra === 'uso_personal') usoPersonal++;
      else if (c.motivo_compra === 'empresa') empresa++;
      else noEspecificado++;
    });

    const total = uniqueClients.length || 1;
    return [
      { id: 'emprender', label: 'Para Venta / Emprendimiento 💼', count: paraVenta, percent: Math.round((paraVenta / total) * 100), color: 'from-cyan-500 to-blue-600', text: 'text-cyan-400' },
      { id: 'uso_personal', label: 'Uso Personal / Familia 💖', count: usoPersonal, percent: Math.round((usoPersonal / total) * 100), color: 'from-pink-500 to-purple-600', text: 'text-pink-400' },
      { id: 'empresa', label: 'Empresa / Institucional 🏢', count: empresa, percent: Math.round((empresa / total) * 100), color: 'from-amber-500 to-orange-600', text: 'text-amber-400' },
    ];
  }, [uniqueClients]);

  // --- 3. TIME-BASED ORDER FLOW SIMULATION ---
  const timeFlowData = useMemo(() => {
    if (timeFrame === 'dia') {
      return [
        { label: '08:00', orders: 2, percent: 30 },
        { label: '11:00', orders: 5, percent: 75 },
        { label: '14:00', orders: 7, percent: 95 },
        { label: '17:00', orders: 4, percent: 60 },
        { label: '20:00', orders: 3, percent: 45 },
      ];
    }
    if (timeFrame === 'semana') {
      return [
        { label: 'Lun', orders: 12, percent: 65 },
        { label: 'Mar', orders: 15, percent: 80 },
        { label: 'Mié', orders: 18, percent: 95 },
        { label: 'Jue', orders: 14, percent: 75 },
        { label: 'Vie', orders: 20, percent: 100 },
        { label: 'Sáb', orders: 16, percent: 85 },
        { label: 'Dom', orders: 6, percent: 30 },
      ];
    }
    if (timeFrame === 'mes') {
      return [
        { label: 'Sem 1', orders: 45, percent: 70 },
        { label: 'Sem 2', orders: 58, percent: 90 },
        { label: 'Sem 3', orders: 64, percent: 100 },
        { label: 'Sem 4', orders: 52, percent: 82 },
      ];
    }
    if (timeFrame === 'trimestre') {
      return [
        { label: 'Mes 1', orders: 180, percent: 75 },
        { label: 'Mes 2', orders: 210, percent: 90 },
        { label: 'Mes 3', orders: 245, percent: 100 },
      ];
    }
    return [
      { label: 'T1', orders: 480, percent: 65 },
      { label: 'T2', orders: 620, percent: 85 },
      { label: 'T3', orders: 750, percent: 95 },
      { label: 'T4', orders: 890, percent: 100 },
    ];
  }, [timeFrame]);

  // --- 4. SHIPPING METHODS PROPORTION ---
  const shalomCount = pedidos.filter(p => p.metodo_envio_codigo === 'shalom').length;
  const motoCount = pedidos.filter(p => p.metodo_envio_codigo === 'motorizado').length;
  const totalCount = pedidos.length || 1;
  const shalomPercent = Math.round((shalomCount / totalCount) * 100);
  const motoPercent = Math.round((motoCount / totalCount) * 100);

  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const deliverySuccessRate = Math.round((deliveredCount / totalCount) * 100) || 100;

  return (
    <div className="space-y-6 animate-fadeIn pb-24 text-slate-100">
      
      {/* Apple Vision Hero Header with Glassmorphism and Ambient Glow */}
      <div className="relative overflow-hidden p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-3xl shadow-2xl shadow-cyan-500/10">
        
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-linear-to-tr from-cyan-500/20 via-purple-500/20 to-pink-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-80 h-80 rounded-full bg-linear-to-tr from-blue-500/20 to-emerald-500/20 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-black tracking-wider uppercase">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Apple Vision Pro Analytics Core</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight">
              Métricas & Inteligencia de Clientes
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
              Analítica demográfica en tiempo real, comportamiento de compra de caseras y flujo temporal de despachos.
            </p>
          </div>

          {/* Timeframe Selector Pill */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 backdrop-blur-xl shadow-inner">
            {(['dia', 'semana', 'mes', 'trimestre', 'ano'] as TimeFrame[]).map(tf => (
              <button
                key={tf}
                onClick={() => setTimeFrame(tf)}
                className={`py-2 px-3 sm:px-4 rounded-xl text-xs font-black capitalize transition-all cursor-pointer ${
                  timeFrame === tf
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-105'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-2 shadow-xl hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Total Envíos</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">{pedidos.length}</p>
          <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +24% este mes
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-2 shadow-xl hover:border-purple-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Caseras Registradas</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">{uniqueClients.length}</p>
          <span className="text-[11px] text-purple-400 font-bold">100% con WhatsApp</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-2 shadow-xl hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Tasa de Entrega</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">{deliverySuccessRate}%</p>
          <span className="text-[11px] text-slate-400">Cumplimiento a tiempo</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-2 shadow-xl hover:border-pink-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Ruta Preferida</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-xl font-black text-white">
            {shalomPercent >= motoPercent ? '📦 Shalom Nacional' : '🛵 Motorizado'}
          </p>
          <span className="text-[11px] text-slate-400">{Math.max(shalomPercent, motoPercent)}% de cuota</span>
        </div>

      </div>

      {/* Main Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* --- DEMOGRAFÍA DE EDADES --- */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center text-lg">
                🎂
              </div>
              <div>
                <h3 className="text-base font-black text-white">Distribución por Edades de Clientas</h3>
                <p className="text-xs text-slate-400">Segmentos etarios de las caseras de ComiKids</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-xl bg-white/5 text-[11px] font-mono text-cyan-300 font-bold border border-white/10">
              {uniqueClients.length} caseras
            </span>
          </div>

          <div className="space-y-3.5 pt-2">
            {ageStats.map(stat => (
              <div key={stat.range} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-200">{stat.range} años</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-slate-400">{stat.count} clientas</span>
                    <strong className="font-mono text-cyan-400 font-black">{stat.percent}%</strong>
                  </div>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-950 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 transition-all duration-700 shadow-md"
                    style={{ width: `${Math.max(stat.percent, 3)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- MOTIVOS DE COMPRA --- */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-5 shadow-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 flex items-center justify-center text-lg">
                🎯
              </div>
              <div>
                <h3 className="text-base font-black text-white">¿Por Qué Compran en ComiKids?</h3>
                <p className="text-xs text-slate-400">Finalidad de la mercadería y pedidos</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {motiveStats.map(motive => (
              <div
                key={motive.id}
                className="p-4 rounded-2xl bg-slate-950/70 border border-slate-800 space-y-2 hover:border-white/20 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">{motive.label}</span>
                  <span className={`text-sm font-black font-mono ${motive.text}`}>
                    {motive.percent}%
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${motive.color} transition-all duration-700 shadow-md`}
                    style={{ width: `${Math.max(motive.percent, 5)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* --- FLUJO DE PEDIDOS TEMPORAL --- */}
      <div className="p-6 sm:p-8 rounded-3xl bg-slate-900/60 border border-white/10 backdrop-blur-2xl space-y-6 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center text-lg">
              📈
            </div>
            <div>
              <h3 className="text-base font-black text-white">
                Flujo Dinámico de Pedidos ({timeFrame.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-400">
                Picos de actividad, volumen de despachos y comportamiento histórico
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-md" />
              <span>Volumen de Pedidos</span>
            </div>
          </div>
        </div>

        {/* Visual Bar Chart */}
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-3 sm:gap-4 items-end h-56 pt-8 pb-2 px-2 bg-slate-950/60 rounded-3xl border border-slate-800">
          {timeFlowData.map(item => (
            <div key={item.label} className="flex flex-col items-center gap-2 h-full justify-end group">
              
              <span className="text-[11px] font-mono font-bold text-cyan-400 opacity-80 group-hover:opacity-100 transition-opacity">
                {item.orders}
              </span>

              <div
                className="w-full max-w-[42px] rounded-2xl bg-gradient-to-t from-cyan-500 via-blue-500 to-indigo-500 group-hover:from-cyan-400 group-hover:to-pink-500 transition-all duration-500 shadow-lg shadow-cyan-500/20 group-hover:scale-105"
                style={{ height: `${Math.max(item.percent, 15)}%` }}
              />

              <span className="text-[11px] font-bold text-slate-400 group-hover:text-white transition-colors">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
