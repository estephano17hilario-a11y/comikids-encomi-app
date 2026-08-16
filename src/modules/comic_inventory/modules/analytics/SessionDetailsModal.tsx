import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { HistoryItem, Product } from '../../types';
import { ShoppingBag, Edit3, Trash2, Check, ArrowLeft, Layers } from 'lucide-react';

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

export const SessionDetailsModal: React.FC<SessionDetailsModalProps> = ({
  currentSessionHistory,
  products,
  onClose,
  onUpdateSaleDetails,
  onDeleteSale
}) => {
  const [editingItem, setEditingItem] = useState<HistoryItem | null>(null);
  const [editVariantId, setEditVariantId] = useState<string>('');
  const [editQty, setEditQty] = useState<number>(1);
  const [editPrice, setEditPrice] = useState<number>(0);

  const totalSessionRevenue = currentSessionHistory.reduce(
    (acc, item) => acc + (Number(item.price) || 0) * (Number(item.qty) || 0),
    0
  );

  const openEditor = (item: HistoryItem) => {
    setEditingItem(item);
    setEditVariantId(item.variantId);
    setEditQty(item.qty);
    setEditPrice(item.price);
  };

  const currentProduct = editingItem
    ? products.find((p) => p.id === editingItem.productId)
    : null;

  const handleSaveEdit = () => {
    if (!editingItem || editQty <= 0) return;
    onUpdateSaleDetails(editingItem, editVariantId, editQty, editPrice);
    setEditingItem(null);
  };

  const handleDeleteCurrent = () => {
    if (!editingItem) return;
    onDeleteSale(editingItem);
    setEditingItem(null);
  };

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
        <div className="p-4 sm:p-5 bg-linear-to-r from-rose-950/80 to-slate-900 border-b border-white/5 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            {editingItem && (
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-slate-300 transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div>
              <p className="text-[10px] uppercase tracking-widest text-rose-400 font-bold mb-0.5">
                {editingItem ? 'Editando Transacción' : 'Live Command Center'}
              </p>
              <h2 className="text-base sm:text-lg font-black text-white">
                {editingItem ? 'Modificar Venta Seleccionada' : 'Registro de Ventas en Vivo'}
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
        {!editingItem && (
          <div className="p-3.5 bg-white/4 border-b border-white/5 flex justify-between items-center shrink-0">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase block">Total Vendido en este Live</span>
              <span className="text-xs text-slate-500">{currentSessionHistory.length} transacciones registradas</span>
            </div>
            <span className="text-xl font-mono font-black text-emerald-400">
              S/ {totalSessionRevenue.toLocaleString()}
            </span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-3">
          {editingItem ? (
            /* --- PANTALLA DE EDICIÓN DETALLADA DE VENTA --- */
            <div className="space-y-4 animate-fadeIn">
              <div className="p-3 bg-white/4 rounded-2xl border border-white/8 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-lg shrink-0">
                  🛍️
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">{editingItem.product}</h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    Hora:{' '}
                    {new Date(editingItem.time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
              </div>

              {/* Selector de Variante */}
              {currentProduct && currentProduct.variants && (
                <div>
                  <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1.5">
                    Variante Seleccionada
                  </label>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto custom-scrollbar">
                    {currentProduct.variants.map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setEditVariantId(v.id);
                          if (v.price) setEditPrice(v.price);
                        }}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          editVariantId === v.id
                            ? 'bg-purple-600/30 border-cyan-400 text-white'
                            : 'bg-white/4 border-white/8 text-slate-400 hover:bg-white/8'
                        }`}
                      >
                        <span className="font-bold text-xs text-white block">{v.size}</span>
                        <span className="text-[10px] uppercase text-slate-400 block">{v.color}</span>
                        <span className="text-[10px] font-mono text-cyan-300 font-bold">
                          S/ {v.price || currentProduct.price}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cantidad y Precio de Venta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-black/40 rounded-2xl border border-white/8">
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Cantidad</label>
                  <input
                    type="number"
                    min="1"
                    value={editQty}
                    onChange={(e) => setEditQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-transparent text-white font-mono font-black text-lg focus:outline-none"
                  />
                </div>

                <div className="p-3 bg-black/40 rounded-2xl border border-white/8">
                  <label className="text-[10px] uppercase font-bold text-emerald-400 block mb-1">Precio Unit. (S/)</label>
                  <input
                    type="number"
                    step="any"
                    value={editPrice}
                    onChange={(e) => setEditPrice(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-transparent text-emerald-400 font-mono font-black text-lg focus:outline-none"
                  />
                </div>
              </div>

              {/* Subtotal */}
              <div className="p-3 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 flex justify-between items-center">
                <span className="text-xs uppercase font-bold text-emerald-300">Total Transacción:</span>
                <span className="text-lg font-mono font-black text-emerald-400">
                  S/ {(editQty * editPrice).toLocaleString()}
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleDeleteCurrent}
                  className="w-1/3 py-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Eliminar</span>
                </button>

                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="w-2/3 py-3 rounded-xl bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-900/40 cursor-pointer transition-all"
                >
                  <Check className="w-4 h-4" />
                  <span>Guardar Cambios</span>
                </button>
              </div>
            </div>
          ) : (
            /* --- LISTA DE VENTAS DE LA SESIÓN LIVE --- */
            <div>
              {currentSessionHistory.length === 0 ? (
                <div className="text-center py-10 opacity-40">
                  <ShoppingBag className="w-10 h-10 mx-auto mb-2 text-slate-400" />
                  <p className="text-xs text-slate-400">Aún no hay ventas registradas en esta transmisión.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-[11px] text-slate-400 uppercase tracking-wider font-bold mb-2">
                    Toca cualquier venta para editar variante, cantidad o precio:
                  </p>
                  {currentSessionHistory
                    .slice()
                    .reverse()
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openEditor(item)}
                        className="w-full flex justify-between items-center bg-white/4 hover:bg-white/10 p-3 rounded-2xl border border-white/8 transition-all cursor-pointer text-left group"
                      >
                        <div className="flex-1 min-w-0 pr-3">
                          <div className="flex items-center gap-2">
                            <p className="font-black text-xs sm:text-sm text-white truncate">{item.product}</p>
                            <span className="px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-mono font-bold">
                              {item.qty} u.
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {item.variant} • <span className="text-emerald-400 font-bold font-mono">S/ {item.price} c/u</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-sm font-mono font-black text-emerald-400">
                            S/ {(item.price * item.qty).toLocaleString()}
                          </span>
                          <div className="p-1.5 rounded-lg bg-white/5 group-hover:bg-cyan-500 group-hover:text-slate-950 text-slate-400 transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </button>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
