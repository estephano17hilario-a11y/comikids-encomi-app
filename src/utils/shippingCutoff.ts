import { TallerConfig } from '../types/database.types';

export const DIAS_SEMANA_MAP: Record<number, string> = {
  0: 'domingo',
  1: 'lunes',
  2: 'martes',
  3: 'miercoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sabado',
};

export const DIAS_SEMANA_NOMBRES: Record<string, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

/**
 * Obtiene la fecha y hora actual en zona horaria Perú (UTC-5 / America/Lima)
 */
export function getPeruCurrentDate(): Date {
  const now = new Date();
  // Compensar la zona horaria del cliente a UTC-5 (Perú)
  const peruOffsetMinutes = -5 * 60;
  const localOffsetMinutes = now.getTimezoneOffset(); // en minutos, inverso
  const totalOffsetMs = (peruOffsetMinutes + localOffsetMinutes) * 60 * 1000;
  return new Date(now.getTime() + totalOffsetMs);
}

/**
 * Formatea una fecha a formato YYYY-MM-DD
 */
export function formatDateToYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parsea una cadena de fecha YYYY-MM-DD a Date a las 00:00 hora Perú
 */
export function parseYMDToDate(ymd: string): Date {
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0);
}

export interface CutoffStatus {
  isPastCutoff: boolean;
  isDispatchDayToday: boolean;
  cutoffTime: string;
  currentTimeStr: string;
  todayYMD: string;
  minAvailableDateYMD: string;
  activeDays: string[];
  noticeText: string;
}

/**
 * Evalúa el estado del corte de envíos para hoy según la configuración del taller
 */
export function evaluateShippingCutoff(config?: Partial<TallerConfig>): CutoffStatus {
  const peruDate = getPeruCurrentDate();
  const todayYMD = formatDateToYMD(peruDate);

  // Configuración con defaults
  const cutoffTime = config?.hora_corte_envio_hoy || '18:00';
  const rawActiveDays = config?.dias_despacho_activos || [
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
  ];
  const isSundayEnabled = Boolean(config?.despacho_domingo_habilitado);

  const activeDays = rawActiveDays.map(d => d.toLowerCase());
  if (isSundayEnabled && !activeDays.includes('domingo')) {
    activeDays.push('domingo');
  }

  // Día de la semana actual (0 = domingo, 1 = lunes, ..., 6 = sábado)
  const currentDayOfWeekNum = peruDate.getDay();
  const currentDayName = DIAS_SEMANA_MAP[currentDayOfWeekNum] || 'lunes';
  const isDispatchDayToday = activeDays.includes(currentDayName);

  // Hora actual en Perú (HH:MM)
  const currentHours = String(peruDate.getHours()).padStart(2, '0');
  const currentMinutes = String(peruDate.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHours}:${currentMinutes}`;

  // Comparación de corte
  const [cutoffHour, cutoffMin] = cutoffTime.split(':').map(n => parseInt(n || '0', 10));
  const currentTotalMinutes = peruDate.getHours() * 60 + peruDate.getMinutes();
  const cutoffTotalMinutes = cutoffHour * 60 + (cutoffMin || 0);

  const isPastCutoff = currentTotalMinutes >= cutoffTotalMinutes;

  // Calcular la fecha mínima disponible
  let minDate = new Date(peruDate.getTime());

  if (!isDispatchDayToday || isPastCutoff) {
    // Buscar el siguiente día de despacho activo
    let found = false;
    for (let i = 1; i <= 14; i++) {
      const nextDate = new Date(peruDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDayName = DIAS_SEMANA_MAP[nextDate.getDay()];
      if (activeDays.includes(nextDayName)) {
        minDate = nextDate;
        found = true;
        break;
      }
    }
    if (!found) {
      minDate = new Date(peruDate.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  const minAvailableDateYMD = formatDateToYMD(minDate);

  // Formato de hora amigable (ej: 2:00 PM o 14:00)
  const friendlyCutoff = formatFriendlyTime(cutoffTime);
  const friendlyNextDate = formatFriendlyDate(minAvailableDateYMD);

  let noticeText = '';
  if (config?.mensaje_corte_personalizado && isPastCutoff) {
    noticeText = config.mensaje_corte_personalizado;
  } else if (!isDispatchDayToday) {
    noticeText = `Hoy ${DIAS_SEMANA_NOMBRES[currentDayName] || currentDayName} no se realizan despachos. Tu pedido se programará a partir del ${friendlyNextDate}.`;
  } else if (isPastCutoff) {
    noticeText = `⏰ El horario límite para envíos de hoy era hasta las ${friendlyCutoff}. Tu pedido se programará para el ${friendlyNextDate}.`;
  } else {
    noticeText = `⚡ ¡Envío para hoy disponible! Regístrate antes de las ${friendlyCutoff} para que tu paquete salga en el lote de hoy.`;
  }

  return {
    isPastCutoff,
    isDispatchDayToday,
    cutoffTime,
    currentTimeStr,
    todayYMD,
    minAvailableDateYMD,
    activeDays,
    noticeText,
  };
}

/**
 * Retorna la fecha mínima permitida (YYYY-MM-DD) para el input date
 */
export function getMinAvailableShippingDate(config?: Partial<TallerConfig>): string {
  const status = evaluateShippingCutoff(config);
  return status.minAvailableDateYMD;
}

/**
 * Formatea una hora HH:MM a formato 12h amigable (ej: 14:00 -> 2:00 PM)
 */
export function formatFriendlyTime(timeStr: string): string {
  if (!timeStr) return '6:00 PM';
  const [hStr, mStr] = timeStr.split(':');
  let h = parseInt(hStr || '18', 10);
  const m = mStr || '00';
  const period = h >= 12 ? 'PM' : 'AM';
  if (h > 12) h -= 12;
  if (h === 0) h = 12;
  return `${h}:${m} ${period}`;
}

/**
 * Formatea una fecha YYYY-MM-DD a formato amigable en español (ej: "Sábado 29 de Agosto")
 */
export function formatFriendlyDate(ymd: string): string {
  if (!ymd) return '';
  try {
    const [year, month, day] = ymd.split('-').map(Number);
    const d = new Date(year, month - 1, day, 12, 0, 0);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    };
    const formatted = d.toLocaleDateString('es-PE', options);
    return formatted.charAt(0).toUpperCase() + formatted.slice(1);
  } catch {
    return ymd;
  }
}
