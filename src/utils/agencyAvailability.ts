import { MetodoEnvio, DiaSemana } from '../types/database.types';
import { formatFriendlyDate, parseYMDToDate, formatDateToYMD } from './shippingCutoff';

export const DIAS_SEMANA_ORDEN: DiaSemana[] = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
];

export const DIAS_SEMANA_LABELS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export const DIAS_SEMANA_ABREV: Record<DiaSemana, string> = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mié',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sáb',
  domingo: 'Dom',
};

/**
 * Obtiene el día de la semana correspondiente a una fecha YYYY-MM-DD
 */
export function getDayOfWeekFromYMD(ymd: string): DiaSemana {
  if (!ymd) return 'lunes';
  try {
    const d = parseYMDToDate(ymd);
    const dayNum = d.getDay(); // 0 = Domingo, 1 = Lunes, ...
    const map: Record<number, DiaSemana> = {
      0: 'domingo',
      1: 'lunes',
      2: 'martes',
      3: 'miercoles',
      4: 'jueves',
      5: 'viernes',
      6: 'sabado',
    };
    return map[dayNum] || 'lunes';
  } catch {
    return 'lunes';
  }
}

/**
 * Evalúa si una agencia puede despachar en una fecha específica (YYYY-MM-DD)
 */
export function isAgencyDateAllowed(
  method: MetodoEnvio,
  targetYMD: string
): { allowed: boolean; reason?: string; diasPermitidos?: string } {
  if (!method.activo) {
    return { allowed: false, reason: 'La agencia se encuentra inactiva actualmente.' };
  }

  const disp = method.disponibilidad;
  if (!disp) {
    return { allowed: true };
  }

  // 1. Verificación de Rango de Fechas
  if (disp.usar_rango_fechas) {
    if (disp.fecha_inicio && targetYMD < disp.fecha_inicio) {
      return {
        allowed: false,
        reason: `Esta agencia estará habilitada a partir del ${formatFriendlyDate(disp.fecha_inicio)}.`,
      };
    }
    if (disp.fecha_fin && targetYMD > disp.fecha_fin) {
      return {
        allowed: false,
        reason: `La disponibilidad para esta agencia finalizó el ${formatFriendlyDate(disp.fecha_fin)}.`,
      };
    }
  }

  // 2. Verificación de Días de la Semana
  if (disp.dias_semana && disp.dias_semana.length > 0 && disp.dias_semana.length < 7) {
    const targetDay = getDayOfWeekFromYMD(targetYMD);
    if (!disp.dias_semana.includes(targetDay)) {
      const allowedNames = disp.dias_semana.map(d => DIAS_SEMANA_LABELS[d] || d).join(', ');
      return {
        allowed: false,
        reason: `Esta agencia solo realiza despachos los días: ${allowedNames}.`,
        diasPermitidos: allowedNames,
      };
    }
  }

  return { allowed: true };
}

/**
 * Calcula la fecha de despacho válida más próxima para una agencia
 */
export function getNextAvailableDateForAgency(
  method: MetodoEnvio,
  startFromYMD: string,
  minAllowedYMD?: string
): string {
  let currentYMD = minAllowedYMD && startFromYMD < minAllowedYMD ? minAllowedYMD : startFromYMD;

  // Si no hay restricciones, retornar la fecha base
  const disp = method.disponibilidad;
  const hasDayRestrictions = disp?.dias_semana && disp.dias_semana.length > 0 && disp.dias_semana.length < 7;
  const hasDateRange = disp?.usar_rango_fechas && (disp.fecha_inicio || disp.fecha_fin);

  if (!hasDayRestrictions && !hasDateRange) {
    return currentYMD;
  }

  // Si la fecha inicial está antes de la fecha de inicio del rango, saltar a la fecha de inicio
  if (disp?.usar_rango_fechas && disp.fecha_inicio && currentYMD < disp.fecha_inicio) {
    currentYMD = disp.fecha_inicio;
  }

  // Buscar hasta 45 días hacia adelante
  let testDate = parseYMDToDate(currentYMD);
  for (let i = 0; i < 45; i++) {
    const testYMD = formatDateToYMD(testDate);
    const check = isAgencyDateAllowed(method, testYMD);
    if (check.allowed) {
      return testYMD;
    }
    // Siguiente día
    testDate.setDate(testDate.getDate() + 1);
  }

  return currentYMD;
}

/**
 * Genera un texto resumido y amigable sobre los días u horario en que opera la agencia
 */
export function getAgencyDaysSummary(method: MetodoEnvio): string {
  const disp = method.disponibilidad;
  if (!disp) return 'Todos los días hábiles';

  if (disp.mensaje_disponibilidad?.trim()) {
    return disp.mensaje_disponibilidad.trim();
  }

  const parts: string[] = [];

  if (disp.dias_semana && disp.dias_semana.length > 0 && disp.dias_semana.length < 7) {
    if (disp.dias_semana.length === 5 && !disp.dias_semana.includes('sabado') && !disp.dias_semana.includes('domingo')) {
      parts.push('Lunes a Viernes');
    } else if (disp.dias_semana.length === 2 && disp.dias_semana.includes('sabado') && disp.dias_semana.includes('domingo')) {
      parts.push('Fines de semana');
    } else {
      const days = disp.dias_semana.map(d => DIAS_SEMANA_ABREV[d] || d).join(', ');
      parts.push(`Despachos: ${days}`);
    }
  }

  if (disp.usar_rango_fechas) {
    if (disp.fecha_inicio && disp.fecha_fin) {
      parts.push(`Del ${disp.fecha_inicio.slice(5)} al ${disp.fecha_fin.slice(5)}`);
    } else if (disp.fecha_inicio) {
      parts.push(`Desde ${disp.fecha_inicio.slice(5)}`);
    } else if (disp.fecha_fin) {
      parts.push(`Hasta ${disp.fecha_fin.slice(5)}`);
    }
  }

  return parts.length > 0 ? parts.join(' • ') : 'Todos los días hábiles';
}

/**
 * Determina si la agencia debe ser visible en el catálogo / listado
 */
export function isAgencyCurrentlyVisible(
  method: MetodoEnvio,
  selectedDateYMD?: string
): boolean {
  if (!method.activo) return false;

  const disp = method.disponibilidad;
  if (!disp || !disp.ocultar_si_no_disponible) return true;

  // Si tiene activada la opción de ocultar si no está disponible, validamos con la fecha
  if (selectedDateYMD) {
    const check = isAgencyDateAllowed(method, selectedDateYMD);
    return check.allowed;
  }

  // Si no se pasó fecha, verificar con el día de hoy
  const todayYMD = formatDateToYMD(new Date());
  const checkToday = isAgencyDateAllowed(method, todayYMD);
  return checkToday.allowed;
}
