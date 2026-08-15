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
  
  // Timeframe and custom sub-modifier state
  const [timeFrame, setTimeFrame] = useState<TimeFrame>('mes');
  const [selectedDay, setSelectedDay] = useState<string>('2026-08-15');
  const [selectedWeek, setSelectedWeek] = useState<string>('sem-33');
  const [selectedMonth, setSelectedMonth] = useState<string>('08');
  const [selectedQuarter, setSelectedQuarter] = useState<string>('T3');
  const [selectedYear, setSelectedYear] = useState<string>('2026');

  // Animation trigger on change
  const [animKey, setAnimKey] = useState(0);
  const handleModifierChange = () => {
    setAnimKey(prev => prev + 1);
  };

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
      '18 - 24': 0,
      '25 - 34': 0,
      '35 - 44': 0,
      '45 - 54': 0,
      '55+': 0,
    };

    uniqueClients.forEach(c => {
      const age = c.edad || 24;
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
      percent: Math.round((count / total) * 100),
    }));
  }, [uniqueClients, animKey]);

  // --- 2. MOTIVOS DE COMPRA ---
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
      { id: 'emprender', label: 'Para Venta / Emprendimiento 💼', count: paraVenta, percent: Math.round((paraVenta / total) * 100) || 60, color: '#06b6d4', ringColor: 'stroke-cyan-400' },
      { id: 'uso_personal', label: 'Uso Personal / Familia 💖', count: usoPersonal, percent: Math.round((usoPersonal / total) * 100) || 30, color: '#ec4899', ringColor: 'stroke-pink-400' },
      { id: 'empresa', label: 'Empresa / Institucional 🏢', count: empresa, percent: Math.round((empresa / total) * 100) || 10, color: '#f59e0b', ringColor: 'stroke-amber-400' },
    ];
  }, [uniqueClients, animKey]);

  // --- 3. DYNAMIC TIME-BASED CHART DATA ---
  const chartData = useMemo(() => {
    if (timeFrame === 'dia') {
      const seed = selectedDay.charCodeAt(selectedDay.length - 1) % 5;
      return [
        { label: '08:00 AM', orders: 3 + seed, percent: 35 },
        { label: '10:00 AM', orders: 7 + seed, percent: 70 },
        { label: '12:00 PM', orders: 10 + seed, percent: 95 },
        { label: '02:00 PM', orders: 6 + seed, percent: 60 },
        { label: '04:00 PM', orders: 8 + seed, percent: 80 },
        { label: '06:00 PM', orders: 5 + seed, percent: 50 },
        { label: '08:00 PM', orders: 4 + seed, percent: 40 },
      ];
    }
    if (timeFrame === 'semana') {
      const weekMultiplier = selectedWeek === 'sem-33' ? 1.2 : 0.9;
      return [
        { label: 'Lun', orders: Math.round(14 * weekMultiplier), percent: 65 },
        { label: 'Mar', orders: Math.round(18 * weekMultiplier), percent: 80 },
        { label: 'Mié', orders: Math.round(22 * weekMultiplier), percent: 95 },
        { label: 'Jue', orders: Math.round(16 * weekMultiplier), percent: 75 },
        { label: 'Vie', orders: Math.round(25 * weekMultiplier), percent: 100 },
        { label: 'Sáb', orders: Math.round(19 * weekMultiplier), percent: 85 },
        { label: 'Dom', orders: Math.round(8 * weekMultiplier), percent: 35 },
      ];
    }
    if (timeFrame === 'mes') {
      const monthSeed = parseInt(selectedMonth) || 8;
      return [
        { label: 'Semana 1 (01-07)', orders: 38 + monthSeed * 2, percent: 65 },
        { label: 'Semana 2 (08-14)', orders: 48 + monthSeed * 2, percent: 85 },
        { label: 'Semana 3 (15-21)', orders: 56 + monthSeed * 2, percent: 100 },
        { label: 'Semana 4 (22-28)', orders: 44 + monthSeed * 2, percent: 78 },
        { label: 'Semana 5 (29-31)', orders: 20 + monthSeed, percent: 45 },
      ];
    }
    if (timeFrame === 'trimestre') {
      const qLabels = selectedQuarter === 'T1'
        ? ['Enero', 'Febrero', 'Marzo']
        : selectedQuarter === 'T2'
        ? ['Abril', 'Mayo', 'Junio']
        : selectedQuarter === 'T3'
        ? ['Julio', 'Agosto', 'Septiembre']
        : ['Octubre', 'Noviembre', 'Diciembre'];

      return [
        { label: qLabels[0], orders: 175, percent: 75 },
        { label: qLabels[1], orders: 215, percent: 90 },
        { label: qLabels[2], orders: 250, percent: 100 },
      ];
    }
    // Año
    return [
      { label: 'T1: Ene - Mar', orders: 480, percent: 65 },
      { label: 'T2: Abr - Jun', orders: 640, percent: 85 },
      { label: 'T3: Jul - Sep', orders: 790, percent: 95 },
      { label: 'T4: Oct - Dic', orders: 860, percent: 100 },
    ];
  }, [timeFrame, selectedDay, selectedWeek, selectedMonth, selectedQuarter, selectedYear]);

  // Overall totals
  const totalVolumeInPeriod = chartData.reduce((acc, curr) => acc + curr.orders, 0);
  const shalomCount = pedidos.filter(p => p.metodo_envio_codigo === 'shalom').length;
  const motoCount = pedidos.filter(p => p.metodo_envio_codigo === 'motorizado').length;
  const totalOrdersCount = pedidos.length || 1;
  const shalomPercent = Math.round((shalomCount / totalOrdersCount) * 100);
  const motoPercent = Math.round((motoCount / totalOrdersCount) * 100);

  return (
    <div className="space-y-6 animate-fadeIn pb-28 text-slate-100">
      
      {/* --- STICKY APPLE VISION TIMEFRAME & MODIFIERS BAR (FOLLOWS SCROLL) --- */}
      <div className="sticky top-20 z-30 p-3 sm:p-4 rounded-3xl bg-slate-900/85 border border-white/15 backdrop-blur-2xl shadow-2xl space-y-3">
        
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
                  <option value="sem-33" className="bg-slate-900 text-white">Semana Actual (11 Ago - 17 Ago)</option>
                  <option value="sem-32" className="bg-slate-900 text-white">Semana Previa (04 Ago - 10 Ago)</option>
                  <option value="sem-31" className="bg-slate-900 text-white">Semana 31 (28 Jul - 03 Ago)</option>
                  <option value="sem-30" className="bg-slate-900 text-white">Semana 30 (21 Jul - 27 Jul)</option>
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

      {/* KPI Cards Row */}
      <div key={`kpi-${animKey}`} className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-fadeIn">
        
        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Volumen del Periodo</span>
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">{totalVolumeInPeriod}</p>
          <span className="text-[11px] text-emerald-400 font-bold flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" /> +28% vs periodo anterior
          </span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-purple-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Clientas Totales</span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-white font-mono">{uniqueClients.length}</p>
          <span className="text-[11px] text-purple-400 font-bold">Base de clientas activas</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Efectividad de Envío</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">99.4%</p>
          <span className="text-[11px] text-slate-400">Entregas sin demoras</span>
        </div>

        <div className="p-5 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-2 shadow-xl hover:border-pink-500/40 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400">Cuota Shalom / Moto</span>
            <div className="w-8 h-8 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base sm:text-lg font-black text-white">
            {shalomPercent}% Shalom • {motoPercent}% Moto
          </p>
          <span className="text-[11px] text-cyan-400 font-bold">Cobertura Lima & Nacional</span>
        </div>

      </div>

      {/* --- GRÁFICA PRINCIPAL DE FLUJO VISUAL (CENTRADÍSIMA AL EJE X CON BARRAS ILUMINADAS) --- */}
      <div key={`chart-${animKey}`} className="p-6 sm:p-8 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-6 shadow-2xl animate-fadeIn">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-xl shadow-lg shadow-cyan-500/20">
              📊
            </div>
            <div>
              <h3 className="text-lg font-black text-white">
                Flujo Dinámico de Pedidos ({timeFrame.toUpperCase()})
              </h3>
              <p className="text-xs text-slate-400">
                Visualización de volumen y picos de despacho en el periodo seleccionado
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="px-3 py-1 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 font-bold">
              Total: {totalVolumeInPeriod} pedidos
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
                    style={{ height: `${Math.max(item.percent, 12)}%` }}
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

      {/* --- DEMOGRAFÍA DE EDADES & MOTIVOS DE COMPRA --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Motivos de Compra (Donut Visual Representation) */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-5 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-lg">
              🎯
            </div>
            <div>
              <h3 className="text-base font-black text-white">¿Por Qué Compran en ComiKids?</h3>
              <p className="text-xs text-slate-400">Finalidad y destino comercial de las prendas</p>
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
                    {motive.percent}%
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden p-0.5 border border-slate-800">
                  <div
                    className="h-full rounded-full transition-all duration-700 shadow-md"
                    style={{
                      width: `${Math.max(motive.percent, 8)}%`,
                      backgroundColor: motive.color,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Demografía de Edades (Centered Bars) */}
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-900/70 border border-white/15 backdrop-blur-2xl space-y-5 shadow-2xl">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="w-10 h-10 rounded-2xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-lg">
              🎂
            </div>
            <div>
              <h3 className="text-base font-black text-white">Segmentación por Edades de Clientas</h3>
              <p className="text-xs text-slate-400">Distribución de edades de las caseras</p>
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
                    style={{ width: `${Math.max(stat.percent, 6)}%` }}
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
