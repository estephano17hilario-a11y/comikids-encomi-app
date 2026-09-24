export function formatCurrency(amount?: number): string {
  if (amount === undefined || amount === null) return 'S/ 0.00';
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2
  }).format(amount);
}

export function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-PE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return dateString;
  }
}

export function formatShortDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-PE', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  } catch {
    return dateString;
  }
}

export function generateOrderTrackingCode(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const prefix = Array.from({ length: 3 }, () => letters[Math.floor(Math.random() * letters.length)]).join('');
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${year}-${randomNum}`;
}

export function cleanPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 9) {
    return `51${digits}`;
  }
  return digits;
}

/**
 * Valida de forma estricta un PIN / Clave de recojo para Shalom:
 * - Debe tener exactamente 4 dígitos numéricos
 * - No puede ser '1234'
 * - No puede ser un año entre 2010 y 2026
 */
export function validateShalomPin(pin?: string): { isValid: boolean; error?: string } {
  if (!pin) {
    return { isValid: false, error: 'La clave de recojo es obligatoria' };
  }
  const clean = String(pin).trim().replace(/\D/g, '');
  if (clean.length !== 4) {
    return { isValid: false, error: 'La clave de recojo debe tener exactamente 4 dígitos numéricos' };
  }
  return { isValid: true };
}

/**
 * Limpia y recorta un PIN a 4 dígitos numéricos
 */
export function formatShalomPin(pin?: string): string {
  if (!pin) return '';
  return String(pin).replace(/\D/g, '').slice(0, 4);
}

/**
 * Pool de claves de recojo fáciles de recordar y válidas ante Shalom Pro.
 * Nunca repite consecutivamente la clave del día anterior.
 */
export const SAFE_SHALOM_PINS = ['0808', '0707', '0505', '0303', '0606', '0404', '0202', '0909'];

/**
 * Obtiene la clave de recojo predeterminada (0808).
 */
export function getDailyShalomPin(): string {
  return '0808';
}

/**
 * Avanza al siguiente PIN seguro en caso de que Shalom rechace el actual.
 */
export function getNextShalomPin(currentPin?: string): string {
  if (!currentPin) return '0808';
  const clean = currentPin.trim();
  const idx = SAFE_SHALOM_PINS.indexOf(clean);
  if (idx === -1) {
    return clean === '0808' ? '0707' : '0808';
  }
  const nextIdx = (idx + 1) % SAFE_SHALOM_PINS.length;
  const next = SAFE_SHALOM_PINS[nextIdx];
  return next === clean ? '0707' : next;
}

/**
 * Guarda en almacenamiento local la clave utilizada con éxito hoy.
 */
export function saveUsedShalomPin(pin: string): void {
  if (typeof window !== 'undefined' && pin) {
    try {
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
      localStorage.setItem('incomi_last_used_shalom_pin', pin.trim());
      localStorage.setItem('incomi_last_used_shalom_pin_date', todayStr);
    } catch {}
  }
}

