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
 * Formatea un horario amigablemente (ej. "24 Horas" o "08:30 a 18:00")
 */
export function formatHorarioAmigable(horario?: { es_24_horas?: boolean; hora_inicio?: string; hora_fin?: string }): string {
  if (!horario) return '';
  if (horario.es_24_horas) return '24 Horas (Todo el día)';
  if (horario.hora_inicio && horario.hora_fin) {
    return `${horario.hora_inicio} a ${horario.hora_fin}`;
  }
  if (horario.hora_inicio) return `Desde las ${horario.hora_inicio}`;
  if (horario.hora_fin) return `Hasta las ${horario.hora_fin}`;
  return '';
}

/**
 * Genera un texto resumido y amigable sobre los días u horario en que opera la agencia
 */
export function getAgencyDaysSummary(method: MetodoEnvio): string {
  const disp = method.disponibilidad;
  if (!disp) return 'Todos los días • 24 Horas';

  if (disp.mensaje_disponibilidad?.trim()) {
    return disp.mensaje_disponibilidad.trim();
  }

  const parts: string[] = [];

  // Días de la semana
  if (disp.dias_semana && disp.dias_semana.length > 0 && disp.dias_semana.length < 7) {
    if (disp.dias_semana.length === 5 && !disp.dias_semana.includes('sabado') && !disp.dias_semana.includes('domingo')) {
      parts.push('Lunes a Viernes');
    } else if (disp.dias_semana.length === 2 && disp.dias_semana.includes('sabado') && disp.dias_semana.includes('domingo')) {
      parts.push('Fines de semana');
    } else {
      const days = disp.dias_semana.map(d => DIAS_SEMANA_ABREV[d] || d).join(', ');
      parts.push(`Despachos: ${days}`);
    }
  } else {
    parts.push('Todos los días');
  }

  // Horarios de atención / despacho
  if (disp.modalidad_horario === 'individual_por_dia' && disp.horarios_por_dia) {
    // Si todos los días configurados tienen 24 horas
    const activeDays = (disp.dias_semana && disp.dias_semana.length > 0) ? disp.dias_semana : DIAS_SEMANA_ORDEN;
    const all24h = activeDays.every(d => disp.horarios_por_dia?.[d]?.es_24_horas);
    if (all24h) {
      parts.push('24 Horas');
    } else {
      parts.push('Horario por día');
    }
  } else if (disp.horario_global) {
    const hText = formatHorarioAmigable(disp.horario_global);
    if (hText) parts.push(hText);
  }

  // Rango de fechas heredado (si aún existiera configurado previamente)
  if (disp.usar_rango_fechas) {
    if (disp.fecha_inicio && disp.fecha_fin) {
      parts.push(`(Del ${disp.fecha_inicio.slice(5)} al ${disp.fecha_fin.slice(5)})`);
    } else if (disp.fecha_inicio) {
      parts.push(`(Desde ${disp.fecha_inicio.slice(5)})`);
    }
  }

  return parts.length > 0 ? parts.join(' • ') : 'Todos los días • 24 Horas';
}

/**
 * Evalúa si la agencia está dentro de su horario de atención en el momento presente
 */
export function isAgencyTimeAllowedNow(
  method: MetodoEnvio,
  now: Date = new Date()
): { allowed: boolean; reason?: string } {
  if (!method.activo) {
    return { allowed: false, reason: 'La agencia no está activa actualmente.' };
  }

  const disp = method.disponibilidad;
  if (!disp) return { allowed: true };

  // 1. Obtener día de hoy
  const dayNum = now.getDay(); // 0 = dom, 1 = lun...
  const map: Record<number, DiaSemana> = {
    0: 'domingo',
    1: 'lunes',
    2: 'martes',
    3: 'miercoles',
    4: 'jueves',
    5: 'viernes',
    6: 'sabado',
  };
  const todayDia = map[dayNum] || 'lunes';

  // Si tiene días específicos y hoy no atiende
  if (disp.dias_semana && disp.dias_semana.length > 0 && disp.dias_semana.length < 7) {
    if (!disp.dias_semana.includes(todayDia)) {
      const allowedNames = disp.dias_semana.map(d => DIAS_SEMANA_LABELS[d] || d).join(', ');
      return {
        allowed: false,
        reason: `Hoy ${DIAS_SEMANA_LABELS[todayDia]} no atiende esta agencia. Despachos disponibles: ${allowedNames}.`,
      };
    }
  }

  // 2. Obtener horario aplicable para hoy
  let horarioHoy = disp.horario_global;
  if (disp.modalidad_horario === 'individual_por_dia' && disp.horarios_por_dia) {
    horarioHoy = disp.horarios_por_dia[todayDia] || disp.horario_global;
  }

  if (!horarioHoy || horarioHoy.es_24_horas) {
    return { allowed: true };
  }

  // Si tiene horas fijas inicio y fin
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentMinTotal = currentHour * 60 + currentMinute;

  if (horarioHoy.hora_inicio) {
    const [hI, mI] = horarioHoy.hora_inicio.split(':').map(Number);
    const minInicio = (hI || 0) * 60 + (mI || 0);
    if (currentMinTotal < minInicio) {
      return {
        allowed: false,
        reason: `El horario de atención para hoy inicia a las ${horarioHoy.hora_inicio}.`,
      };
    }
  }

  if (horarioHoy.hora_fin) {
    const [hF, mF] = horarioHoy.hora_fin.split(':').map(Number);
    const minFin = (hF || 0) * 60 + (mF || 0);
    if (currentMinTotal > minFin) {
      return {
        allowed: false,
        reason: `El horario de atención para hoy finalizó a las ${horarioHoy.hora_fin}.`,
      };
    }
  }

  return { allowed: true };
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

  // Si no se pasó fecha, verificar con el día y hora de hoy
  const todayYMD = formatDateToYMD(new Date());
  const checkTodayDate = isAgencyDateAllowed(method, todayYMD);
  if (!checkTodayDate.allowed) return false;

  const checkTodayTime = isAgencyTimeAllowedNow(method);
  return checkTodayTime.allowed;
}
