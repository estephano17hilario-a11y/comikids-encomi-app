import React, { useState, useEffect } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Product, Variant } from '../../types';

interface TransactionModalProps {
  product: Product;
  mode: 'sale' | 'restock' | 'production';
  onClose: () => void;
  onCommit: (productId: string, variantId: string, quantity: number, mode: any, price: number) => void;
}

export const TransactionModal: React.FC<TransactionModalProps> = ({ product, mode, onClose, onCommit }) => {
  const [selectedVariant, setSelectedVariant] = useState<Variant>(
    product?.variants?.[0] || { id: '', size: '', color: '', stock: 0 }
  );
  const [qty, setQty] = useState(1);
  const [salePrice, setSalePrice] = useState(product?.variants?.[0]?.price || product?.price || 0);
  const isSale = mode === 'sale';

  useEffect(() => {
    if (product && product.variants) {
      const updatedVariant = product.variants.find((v) => v.id === selectedVariant.id);
      if (updatedVariant) {
        setSelectedVariant(updatedVariant);
        setSalePrice(updatedVariant.price || product.price);
      }
    }
  }, [product, selectedVariant.id]);

  if (!product || !product.variants || product.variants.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`p-5 flex justify-between items-center bg-linear-to-r ${
            isSale ? 'from-rose-950/90 via-slate-900 to-slate-900' : 'from-emerald-950/90 via-slate-900 to-slate-900'
          }`}
        >
          <div>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 mb-0.5 font-bold">
              {isSale ? '🔴 VENTA RÁPIDA / LIVE' : '📦 INGRESO DE TALLER'}
            </p>
            <h2 className="text-xl font-black text-white leading-tight">{product.name}</h2>
            <p className="text-xs font-mono text-cyan-300">
              {selectedVariant.size} • {selectedVariant.color}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-white/5 hover:bg-white/15 rounded-full text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-[11px] text-slate-400 mb-2 block uppercase tracking-wider font-bold">
              Selecciona Variante
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto custom-scrollbar">
              {product.variants.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedVariant(v)}
                  className={`p-2.5 rounded-xl border flex justify-between items-center transition-all cursor-pointer ${
                    selectedVariant.id === v.id
                      ? 'bg-purple-600/30 border-purple-400 text-white shadow-md'
                      : 'bg-white/4 border-white/8 text-slate-400 hover:bg-white/8 hover:text-white'
                  }`}
                >
                  <div className="flex flex-col text-left">
                    <span className="font-black text-xs text-white">{v.size}</span>
                    <span className="text-[10px] uppercase text-slate-400">{v.color}</span>
                  </div>
                  <div className="text-right">
                    <span
                      className={`text-xs font-mono font-bold block ${
                        v.stock < 5 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {v.stock} u.
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-white/8">
            {isSale && (
              <div className="p-3 bg-white/4 rounded-2xl border border-white/8 flex justify-between items-center">
                <div>
                  <label className="text-[10px] uppercase text-cyan-300 font-bold block mb-0.5">Precio de Venta</label>
                  <span className="text-slate-500 text-xs line-through">
                    S/ {selectedVariant.price || product.price}
                  </span>
                </div>
                <div className="flex items-center gap-1 bg-slate-950 rounded-xl px-3 py-1.5 border border-white/10">
                  <span className="text-emerald-400 font-bold text-sm">S/</span>
                  <input
                    type="number"
                    value={salePrice}
                    onChange={(e) => setSalePrice(Number(e.target.value))}
                    className="w-20 bg-transparent text-white font-bold text-base focus:outline-none text-right font-mono"
                  />
                </div>
              </div>
            )}

            {/* Quantity Selector */}
            <div className="flex items-center justify-between bg-black/40 p-2 rounded-2xl border border-white/8">
              <button
                type="button"
                onClick={() => setQty(Math.max(1, qty - 1))}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              >
                <Icon name="ArrowDown" size={16} />
              </button>
              <div className="text-center">
                <span className="block text-2xl font-black text-white font-mono leading-none">{qty}</span>
                <span className="text-[10px] text-slate-400 uppercase font-bold">Unidades</span>
              </div>
              <button
                type="button"
                onClick={() => setQty(qty + 1)}
                className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white active:scale-90 transition-transform cursor-pointer"
              >
                <Icon name="ArrowUp" size={16} />
              </button>
            </div>

            {isSale && (
              <div className="flex gap-2 justify-center">
                {[1, 2, 3, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setQty(n)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      qty === n ? 'bg-rose-600 text-white shadow-md' : 'bg-white/5 text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    +{n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onCommit(product.id, selectedVariant.id, qty, mode, salePrice)}
            className={`w-full py-3.5 px-4 rounded-2xl font-black uppercase tracking-wider text-xs sm:text-sm shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isSale
                ? 'bg-linear-to-r from-rose-600 via-pink-600 to-amber-600 text-white shadow-rose-900/40'
                : 'bg-linear-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-900/40'
            }`}
          >
            <Icon name={isSale ? 'ShoppingBag' : 'Box'} size={16} />
            <span>
              {isSale ? `Vender (S/ ${(qty * salePrice).toLocaleString()})` : `Ingresar ${qty} unds a Taller`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
