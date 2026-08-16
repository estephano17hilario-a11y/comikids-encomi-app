import React, { useState, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Product, Variant } from '../../types';
import { ShoppingBag, Box, Check, Plus, Minus, Layers, Image as ImageIcon } from 'lucide-react';

export interface MultiVariantCommitItem {
  variantId: string;
  quantity: number;
  price: number;
}

interface TransactionModalProps {
  product: Product;
  mode: 'sale' | 'restock' | 'production';
  onClose: () => void;
  onCommit: (productId: string, variantId: string, quantity: number, mode: any, price: number) => void;
  onCommitMulti?: (productId: string, items: MultiVariantCommitItem[], mode: any) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  product,
  mode,
  onClose,
  onCommit,
  onCommitMulti
}) => {
  const isSale = mode === 'sale';
  const defaultVariant = product?.variants?.[0] || { id: '', size: 'STD', color: 'Único', stock: 0 };

  // Diccionario de cantidades por variante: { [variantId]: number }
  const [selectedQuantities, setSelectedQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    if (product?.variants?.length) {
      initial[product.variants[0].id] = 1;
    }
    return initial;
  });

  // Variante actualmente enfocada para edición en la franja inferior
  const [activeVariantId, setActiveVariantId] = useState<string>(defaultVariant.id);

  // Precios personalizados por variante (si se desea modificar en vivo)
  const [customPrices, setCustomPrices] = useState<Record<string, number>>(() => {
    const prices: Record<string, number> = {};
    product?.variants?.forEach((v) => {
      prices[v.id] = v.price || product.price || 0;
    });
    return prices;
  });

  const activeVariant = useMemo(() => {
    return product?.variants?.find((v) => v.id === activeVariantId) || defaultVariant;
  }, [product, activeVariantId, defaultVariant]);

  const activeQty = selectedQuantities[activeVariantId] || 0;
  const activePrice = customPrices[activeVariantId] ?? (activeVariant.price || product.price || 0);

  // Cálculos totales
  const totalItemsCount = useMemo(() => {
    return Object.values(selectedQuantities).reduce((acc, q) => acc + (q || 0), 0);
  }, [selectedQuantities]);

  const totalSaleAmount = useMemo(() => {
    return Object.entries(selectedQuantities).reduce((acc, [vId, qty]) => {
      const v = product?.variants?.find((vItem) => vItem.id === vId);
      const price = customPrices[vId] ?? (v?.price || product.price || 0);
      return acc + (qty || 0) * price;
    }, 0);
  }, [selectedQuantities, customPrices, product]);

  // Manejo de clic en variante (1 clic: enfocar / seleccionar con 1; 2 clics consecutivos: deseleccionar a 0)
  const handleVariantClick = (v: Variant) => {
    if (activeVariantId === v.id) {
      // 2do clic en la misma variante activa: Deseleccionar
      if (selectedQuantities[v.id] > 0) {
        setSelectedQuantities((prev) => ({ ...prev, [v.id]: 0 }));
      } else {
        setSelectedQuantities((prev) => ({ ...prev, [v.id]: 1 }));
      }
    } else {
      // 1er clic en una variante diferente: Enfocar y si está en 0 ponerla en 1
      setActiveVariantId(v.id);
      if (!selectedQuantities[v.id] || selectedQuantities[v.id] === 0) {
        setSelectedQuantities((prev) => ({ ...prev, [v.id]: 1 }));
      }
    }
  };

  const handleActiveQtyChange = (newQty: number) => {
    const validQty = Math.max(0, newQty);
    setSelectedQuantities((prev) => ({
      ...prev,
      [activeVariantId]: validQty
    }));
  };

  const handleActivePriceChange = (newPrice: number) => {
    setCustomPrices((prev) => ({
      ...prev,
      [activeVariantId]: Math.max(0, newPrice)
    }));
  };

  const handleCommitAll = () => {
    const itemsToCommit: MultiVariantCommitItem[] = [];

    Object.entries(selectedQuantities).forEach(([vId, qty]) => {
      if (qty > 0) {
        const v = product.variants.find((vari) => vari.id === vId);
        const price = customPrices[vId] ?? (v?.price || product.price || 0);
        itemsToCommit.push({
          variantId: vId,
          quantity: qty,
          price
        });
      }
    });

    if (itemsToCommit.length === 0) return;

    if (onCommitMulti) {
      onCommitMulti(product.id, itemsToCommit, mode);
    } else {
      // Fallback a llamada individual secuencial
      itemsToCommit.forEach((item) => {
        onCommit(product.id, item.variantId, item.quantity, mode, item.price);
      });
    }
    onClose();
  };

  if (!product || !product.variants || product.variants.length === 0) return null;

  const hasImage = Boolean(product.image && !product.image.startsWith('bg-'));

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp text-left flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header */}
        <div
          className={`p-4 sm:p-5 flex justify-between items-center border-b border-white/10 bg-linear-to-r ${
            isSale ? 'from-rose-950/90 via-slate-900 to-slate-900' : 'from-emerald-950/90 via-slate-900 to-slate-900'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {/* Foto de la Prenda */}
            <div className="w-12 h-12 rounded-2xl overflow-hidden border border-white/15 shadow-md shrink-0 relative bg-black/40">
              {hasImage ? (
                <img src={product.image!} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/40">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                  {isSale ? '🔴 VENTA RÁPIDA / LIVE' : '📦 INGRESO A TALLER'}
                </p>
                {totalItemsCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                    {totalItemsCount} {totalItemsCount === 1 ? 'prenda' : 'prendas'}
                  </span>
                )}
              </div>
              <h2 className="text-base sm:text-lg font-black text-white leading-tight truncate">{product.name}</h2>
              <p className="text-xs font-mono text-emerald-400 font-bold">
                Precio Base: S/ {product.price}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto custom-scrollbar flex-1">
          {/* Multi-variant Grid */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-[11px] text-slate-300 uppercase tracking-wider font-bold">
                Toca para seleccionar variantes (1 clic suma 1, 2 clics deselecciona)
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2 max-h-52 overflow-y-auto custom-scrollbar pr-0.5">
              {product.variants.map((v) => {
                const qty = selectedQuantities[v.id] || 0;
                const isSelected = qty > 0;
                const isActive = activeVariantId === v.id;
                const vPrice = customPrices[v.id] ?? (v.price || product.price || 0);

                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => handleVariantClick(v)}
                    className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between min-h-18 ${
                      isActive
                        ? 'bg-purple-600/30 border-cyan-400 shadow-lg shadow-purple-900/30 ring-2 ring-cyan-400/40'
                        : isSelected
                        ? 'bg-pink-950/40 border-pink-500/50 text-white'
                        : 'bg-white/4 border-white/8 text-slate-400 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {/* Badge de cantidad seleccionada */}
                    {isSelected && (
                      <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-cyan-500 text-slate-950 font-black text-xs shadow-md animate-scaleUp">
                        +{qty}
                      </div>
                    )}

                    <div>
                      <span className="font-black text-sm text-white block leading-tight">{v.size}</span>
                      <span className="text-[10px] uppercase text-slate-400 block">{v.color}</span>
                    </div>

                    <div className="flex justify-between items-end mt-1 pt-1 border-t border-white/6 w-full">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-mono font-bold text-cyan-300">
                          S/ {vPrice}
                        </span>
                        {!isSale && v.cost !== undefined && v.cost > 0 && (
                          <span className="text-[9px] font-mono text-amber-400">
                            Costo: S/ {v.cost}
                          </span>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-mono font-bold ${
                          v.stock < 5 ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {v.stock} u.
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Variant Controls Strip */}
          <div className="p-3.5 bg-black/50 rounded-2xl border border-white/10 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Editando Cantidad de:</span>
                <span className="text-xs font-black text-cyan-300 font-mono">
                  {activeVariant.size} • {activeVariant.color}
                </span>
              </div>

              {isSale && (
                <div className="flex items-center gap-1 bg-slate-950 rounded-xl px-2.5 py-1 border border-white/10">
                  <span className="text-emerald-400 font-bold text-xs">S/</span>
                  <input
                    type="number"
                    value={activePrice}
                    onChange={(e) => handleActivePriceChange(Number(e.target.value))}
                    className="w-16 bg-transparent text-white font-bold text-xs focus:outline-none text-right font-mono"
                    title="Precio para esta variante"
                  />
                </div>
              )}
            </div>

            {/* Quantity Selector for Active Variant */}
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

            {/* Quick Add Pills */}
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
        </div>

        {/* Bottom Confirm Commit Button */}
        <div className="p-4 sm:p-5 border-t border-white/10 bg-slate-950">
          <button
            type="button"
            disabled={totalItemsCount === 0}
            onClick={handleCommitAll}
            className={`w-full py-4 px-4 rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              totalItemsCount === 0
                ? 'bg-white/10 text-slate-500 cursor-not-allowed'
                : isSale
                ? 'bg-linear-to-r from-rose-600 via-pink-600 to-amber-600 text-white shadow-rose-900/40'
                : 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40'
            }`}
          >
            {isSale ? <ShoppingBag className="w-4 h-4" /> : <Box className="w-4 h-4" />}
            <span>
              {totalItemsCount === 0
                ? 'Selecciona al menos 1 variante'
                : isSale
                ? `Vender ${totalItemsCount} ${totalItemsCount === 1 ? 'prenda' : 'prendas'} (S/ ${totalSaleAmount.toLocaleString()})`
                : `Ingresar ${totalItemsCount} ${totalItemsCount === 1 ? 'unds' : 'unds'} a Taller`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
