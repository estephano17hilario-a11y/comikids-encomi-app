import React, { useState, useEffect, useRef } from 'react';
import { Icon } from '../../components/ui/Icon';
import { Product, Category, Variant } from '../../types';
import { Camera, Image as ImageIcon, Trash2, Plus, Upload } from 'lucide-react';

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
      ? initialData.variants.map((v) => ({
          ...v,
          price: v.price !== undefined ? v.price.toString() : '',
          cost: v.cost !== undefined ? v.cost.toString() : ''
        }))
      : [{ id: Date.now().toString(), size: 'M', color: 'Negro', stock: 10, price: '', cost: '' }]
  );

  const [isPack, setIsPack] = useState(initialData ? initialData.isPack || false : false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setSelectedImage(canvas.toDataURL('image/jpeg', 0.85));
        }
      };
      if (typeof event.target?.result === 'string') img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

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
    setVariants((prev) => prev.map((v, i) => (i === index ? { ...v, [field]: value } : v)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanedVariants: Variant[] = variants.map((v) => ({
      id: v.id || Date.now().toString() + Math.random(),
      size: v.size || 'STD',
      color: v.color || 'Único',
      stock: Number(v.stock) || 0,
      price: v.price && v.price !== '' ? Number(v.price) : Number(basePrice) || 0,
      cost: v.cost && v.cost !== '' ? Number(v.cost) : Number(baseCost) || 0
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
          {/* Foto de la prenda */}
          <div className="p-3 bg-white/4 rounded-2xl border border-white/8">
            <label className="text-[11px] uppercase font-bold text-slate-300 block mb-2 flex items-center justify-between">
              <span>📸 Foto de la Prenda</span>
              {selectedImage && (
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="text-rose-400 hover:text-rose-300 text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Quitar Foto
                </button>
              )}
            </label>

            <div className="flex items-center gap-4">
              {selectedImage ? (
                <div className="relative w-20 h-20 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-md shrink-0">
                  <img src={selectedImage} alt="Previsualización" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-20 h-20 rounded-2xl bg-black/40 border border-dashed border-white/20 flex flex-col items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon className="w-6 h-6 mb-1" />
                  <span className="text-[9px]">Sin foto</span>
                </div>
              )}

              <div className="flex-1 space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImageFile}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-3 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{selectedImage ? 'Cambiar Foto' : 'Subir Foto de Galería o Cámara'}</span>
                </button>
                <p className="text-[10px] text-slate-400">Aparecerá en el catálogo, en Live y al registrar ventas.</p>
              </div>
            </div>
          </div>

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
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
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
                      <option key={sub.id} value={sub.id}>{sub.name}</option>
                    ))}
                </select>
              </div>
            </div>

            {/* Precios Base */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] uppercase font-bold text-cyan-300 block mb-1">💰 Precio Base (S/) *</label>
                <input
                  type="number"
                  required
                  step="any"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-slate-950 border border-cyan-500/30 rounded-xl text-cyan-400 font-mono text-xs font-bold focus:border-cyan-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] uppercase font-bold text-amber-400 block mb-1">🏭 Costo Base (S/)</label>
                <input
                  type="number"
                  step="any"
                  value={baseCost}
                  onChange={(e) => setBaseCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full p-3 bg-slate-950 border border-amber-500/30 rounded-xl text-amber-300 font-mono text-xs font-bold focus:border-amber-400 focus:outline-none"
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

          {/* ═══ MATRIZ DE VARIANTES CON PRECIO Y COSTO INDIVIDUAL ═══ */}
          <div className="space-y-3 pt-2 border-t border-white/8">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-[11px] uppercase font-bold text-slate-300 block">🏷️ Variantes · Precio · Costo</label>
                <p className="text-[10px] text-slate-500">Precio de venta y costo de producción por talla/color → ganancias 100% precisas</p>
              </div>
              <button
                type="button"
                onClick={handleAddVariant}
                className="py-1 px-2.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-400/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" /> Agregar
              </button>
            </div>

            <div className="space-y-2.5">
              {variants.map((v, idx) => (
                <div key={v.id || idx} className="bg-white/4 p-3 rounded-2xl border border-white/6 space-y-2">
                  {/* Fila 1: Talla · Color · Stock · Eliminar */}
                  <div className="grid grid-cols-12 gap-1.5 items-end">
                    <div className="col-span-4">
                      <label className="text-[9px] uppercase text-slate-400 block font-bold mb-1">Talla</label>
                      <input
                        type="text"
                        placeholder="S, M, XL..."
                        value={v.size}
                        onChange={(e) => handleVariantChange(idx, 'size', e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="col-span-4">
                      <label className="text-[9px] uppercase text-slate-400 block font-bold mb-1">Color</label>
                      <input
                        type="text"
                        placeholder="Negro..."
                        value={v.color}
                        onChange={(e) => handleVariantChange(idx, 'color', e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-white/10 rounded-lg text-white text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="col-span-3">
                      <label className="text-[9px] uppercase text-emerald-400 block font-bold mb-1">Stock</label>
                      <input
                        type="number"
                        placeholder="10"
                        value={v.stock}
                        onChange={(e) => handleVariantChange(idx, 'stock', e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>

                    <div className="col-span-1 flex justify-center pb-0.5">
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(idx)}
                        className="p-1.5 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar variante"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Fila 2: Precio de venta | Costo de producción */}
                  <div className="grid grid-cols-2 gap-1.5">
                    <div>
                      <label className="text-[9px] uppercase text-cyan-300 block font-bold mb-1">
                        💰 Precio Venta (S/)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder={basePrice || '0.00'}
                        value={v.price}
                        onChange={(e) => handleVariantChange(idx, 'price', e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-cyan-500/30 rounded-lg text-cyan-300 text-xs font-mono font-bold focus:border-cyan-400 focus:outline-none"
                        title="Precio de venta de esta variante (vacío = usa precio base)"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] uppercase text-amber-400 block font-bold mb-1">
                        🏭 Costo Producción (S/)
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder={baseCost || '0.00'}
                        value={v.cost}
                        onChange={(e) => handleVariantChange(idx, 'cost', e.target.value)}
                        className="w-full p-2 bg-slate-950 border border-amber-500/30 rounded-lg text-amber-300 text-xs font-mono font-bold focus:border-amber-400 focus:outline-none"
                        title="Costo real de producción → determina ganancia neta precisa"
                      />
                    </div>
                  </div>
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
