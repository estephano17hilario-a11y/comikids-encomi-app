import axios from 'axios';

interface SessionData {
  token?: string;
  cookies?: string[];
  email: string;
  expiresAt: number;
}

export class ShalomSessionManager {
  private static sessions: Map<string, SessionData> = new Map();
  private static activeRenewals: Map<string, Promise<boolean>> = new Map();
  private static readonly SESSION_TTL_MS = 25 * 60 * 1000; // 25 minutos

  /**
   * Obtiene la sesión en memoria si está vigente
   */
  public static getValidSession(email: string): SessionData | null {
    const session = this.sessions.get(email.toLowerCase().trim());
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.sessions.delete(email.toLowerCase().trim());
      return null;
    }
    return session;
  }

  /**
   * Guarda o actualiza la sesión en memoria
   */
  public static setSession(email: string, token?: string, cookies?: string[]) {
    this.sessions.set(email.toLowerCase().trim(), {
      email: email.toLowerCase().trim(),
      token,
      cookies,
      expiresAt: Date.now() + this.SESSION_TTL_MS,
    });
  }

  /**
   * Invalida la sesión activa para forzar renovación
   */
  public static invalidateSession(email: string) {
    this.sessions.delete(email.toLowerCase().trim());
  }

  /**
   * Renovación Single-Flight: si 10 peticiones concurrentes detectan sesión expirada,
   * solo 1 ejecuta la llamada de autenticación y las otras 9 esperan el mismo Promise.
   */
  public static async ensureActiveSession(
    email: string,
    authFn: () => Promise<boolean>
  ): Promise<boolean> {
    const key = email.toLowerCase().trim();
    const existing = this.getValidSession(key);
    if (existing) return true;

    // Si ya hay una renovación en curso para este email, esperar a que termine
    if (this.activeRenewals.has(key)) {
      return this.activeRenewals.get(key)!;
    }

    const renewalPromise = (async () => {
      try {
        const success = await authFn();
        if (success) {
          this.setSession(key);
        }
        return success;
      } finally {
        this.activeRenewals.delete(key);
      }
    })();

    this.activeRenewals.set(key, renewalPromise);
    return renewalPromise;
  }
}
