import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { GlassPanel } from './components/ui/GlassPanel';
import { Icon } from './components/ui/Icon';
import { MeshBackground } from './components/ui/MeshBackground';
import { MESH_THEMES } from './data/initialData';
import { ProductItem } from './modules/inventory/ProductItem';
import { ProductFormModal } from './modules/inventory/ProductFormModal';
import { TransactionModal, MultiVariantCommitItem } from './modules/inventory/TransactionModal';
import { CategoryFilter } from './modules/inventory/CategoryFilter';
import { SessionSummaryModal } from './modules/analytics/SessionSummaryModal';
import { SessionDetailsModal } from './modules/analytics/SessionDetailsModal';
import { ConfirmationModal } from './modules/live/ConfirmationModal';
import { AnalyticsDashboard } from './modules/analytics/AnalyticsDashboard';
import { SettingsView } from './modules/inventory/SettingsView';
import { inventoryService } from './services/inventoryService';
import { yapeReaderService } from '../../services/yapeReaderService';
import { liveSessionService, LiveSessionState } from '../../services/liveSessionService';
import { Product, Category, HistoryItem, Session } from './types';
import { Volume2, Sparkles, Plus, Archive, Radio, BarChart3, Settings as SettingsIcon, Package } from 'lucide-react';

export const ComicInventoryApp: React.FC = () => {
  const [products, setProducts] = useState<Product[]>(() => inventoryService.getProducts());
  const [categories, setCategories] = useState<Category[]>(() => inventoryService.getCategories());
  const [history, setHistory] = useState<HistoryItem[]>(() => inventoryService.getHistory());
  const [sessions, setSessions] = useState<Session[]>(() => inventoryService.getSessions());
  const [themeId, setThemeId] = useState<string>(() => inventoryService.getThemePreference());

  const [activeTab, setActiveTab] = useState<'inventory' | 'analytics' | 'settings' | 'archived'>('inventory');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeSubCategory, setActiveSubCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Live session state from global persistent service
  const [liveState, setLiveState] = useState<LiveSessionState>(() => liveSessionService.getState());
  const isLiveMode = liveState.isLive;
  const currentSessionId = liveState.sessionId;
  const sessionStartTime = liveState.startTime;
  const liveSessionStats = { sold: liveState.sold, revenue: liveState.revenue };

  useEffect(() => {
    const unsub = liveSessionService.subscribe((state) => {
      setLiveState(state);
    });
    return unsub;
  }, []);

  // Modals state
  const [modalConfig, setModalConfig] = useState<{ product: Product; mode: 'sale' | 'restock' | 'production' } | null>(null);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [confirmationConfig, setConfirmationConfig] = useState<any>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [showSessionDetails, setShowSessionDetails] = useState(false);

  // Yape voice listener status
  const [yapeGranted, setYapeGranted] = useState(false);

  useEffect(() => {
    yapeReaderService.isGranted().then(setYapeGranted);
  }, []);

  // Save changes
  useEffect(() => {
    inventoryService.saveProducts(products);
  }, [products]);

  useEffect(() => {
    inventoryService.saveCategories(categories);
  }, [categories]);

  useEffect(() => {
    inventoryService.saveHistory(history);
  }, [history]);

  useEffect(() => {
    inventoryService.saveSessions(sessions);
  }, [sessions]);

  const currentTheme = useMemo(
    () => MESH_THEMES.find((t) => t.id === themeId) || MESH_THEMES[0],
    [themeId]
  );

  const handleThemeChange = (id: string) => {
    setThemeId(id);
    inventoryService.saveThemePreference(id);
  };

  const totalStock = useMemo(
    () =>
      products.reduce(
        (acc, p) => acc + (p.variants?.reduce((vAcc, v) => vAcc + (v.stock || 0), 0) || 0),
        0
      ),
    [products]
  );

  const inventoryValue = useMemo(
    () =>
      products.reduce(
        (acc, p) =>
          acc +
          (p.variants?.reduce((vAcc, v) => vAcc + (v.stock || 0) * (v.price || p.price || 0), 0) || 0),
        0
      ),
    [products]
  );

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (p.isArchived) return false;
      if (activeCategory && p.categoryId !== activeCategory) return false;
      if (activeSubCategory && p.subCategoryId !== activeSubCategory) return false;
      if (searchQuery.trim() && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [products, activeCategory, activeSubCategory, searchQuery]);

  const archivedProducts = useMemo(() => {
    return products.filter((p) => p.isArchived);
  }, [products]);

  const updateStock = (productId: string, variantId: string, delta: number) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        const newVariants =
          p.variants?.map((v) => {
            if (v.id !== variantId) return v;
            return { ...v, stock: Math.max(0, (v.stock || 0) + delta) };
          }) || [];
        return { ...p, variants: newVariants };
      })
    );
  };

  const handleTransaction = (
    productId: string,
    variantId: string,
    quantity: number,
    mode: 'sale' | 'restock' | 'production',
    transactionPrice?: number
  ) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const vari = prod.variants?.find((v) => v.id === variantId);
    if (!vari) return;

    const finalPrice = transactionPrice || vari.price || prod.price || 0;
    const finalCost = vari.cost || prod.cost || 0;

    if (mode === 'sale' && isLiveMode) {
      liveSessionService.updateLiveStats(quantity, quantity * finalPrice);
    }

    const newItem: HistoryItem = {
      id: Date.now() + Math.random(),
      type: mode === 'production' ? 'restock' : mode,
      productId,
      variantId,
      product: prod.name,
      variant: `${vari.size} - ${vari.color}`,
      qty: quantity,
      price: finalPrice,
      cost: finalCost,
      time: Date.now(),
      sessionDate: isLiveMode ? sessionStartTime : null,
      sessionId: isLiveMode ? currentSessionId : null
    };

    setHistory((prev) => [...prev, newItem]);
    updateStock(productId, variantId, mode === 'sale' ? -quantity : quantity);
    setModalConfig(null);
  };

  // Commit múltiple de variantes desde TransactionModal
  const handleCommitMulti = (
    productId: string,
    items: MultiVariantCommitItem[],
    mode: 'sale' | 'restock' | 'production'
  ) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;

    const now = Date.now();
    const newHistoryItems: HistoryItem[] = [];

    items.forEach((item) => {
      const vari = prod.variants?.find((v) => v.id === item.variantId);
      if (!vari) return;

      const finalPrice = item.price || vari.price || prod.price || 0;
      const finalCost = vari.cost || prod.cost || 0;

      if (mode === 'sale' && isLiveMode) {
        liveSessionService.updateLiveStats(item.quantity, item.quantity * finalPrice);
      }

      newHistoryItems.push({
        id: now + Math.random(),
        type: mode === 'production' ? 'restock' : mode,
        productId,
        variantId: item.variantId,
        product: prod.name,
        variant: `${vari.size} - ${vari.color}`,
        qty: item.quantity,
        price: finalPrice,
        cost: finalCost,
        time: now,
        sessionDate: isLiveMode ? sessionStartTime : null,
        sessionId: isLiveMode ? currentSessionId : null
      });

      updateStock(productId, item.variantId, mode === 'sale' ? -item.quantity : item.quantity);
    });

    setHistory((prev) => [...prev, ...newHistoryItems]);
    setModalConfig(null);
  };

  // Actualización profunda de venta desde SessionDetailsModal
  const handleUpdateSaleDetails = (
    saleItem: HistoryItem,
    newVariantId: string,
    newQty: number,
    newPrice: number
  ) => {
    const prod = products.find((p) => p.id === saleItem.productId);
    if (!prod) return;

    const oldTotal = (saleItem.price || 0) * (saleItem.qty || 0);
    const newTotal = (newPrice || 0) * (newQty || 0);
    const diffRevenue = newTotal - oldTotal;

    // Revertir stock previo
    updateStock(saleItem.productId, saleItem.variantId, saleItem.qty);
    // Aplicar nuevo stock
    updateStock(saleItem.productId, newVariantId, -newQty);

    const newVari = prod.variants?.find((v) => v.id === newVariantId);
    const variantName = newVari ? `${newVari.size} - ${newVari.color}` : saleItem.variant;

    setHistory((prev) =>
      prev.map((item) => {
        if (item.id !== saleItem.id) return item;
        return {
          ...item,
          variantId: newVariantId,
          variant: variantName,
          qty: newQty,
          price: newPrice,
          cost: newVari?.cost || prod.cost || 0
        };
      })
    );

    liveSessionService.updateLiveStats(newQty - saleItem.qty, diffRevenue);
  };

  const handleDeleteSale = (saleItem: HistoryItem) => {
    setHistory((prev) => prev.filter((item) => item.id !== saleItem.id));
    liveSessionService.updateLiveStats(-saleItem.qty, -(saleItem.qty * saleItem.price));
    updateStock(saleItem.productId, saleItem.variantId, saleItem.qty);
  };

  const handleSaveProduct = (productData: Partial<Product>) => {
    if (editingProduct) {
      setProducts((prev) =>
        prev.map((p) => (p.id === editingProduct.id ? ({ ...p, ...productData } as Product) : p))
      );
    } else {
      setProducts((prev) => [productData as Product, ...prev]);
    }
    setIsFormModalOpen(false);
    setEditingProduct(null);
  };

  const openEditModal = useCallback((product: Product) => {
    setEditingProduct(product);
    setIsFormModalOpen(true);
  }, []);

  const openModal = useCallback((product: Product, mode: 'sale' | 'restock' | 'production') => {
    setModalConfig({ product, mode });
  }, []);

  const requestToggleLiveMode = useCallback(() => {
    if (!isLiveMode) {
      setConfirmationConfig({
        type: 'start',
        title: '¿Iniciar Modo TikTok Live?',
        message: 'Se activará el modo de venta rápida de prendas y el monitor de pagos Yape.',
        onConfirm: () => {
          liveSessionService.startLive();
          setConfirmationConfig(null);
        }
      });
    } else {
      setConfirmationConfig({
        type: 'end',
        title: '¿Cerrar Sesión Live?',
        message: `Has vendido S/ ${liveSessionStats.revenue.toLocaleString()} en esta transmisión.`,
        onConfirm: () => {
          setConfirmationConfig(null);
          setShowSummaryModal(true);
        }
      });
    }
  }, [isLiveMode, liveSessionStats.revenue]);

  const handleFinishSession = useCallback(
    (notes: string) => {
      const newSession: Session = {
        id: currentSessionId || Date.now(),
        startTime: sessionStartTime || Date.now(),
        endTime: Date.now(),
        totalSold: liveSessionStats.sold,
        totalRevenue: liveSessionStats.revenue,
        notes
      };
      setSessions((prev) => [...prev, newSession]);
      liveSessionService.endLive();
      setShowSummaryModal(false);
    },
    [currentSessionId, sessionStartTime, liveSessionStats]
  );

  const handleArchiveProduct = (productId: string, isArchived = true) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === productId ? { ...p, isArchived } : p))
    );
  };

  const handleDeleteProduct = (productId: string) => {
    if (window.confirm('¿Seguro que deseas eliminar este producto del catálogo?')) {
      setProducts((prev) => prev.filter((p) => p.id !== productId));
    }
  };

  return (
    <div className="relative w-full min-h-[90vh] text-white flex flex-col transition-colors duration-500 rounded-3xl overflow-hidden bg-slate-950/95 border border-white/10 shadow-2xl p-3 sm:p-6 text-left">
      {/* Background ambient lighting */}
      <MeshBackground isLiveMode={isLiveMode} theme={currentTheme} />

      {/* Comic Inventory Header & Mode Toggles */}
      <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isLiveMode ? 'bg-rose-500 animate-ping' : 'bg-cyan-400'
              }`}
            />
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              {isLiveMode ? '🔴 MODO TIKTOK LIVE ACTIVO' : '📦 GESTIÓN DE TALLER & PRENDAS'}
            </p>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <span>Comic<span className="text-cyan-400">.Inventory</span></span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
              ComiKids Pro
            </span>
          </h1>
        </div>

        {/* Action Buttons in HUD */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Yape Native Voice Status Pill */}
          <button
            type="button"
            onClick={() => yapeReaderService.requestPermission()}
            className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              yapeGranted
                ? 'bg-purple-600/20 border-purple-400/50 text-purple-300 hover:bg-purple-600/30'
                : 'bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30'
            }`}
            title="Lector nativo de pagos Yape por voz con WakeLock"
          >
            <Volume2 className="w-3.5 h-3.5" />
            <span>{yapeGranted ? '🔊 Yape Voz Activo' : '⚠️ Activar Permiso Yape'}</span>
          </button>

          {!isLiveMode && (
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === 'archived' ? 'inventory' : 'archived')}
              className={`px-3 py-1.5 rounded-full border text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'archived'
                  ? 'bg-amber-600 border-amber-400 text-white shadow-md'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Archive className="w-3.5 h-3.5" />
              <span>{activeTab === 'archived' ? 'Volver' : 'Archivados'}</span>
            </button>
          )}

          {/* TikTok Live Toggle Button */}
          <button
            type="button"
            onClick={requestToggleLiveMode}
            className={`px-4 py-1.5 rounded-full border text-xs font-black flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-lg ${
              isLiveMode
                ? 'bg-linear-to-r from-rose-600 to-pink-600 border-rose-400 text-white shadow-rose-900/40 animate-pulse'
                : 'bg-linear-to-r from-cyan-600 to-blue-600 border-cyan-400 text-white shadow-cyan-900/30'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{isLiveMode ? 'LIVE ACTIVO' : 'TRANSMITIR LIVE'}</span>
          </button>
        </div>
      </div>

      {/* Live Mode In-Session Bar */}
      {isLiveMode && (
        <div className="relative z-20 mb-4 animate-slideDown">
          <GlassPanel
            className="p-3.5 bg-linear-to-r from-rose-950/80 via-slate-900 to-slate-900 border-rose-500/40 shadow-xl"
            noHover
          >
            <div className="flex justify-between items-center w-full flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-rose-500/20 rounded-2xl flex items-center justify-center border border-rose-500/30 text-rose-400 text-lg font-black font-mono">
                  S/
                </div>
                <div>
                  <p className="text-[10px] uppercase text-rose-300 font-bold tracking-wider">
                    Ventas TikTok Live en Tiempo Real
                  </p>
                  <p className="text-xl sm:text-2xl font-black text-white font-mono leading-tight">
                    S/ {liveSessionStats.revenue.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 ml-2">
                      ({liveSessionStats.sold} prendas)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowSessionDetails(true)}
                  className="py-2 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 text-xs font-bold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <SettingsIcon className="w-3.5 h-3.5 text-cyan-300" />
                  <span>Ajustar Ventas</span>
                </button>
              </div>
            </div>
          </GlassPanel>
        </div>
      )}

      {/* Main Sub-Navigation Bar */}
      {!isLiveMode && (
        <div className="relative z-20 flex p-1 bg-slate-900/90 rounded-2xl border border-white/10 mb-4">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Prendas ({filteredProducts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analytics')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'analytics'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Métricas & Yape 📱</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'settings'
                ? 'bg-pink-600 text-white shadow-md shadow-pink-600/30 scale-[1.02]'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SettingsIcon className="w-4 h-4" />
            <span>Ajustes & Taller</span>
          </button>
        </div>
      )}

      {/* Inventory KPI Cards (Only in Inventory tab) */}
      {!isLiveMode && activeTab === 'inventory' && (
        <div className="relative z-20 grid grid-cols-2 gap-3 mb-4">
          <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Stock Total en Taller</p>
            <p className="text-2xl font-black text-white font-mono mt-1">{totalStock} prendas</p>
          </GlassPanel>

          <GlassPanel className="p-3.5 bg-slate-900/80 border-white/8" noHover>
            <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Valor Estimado</p>
            <p className="text-2xl font-black text-emerald-400 font-mono mt-1">S/ {inventoryValue.toLocaleString()}</p>
          </GlassPanel>
        </div>
      )}

      {/* Category & Search Filter Bar (in inventory and live mode) */}
      {(activeTab === 'inventory' || isLiveMode) && (
        <div className="relative z-20 space-y-2 mb-4">
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Buscar prenda por nombre o talla..."
              className="flex-1 p-2.5 bg-slate-900/90 border border-white/10 rounded-2xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-bold"
            />
            {!isLiveMode && (
              <button
                type="button"
                onClick={() => {
                  setEditingProduct(null);
                  setIsFormModalOpen(true);
                }}
                className="py-2.5 px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Nueva Prenda</span>
              </button>
            )}
          </div>

          <CategoryFilter
            categories={categories}
            activeCategory={activeCategory}
            activeSubCategory={activeSubCategory}
            onSelectCategory={setActiveCategory}
            onSelectSubCategory={setActiveSubCategory}
            isLive={isLiveMode}
          />
        </div>
      )}

      {/* Content Rendering by Active Tab */}
      <div className="relative z-20 flex-1">
        {activeTab === 'analytics' && !isLiveMode ? (
          <AnalyticsDashboard history={history} sessions={sessions} products={products} />
        ) : activeTab === 'settings' && !isLiveMode ? (
          <SettingsView
            categories={categories}
            setCategories={setCategories}
            onReset={() => setCategories([])}
            currentThemeId={themeId}
            onThemeChange={handleThemeChange}
          />
        ) : activeTab === 'archived' && !isLiveMode ? (
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400">Prendas Archivadas</h3>
            {archivedProducts.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 bg-white/3 rounded-2xl border border-white/5">
                No hay prendas archivadas.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {archivedProducts.map((p) => (
                  <ProductItem
                    key={p.id}
                    item={p}
                    isLiveMode={false}
                    openModal={openModal}
                    openEditModal={openEditModal}
                    onArchive={handleArchiveProduct}
                    onDelete={handleDeleteProduct}
                    categories={categories}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Main Products Grid */
          <div className="space-y-3">
            {filteredProducts.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-400 bg-white/3 rounded-3xl border border-white/5 space-y-3">
                <Sparkles className="w-8 h-8 text-cyan-400 mx-auto opacity-60" />
                <p className="font-bold">No se encontraron prendas con los filtros seleccionados.</p>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProduct(null);
                    setIsFormModalOpen(true);
                  }}
                  className="py-2 px-4 rounded-xl bg-cyan-500 text-slate-950 text-xs font-black cursor-pointer shadow-md"
                >
                  + Agregar Nueva Prenda
                </button>
              </div>
            ) : (
              <div
                className={`grid gap-3 ${
                  isLiveMode
                    ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                }`}
              >
                {filteredProducts.map((p) => (
                  <ProductItem
                    key={p.id}
                    item={p}
                    isLiveMode={isLiveMode}
                    openModal={openModal}
                    openEditModal={openEditModal}
                    onArchive={handleArchiveProduct}
                    onDelete={handleDeleteProduct}
                    categories={categories}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      {modalConfig && (
        <TransactionModal
          product={products.find((p) => p.id === modalConfig.product.id)!}
          mode={modalConfig.mode}
          onClose={() => setModalConfig(null)}
          onCommit={handleTransaction}
          onCommitMulti={handleCommitMulti}
        />
      )}

      {isFormModalOpen && (
        <ProductFormModal
          onClose={() => setIsFormModalOpen(false)}
          onSave={handleSaveProduct}
          initialData={editingProduct}
          categories={categories}
        />
      )}

      {confirmationConfig && (
        <ConfirmationModal
          config={confirmationConfig}
          onClose={() => setConfirmationConfig(null)}
        />
      )}

      {showSummaryModal && (
        <SessionSummaryModal
          stats={liveSessionStats}
          onClose={() => setShowSummaryModal(false)}
          onSave={handleFinishSession}
        />
      )}

      {showSessionDetails && (
        <SessionDetailsModal
          currentSessionHistory={history.filter((h) => h.sessionId === currentSessionId)}
          products={products}
          onClose={() => setShowSessionDetails(false)}
          onUpdateSaleDetails={handleUpdateSaleDetails}
          onDeleteSale={handleDeleteSale}
        />
      )}
    </div>
  );
};
