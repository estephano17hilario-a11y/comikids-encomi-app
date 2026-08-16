import React, { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { HistoryItem, Product, Variant } from '../../types';
import { ShoppingBag, Edit3, Trash2, Check, ArrowLeft, Image as ImageIcon, Plus, Minus } from 'lucide-react';

interface SessionDetailsModalProps {
  currentSessionHistory: HistoryItem[];
  products: Product[];
  onClose: () => void;
  onUpdateSaleDetails: (
    saleItem: HistoryItem,
    newVariantId: string,
    newQty: number,
    newPrice: number
  ) => void;
  onDeleteSale: (item: HistoryItem) => void;
}

// Agrupa múltiples items de historial de la misma transacción (mismo producto, misma hora aprox)
// Por convención, historyItems del mismo "commit" comparten el mismo Math.floor(time/1000)
interface ProductSaleGroup {
  productId: string;
  productName: string;
  product: Product | undefined;
  items: HistoryItem[];
  totalQty: number;
  totalRevenue: number;
  time: number; // del primer item
}

export const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({
  currentSessionHistory,
  products,
  onClose,
  onUpdateSaleDetails,
  onDeleteSale
}) => {
  const [editingGroup, setEditingGroup] = useState<ProductSaleGroup | null>(null);

  // Estado del editor multi-variante (similar a TransactionModal)
  const [editQtys, setEditQtys] = useState<Record<string, number>>({});
  const [editPrices, setEditPrices] = useState<Record<string, number>>({});
  const [activeVariantId, setActiveVariantId] = useState<string>('');

  const totalSessionRevenue = currentSessionHistory.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * (Number(item.qty) || 0),
    0
  );

  // Agrupar items por producto + timestamp de sesión (round al segundo para agrupar commits)
  const saleGroups = useMemo<ProductSaleGroup[]>(() => {
    // Agrupar por productId + segundos de timestamp (los multi-variante se lanzan en el mismo ms aprox)
    const groupMap = new Map<string, ProductSaleGroup>();

    currentSessionHistory
      .slice()
      .reverse()
      .forEach((item) => {
        const tsKey = Math.floor(item.time / 2000); // bucket de 2 segundos
        const key = `${item.productId}_${tsKey}`;
        if (!groupMap.has(key)) {
          const product = products.find((p) => p.id === item.productId);
          groupMap.set(key, {
            productId: item.productId,
            productName: item.product,
            product,
            items: [],
            totalQty: 0,
            totalRevenue: 0,
            time: item.time
          });
        }
        const group = groupMap.get(key)!;
        group.items.push(item);
        group.totalQty += item.qty;
        group.totalRevenue += item.price * item.qty;
      });

    return Array.from(groupMap.values());
  }, [currentSessionHistory, products]);

  const openGroupEditor = (group: ProductSaleGroup) => {
    setEditingGroup(group);
    // Inicializar qtys y prices desde los items de la venta
    const qtys: Record<string, number> = {};
    const prices: Record<string, number> = {};
    group.items.forEach((item) => {
      qtys[item.variantId] = item.qty;
      prices[item.variantId] = item.price;
    });
    // Si hay variantes no seleccionadas, ponerlas en 0
    group.product?.variants?.forEach((v) => {
      if (!(v.id in qtys)) {
        qtys[v.id] = 0;
        prices[v.id] = v.price || group.product?.price || 0;
      }
    });
    setEditQtys(qtys);
    setEditPrices(prices);
    setActiveVariantId(group.items[0]?.variantId || group.product?.variants?.[0]?.id || '');
  };

  const activeVariant = useMemo(() => {
    return editingGroup?.product?.variants?.find((v) => v.id === activeVariantId);
  }, [editingGroup, activeVariantId]);

  const handleVariantClick = (v: Variant) => {
    if (activeVariantId === v.id) {
      // 2do clic: toggle selección
      setEditQtys((prev) => ({ ...prev, [v.id]: prev[v.id] > 0 ? 0 : 1 }));
    } else {
      setActiveVariantId(v.id);
      if (!editQtys[v.id] || editQtys[v.id] === 0) {
        setEditQtys((prev) => ({ ...prev, [v.id]: 1 }));
      }
    }
  };

  const handleActiveQtyChange = (newQty: number) => {
    setEditQtys((prev) => ({ ...prev, [activeVariantId]: Math.max(0, newQty) }));
  };

  const handleActivePriceChange = (newPrice: number) => {
    setEditPrices((prev) => ({ ...prev, [activeVariantId]: Math.max(0, newPrice) }));
  };

  const totalEditItems = useMemo(() => Object.values(editQtys).reduce((a, b) => a + b, 0), [editQtys]);
  const totalEditRevenue = useMemo(() => {
    return Object.entries(editQtys).reduce((acc, [vId, qty]) => acc + qty * (editPrices[vId] || 0), 0);
  }, [editQtys, editPrices]);

  const handleSaveGroup = () => {
    if (!editingGroup) return;
    const prod = editingGroup.product;
    if (!prod) return;

    // Variantes con qty > 0
    const newSelections = Object.entries(editQtys).filter(([, qty]) => qty > 0);

    // Actualizar o eliminar los ítems existentes y crear los nuevos
    // Estrategia: eliminar todos los items del grupo, luego crear con onUpdateSaleDetails
    // Para simplificar, actualizamos 1-a-1 los items existentes, y eliminamos los sobrantes

    const oldItems = [...editingGroup.items];

    newSelections.forEach(([vId, qty], idx) => {
      const price = editPrices[vId] || 0;
      if (idx < oldItems.length) {
        // Actualizar item existente
        onUpdateSaleDetails(oldItems[idx], vId, qty, price);
      } else {
        // No hay más items existentes para actualizar; en este caso reutilizamos el primero como template
        onUpdateSaleDetails({ ...oldItems[0], id: Date.now() + Math.random() }, vId, qty, price);
      }
    });

    // Eliminar los items sobrantes del grupo original que no fueron cubiertos
    if (oldItems.length > newSelections.length) {
      for (let i = newSelections.length; i < oldItems.length; i++) {
        onDeleteSale(oldItems[i]);
      }
    }

    setEditingGroup(null);
  };

  const handleDeleteGroup = () => {
    if (!editingGroup) return;
    editingGroup.items.forEach((item) => onDeleteSale(item));
    setEditingGroup(null);
  };

  const activeQty = editQtys[activeVariantId] ?? 0;
  const activePrice = editPrices[activeVariantId] ?? 0;

  const hasImage = Boolean(
    editingGroup?.product?.image && !editingGroup?.product?.image?.startsWith('bg-')
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-xl p-3 sm:p-4 animate-fadeIn text-left"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-rose-950/80 to-slate-900 border-b border-white/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            {editingGroup && (
              <button
                type="button"
                onClick={() => setEditingGroup(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-0.5">
                {editingGroup ? 'Editando Venta' : 'Live Command Center'}
              </p>
              <h2 className="text-base sm:text-lg font-black text-white">
                {editingGroup ? editingGroup.productName : 'Registro de Ventas en Vivo'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Subheader Total */}
        {!editingGroup && (
          <div className="p-3.5 bg-white/4 border-b border-white/5 flex justify-between items-center shrink-0">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Vendido en este Live</span>
              <span className="text-xs text-slate-500">{saleGroups.length} {saleGroups.length === 1 ? 'venta' : 'ventas'} registradas</span>
            </div>
            <span className="text-xl font-mono font-black text-emerald-400">
              S/ {totalSessionRevenue.toLocaleString()}
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {editingGroup ? (
            /* ─── EDITOR MULTI-VARIANTE ─── */
            <div className="space-y-4 animate-fadeIn">
              {/* Foto + nombre del producto */}
              <div className="p-3 bg-white/4 rounded-2xl border border-white/8 flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl overflow-hidden border border-white/15 shadow-md shrink-0 bg-black/40">
                  {hasImage ? (
                    <img src={editingGroup.product!.image!} alt={editingGroup.productName} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40">
                      <ImageIcon className="w-6 h-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{editingGroup.productName}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    {new Date(editingGroup.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </p>
                  {totalEditItems > 0 && (
                    <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 text-[9px] font-black border border-cyan-400/30 animate-pulse">
                      {totalEditItems} prendas · S/ {totalEditRevenue.toLocaleString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Grid de variantes interactivo */}
              {editingGroup.product?.variants && editingGroup.product.variants.length > 0 && (
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1.5">
                    Toca para cambiar selección (1 clic = enfocar, 2 clics = deseleccionar)
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-0.5">
                    {editingGroup.product.variants.map((v) => {
                      const qty = editQtys[v.id] || 0;
                      const isSelected = qty > 0;
                      const isActive = activeVariantId === v.id;
                      const vPrice = editPrices[v.id] ?? (v.price || editingGroup.product?.price || 0);

                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => handleVariantClick(v)}
                          className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-[4.5rem] ${
                            isActive
                              ? 'bg-purple-600/30 border-cyan-400 shadow-lg ring-2 ring-cyan-400/40'
                              : isSelected
                              ? 'bg-pink-950/40 border-pink-500/50'
                              : 'bg-white/4 border-white/8 text-slate-400 hover:bg-white/8'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-xs shadow-md">
                              +{qty}
                            </div>
                          )}
                          <div>
                            <span className="font-black text-sm text-white block leading-tight">{v.size}</span>
                            <span className="text-[10px] uppercase text-slate-400 block">{v.color}</span>
                          </div>
                          <div className="flex justify-between items-end mt-1 pt-1 border-t border-white/6 w-full">
                            <span className="text-[11px] font-mono font-bold text-cyan-300">S/ {vPrice}</span>
                            <span className={`text-[10px] font-mono font-bold ${v.stock < 5 ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {v.stock} u.
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Franja de control de la variante activa */}
              {activeVariant && (
                <div className="p-3.5 bg-black/50 rounded-2xl border border-white/10 space-y-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Editando:</span>
                      <span className="text-xs font-black text-cyan-300 font-mono">
                        {activeVariant.size} · {activeVariant.color}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 bg-slate-950 rounded-xl px-2.5 py-1 border border-white/10">
                      <span className="text-emerald-400 font-bold text-xs">S/</span>
                      <input
                        type="number"
                        value={activePrice}
                        onChange={(e) => handleActivePriceChange(Number(e.target.value))}
                        className="w-16 bg-transparent text-white font-bold text-xs focus:outline-none text-right font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950 p-2 rounded-2xl border border-white/8">
                    <button
                      type="button"
                      onClick={() => handleActiveQtyChange(activeQty - 1)}
                      className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="text-center">
                      <input
                        type="number"
                        min="0"
                        value={activeQty}
                        onChange={(e) => handleActiveQtyChange(Number(e.target.value))}
                        className="w-20 text-center bg-transparent text-2xl font-black text-white font-mono leading-none focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mt-0.5">
                        {activeQty === 1 ? 'Unidad' : 'Unidades'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleActiveQtyChange(activeQty + 1)}
                      className="w-10 h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 flex items-center justify-center text-slate-950 active:scale-90 transition-transform cursor-pointer font-bold shadow-md shadow-cyan-500/20"
                    >
                      <Plus className="w-4 h-4 stroke-[3]" />
                    </button>
                  </div>

                  <div className="flex gap-1.5 justify-center">
                    {[1, 2, 3, 5, 10].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => handleActiveQtyChange(n)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          activeQty === n
                            ? 'bg-cyan-500 text-slate-950 shadow-md'
                            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        {n} u.
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleDeleteGroup}
                  className="w-1/3 py-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveGroup}
                  disabled={totalEditItems === 0}
                  className={`w-2/3 py-3 rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                    totalEditItems === 0
                      ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40'
                  }`}
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar · S/ {totalEditRevenue.toLocaleString()}</span>
                </button>
              </div>
            </div>
          ) : (
            /* ─── LISTA AGRUPADA DE VENTAS ─── */
            <div>
              {saleGroups.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                  <p className="text-xs text-slate-400">Aún no hay ventas registradas en esta transmisión.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold mb-2">
                    Toca una venta para editar variantes, cantidades o precios:
                  </p>
                  {saleGroups.map((group, idx) => {
                    const hasImg = Boolean(group.product?.image && !group.product.image.startsWith('bg-'));
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => openGroupEditor(group)}
                        className="w-full bg-white/4 hover:bg-white/10 p-3 rounded-2xl border border-white/8 transition-all cursor-pointer text-left group flex items-center gap-3"
                      >
                        {/* Thumbnail */}
                        <div className="w-12 h-12 rounded-xl overflow-hidden border border-white/15 shadow-md shrink-0 bg-black/40">
                          {hasImg ? (
                            <img src={group.product!.image!} alt={group.productName} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/40 text-lg">
                              🛍️
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="font-black text-xs sm:text-sm text-white truncate">{group.productName}</p>
                          {/* Línea de variantes resumida */}
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {group.items.map((item) => (
                              <span key={item.id} className="px-1.5 py-0.5 rounded-lg bg-slate-800 text-[10px] font-mono text-cyan-300 border border-white/6">
                                {item.variant.split(' - ')[0]} ×{item.qty}
                              </span>
                            ))}
                          </div>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {new Date(group.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-mono font-black text-emerald-400">
                            S/ {group.totalRevenue.toLocaleString()}
                          </span>
                          <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-cyan-500 group-hover:text-slate-950 text-slate-400 transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
