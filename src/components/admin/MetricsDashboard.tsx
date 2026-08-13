import React from 'react';
import { useOrders } from '../../context/OrderContext';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import {
  TrendingUp,
  Package,
  Truck,
  Users,
  Scissors
} from 'lucide-react';

export const MetricsDashboard: React.FC = () => {
  const { pedidos, shippingMethods } = useOrders();

  const totalPedidos = pedidos.length;
  const pedidosCompletados = pedidos.filter(p => p.estado_envio === 'entregado').length;
  const pedidosEnCurso = pedidos.filter(p => p.estado_envio !== 'entregado').length;

  // Distribution by Shipping Method
  const shippingCounts: { [key: string]: number } = {};
  pedidos.forEach(p => {
    shippingCounts[p.metodo_envio_nombre] = (shippingCounts[p.metodo_envio_nombre] || 0) + 1;
  });

  const colors = ['#06b6d4', '#ec4899', '#a855f7', '#f59e0b', '#10b981'];
  const shippingData = Object.keys(shippingCounts).map((name, idx) => ({
    name,
    value: shippingCounts[name],
    color: colors[idx % colors.length]
  }));

  const prodStatusData = [
    { status: 'En Cola', cantidad: pedidos.filter(p => p.estado_produccion === 'en_cola').length },
    { status: 'Bordando', cantidad: pedidos.filter(p => p.estado_produccion === 'bordando').length },
    { status: 'Terminado', cantidad: pedidos.filter(p => p.estado_produccion === 'completado').length },
  ];

  return (
    <div className="space-y-6">
      
      {/* Top Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        <div className="rounded-2xl glass-card p-4 border border-pink-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Total Pedidos</span>
            <TrendingUp className="w-4 h-4 text-pink-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {totalPedidos}
          </p>
          <span className="text-[10px] text-pink-400 font-semibold">
            {pedidosEnCurso} en curso en taller
          </span>
        </div>

        <div className="rounded-2xl glass-card p-4 border border-purple-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">En Bastidor</span>
            <Scissors className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {pedidos.filter(p => p.estado_produccion === 'bordando').length}
          </p>
          <span className="text-[10px] text-purple-400 font-semibold">
            Bordándose ahora mismo
          </span>
        </div>

        <div className="rounded-2xl glass-card p-4 border border-cyan-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Destinos Activos</span>
            <Package className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {shippingMethods.filter(m => m.activo).length}
          </p>
          <span className="text-[10px] text-cyan-400 font-semibold">
            Opciones configuradas
          </span>
        </div>

        <div className="rounded-2xl glass-card p-4 border border-amber-500/20 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase">Despachados</span>
            <Truck className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-2xl font-black text-white font-mono">
            {pedidosCompletados}
          </p>
          <span className="text-[10px] text-amber-400 font-semibold">
            Entregados con éxito
          </span>
        </div>

      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Status Distribution */}
        <div className="rounded-3xl glass-card border border-slate-800 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-white">Estado de la Producción</h4>
              <p className="text-xs text-slate-400">Distribución de pedidos por fase</p>
            </div>
            <Scissors className="w-5 h-5 text-purple-400" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={prodStatusData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="status" stroke="#64748b" fontSize={11} />
                <YAxis stroke="#64748b" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                />
                <Bar dataKey="cantidad" name="Pedidos" fill="#a855f7" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Shipping Methods */}
        <div className="rounded-3xl glass-card border border-slate-800 p-5 sm:p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-base font-bold text-white">Métodos de Envío Utilizados</h4>
              <p className="text-xs text-slate-400">Preferencia de entrega de las clientas</p>
            </div>
            <Truck className="w-5 h-5 text-pink-400" />
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            {shippingData.length === 0 ? (
              <p className="text-xs text-slate-500">Sin pedidos registrados aún</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shippingData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {shippingData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                  />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
