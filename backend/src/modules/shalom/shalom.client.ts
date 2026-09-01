import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { ShalomQueueService } from '../../services/shalomQueue.service.js';
import { ConfigService } from '../config/config.service.js';

export class ShalomHttpClient {
  private static readonly BASE_URL = 'https://api.shalom-api-peru.com';
  private static client: AxiosInstance = axios.create({
    baseURL: ShalomHttpClient.BASE_URL,
    timeout: 25000,
  });

  /**
   * Ejecuta una petición HTTP encolada y con rate-limiting hacia Shalom Pro API
   */
  public static async request<T = any>(config: AxiosRequestConfig, customHeaders?: Record<string, any>): Promise<T> {
    const creds = await ConfigService.getShalomCredentials(customHeaders);

    const mergedHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-API-Key': creds.apiKey,
      'X-Shalom-Email': creds.email,
      ...(config.headers as Record<string, string> || {}),
    };

    if (creds.password) {
      mergedHeaders['X-Shalom-Password'] = creds.password;
    }

    return ShalomQueueService.enqueue(async () => {
      const response = await this.client.request<T>({
        ...config,
        headers: mergedHeaders,
      });
      return response.data;
    });
  }

  public static async get<T = any>(url: string, config?: AxiosRequestConfig, customHeaders?: Record<string, any>): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url }, customHeaders);
  }

  public static async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig, customHeaders?: Record<string, any>): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data }, customHeaders);
  }
}
