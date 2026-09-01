import { supabaseAdmin } from '../../config/supabase.js';

export interface CachedTallerConfig {
  nombre_taller: string;
  ruc_dni: string;
  celular_taller: string;
  whatsapp_pedidos: string;
  direccion_taller: string;
  ciudad_origen: string;
  agencia_shalom_origen: string;
  shalom_email: string;
  shalom_password?: string;
  remitente_dni?: string;
  remitente_celular?: string;
}

export class ConfigService {
  private static cachedConfig: CachedTallerConfig | null = null;
  private static lastFetchTime = 0;
  private static readonly TTL_MS = 3 * 60 * 1000; // 3 minutos de caché en memoria

  /**
   * Obtiene la configuración activa del taller con caché inteligente de 3 minutos
   */
  public static async getTallerConfig(): Promise<CachedTallerConfig | null> {
    const now = Date.now();
    if (this.cachedConfig && (now - this.lastFetchTime) < this.TTL_MS) {
      return this.cachedConfig;
    }

    try {
      const { data, error } = await supabaseAdmin
        .from('taller_config')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) {
        console.warn('[CONFIG SERVICE] Error leyendo taller_config:', error.message);
        return this.cachedConfig;
      }

      if (data) {
        this.cachedConfig = data;
        this.lastFetchTime = now;
      }
      return this.cachedConfig;
    } catch (err: any) {
      console.warn('[CONFIG SERVICE] Excepción al consultar taller_config:', err?.message);
      return this.cachedConfig;
    }
  }

  /**
   * Resuelve credenciales dinámicas de Shalom Pro
   */
  public static async getShalomCredentials(customHeaders?: Record<string, any>): Promise<{ email: string; password?: string; apiKey: string }> {
    const defaultApiKey = 'sk_qm4rm5ivepety4ausqnubkfegp4yr2lnqu3p4q55oc3v4yzw3oma';
    let email = (customHeaders?.['x-shalom-email'] as string) || '';
    let password = (customHeaders?.['x-shalom-password'] as string) || '';
    const apiKey = (customHeaders?.['x-api-key'] as string) || defaultApiKey;

    if (!email || !password) {
      const config = await this.getTallerConfig();
      if (config) {
        if (!email && config.shalom_email) email = config.shalom_email;
        if (!password && config.shalom_password) password = config.shalom_password;
      }
    }

    return {
      email: (email || 'milagrosjanetamis@gmail.com').trim(),
      password: password ? password.trim() : '986398Mi$',
      apiKey,
    };
  }

  /**
   * Invalida inmediatamente el caché (por ejemplo cuando se actualizan datos desde el frontend)
   */
  public static invalidateCache() {
    this.cachedConfig = null;
    this.lastFetchTime = 0;
    console.log('[CONFIG SERVICE] Caché de configuración invalidado exitosamente.');
  }
}
