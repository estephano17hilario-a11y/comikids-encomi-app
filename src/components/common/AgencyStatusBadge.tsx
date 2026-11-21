import React from 'react';
import { getAgencyStatusInfo } from '../../utils/agencyStatus';
import { AlertTriangle, History, Calendar } from 'lucide-react';

interface Props {
  agency: {
    is_active?: boolean;
    deleted_at?: string | null;
    previous_name?: string | null;
    previous_address?: string | null;
    previous_agency_info?: string | null;
    name_changed_at?: string | null;
  };
  compact?: boolean;
}

export const AgencyStatusBadge: React.FC<Props> = ({ agency, compact = false }) => {
  const status = getAgencyStatusInfo(agency);

  if (status.isDeletedRecently) {
    if (compact) {
      return (
        <span
          title={status.statusTooltipText || undefined}
          className={`inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border shrink-0 animate-pulse ${
            status.isSoloOrigenNoRecibe
              ? 'text-orange-200 bg-orange-500/25 border-orange-500/40'
              : 'text-rose-300 bg-rose-500/25 border-rose-500/40'
          }`}
        >
          <AlertTriangle className={`w-3 h-3 shrink-0 ${status.isSoloOrigenNoRecibe ? 'text-orange-400' : 'text-rose-400'}`} />
          <span>
            {status.isSoloOrigenNoRecibe ? 'Solo envíos · No recibe' : 'Ya no existe'}
            {status.deletedAtShort ? ` · ${status.deletedAtShort}` : ''}
          </span>
        </span>
      );
    }

    if (status.isSoloOrigenNoRecibe) {
      return (
        <div className="mt-1.5 p-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-100 text-xs space-y-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 font-black text-[11px] text-orange-300 uppercase tracking-wide">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400 shrink-0" />
              <span>🚫 Solo envíos (No recibe encomiendas)</span>
            </div>
            {status.deletedAtDate && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-orange-100 bg-orange-500/30 px-2 py-0.5 rounded-full border border-orange-400/30">
                <Calendar className="w-3 h-3 shrink-0" />
                <span>Desde: {status.deletedAtDate}</span>
              </span>
            )}
          </div>
          <p className="text-[11px] text-orange-100/90 leading-tight">
            Esta agencia de Shalom solo atiende envíos de salida (origen) y <strong className="text-white font-bold">NO recibe encomiendas como destino</strong>
            {status.deletedAtDate ? <> (detectado el <strong className="text-white font-bold">{status.deletedAtDate}</strong>)</> : null}.{' '}
            <span className="font-bold underline text-white">No se puede seleccionar.</span>
          </p>
        </div>
      );
    }

    return (
      <div className="mt-1.5 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-black text-[11px] text-rose-300 uppercase tracking-wide">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span>⚠️ Sede cerrada / Ya no existe</span>
          </div>
          {status.deletedAtDate && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-100 bg-rose-500/30 px-2 py-0.5 rounded-full border border-rose-400/30">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>Baja: {status.deletedAtDate}</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-rose-200/90 leading-tight">
          {status.previousName ? (
            <>Antigua agencia: <strong className="text-white font-bold">{status.previousName}</strong>. </>
          ) : null}
          {status.deletedAtDate ? (
            <>Desactivada el <strong className="text-white font-bold">{status.deletedAtDate}</strong> (vigencia de 30 días). </>
          ) : (
            <>Esta sede fue desactivada (vigencia de 30 días). </>
          )}
          <span className="font-bold underline text-white">No se puede seleccionar.</span>
        </p>
      </div>
    );
  }

  if (status.isNameChangedRecently && status.previousName) {
    if (compact) {
      return (
        <span
          title={status.statusTooltipText || undefined}
          className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/25 px-2 py-0.5 rounded-full border border-amber-500/40 shrink-0"
        >
          <History className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Nombre cambiado{status.changedAtShort ? ` · ${status.changedAtShort}` : ''}</span>
        </span>
      );
    }

    return (
      <div className="mt-1 p-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs space-y-1">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-300">
            <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>🔄 Nombre cambiado recientemente</span>
          </div>
          {status.changedAtDate && (
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-100 bg-amber-500/25 px-2 py-0.5 rounded-full border border-amber-400/30">
              <Calendar className="w-3 h-3 shrink-0" />
              <span>Cambió: {status.changedAtDate}</span>
            </span>
          )}
        </div>
        <p className="text-[11px] text-amber-100 leading-tight">
          Antes: <strong className="text-white font-black">&quot;{status.previousName}&quot;</strong>
          {status.changedAtDate ? <> — actualizado el <strong className="text-white font-bold">{status.changedAtDate}</strong></> : null} (vigencia de 30 días).
        </p>
      </div>
    );
  }

  return null;
};
