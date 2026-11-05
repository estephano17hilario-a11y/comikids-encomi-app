import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Sparkles, Send, RotateCcw, Check, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useOrders } from '../../context/OrderContext';
import { askEmpresaAi, EmpresaAiAction, EmpresaAiError } from '../../services/empresaAiService';

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: EmpresaAiAction[];
  error?: boolean;
}

const SUGGESTIONS: { emoji: string; label: string; prompt: string }[] = [
  { emoji: '📊', label: 'Reporte de hoy', prompt: 'Dame el reporte de hoy' },
  { emoji: '📦', label: 'Pedidos pendientes', prompt: '¿Qué pedidos pendientes tengo por despachar?' },
  { emoji: '➕', label: 'Crear pedido', prompt: 'Quiero registrar un pedido nuevo' },
  { emoji: '🚚', label: 'Mis agencias', prompt: '¿Qué agencias tengo activas y qué días salen?' },
  { emoji: '👥', label: 'Mis clientas', prompt: 'Muéstrame mis clientas con más pedidos' },
  { emoji: '⚙️', label: 'Mi horario', prompt: '¿Cuál es mi hora de corte y mis días de despacho?' },
];

// Mini formato: **negrita**, listas con - o •, saltos de línea
const renderInline = (text: string, keyBase: string) =>
  text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? (
      <strong key={`${keyBase}-${i}`} className="font-black text-white">{part.slice(2, -2)}</strong>
    ) : part.length > 2 && part.startsWith('*') && part.endsWith('*') ? (
      <em key={`${keyBase}-${i}`}>{part.slice(1, -1)}</em>
    ) : (
      <React.Fragment key={`${keyBase}-${i}`}>{part}</React.Fragment>
    )
  );

const RichText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        const bullet = trimmed.match(/^([-•*]|\d+[.)])\s+(.*)$/);
        if (bullet) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-cyan-300 shrink-0">{/^\d/.test(bullet[1]) ? bullet[1] : '•'}</span>
              <span className="min-w-0 break-words">{renderInline(bullet[2], `l${i}`)}</span>
            </div>
          );
        }
        const heading = trimmed.match(/^#{1,3}\s+(.*)$/);
        if (heading) return <p key={i} className="font-black text-white pt-1">{renderInline(heading[1], `h${i}`)}</p>;
        return <p key={i} className="break-words">{renderInline(trimmed, `p${i}`)}</p>;
      })}
    </div>
  );
};

export const EmpresaAiAssistant: React.FC = () => {
  const { currentEmpresa, currentUser } = useAuth();
  const { refreshData, tallerConfig } = useOrders();

  const empresaId = currentEmpresa?.id || currentUser?.id || 'empresa-master-comikids';
  const empresaNombre = currentEmpresa?.nombre || tallerConfig.nombre_taller || 'tu empresa';
  const credential = currentEmpresa?.password_hash || currentUser?.password_hash || '';
  const storageKey = `encomi_ai_chat_${empresaId}`;

  const [messages, setMessages] = useState<Msg[]>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const parsed = raw ? (JSON.parse(raw) as Msg[]) : [];
      return Array.isArray(parsed) ? parsed.slice(-30) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.filter(m => !m.error).slice(-30)));
    } catch {
      // sin almacenamiento: el chat sigue funcionando
    }
  }, [messages, storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, busy]);

  const send = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!clean || busy) return;
      const userMsg: Msg = { id: `u-${Date.now()}`, role: 'user', content: clean };
      const next = [...messages.filter(m => !m.error), userMsg];
      setMessages(next);
      setInput('');
      setBusy(true);
      try {
        const res = await askEmpresaAi({
          empresaId,
          empresaNombre,
          credential,
          messages: next.map(m => ({ role: m.role, content: m.content })),
        });
        setMessages(prev => [...prev, { id: `a-${Date.now()}`, role: 'assistant', content: res.reply, actions: res.actions }]);
        // Si la IA cambió datos, se refresca la app para que todo se vea al instante
        if (res.actions.some(a => a.write && a.ok)) refreshData().catch(() => {});
      } catch (e) {
        const msg = e instanceof EmpresaAiError ? e.message : 'No pude responder ahora. Intenta de nuevo.';
        setMessages(prev => [...prev, { id: `e-${Date.now()}`, role: 'assistant', content: msg, error: true }]);
      } finally {
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [messages, busy, empresaId, empresaNombre, credential, refreshData]
  );

  const lastUser = useMemo(() => [...messages].reverse().find(m => m.role === 'user'), [messages]);

  const reset = () => {
    setMessages([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // nada que limpiar
    }
  };

  return (
    <div className="max-w-2xl mx-auto flex flex-col h-[calc(100dvh-12.5rem)] min-h-[26rem] rounded-[1.75rem] bg-slate-900/80 border border-white/10 overflow-hidden animate-fadeIn">
      {/* Cabecera */}
      <div className="shrink-0 px-4 py-3 flex items-center gap-3 border-b border-white/10 bg-slate-950/60">
        <div className="w-11 h-11 rounded-2xl bg-linear-to-tr from-cyan-500 to-purple-600 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-black text-white leading-tight">Encomi AI</h2>
          <p className="text-[13px] text-slate-400 truncate">Trabaja con los datos de {empresaNombre}</p>
        </div>
        {messages.length > 0 && (
          <button type="button" onClick={reset} className="min-h-11 px-3 rounded-2xl bg-white/5 hover:bg-white/10 text-[13px] font-bold text-slate-300 flex items-center gap-1.5" aria-label="Empezar una conversación nueva">
            <RotateCcw className="w-4 h-4" /> Nueva
          </button>
        )}
      </div>

      {/* Conversación */}
      <div className="flex-1 min-h-0 overflow-y-auto px-3 py-4 space-y-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-3 gap-3">
            <div className="w-16 h-16 rounded-[1.4rem] bg-linear-to-tr from-cyan-500/20 to-purple-600/20 border border-cyan-400/30 flex items-center justify-center text-3xl">✨</div>
            <h3 className="text-[20px] font-black text-white">¿Qué hacemos hoy?</h3>
            <p className="text-[15px] text-slate-400 leading-snug max-w-sm">
              Pídeme lo que quieras con tus pedidos, clientas y agencias. Puedo consultar, crear y cambiar cosas por ti.
            </p>
          </div>
        )}

        {messages.map(m =>
          m.role === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="max-w-[85%] rounded-[1.3rem] rounded-br-md bg-cyan-600 text-white px-4 py-2.5 text-[15px] leading-snug whitespace-pre-wrap break-words">{m.content}</div>
            </div>
          ) : (
            <div key={m.id} className="flex gap-2.5">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${m.error ? 'bg-rose-500/20 text-rose-300' : 'bg-linear-to-tr from-purple-600 to-indigo-600 text-white'}`}>
                {m.error ? <AlertCircle className="w-4 h-4" /> : <Sparkles className="w-4 h-4" />}
              </div>
              <div className="max-w-[88%] space-y-2">
                <div className={`rounded-[1.3rem] rounded-tl-md px-4 py-3 text-[15px] leading-snug ${m.error ? 'bg-rose-500/10 border border-rose-400/30 text-rose-100' : 'bg-slate-800/90 border border-white/10 text-slate-100'}`}>
                  <RichText text={m.content} />
                </div>
                {m.actions && m.actions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {m.actions.map((a, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[12px] font-bold border ${
                          !a.ok ? 'bg-rose-500/10 border-rose-400/30 text-rose-200' : a.write ? 'bg-emerald-500/15 border-emerald-400/30 text-emerald-200' : 'bg-white/5 border-white/10 text-slate-300'
                        }`}
                      >
                        {a.ok ? <Check className="w-3 h-3 stroke-[3]" /> : <AlertCircle className="w-3 h-3" />} {a.summary}
                      </span>
                    ))}
                  </div>
                )}
                {m.error && lastUser && (
                  <button type="button" onClick={() => send(lastUser.content)} disabled={busy} className="min-h-10 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-[14px] font-bold text-white">
                    Reintentar
                  </button>
                )}
              </div>
            </div>
          )
        )}

        {busy && (
          <div className="flex gap-2.5 items-center text-slate-400 text-[14px]">
            <div className="w-8 h-8 rounded-xl bg-linear-to-tr from-purple-600 to-indigo-600 flex items-center justify-center"><Loader2 className="w-4 h-4 text-white animate-spin" /></div>
            <span className="animate-pulse">Pensando y revisando tus datos…</span>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Atajos */}
      {messages.length === 0 && (
        <div className="shrink-0 px-3 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
          {SUGGESTIONS.map(s => (
            <button key={s.label} type="button" onClick={() => send(s.prompt)} disabled={busy} className="shrink-0 min-h-11 px-4 rounded-full bg-white/8 hover:bg-white/15 border border-white/10 text-[14px] font-bold text-white flex items-center gap-1.5">
              <span aria-hidden="true">{s.emoji}</span> {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Escribir */}
      <form
        onSubmit={e => {
          e.preventDefault();
          send(input);
        }}
        className="shrink-0 p-3 border-t border-white/10 bg-slate-950/60 flex items-end gap-2"
      >
        <textarea
          ref={inputRef}
          value={input}
          rows={1}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder="Escribe aquí… ej: ¿cuántos envíos salen hoy?"
          aria-label="Mensaje para Encomi AI"
          className="flex-1 max-h-32 min-h-12 px-4 py-3 rounded-[1.4rem] bg-slate-900 border border-white/15 text-base text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-400 resize-none"
        />
        <button type="submit" disabled={!input.trim() || busy} className="w-12 h-12 rounded-full bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 flex items-center justify-center shrink-0 active:scale-95 transition-transform" aria-label="Enviar">
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
};
