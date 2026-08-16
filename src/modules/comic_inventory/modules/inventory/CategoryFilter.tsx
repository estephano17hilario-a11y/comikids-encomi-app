import React, { memo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Category } from '../../types';

interface CategoryFilterProps {
  categories: Category[];
  activeCategory: string | null;
  activeSubCategory: string | null;
  onSelectCategory: (id: string | null) => void;
  onSelectSubCategory: (id: string | null) => void;
  isLive?: boolean;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = memo(
  ({ categories, activeCategory, activeSubCategory, onSelectCategory, onSelectSubCategory, isLive = false }) => {
    const activeCatData = categories.find((c) => c.id === activeCategory);

    return (
      <div className={`transition-all duration-300 ${isLive ? 'mb-2' : 'mb-3'} mt-1 relative z-20`}>
        <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-1 items-center">
          <button
            type="button"
            onClick={() => onSelectCategory(null)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all duration-300 whitespace-nowrap text-xs font-bold cursor-pointer ${
              !activeCategory
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 scale-105 shadow-md shadow-cyan-500/20'
                : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon name="Layers" size={13} /> Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id === activeCategory ? null : cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all duration-300 whitespace-nowrap text-xs font-bold cursor-pointer ${
                activeCategory === cat.id
                  ? 'bg-purple-600 border-purple-400 text-white scale-105 shadow-md shadow-purple-600/30'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon name={cat.icon} size={13} /> {cat.name}
            </button>
          ))}
        </div>

        {activeCatData && activeCatData.subCategories && activeCatData.subCategories.length > 0 && (
          <div className="px-1 mt-1.5 flex gap-1.5 flex-wrap items-center animate-fadeIn">
            <span className="text-[10px] uppercase text-slate-500 font-bold mr-1 tracking-wider">Sub-filtro:</span>
            {activeCatData.subCategories.map((sub) => (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelectSubCategory(activeSubCategory === sub.id ? null : sub.id)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border cursor-pointer ${
                  activeSubCategory === sub.id
                    ? 'bg-purple-500/20 border-purple-400/50 text-purple-300'
                    : 'bg-transparent border-white/8 text-slate-400 hover:border-white/20 hover:text-slate-200'
                }`}
              >
                {sub.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
);
