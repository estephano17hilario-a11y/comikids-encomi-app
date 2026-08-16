import React, { useState, useEffect, useMemo } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Product, Category } from '../../types';

interface ProductFormModalProps {
  onClose: () => void;
  onSave: (productData: Partial<Product>) => void;
  initialData: Product | null;
  categories: Category[];
}

export const ProductFormModal: React.FC<ProductFormModalProps> = ({ onClose, onSave, initialData, categories }) => {
  const [name, setName] = useState(initialData ? initialData.name : '');
  const [description, setDescription] = useState(initialData ? initialData.description || '' : '');
  const [selectedColor, setSelectedColor] = useState(initialData ? initialData.color || 'bg-slate-900' : 'bg-slate-900');
  const [selectedImage, setSelectedImage] = useState<string | null>(initialData ? initialData.image || null : null);

  const [categoryId, setCategoryId] = useState(initialData ? initialData.categoryId : categories[0]?.id || '');
  const [subCategoryId, setSubCategoryId] = useState(initialData ? initialData.subCategoryId || '' : '');

  const [basePrice, setBasePrice] = useState(initialData ? initialData.price.toString() : '');
  const [baseCost, setBaseCost] = useState(initialData && initialData.cost ? initialData.cost.toString() : '');

  const [variants, setVariants] = useState<any[]>(
    initialData && initialData.variants && initialData.variants.length > 0
      ? initialData.variants.map((v) => ({ ...v, cost: v.cost || '' }))
      : [{ id: Date.now().toString(), size: 'M', color: 'Negro', stock: 10, price: '', cost: '' }]
  );

  const [isPack, setIsPack] = useState(initialData ? initialData.isPack || false : false);

  const [activeBlock, setActiveBlock] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!initialData || categoryId !== initialData.categoryId) setSubCategoryId('');
  }, [categoryId, initialData]);

  useEffect(() => {
    if (!categoryId && categories.length > 0) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  const colors = [
    { class: 'bg-zinc-900', label: 'Onyx' },
    { class: 'bg-blue-900', label: 'Midnight' },
    { class: 'bg-emerald-900', label: 'Forest' },
    { class: 'bg-rose-900', label: 'Crimson' },
    { class: 'bg-purple-900', label: 'Royal' },
    { class: 'bg-amber-900', label: 'Bronze' },
    { class: 'bg-cyan-600', label: 'Cyber' },
    { class: 'bg-lime-600', label: 'Neon' },
    { class: 'bg-orange-600', label: 'Sunset' },
    { class: 'bg-indigo-600', label: 'Indigo' },
    { class: 'bg-pink-600', label: 'Sakura' },
    { class: 'bg-slate-700', label: 'Slate' }
  ];

  const handleAddVariant = () => {
    setVariants((prev) => [
      ...prev,
      { id: Date.now().toString() + Math.random(), size: 'M', color: 'Blanco', stock: 5, price: basePrice, cost: baseCost }
    ]);
  };

  const handleRemoveVariant = (index: number) => {
    if (variants.length <= 1) return;
    setVariants((prev) => prev.filter((_, i) => i !== index));
  };

  const handleVariantChange = (index: number, field: string, value: any) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanedVariants = variants.map((v) => ({
      id: v.id || Date.now().toString() + Math.random(),
      size: v.size || 'STD',
      color: v.color || 'Único',
      stock: Number(v.stock) || 0,
      price: v.price ? Number(v.price) : Number(basePrice) || 0,
      cost: v.cost ? Number(v.cost) : Number(baseCost) || 0
    }));

    const productPayload: Partial<Product> = {
      ...(initialData || {}),
      id: initialData?.id || 'prod_' + Date.now().toString(36),
      name: name.trim(),
      description: description.trim(),
      price: Number(basePrice) || 0,
      cost: Number(baseCost) || 0,
      categoryId,
      subCategoryId,
      color: selectedColor,
      image: selectedImage,
      isPack,
      variants: cleanedVariants,
      createdAt: initialData?.createdAt || Date.now()
    };

    onSave(productPayload);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-3 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-white/15 rounded-3xl overflow-hidden shadow-2xl animate-scaleUp max-h-[92vh] flex flex-col text-left"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 sm:p-5 border-b border-white/10 bg-slate-950 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-base">
              👕
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {initialData ? 'Editar Prenda / Producto' : 'Nueva Prenda en Inventario'}
              </h2>
              <p className="text-[10px] text-slate-400">Catálogo general de ComiKids y despachos</p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {/* Nombre y Descripción */}
          <div className="space-y-3">
            <div>
              <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">Nombre de la Prenda *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Polera Oversize Anime Edition"
                className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold focus:border-cyan-400 focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">Categoría *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold focus:border-cyan-400 focus:outline-none"
                >
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">Subcategoría</label>
                <select
                  value={subCategoryId}
                  onChange={(e) => setSubCategoryId(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-white text-xs font-bold focus:border-cyan-400 focus:outline-none"
                >
                  <option value="">General</option>
                  {categories
                    .find((c) => c.id === categoryId)
                    ?.subCategories.map((sub) => (
                      <option key={sub.id} value={sub.id}>
                        {sub.name}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            {/* Precios Base */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">Precio Venta (S/) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-emerald-400 font-mono text-xs font-bold focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block mb-1">Costo Taller (S/)</label>
                <input
                  type="number"
                  step="any"
                  value={baseCost}
                  onChange={(e) => setBaseCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-slate-950 border border-white/10 rounded-xl text-slate-300 font-mono text-xs font-bold focus:border-cyan-400 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Selector de Color de Tarjeta */}
          <div>
            <label className="text-[11px] uppercase font-bold text-slate-300 block mb-2">Color del Display</label>
            <div className="flex gap-2 flex-wrap">
              {colors.map((col) => (
                <button
                  key={col.class}
                  type="button"
                  onClick={() => setSelectedColor(col.class)}
                  className={`w-7 h-7 rounded-full ${col.class} border-2 transition-transform cursor-pointer ${
                    selectedColor === col.class ? 'border-white scale-125 shadow-lg' : 'border-transparent opacity-60 hover:opacity-100'
                  }`}
                  title={col.label}
                />
              ))}
            </div>
          </div>

          {/* Matriz de Variantes */}
          <div className="space-y-2 pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <label className="text-[11px] uppercase font-bold text-slate-300">Variantes & Stock</label>
              <button
                type="button"
                onClick={handleAddVariant}
                className="py-1 px-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Icon name="Plus" size={12} /> Agregar Variante
              </button>
            </div>

            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={v.id || idx} className="flex gap-2 items-center bg-white/4 p-2 rounded-xl border border-white/6">
                  <input
                    type="text"
                    placeholder="Talla (S, M, L...)"
                    value={v.size}
                    onChange={(e) => handleVariantChange(idx, 'size', e.target.value)}
                    className="w-1/4 p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-bold"
                  />
                  <input
                    type="text"
                    placeholder="Color (Negro, Rosa...)"
                    value={v.color}
                    onChange={(e) => handleVariantChange(idx, 'color', e.target.value)}
                    className="w-1/3 p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs"
                  />
                  <input
                    type="number"
                    placeholder="Stock"
                    value={v.stock}
                    onChange={(e) => handleVariantChange(idx, 'stock', e.target.value)}
                    className="w-1/4 p-2 bg-slate-950 border border-white/10 rounded-lg text-emerald-400 text-xs font-mono font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveVariant(idx)}
                    className="p-2 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                  >
                    <Icon name="Trash" size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-1/3 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="w-2/3 py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-lg shadow-cyan-500/20 cursor-pointer"
            >
              Guardar en Catálogo
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
