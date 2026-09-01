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

