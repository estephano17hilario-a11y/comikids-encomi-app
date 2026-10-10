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
  isNameChangedRecently: boolean;
  previousName: string | null;
  previousAddress: string | null;
  statusBadgeText: string | null;
  statusTooltipText: string | null;
  canBeSelected: boolean;
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
  name_changed_at?: string | null;
}): AgencyStatusInfo {
  const isDeleted = isAgencyDeletedRecently(agency);
  const isExpired = isAgencyDeletedExpired(agency);
  const isNameChanged = !isDeleted && isAgencyNameRecentlyChanged(agency);

  const prevName = agency.previous_name?.trim() || null;
  const prevAddr = agency.previous_address?.trim() || null;

  let statusBadgeText: string | null = null;
  let statusTooltipText: string | null = null;

  if (isDeleted) {
    statusBadgeText = '⚠️ YA NO EXISTE';
    statusTooltipText = prevName
      ? `Esta agencia fue cerrada o eliminada recientemente (antigua agencia: ${prevName}). No está disponible para selección.`
      : 'Esta agencia fue cerrada o eliminada recientemente y ya no está disponible para selección.';
  } else if (isNameChanged && prevName) {
    statusBadgeText = `🔄 Nombre cambiado recientemente`;
    statusTooltipText = `Nombre anterior: "${prevName}"`;
  }

  return {
    isDeletedRecently: isDeleted,
    isDeletedExpired: isExpired,
    isNameChangedRecently: isNameChanged,
    previousName: prevName,
    previousAddress: prevAddr,
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
