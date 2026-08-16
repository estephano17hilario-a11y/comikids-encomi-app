import React, { memo } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Badge } from '../../components/ui/Badge';
import { Icon } from '../../components/ui/Icon';
import { Product, Category, Variant } from '../../types';

interface ProductItemProps {
  item: Product;
  isLiveMode: boolean;
  openModal: (product: Product, mode: 'sale' | 'production') => void;
  openEditModal: (product: Product) => void;
  onArchive?: (productId: string, isArchived: boolean) => void;
  onDelete?: (productId: string) => void;
  categories: Category[];
}

export const ProductItem: React.FC<ProductItemProps> = memo(
  ({ item, isLiveMode, openModal, openEditModal, onArchive, categories }) => {
    const hasImage = item.image && !item.image.startsWith('bg-');
    const bgStyle: React.CSSProperties = hasImage
      ? { backgroundImage: `url(${item.image})`, backgroundPosition: 'center', backgroundSize: 'cover' }
      : {};
    const colorClass = item.color || (item.image && item.image.startsWith('bg-') ? item.image : 'bg-slate-800');

    const totalStock = item.variants?.reduce((acc: number, v: Variant) => acc + (v.stock || 0), 0) || 0;

    return isLiveMode ? (
      <button
        type="button"
        onClick={() => openModal(item, 'sale')}
        className="relative group overflow-hidden rounded-3xl aspect-4/5 border border-white/10 active:scale-[0.98] transition-transform duration-200 shadow-xl cursor-pointer text-left w-full"
      >
        <div className={`absolute inset-0 opacity-90 transition-opacity duration-300 ${colorClass}`} style={bgStyle} />
        <div className="absolute inset-0 bg-linear-to-t from-black via-black/30 to-transparent" />
        {item.isPack && (
          <div className="absolute top-2 right-2 z-10">
            <Badge color="indigo">
              <span className="flex items-center gap-1">
                <Icon name="Layers" size={10} />PACK
              </span>
            </Badge>
          </div>
        )}
        <div className="absolute bottom-0 left-0 w-full p-4 text-left">
          <div className="flex justify-between items-end mb-1.5">
            <Badge color="white">S/ {item.price}</Badge>
            <div className={`flex items-center gap-1 text-[11px] font-bold ${totalStock < 5 ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
              <div className="w-1.5 h-1.5 rounded-full bg-current" />
              {totalStock} unds
            </div>
          </div>
          <h3 className="font-bold text-base text-white leading-tight truncate">{item.name}</h3>
        </div>
      </button>
    ) : (
      <GlassPanel className="flex flex-col h-full relative overflow-hidden group transition-all duration-200 bg-slate-900/90 hover:bg-slate-800/90 border-white/10 hover:border-cyan-500/30 shadow-xl" noHover blur="none">
        {/* Main Header Section */}
        <div className="p-4 flex gap-4 relative z-10 items-center border-b border-white/6">
          <div className={`w-18 h-22 rounded-2xl shadow-xl shrink-0 relative overflow-hidden border border-white/10 ${!hasImage ? colorClass : ''}`} style={bgStyle}>
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-white/5" />
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <div className="space-y-1">
              <div className="flex justify-between items-start gap-2">
                <div className="flex gap-2 items-center">
                  <span className="text-base font-black text-emerald-400 font-mono">S/ {item.price}</span>
                  {item.isPack && (
                    <Badge color="indigo" className="text-[8px] px-1.5 py-0">
                      <Icon name="Layers" size={8} /> PACK
                    </Badge>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => onArchive?.(item.id, !item.isArchived)}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      item.isArchived ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'
                    }`}
                    title={item.isArchived ? 'Desarchivar' : 'Archivar'}
                  >
                    <Icon name={item.isArchived ? 'RotateCcw' : 'Archive'} size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="text-slate-400 hover:text-white transition-colors p-1.5 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer"
                    title="Editar Prenda"
                  >
                    <Icon name="Pencil" size={14} />
                  </button>
                </div>
              </div>
              <h3 className="font-black text-base truncate tracking-tight text-white leading-tight uppercase">{item.name}</h3>
              <div className="flex flex-wrap gap-1 mt-0.5">
                <span className="bg-white/10 text-slate-300 px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider">
                  {categories?.find((c) => c.id === item.categoryId)?.name || 'General'}
                </span>
                {item.cost ? (
                  <span className="text-[9px] text-slate-400 font-mono py-0.5">Costo: S/ {item.cost}</span>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => openModal(item, 'sale')}
                className="flex-1 py-2 px-3 rounded-xl text-[11px] font-black uppercase flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 transition-all active:scale-95 shadow-md shadow-emerald-500/20 cursor-pointer"
              >
                <Icon name="ShoppingBag" size={13} /> Vender
              </button>
              <button
                type="button"
                onClick={() => openModal(item, 'production')}
                className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all flex items-center justify-center active:scale-95 cursor-pointer text-[11px] font-bold"
                title="Ingreso de Producción / Taller"
              >
                <Icon name="Scissors" size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Variants Matrix */}
        {item.variants && item.variants.length > 0 && (
          <div className="p-2.5 grid grid-cols-3 gap-1.5 bg-black/25">
            {item.variants.map((v) => (
              <div
                key={v.id}
                className="flex flex-col items-center justify-center p-2 rounded-xl bg-white/4 border border-white/6 hover:bg-white/8 transition-colors"
              >
                <span className="text-[8px] uppercase text-slate-400 truncate w-full text-center tracking-wider font-bold mb-0.5">
                  {v.color}
                </span>
                <span className="text-sm font-black text-white leading-none">{v.size}</span>
                <div
                  className={`text-[9px] font-mono mt-1 font-black px-1.5 py-0.5 rounded-md ${
                    v.stock < 5 ? 'text-rose-400 bg-rose-500/10' : 'text-emerald-400 bg-emerald-500/10'
                  }`}
                >
                  {v.stock} <span className="text-[7px] opacity-70">unds</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>
    );
  },
  (prev, next) => prev.item === next.item && prev.isLiveMode === next.isLiveMode
);
