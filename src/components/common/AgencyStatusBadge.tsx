import React from 'react';
import { getAgencyStatusInfo } from '../../utils/agencyStatus';
import { AlertTriangle, History } from 'lucide-react';

interface Props {
  agency: {
    is_active?: boolean;
    deleted_at?: string | null;
    previous_name?: string | null;
    previous_address?: string | null;
    name_changed_at?: string | null;
  };
  compact?: boolean;
}

export const AgencyStatusBadge: React.FC<Props> = ({ agency, compact = false }) => {
  const status = getAgencyStatusInfo(agency);

  if (status.isDeletedRecently) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/25 px-2 py-0.5 rounded-full border border-rose-500/40 shrink-0 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-400 shrink-0" />
          <span>Ya no existe</span>
        </span>
      );
    }

    return (
      <div className="mt-1.5 p-2 rounded-xl bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs space-y-0.5">
        <div className="flex items-center gap-1.5 font-black text-[11px] text-rose-300 uppercase tracking-wide">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
          <span>⚠️ Sede cerrada / Ya no existe</span>
        </div>
        <p className="text-[11px] text-rose-200/90 leading-tight">
          {status.previousName ? (
            <>Antigua agencia: <strong className="text-white font-bold">{status.previousName}</strong>. </>
          ) : null}
          Esta sede fue desactivada (vigencia de 30 días). <span className="font-bold underline text-white">No se puede seleccionar.</span>
        </p>
      </div>
    );
  }

  if (status.isNameChangedRecently && status.previousName) {
    if (compact) {
      return (
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider text-amber-300 bg-amber-500/25 px-2 py-0.5 rounded-full border border-amber-500/40 shrink-0">
          <History className="w-3 h-3 text-amber-400 shrink-0" />
          <span>Nombre cambiado</span>
        </span>
      );
    }

    return (
      <div className="mt-1 p-2 rounded-xl bg-amber-500/15 border border-amber-500/35 text-amber-200 text-xs space-y-0.5">
        <div className="flex items-center gap-1.5 font-bold text-[11px] text-amber-300">
          <History className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>🔄 Nombre cambiado recientemente:</span>
        </div>
        <p className="text-[11px] text-amber-100 leading-tight">
          Antes: <strong className="text-white font-black">&quot;{status.previousName}&quot;</strong> (vigencia de 30 días).
        </p>
      </div>
    );
  }

  return null;
};
