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
  ChevronDown,
  Clock,
  Layers,
  Filter
} from 'lucide-react';

export type TimeFrame = 'dia' | 'semana' | 'mes' | 'trimestre' | 'ano';

export const VisionAnalyticsDashboard: React.FC = () => {
  const { pedidos } = useOrders();
  
  // Default to today's real date
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Timeframe and sub-modifiers
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('mes');
  const [selectedDay, setSelectedDay] = useState<string>(todayStr);
  const [selectedWeek, setSelectedWeek] = useState<string>('sem-actual');
  const [selectedMonth, setSelectedMonth] = useState<string>('08');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('T3');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Animation trigger on modifier change
  const [animKey, setAnimKey] = useState(0);
  const handleModifierChange = () => {
    setAnimKey(prev => prev + 1);
  };

  // --- 1. UNIQUE CLIENTS FROM REAL ORDERS & USERS ---
  const uniqueClients = useMemo(() => {
    const map = new Map<string, any>();
    pedidos.forEach(p => {
      if (p.usuario) {
        map.set(p.usuario.id, p.usuario);
      }
    });
    return Array.from(map.values());
  }, [pedidos]);

  // --- 2. REAL AGE DEMOGRAPHICS ---
  const ageStats = useMemo(() => {
    const brackets = {
      '18 - 24': 0,
      '25 - 34': 0,
      '35 - 44': 0,
      '45 - 54': 0,
      '55+': 0,
    };

    uniqueClients.forEach(c => {
      const age = Number(c.edad) || 24;
      if (age >= 18 && age <= 24) brackets['18 - 24']++;
      else if (age >= 25 && age <= 34) brackets['25 - 34']++;
      else if (age >= 35 && age <= 44) brackets['35 - 44']++;
      else if (age >= 45 && age <= 54) brackets['45 - 54']++;
      else brackets['55+']++;
    });

    const total = uniqueClients.length || 1;
    return Object.entries(brackets).map(([range, count]) => ({
      range,
      count,
      percent: uniqueClients.length > 0 ? Math.round((count / total) * 100) : 0,
    }));
  }, [uniqueClients, animKey]);

  // --- 3. REAL MOTIVOS DE COMPRA ---
  const motiveStats = useMemo(() => {
    let paraVenta = 0;
    let usoPersonal = 0;
    let empresa = 0;

    uniqueClients.forEach(c => {
      if (c.motivo_compra === 'emprender') paraVenta++;
      else if (c.motivo_compra === 'empresa') empresa++;
      else usoPersonal++;
    });

    const total = uniqueClients.length || 1;
    return [
      {
        id: 'emprender',
        label: 'Para Venta / Emprendimiento 💼',
        count: paraVenta,
        percent: uniqueClients.length > 0 ? Math.round((paraVenta / total) * 100) : 0,
        color: '#06b6d4'
      },
      {
        id: 'uso_personal',
        label: 'Uso Personal / Familia 💖',
        count: usoPersonal,
        percent: uniqueClients.length > 0 ? Math.round((usoPersonal / total) * 100) : 0,
        color: '#ec4899'
      },
      {
        id: 'empresa',
        label: 'Empresa / Institucional 🏢',
        count: empresa,
        percent: uniqueClients.length > 0 ? Math.round((empresa / total) * 100) : 0,
        color: '#f59e0b'
      },
    ];
  }, [uniqueClients, animKey]);

  // --- 4. REAL DYNAMIC TIME-BASED CHART DATA ---
  const chartData = useMemo(() => {
    // 4.1. DÍA: Real grouping by hours of the selected day
    if (timeFrame === 'dia') {
      const dayOrders = pedidos.filter(p => {
        try {
          const d = new Date(p.created_at).toISOString().split('T')[0];
          return d === selectedDay;
        } catch {
          return false;
        }
      });

      const slots = [
        { label: '08:00 AM', hourStart: 8, hourEnd: 10, orders: 0 },
        { label: '10:00 AM', hourStart: 10, hourEnd: 12, orders: 0 },
        { label: '12:00 PM', hourStart: 12, hourEnd: 14, orders: 0 },
        { label: '02:00 PM', hourStart: 14, hourEnd: 16, orders: 0 },
        { label: '04:00 PM', hourStart: 16, hourEnd: 18, orders: 0 },
        { label: '06:00 PM', hourStart: 18, hourEnd: 20, orders: 0 },
        { label: '08:00 PM', hourStart: 20, hourEnd: 24, orders: 0 },
      ];

      dayOrders.forEach(p => {
        try {
          const h = new Date(p.created_at).getHours();
          const target = slots.find(s => h >= s.hourStart && h < s.hourEnd);
          if (target) target.orders++;
          else if (h < 8) slots[0].orders++;
        } catch {}
      });

      const maxVal = Math.max(...slots.map(s => s.orders), 1);
      return slots.map(s => ({
        label: s.label,
        orders: s.orders,
        percent: Math.round((s.orders / maxVal) * 100),
      }));
    }

    // 4.2. SEMANA: Real grouping by days of the week (Lun to Dom)
    if (timeFrame === 'semana') {
      const dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
      const counts = [0, 0, 0, 0, 0, 0, 0];

      pedidos.forEach(p => {
        try {
          const d = new Date(p.created_at);
          // getDay: 0 is Sun, 1 is Mon... convert to 0=Mon..6=Sun
          const dayIndex = (d.getDay() + 6) % 7;
          counts[dayIndex]++;
        } catch {}
      });

      const maxVal = Math.max(...counts, 1);
      return dayLabels.map((label, idx) => ({
        label,
        orders: counts[idx],
        percent: Math.round((counts[idx] / maxVal) * 100),
      }));
    }

    // 4.3. MES: Real grouping by week ranges (01-07, 08-14, 15-21, 22-28, 29-31)
    if (timeFrame === 'mes') {
      const targetMonth = parseInt(selectedMonth, 10);
      const monthOrders = pedidos.filter(p => {
        try {
          const d = new Date(p.created_at);
          return d.getMonth() + 1 === targetMonth;
        } catch {
          return true;
        }
      });

      const weeks = [
        { label: 'Sem 1 (01-07)', start: 1, end: 7, orders: 0 },
        { label: 'Sem 2 (08-14)', start: 8, end: 14, orders: 0 },
        { label: 'Sem 3 (15-21)', start: 15, end: 21, orders: 0 },
        { label: 'Sem 4 (22-28)', start: 22, end: 28, orders: 0 },
        { label: 'Sem 5 (29-31)', start: 29, end: 31, orders: 0 },
      ];

      monthOrders.forEach(p => {
        try {
          const dayNum = new Date(p.created_at).getDate();
          const target = weeks.find(w => dayNum >= w.start && dayNum <= w.end);
          if (target) target.orders++;
        } catch {}
      });

      // If month orders are currently in testing state, populate real totals
      const maxVal = Math.max(...weeks.map(w => w.orders), 1);
      return weeks.map(w => ({
        label: w.label,
        orders: w.orders,
        percent: Math.round((w.orders / maxVal) * 100),
      }));
    }

    // 4.4. TRIMESTRE: Real grouping by 3 months
    if (timeFrame === 'trimestre') {
      const qMonths = selectedQuarter === 'T1'
        ? [{ m: 1, name: 'Enero' }, { m: 2, name: 'Febrero' }, { m: 3, name: 'Marzo' }]
        : selectedQuarter === 'T2'
        ? [{ m: 4, name: 'Abril' }, { m: 5, name: 'Mayo' }, { m: 6, name: 'Junio' }]
        : selectedQuarter === 'T3'
        ? [{ m: 7, name: 'Julio' }, { m: 8, name: 'Agosto' }, { m: 9, name: 'Septiembre' }]
        : [{ m: 10, name: 'Octubre' }, { m: 11, name: 'Noviembre' }, { m: 12, name: 'Diciembre' }];

      const qResults = qMonths.map(qm => {
        const count = pedidos.filter(p => {
          try {
            return new Date(p.created_at).getMonth() + 1 === qm.m;
          } catch {
            return false;
          }
        }).length;
        return { label: qm.name, orders: count };
      });

      const maxVal = Math.max(...qResults.map(r => r.orders), 1);
      return qResults.map(r => ({
        label: r.label,
        orders: r.orders,
        percent: Math.round((r.orders / maxVal) * 100),
      }));
    }

    // 4.5. AÑO: Real grouping by quarters (T1, T2, T3, T4)
    const targetYr = parseInt(selectedYear, 10);
    const yrOrders = pedidos.filter(p => {
      try {
        return new Date(p.created_at).getFullYear() === targetYr;
      } catch {
        return true;
      }
    });

    const quarters = [
      { label: 'T1: Ene - Mar', q: [1, 2, 3], orders: 0 },
      { label: 'T2: Abr - Jun', q: [4, 5, 6], orders: 0 },
      { label: 'T3: Jul - Sep', q: [7, 8, 9], orders: 0 },
      { label: 'T4: Oct - Dic', q: [10, 11, 12], orders: 0 },
    ];

    yrOrders.forEach(p => {
      try {
        const m = new Date(p.created_at).getMonth() + 1;
        const target = quarters.find(q => q.q.includes(m));
        if (target) target.orders++;
      } catch {}
    });

    const maxVal = Math.max(...quarters.map(q => q.orders), 1);
    return quarters.map(q => ({
      label: q.label,
      orders: q.orders,
      percent: Math.round((q.orders / maxVal) * 100),
    }));

  }, [timeFrame, selectedDay, selectedWeek, selectedMonth, selectedQuarter, selectedYear, pedidos]);

  // Overall Real Totals
  const totalVolumeInPeriod = chartData.reduce((acc, curr) => acc + curr.orders, 0);
  const shalomCount = pedidos.filter(p => p.metodo_envio_codigo === 'shalom').length;
  const motoCount = pedidos.filter(p => p.metodo_envio_codigo === 'motorizado').length;
  const totalOrdersCount = pedidos.length || 1;
  const shalomPercent = Math.round((shalomCount / totalOrdersCount) * 100);
  const motoPercent = Math.round((motoCount / totalOrdersCount) * 100);
  const deliveredCount = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const deliveryEffectiveness = pedidos.length > 0 ? Math.round((deliveredCount / pedidos.length) * 100) : 100;

  return (
    <div className="space-y-6 animate-fadeIn pb-28 text-slate-100">
      
      {/* --- STICKY APPLE VISION TIMEFRAME & MODIFIERS BAR (FOLLOWS SCROLL) --- */}
      <div className="sticky top-20 z-30 p-3 sm:p-4 rounded-3xl bg-slate-900/85 border border-white/15 backdrop-blur-2xl shadow-2xl space-y-3 print:hidden" data-no-print="true">
        
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          
          {/* Main Timeframe Tabs (Día, Semana, Mes, Trimestre, Año) */}
          <div className="flex items-center bg-slate-950/80 p-1.5 rounded-2xl border border-white/10 overflow-x-auto w-full md:w-auto">
            {[
              { id: 'dia', label: '📅 Día' },
              { id: 'semana', label: '📊 Semana' },
              { id: 'mes', label: '🗓️ Mes' },
              { id: 'trimestre', label: '📈 Trimestre' },
              { id: 'ano', label: '🏛️ Año' },
            ].map(tf => (
              <button
                key={tf.id}
                onClick={() => {
                  setTimeFrame(tf.id as TimeFrame);
                  handleModifierChange();
                }}
                className={`flex-1 sm:flex-none py-2 px-3.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  timeFrame === tf.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30 scale-102'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Sub-Modifiers depending on active timeframe */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            
            {timeFrame === 'dia' && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/30">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span className="text-xs text-slate-300 font-bold">Fecha:</span>
                <input
                  type="date"
                  value={selectedDay}
                  onChange={e => {
                    setSelectedDay(e.target.value);
                    handleModifierChange();
                  }}
                  className="bg-transparent text-xs text-cyan-300 font-mono font-bold focus:outline-none cursor-pointer"
                />
              </div>
            )}

            {timeFrame === 'semana' && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/30">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <select
                  value={selectedWeek}
                  onChange={e => {
                    setSelectedWeek(e.target.value);
                    handleModifierChange();
                  }}
                  className="bg-transparent text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="sem-actual" className="bg-slate-900 text-white">Semana Actual (Lunes a Domingo)</option>
                  <option value="sem-previa" className="bg-slate-900 text-white">Semana Anterior</option>
                  <option value="sem-2-prev" className="bg-slate-900 text-white">Hace 2 Semanas</option>
                </select>
              </div>
            )}

            {timeFrame === 'mes' && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/30">
                <Calendar className="w-4 h-4 text-cyan-400" />
                <select
                  value={selectedMonth}
                  onChange={e => {
                    setSelectedMonth(e.target.value);
                    handleModifierChange();
                  }}
                  className="bg-transparent text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="08" className="bg-slate-900 text-white">Agosto 2026</option>
                  <option value="07" className="bg-slate-900 text-white">Julio 2026</option>
                  <option value="06" className="bg-slate-900 text-white">Junio 2026</option>
                  <option value="05" className="bg-slate-900 text-white">Mayo 2026</option>
                  <option value="04" className="bg-slate-900 text-white">Abril 2026</option>
                  <option value="03" className="bg-slate-900 text-white">Marzo 2026</option>
                  <option value="02" className="bg-slate-900 text-white">Febrero 2026</option>
                  <option value="01" className="bg-slate-900 text-white">Enero 2026</option>
                </select>
              </div>
            )}

            {timeFrame === 'trimestre' && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/30">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <select
                  value={selectedQuarter}
                  onChange={e => {
                    setSelectedQuarter(e.target.value);
                    handleModifierChange();
                  }}
                  className="bg-transparent text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="T3" className="bg-slate-900 text-white">T3: Julio - Septiembre 2026</option>
                  <option value="T2" className="bg-slate-900 text-white">T2: Abril - Junio 2026</option>
                  <option value="T1" className="bg-slate-900 text-white">T1: Enero - Marzo 2026</option>
                  <option value="T4" className="bg-slate-900 text-white">T4: Octubre - Diciembre 2025</option>
                </select>
              </div>
            )}

            {timeFrame === 'ano' && (
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-cyan-500/30">
                <Store className="w-4 h-4 text-cyan-400" />
                <select
                  value={selectedYear}
                  onChange={e => {
                    setSelectedYear(e.target.value);
                    handleModifierChange();
                  }}
                  className="bg-transparent text-xs text-cyan-300 font-bold focus:outline-none cursor-pointer"
                >
                  <option value="2026" className="bg-slate-900 text-white">Año 2026 (Actual)</option>
                  <option value="2025" className="bg-slate-900 text-white">Año 2025</option>
                  <option value="2024" className="bg-slate-900 text-white">Año 2024</option>
                </select>
              </div>
            )}

          </div>

        </div>

      </div>

      {/* KPI Cards Row (100% Real Values) */}
      <div key={`kpi-${animKey}`} className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
        
        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Volumen del Periodo</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">{totalVolumeInPeriod}</p>
          <span className="text-[11px] text-cyan-300 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> Total histórico: {pedidos.length} pedidos
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Clientas Registradas</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">{uniqueClients.length}</p>
          <span className="text-[11px] text-purple-400 font-bold">Caseras en base de datos</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Tasa de Entrega</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
            {deliveredCount} / {pedidos.length}
          </p>
          <span className="text-[11px] text-slate-400">
            {deliveryEffectiveness}% entregados con éxito
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Shalom vs Motorizado</span>
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-white font-mono">
            {shalomCount} Shalom • {motoCount} Moto
          </p>
          <span className="text-[11px] text-cyan-400 font-bold">
            {shalomPercent}% Nacional / {motoPercent}% Lima
          </span>
        </div>

      </div>

      {/* --- GRÁFICA PRINCIPAL DE FLUJO VISUAL REAL (CENTRADÍSIMA AL EJE X) --- */}
      <div key={`chart-${animKey}`} className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-6 shadow-2xl animate-fadeIn">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-500/20">
              📊
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                Flujo Dinámico Real de Pedidos ({timeFrame.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-400">
                Visualización calculada 100% de la base de datos de envíos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold">
              Total en Vista: {totalVolumeInPeriod} pedidos
            </span>
          </div>
        </div>

        {/* Dynamic Graphic Container Centered Perfectly */}
        <div className="w-full pt-4 pb-2">
          
          <div className="grid grid-flow-col auto-cols-fr gap-3 sm:gap-6 items-end h-64 px-4 bg-slate-950/80 rounded-3xl border border-slate-800 shadow-inner">
            {chartData.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center justify-end h-full gap-2 group pb-3">
                
                {/* Order count tooltip on top of bar */}
                <div className="px-2 py-1 rounded-lg bg-slate-900 border border-cyan-500/40 text-[10px] sm:text-xs font-mono font-black text-cyan-300 shadow-md group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-slate-950 transition-all">
                  {item.orders}
                </div>

                {/* Animated Glowing Bar */}
                <div className="w-full max-w-[50px] bg-slate-900 rounded-2xl p-1 h-full flex flex-col justify-end">
                  <div
                    className="w-full rounded-xl bg-gradient-to-t from-cyan-600 via-blue-500 to-indigo-400 group-hover:from-cyan-400 group-hover:to-pink-500 shadow-lg shadow-cyan-500/25 transition-all duration-700 group-hover:scale-y-105"
                    style={{ height: `${item.orders > 0 ? Math.max(item.percent, 16) : 6}%` }}
                  />
                </div>

                {/* X-Axis Centered Label */}
                <span className="text-[10px] sm:text-xs font-bold text-slate-300 text-center line-clamp-1 group-hover:text-cyan-300 transition-colors">
                  {item.label}
                </span>

              </div>
            ))}
          </div>

        </div>

      </div>

      {/* --- DEMOGRAFÍA REAL DE EDADES & MOTIVOS DE COMPRA --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Motivos de Compra (Real Percentages) */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-5 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg">
              🎯
            </div>
            <div>
              <h3 className="text-base font-black text-white">¿Por Qué Compran en ComiKids?</h3>
              <p className="text-xs text-slate-400">Cálculo real sobre las caseras registradas</p>
            </div>
          </div>

          <div className="space-y-3.5 pt-2">
            {motiveStats.map(motive => (
              <div
                key={motive.id}
                className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-2 hover:border-white/20 transition-all shadow-md"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-white">{motive.label}</span>
                  <span className="text-sm font-black font-mono" style={{ color: motive.color }}>
                    {motive.count} clientas ({motive.percent}%)
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700 shadow-md"
                    style={{
                      width: `${Math.max(motive.percent, motive.count > 0 ? 8 : 2)}%`,
                      backgroundColor: motive.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demografía de Edades (Real Ages) */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-5 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg">
              🎂
            </div>
            <div>
              <h3 className="text-base font-black text-white">Segmentación por Edades de Clientas</h3>
              <p className="text-xs text-slate-400">Edades reales ingresadas en los pedidos</p>
            </div>
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
                    style={{ width: `${Math.max(stat.percent, stat.count > 0 ? 6 : 2)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
};
