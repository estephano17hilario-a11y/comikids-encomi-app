import React, { useState } from 'react';
import { GlassPanel } from '../../components/ui/GlassPanel';
import { Icon } from '../../components/ui/Icon';
import { Category, MeshTheme } from '../../types';
import { MESH_THEMES } from '../../data/initialData';
import { CompanyAccountSettings } from '../../../../components/admin/CompanyAccountSettings';

interface SettingsViewProps {
  categories: Category[];
  setCategories: (categories: Category[]) => void;
  onReset: () => void;
  currentThemeId: string;
  onThemeChange: (id: string) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  categories,
  setCategories,
  currentThemeId,
  onThemeChange
}) => {
  const [activeTab, setActiveTab] = useState<'empresa' | 'categorias' | 'temas'>('empresa');
  const [newCatName, setNewCatName] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState('');

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: `cat_${Date.now()}`,
      name: newCatName.trim(),
      icon: 'Shirt',
      subCategories: []
    };
    setCategories([...categories, newCat]);
    setNewCatName('');
  };

  const handleDeleteCategory = (id: string) => {
    setCategories(categories.filter((c) => c.id !== id));
    if (selectedCatId === id) setSelectedCatId(null);
  };

  const handleAddSubCategory = () => {
    if (!newSubName.trim() || !selectedCatId) return;
    setCategories(
      categories.map((c) => {
        if (c.id === selectedCatId) {
          return {
            ...c,
            subCategories: [...c.subCategories, { id: `sub_${Date.now()}`, name: newSubName.trim() }]
          };
        }
        return c;
      })
    );
    setNewSubName('');
  };

  const handleDeleteSubCategory = (catId: string, subId: string) => {
    setCategories(
      categories.map((c) => {
        if (c.id === catId) {
          return { ...c, subCategories: c.subCategories.filter((s) => s.id !== subId) };
        }
        return c;
      })
    );
  };

  return (
    <div className="space-y-4 animate-fadeIn text-left">
      {/* Top Section Tabs */}
      <div className="flex p-1 bg-slate-900 rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setActiveTab('empresa')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'empresa'
              ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Empresa & Yape
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categorias')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'categorias'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Categorías
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('temas')}
          className={`flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'temas'
              ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          Temas Vision
        </button>
      </div>

      {activeTab === 'empresa' && (
        <div className="animate-fadeIn">
          <CompanyAccountSettings />
        </div>
      )}

      {activeTab === 'categorias' && (
        <div className="space-y-4 animate-fadeIn">
          {/* Add Category */}
          <GlassPanel className="p-4 bg-slate-900/80 border-white/10" noHover>
            <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 mb-3">Agregar Nueva Categoría</h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                placeholder="Nombre de categoría (ej: Calzados, Accesorios)"
                className="flex-1 p-2.5 bg-slate-950 border border-white/10 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-md shadow-purple-600/20"
              >
                <Icon name="Plus" size={14} /> Agregar
              </button>
            </div>
          </GlassPanel>

          {/* List of categories */}
          <div className="space-y-2">
            {categories.map((cat) => (
              <GlassPanel key={cat.id} className="p-3.5 bg-slate-900/80 border-white/8" noHover>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Icon name={cat.icon} size={16} className="text-cyan-400" />
                    <span className="font-black text-sm text-white">{cat.name}</span>
                    <span className="text-[10px] text-slate-400 font-mono">({cat.subCategories.length} sub-filtros)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCatId(selectedCatId === cat.id ? null : cat.id)}
                      className="py-1 px-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[11px] font-bold cursor-pointer"
                    >
                      {selectedCatId === cat.id ? 'Ocultar' : 'Editar Subcategorías'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 cursor-pointer"
                    >
                      <Icon name="Trash" size={13} />
                    </button>
                  </div>
                </div>

                {selectedCatId === cat.id && (
                  <div className="mt-3 pt-3 border-t border-white/6 space-y-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                        placeholder="Nueva subcategoría..."
                        className="flex-1 p-2 bg-slate-950 border border-white/10 rounded-lg text-xs text-white"
                      />
                      <button
                        type="button"
                        onClick={handleAddSubCategory}
                        className="py-2 px-3 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold cursor-pointer"
                      >
                        + Añadir
                      </button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {cat.subCategories.map((sub) => (
                        <span
                          key={sub.id}
                          className="px-2.5 py-1 rounded-lg bg-white/5 text-slate-300 text-[11px] font-bold flex items-center gap-1.5 border border-white/10"
                        >
                          {sub.name}
                          <button
                            type="button"
                            onClick={() => handleDeleteSubCategory(cat.id, sub.id)}
                            className="text-slate-500 hover:text-rose-400 cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </GlassPanel>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'temas' && (
        <div className="grid grid-cols-2 gap-3 animate-fadeIn">
          {MESH_THEMES.map((theme: MeshTheme) => (
            <button
              key={theme.id}
              type="button"
              onClick={() => onThemeChange(theme.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                currentThemeId === theme.id
                  ? 'border-cyan-400 bg-slate-800 shadow-lg shadow-cyan-500/20 scale-[1.02]'
                  : 'border-white/10 bg-slate-900/80 hover:bg-slate-800/80'
              }`}
            >
              <div className="flex gap-1.5 mb-2">
                {theme.colors.map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                ))}
              </div>
              <h4 className="font-black text-xs text-white uppercase">{theme.name}</h4>
              {currentThemeId === theme.id && (
                <span className="text-[10px] font-bold text-cyan-400 mt-1 block">● Tema Activo</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
