/**
 * Utilidades para el control de ciclo de vida de agencias y sucursales (Shalom / Olva).
 * - Detección de agencias cerradas/borradas con vigencia de 30 días.
 * - Detección de cambios de nombre recientes con vigencia de 30 días.
 * - Restricción de selección para agencias que ya no existen.
 */

export const VIGENCIA_AGENCIA_DIAS = 30;
export const VIGENCIA_AGENCIA_MS = VIGENCIA_AGENCIA_DIAS * 24 * 60 * 60 * 1000;

export interface AgencyStatusInfo {
  isDeletedRecently: boolean;
  isDeletedExpired: boolean;
  isSoloOrigenNoRecibe: boolean;
  isNameChangedRecently: boolean;
  previousName: string | null;
  previousAddress: string | null;
  changedAtDate: string | null;
  changedAtShort: string | null;
  deletedAtDate: string | null;
  deletedAtShort: string | null;
  statusBadgeText: string | null;
  statusTooltipText: string | null;
  canBeSelected: boolean;
}

/**
 * Formatea una fecha ISO en hora Perú (America/Lima) con contexto relativo legible.
 * Ej: "20 nov 2026 (hoy)", "19 nov 2026 (ayer)", "10 nov 2026 (hace 10 días)"
 */
export function formatAgencyChangeDate(iso?: string | null): { full: string; short: string } | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (isNaN(parsed.getTime()) || parsed.getUTCFullYear() <= 2025) return null;

  const peruNow = new Date(Date.now() - 5 * 3600 * 1000);
  const peruTarget = new Date(parsed.getTime() - 5 * 3600 * 1000);
  const todayYmd = peruNow.toISOString().slice(0, 10);
  const targetYmd = peruTarget.toISOString().slice(0, 10);

  const dayDiff = Math.round(
    (new Date(`${todayYmd}T00:00:00Z`).getTime() - new Date(`${targetYmd}T00:00:00Z`).getTime()) /
      (24 * 60 * 60 * 1000)
  );

  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const [y, m, d] = targetYmd.split('-').map(Number);
  const shortDate = `${d} ${months[(m || 1) - 1]}`;
  const fullDate = `${shortDate} ${y}`;

  let rel = '';
  if (dayDiff <= 0) rel = ' (hoy)';
  else if (dayDiff === 1) rel = ' (ayer)';
  else rel = ` (hace ${dayDiff} días)`;

  return { full: `${fullDate}${rel}`, short: shortDate };
}

/**
 * Evalúa si una agencia fue borrada/desactivada en los últimos 30 días.
 */
export function isAgencyDeletedRecently(agency: {
  is_active?: boolean;
  deleted_at?: string | null;
}): boolean {
  if (agency.is_active === false) {
    if (!agency.deleted_at) return true;
    const deletedTime = new Date(agency.deleted_at).getTime();
    if (isNaN(deletedTime)) return true;
    return Date.now() - deletedTime <= VIGENCIA_AGENCIA_MS;
  }
  return false;
}

/**
 * Evalúa si una agencia fue borrada hace más de 30 días (expirada, no debe mostrarse).
 */
export function isAgencyDeletedExpired(agency: {
  is_active?: boolean;
  deleted_at?: string | null;
}): boolean {
  if (agency.is_active === false) {
    if (!agency.deleted_at) return false;
    const deletedTime = new Date(agency.deleted_at).getTime();
    if (isNaN(deletedTime)) return false;
    return Date.now() - deletedTime > VIGENCIA_AGENCIA_MS;
  }
  return false;
}

/**
 * Evalúa si el nombre de la sucursal fue modificado recientemente (últimos 30 días).
 */
export function isAgencyNameRecentlyChanged(agency: {
  previous_name?: string | null;
  name_changed_at?: string | null;
}): boolean {
  const prev = agency.previous_name?.trim();
  if (!prev) return false;

  if (agency.name_changed_at) {
    const changedTime = new Date(agency.name_changed_at).getTime();
    if (!isNaN(changedTime)) {
      return Date.now() - changedTime <= VIGENCIA_AGENCIA_MS;
    }
  }
  // Si tiene nombre anterior registrado y no hay fecha explícita, se considera reciente
  return true;
}

/**
 * Analiza el estado completo de una agencia para renderizar badges y controles en la interfaz.
 */
export function getAgencyStatusInfo(agency: {
  is_active?: boolean;
  deleted_at?: string | null;
  previous_name?: string | null;
  previous_address?: string | null;
  previous_agency_info?: string | null;
  name_changed_at?: string | null;
}): AgencyStatusInfo {
  const isDeleted = isAgencyDeletedRecently(agency);
  const isExpired = isAgencyDeletedExpired(agency);
  const isSoloOrigenNoRecibe = Boolean(
    isDeleted &&
    typeof agency.previous_agency_info === 'string' &&
    agency.previous_agency_info.includes('[SOLO_ORIGEN_NO_RECIBE]')
  );
  const isNameChanged = !isDeleted && isAgencyNameRecentlyChanged(agency);

  const prevName = agency.previous_name?.trim() || null;
  const prevAddr = agency.previous_address?.trim() || null;
  const changedFmt = formatAgencyChangeDate(agency.name_changed_at);
  const deletedFmt = formatAgencyChangeDate(agency.deleted_at);

  let statusBadgeText: string | null = null;
  let statusTooltipText: string | null = null;

  if (isDeleted && isSoloOrigenNoRecibe) {
    statusBadgeText = deletedFmt ? `🚫 SOLO ENVÍOS · NO RECIBE (${deletedFmt.short})` : '🚫 SOLO ENVÍOS · NO RECIBE';
    const dateSuffix = deletedFmt ? ` desde el ${deletedFmt.full}` : '';
    statusTooltipText = `Esta sucursal es SOLO ENVÍOS (origen) y NO recibe encomiendas como destino en Shalom${dateSuffix}. No está disponible para selección.`;
  } else if (isDeleted) {
    statusBadgeText = deletedFmt ? `⚠️ YA NO EXISTE (${deletedFmt.short})` : '⚠️ YA NO EXISTE';
    const dateSuffix = deletedFmt ? ` el ${deletedFmt.full}` : ' recientemente';
    statusTooltipText = prevName
      ? `Esta agencia fue cerrada o eliminada${dateSuffix} (antigua agencia: ${prevName}). No está disponible para selección.`
      : `Esta agencia fue cerrada o eliminada${dateSuffix} y ya no está disponible para selección.`;
  } else if (isNameChanged && prevName) {
    statusBadgeText = changedFmt
      ? `🔄 Nombre cambiado (${changedFmt.short})`
      : `🔄 Nombre cambiado recientemente`;
    statusTooltipText = changedFmt
      ? `Cambió el ${changedFmt.full}. Nombre anterior: "${prevName}"`
      : `Nombre anterior: "${prevName}"`;
  }

  return {
    isDeletedRecently: isDeleted,
    isDeletedExpired: isExpired,
    isSoloOrigenNoRecibe,
    isNameChangedRecently: isNameChanged,
    previousName: prevName,
    previousAddress: prevAddr,
    changedAtDate: changedFmt?.full || null,
    changedAtShort: changedFmt?.short || null,
    deletedAtDate: deletedFmt?.full || null,
    deletedAtShort: deletedFmt?.short || null,
    statusBadgeText,
    statusTooltipText,
    canBeSelected: !isDeleted,
  };
}

/**
 * Filtra la lista de agencias descartando aquellas eliminadas con más de 30 días de antigüedad,
 * pero manteniendo las eliminadas dentro de los 30 días para visualización informativa (no seleccionable).
 */
export function filterAgenciesWithVigencia<T extends { is_active?: boolean; deleted_at?: string | null }>(
  agencies: T[]
): T[] {
  return agencies.filter(agency => !isAgencyDeletedExpired(agency));
}
