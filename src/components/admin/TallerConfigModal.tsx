import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOrders } from '../../context/OrderContext';
import { TallerConfig } from '../../types/database.types';
import { ShalomApiService } from '../../services/shalomApiService';
import { X, Settings, Save, Store, Phone, MapPin, Check, Eye, EyeOff, Copy } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export const TallerConfigModal: React.FC<Props> = ({ onClose }) => {
  const { tallerConfig, updateTallerConfig } = useOrders();
  const [formData, setFormData] = useState<TallerConfig>(tallerConfig);
  const [saved, setSaved] = useState(false);
  const [testingShalom, setTestingShalom] = useState(false);
  const [testStatus, setTestStatus] = useState<{ valid: boolean; message: string } | null>(null);
  const [showCopilotPass, setShowCopilotPass] = useState(false);
  const [copiedPass, setCopiedPass] = useState(false);


  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleTestShalom = async () => {
    if (!formData.shalom_email || !formData.shalom_password) return;
    setTestingShalom(true);
    setTestStatus(null);
    try {
      const res = await ShalomApiService.testShalomAuth({
        email: formData.shalom_email,
        password: formData.shalom_password,
      });
      setTestStatus(res);
    } catch (err: any) {
      setTestStatus({ valid: false, message: err.message || 'Error de conexión' });
    } finally {
      setTestingShalom(false);
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateTallerConfig(formData);
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
    }, 1500);
  };

  return createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn" data-no-print="true">
      <div className="relative w-full max-w-md rounded-3xl glass-panel p-6 border border-slate-700 shadow-2xl">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-slate-800 text-pink-400">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Configuración de Encomi Envíos</h3>
              <p className="text-xs text-slate-400">Datos de Remitente para Guías y Despachos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800 hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Comercial / Remitente</label>
            <input
              type="text"
              required
              value={formData.nombre_taller}
              onChange={e => setFormData({ ...formData, nombre_taller: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-yellow-950/20 border border-yellow-500/30 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-300">
              <span>🏢</span>
              <span>Datos Oficiales de Quien Envía (Remitente)</span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">DNI / RUC Remitente</label>
                <input
                  type="text"
                  required
                  value={formData.remitente_dni || formData.ruc_dni || ''}
                  onChange={e => setFormData({ ...formData, remitente_dni: e.target.value, ruc_dni: e.target.value })}
                  placeholder="42020312"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-yellow-400"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Celular Remitente</label>
                <input
                  type="text"
                  required
                  value={formData.remitente_celular || formData.celular_taller || ''}
                  onChange={e => setFormData({ ...formData, remitente_celular: e.target.value, celular_taller: e.target.value })}
                  placeholder="927781412"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs font-mono font-bold text-white focus:outline-none focus:border-yellow-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Correo Electrónico Remitente (Olva / Comprobantes)</label>
              <input
                type="email"
                required
                value={formData.remitente_email || ''}
                onChange={e => setFormData({ ...formData, remitente_email: e.target.value })}
                placeholder="comikidsperu@gmail.com"
                className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-yellow-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Dirección del Taller (Origen Shalom)</label>
            <input
              type="text"
              required
              value={formData.direccion_taller}
              onChange={e => setFormData({ ...formData, direccion_taller: e.target.value })}
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Ciudad Origen Shalom</label>
              <input
                type="text"
                required
                value={formData.ciudad_origen || 'LIMA'}
                onChange={e => setFormData({ ...formData, ciudad_origen: e.target.value.toUpperCase() })}
                placeholder="LIMA"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Agencia Shalom Origen</label>
              <input
                type="text"
                required
                value={formData.agencia_shalom_origen || 'AV MEXICO CO'}
                onChange={e => setFormData({ ...formData, agencia_shalom_origen: e.target.value.toUpperCase() })}
                placeholder="AV MEXICO CO"
                className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
              />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5" />
                <span>Credenciales de Shalom Pro (API)</span>
              </span>
              {testStatus && (
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  testStatus.valid ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {testStatus.valid ? '✓ Conectado' : '✕ Error'}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Email Shalom Pro</label>
                <input
                  type="email"
                  value={formData.shalom_email || ''}
                  onChange={e => setFormData({ ...formData, shalom_email: e.target.value })}
                  placeholder="usuario@gmail.com"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Contraseña Shalom Pro</label>
                <input
                  type="password"
                  value={formData.shalom_password || ''}
                  onChange={e => setFormData({ ...formData, shalom_password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={handleTestShalom}
              disabled={testingShalom || !formData.shalom_email || !formData.shalom_password}
              className="w-full py-1.5 px-3 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {testingShalom ? (
                <>
                  <div className="w-3 h-3 border-2 border-cyan-300 border-t-transparent rounded-full animate-spin" />
                  <span>Verificando con Shalom Pro...</span>
                </>
              ) : (
                <span>Probar Conexión con Shalom Pro</span>
              )}
            </button>

            {testStatus && (
              <p className={`text-[10px] leading-tight ${testStatus.valid ? 'text-emerald-300' : 'text-rose-300'}`}>
                {testStatus.message}
              </p>
            )}
          </div>

          {/* Vinculación de Sub-QR y Seguridad del Copiloto IA */}
          <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Store className="w-3.5 h-3.5 text-purple-400" />
                <span>Vinculación de Sub-QR & Seguridad Copiloto IA</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Límite: 500k tokens/día
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Instancia Sub-QR</label>
                <input
                  type="text"
                  value={formData.copilot_sub_instance || 'tenant_Comikids'}
                  onChange={e => setFormData({ ...formData, copilot_sub_instance: e.target.value })}
                  placeholder="tenant_Comikids"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] text-slate-300 mb-1">Teléfono Emisor Sub-QR</label>
                <input
                  type="text"
                  value={formData.copilot_owner_phone || '51927781412'}
                  onChange={e => setFormData({ ...formData, copilot_owner_phone: e.target.value })}
                  placeholder="51927781412"
                  className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-300">Contraseña de Seguridad Copiloto IA (WhatsApp)</label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(formData.copilot_password || '989834969MI');
                      setCopiedPass(true);
                      setTimeout(() => setCopiedPass(false), 2000);
                    }}
                    className="text-[10px] text-purple-300 hover:text-white px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedPass ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedPass ? '¡Copiada!' : 'Copiar'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCopilotPass(!showCopilotPass)}
                    className="text-[10px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 flex items-center gap-1 cursor-pointer"
                  >
                    {showCopilotPass ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showCopilotPass ? 'Ocultar' : 'Ver'}</span>
                  </button>
                </div>
              </div>
              <div className="relative">
                <input
                  type={showCopilotPass ? 'text' : 'password'}
                  value={formData.copilot_password || '989834969MI'}
                  onChange={e => setFormData({ ...formData, copilot_password: e.target.value })}
                  placeholder="989834969MI"
                  className="w-full px-3 py-2 bg-slate-900 border border-purple-500/50 rounded-xl text-xs text-amber-300 font-mono font-bold tracking-wider focus:outline-none focus:border-purple-400 shadow-inner"
                />
              </div>
              <div className="mt-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2 text-[10px] text-amber-200/90 leading-tight">
                <span className="text-xs">🔑</span>
                <span>
                  <strong>Contraseña actual:</strong> <code className="px-1 py-0.5 bg-slate-900 rounded font-bold text-amber-300 font-mono select-all">{formData.copilot_password || '989834969MI'}</code>. Ingrésala cuando el bot de WhatsApp te pida la clave para conectar con <strong>Comikids</strong>.
                </span>
              </div>
            </div>
          </div>


          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">WhatsApp para Pedidos y Clientes</label>
            <input
              type="text"
              required
              value={formData.whatsapp_pedidos}
              onChange={e => setFormData({ ...formData, whatsapp_pedidos: e.target.value })}
              placeholder="51987654321"
              className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-pink-500"
            />
            <p className="text-[10px] text-slate-400 mt-1">Con código de país (Ej: 51987654321)</p>
          </div>


          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs shadow-lg shadow-pink-600/30 transition-all flex items-center justify-center gap-2 mt-4"
          >
            {saved ? (
              <>
                <Check className="w-4 h-4 text-white" />
                <span>¡Guardado Correctamente!</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </>
            )}
          </button>

        </form>

      </div>
    </div>,
    document.body
  );
};
