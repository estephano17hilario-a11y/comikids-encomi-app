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
    return { isValid: false, error: 'El PIN es obligatorio' };
  }
  const clean = String(pin).trim().replace(/\D/g, '');
  if (clean.length !== 4) {
    return { isValid: false, error: 'El PIN debe tener exactamente 4 dígitos numéricos' };
  }
  if (clean === '1234') {
    return { isValid: false, error: 'La clave 1234 está prohibida por seguridad' };
  }
  const numVal = parseInt(clean, 10);
  if (numVal >= 2010 && numVal <= 2026) {
    return { isValid: false, error: `No se permiten años entre 2010 y 2026 como PIN (${clean})` };
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
export const SAFE_SHALOM_PINS = ['0909', '0707', '0505', '0303', '0606', '0404', '0202', '0808'];

/**
 * Obtiene la clave de recojo predeterminada para el día actual.
 * Garantiza que la clave sea diferente a la usada ayer.
 */
export function getDailyShalomPin(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Rotación determinista por día del año (módulo 8)
  const defaultRotatingPin = SAFE_SHALOM_PINS[dayOfYear % SAFE_SHALOM_PINS.length];

  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('incomi_last_used_shalom_pin');
      const storedDate = localStorage.getItem('incomi_last_used_shalom_pin_date');
      const todayStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;

      // Si ayer se usó una clave y hoy la rotación coincide con esa, avanzar al siguiente
      if (stored && storedDate !== todayStr && defaultRotatingPin === stored) {
        const nextIdx = (SAFE_SHALOM_PINS.indexOf(stored) + 1) % SAFE_SHALOM_PINS.length;
        return SAFE_SHALOM_PINS[nextIdx];
      }

      // Proteger activamente contra 0808 si fue la clave usada ayer
      if (defaultRotatingPin === '0808' || stored === '0808') {
        return '0909';
      }
    } catch {}
  }

  return defaultRotatingPin === '0808' ? '0909' : defaultRotatingPin;
}

/**
 * Avanza al siguiente PIN seguro en caso de que Shalom rechace el actual.
 */
export function getNextShalomPin(currentPin?: string): string {
  if (!currentPin) return '0909';
  const clean = currentPin.trim();
  const idx = SAFE_SHALOM_PINS.indexOf(clean);
  if (idx === -1) {
    return clean === '0808' ? '0909' : '0707';
  }
  const nextIdx = (idx + 1) % SAFE_SHALOM_PINS.length;
  const next = SAFE_SHALOM_PINS[nextIdx];
  return next === clean ? '0909' : next;
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

