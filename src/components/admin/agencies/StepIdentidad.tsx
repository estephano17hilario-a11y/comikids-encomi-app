import React, { useRef } from 'react';
import { Upload, Check, Link2 } from 'lucide-react';
import { useFeedback } from '../../../context/FeedbackContext';
import { StepProps, LOGO_PRESETS, COLOR_PRESETS } from './agencyDraft';
import { StepIntro, Card, Field, inputClass, Disclosure } from './ui';

export const StepIdentidad: React.FC<StepProps> = ({ draft, update, base, accent }) => {
  const { toast } = useFeedback();
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('La imagen es muy pesada. Usa una de menos de 2 MB.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => update({ foto_url: reader.result as string });
    reader.readAsDataURL(file);
  };

  const isCustomColor = !COLOR_PRESETS.some(c => c.hex.toLowerCase() === draft.color.toLowerCase());

  return (
    <div className="space-y-5">
      <StepIntro
        emoji="🎨"
        title="Nombre y logo"
        accent={accent}
        queEs="Cuando tu clienta hace un pedido, elige cómo quiere recibirlo tocando una tarjeta como la de la vista previa. Un nombre claro y un logo conocido le dan confianza."
        pasos={['Escribe el nombre de la agencia.', 'Elige su logo o sube una foto.', 'Elige un color para reconocer sus pedidos en tu lista.']}
      />

      <Card emoji="✏️" title="1. ¿Cómo se llama?" help="Usa el nombre que tus clientas conocen. Ej: «Shalom» y no «Empresa de transportes S.A.C.»">
        <Field label="Nombre de la agencia" htmlFor="agency-name">
          <input
            id="agency-name"
            type="text"
            value={draft.nombre}
            onChange={e => update({ nombre: e.target.value })}
            placeholder="Ej: Shalom, Olva, Transportes Flores"
            className={`${inputClass} text-lg font-bold`}
          />
        </Field>
        <Field label="Frase corta debajo del nombre (opcional)" htmlFor="agency-desc" hint="Ayuda a tu clienta a decidir. Ej: Envíos a todo el Perú con recojo en agencia.">
          <input
            id="agency-desc"
            type="text"
            value={draft.descripcion}
            onChange={e => update({ descripcion: e.target.value })}
            placeholder="Ej: Envíos a todo el Perú"
            className={inputClass}
          />
        </Field>
      </Card>

      <Card emoji="🖼️" title="2. Elige su logo" description="Toca una imagen o sube la tuya desde el celular." help="El logo aparece en la tarjeta que ve tu clienta y en el rótulo que imprimes.">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="aspect-square rounded-2xl border-2 border-dashed border-cyan-400/50 bg-cyan-500/5 hover:bg-cyan-500/10 flex flex-col items-center justify-center gap-1.5 text-cyan-300"
          >
            <Upload className="w-6 h-6" />
            <span className="text-xs font-bold">Subir foto</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />

          {draft.foto_url && !LOGO_PRESETS.some(p => p.url === draft.foto_url) && (
            <div className="relative aspect-square rounded-2xl border-2 border-cyan-400 bg-white p-2 flex items-center justify-center">
              <img src={draft.foto_url} alt="Tu logo" className="w-full h-full object-contain" />
              <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center"><Check className="w-4 h-4 stroke-[3]" /></span>
            </div>
          )}

          {LOGO_PRESETS.map(p => {
            const selected = draft.foto_url === p.url;
            return (
              <button
                key={p.url}
                type="button"
                onClick={() => update({ foto_url: p.url })}
                aria-pressed={selected}
                className={`relative aspect-square rounded-2xl border-2 p-2 flex flex-col items-center justify-center gap-1 transition-colors ${
                  selected ? 'border-cyan-400 bg-white' : 'border-white/10 bg-white/90 hover:border-white/40'
                }`}
              >
                <img src={p.url} alt="" className="w-full h-3/4 object-contain" />
                <span className="text-[11px] font-bold text-slate-700 truncate max-w-full">{p.label}</span>
                {selected && <span className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center"><Check className="w-4 h-4 stroke-[3]" /></span>}
              </button>
            );
          })}
        </div>

        <Disclosure title="Pegar el link de una imagen">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-slate-500 shrink-0" />
            <input
              type="url"
              value={draft.foto_url.startsWith('data:') ? '' : draft.foto_url}
              onChange={e => update({ foto_url: e.target.value })}
              placeholder="https://..."
              className={inputClass}
            />
          </div>
          {draft.foto_url && (
            <button type="button" onClick={() => update({ foto_url: '' })} className="text-sm font-bold text-rose-300 hover:text-rose-200">
              Quitar logo
            </button>
          )}
        </Disclosure>
      </Card>

      <Card emoji="🎯" title="3. Elige su color" help={`En tu lista de pedidos, los de ${draft.nombre || base.nombre || 'esta agencia'} tendrán un borde de este color. Así sabes de un vistazo cuáles van por aquí.`}>
        <div className="flex flex-wrap gap-3">
          {COLOR_PRESETS.map(c => {
            const selected = draft.color.toLowerCase() === c.hex.toLowerCase();
            return (
              <button
                key={c.hex}
                type="button"
                onClick={() => update({ color: c.hex })}
                aria-pressed={selected}
                aria-label={c.name}
                title={c.name}
                className={`w-12 h-12 rounded-full border-4 flex items-center justify-center transition-transform ${selected ? 'border-white scale-110' : 'border-transparent hover:scale-105'}`}
                style={{ backgroundColor: c.hex }}
              >
                {selected && <Check className="w-6 h-6 text-white stroke-[3] drop-shadow" />}
              </button>
            );
          })}
          <label
            className={`relative w-12 h-12 rounded-full border-4 flex items-center justify-center cursor-pointer overflow-hidden ${isCustomColor ? 'border-white' : 'border-white/20'}`}
            style={{ background: isCustomColor ? draft.color : 'conic-gradient(red, yellow, lime, cyan, blue, magenta, red)' }}
            title="Otro color"
          >
            <span className="sr-only">Elegir otro color</span>
            <input type="color" value={draft.color} onChange={e => update({ color: e.target.value })} className="absolute inset-0 opacity-0 cursor-pointer" />
          </label>
        </div>
      </Card>
    </div>
  );
};
