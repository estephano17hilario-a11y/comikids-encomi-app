import React, { useMemo, useState } from 'react';
import { Smartphone, Settings as SettingsIcon, Palette, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CompanyAccountSettings } from '../../components/admin/CompanyAccountSettings';
import { MeshBackground } from './ui/MeshBackground';
import { YapesAnalyticsView } from './YapesAnalyticsView';
import { MESH_THEMES, MeshTheme, getThemePreference, saveThemePreference } from './themes';

type YapeTab = 'yape' | 'ajustes';
type AjustesTab = 'empresa' | 'temas';

// Sección Yape del panel de empresa: pagos recibidos por Yape + sus ajustes.
// (Reemplaza al antiguo módulo de inventario de prendas / TikTok Live.)
export const YapeSection: React.FC = () => {
  const { currentEmpresa, currentUser } = useAuth();
  const empresaId = currentEmpresa?.id || currentUser?.id || 'empresa-master-comikids';

  const [activeTab, setActiveTab] = useState<YapeTab>('yape');
  const [ajustesTab, setAjustesTab] = useState<AjustesTab>('empresa');
  const [themeId, setThemeId] = useState<string>(() => getThemePreference(empresaId));

  const currentTheme = useMemo(
    () => MESH_THEMES.find(t => t.id === themeId) || MESH_THEMES[0],
    [themeId]
  );

  const handleThemeChange = (id: string) => {
    setThemeId(id);
    saveThemePreference(id, empresaId);
  };

  const tabs: { id: YapeTab; label: string; icon: React.ElementType; active: string }[] = [
    { id: 'yape', label: 'Pagos Yape', icon: Smartphone, active: 'bg-purple-600 text-white shadow-md shadow-purple-600/30' },
    { id: 'ajustes', label: 'Ajustes', icon: SettingsIcon, active: 'bg-pink-600 text-white shadow-md shadow-pink-600/30' },
  ];

  return (
    <div className="relative w-full min-h-[80vh] text-white flex flex-col rounded-3xl overflow-hidden bg-slate-950/95 border border-white/10 shadow-2xl p-3 sm:p-6 text-left">
      <MeshBackground isLiveMode={false} theme={currentTheme} />

      {/* Encabezado */}
      <div className="relative z-20 flex items-center gap-3 border-b border-white/10 pb-4 mb-4">
        <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-500/30 text-purple-300 flex items-center justify-center shrink-0">
          <Smartphone className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-tight">Yape</h1>
          <p className="text-xs text-slate-400 truncate">Pagos recibidos y configuración de la cuenta</p>
        </div>
      </div>

      {/* Pestañas */}
      <div className="relative z-20 flex p-1 bg-slate-900/90 rounded-2xl border border-white/10 mb-4" role="tablist" aria-label="Secciones de Yape">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-h-11 px-3 rounded-xl text-sm font-black flex items-center justify-center gap-2 transition-all ${
                isActive ? tab.active : 'text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="relative z-20 flex-1">
        {activeTab === 'yape' ? (
          <YapesAnalyticsView />
        ) : (
          <div className="space-y-4 animate-fadeIn">
            <div className="flex p-1 bg-slate-900 rounded-2xl border border-white/10">
              {([
                { id: 'empresa', label: 'Empresa & Yape', icon: Building2 },
                { id: 'temas', label: 'Temas', icon: Palette },
              ] as { id: AjustesTab; label: string; icon: React.ElementType }[]).map(t => {
                const Icon = t.icon;
                const isActive = ajustesTab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setAjustesTab(t.id)}
                    aria-pressed={isActive}
                    className={`flex-1 min-h-10 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all ${
                      isActive ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>

            {ajustesTab === 'empresa' ? (
              <CompanyAccountSettings />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {MESH_THEMES.map((theme: MeshTheme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleThemeChange(theme.id)}
                    aria-pressed={themeId === theme.id}
                    className={`p-4 rounded-2xl border text-left transition-all ${
                      themeId === theme.id
                        ? 'border-cyan-400 bg-slate-800 shadow-lg shadow-cyan-500/20'
                        : 'border-white/10 bg-slate-900/80 hover:bg-slate-800/80'
                    }`}
                  >
                    <div className="flex gap-1.5 mb-2">
                      {theme.colors.map((c, i) => (
                        <div key={i} className="w-5 h-5 rounded-full border border-white/20" style={{ backgroundColor: c }} />
                      ))}
                    </div>
                    <h4 className="font-black text-xs text-white uppercase">{theme.name}</h4>
                    {themeId === theme.id && (
                      <span className="text-[11px] font-bold text-cyan-400 mt-1 block">● Tema activo</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
