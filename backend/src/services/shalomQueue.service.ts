/**
 * Servicio de Cola Serial y Rate Limiter Outbound para Shalom Pro API.
 * Garantiza que las peticiones hacia https://api.shalom-api-peru.com se ejecuten de forma
 * estrictamente serializada (concurrencia = 1) con espaciado de seguridad para evitar bloqueos WAF / 429.
 */

interface QueuedTask<T> {
  task: () => Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: any) => void;
  addedAt: number;
}

export class ShalomQueueService {
  private static queue: QueuedTask<any>[] = [];
  private static isProcessing = false;
  private static lastExecutionTime = 0;
  private static minDelayMs = 1200; // 1.2 segundos mínimo entre peticiones hacia Shalom

  /**
   * Encola una tarea hacia Shalom y devuelve una promesa que se resuelve cuando la tarea se ejecuta.
   */
  public static async enqueue<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.queue.push({
        task,
        resolve,
        reject,
        addedAt: Date.now(),
      });

      this.processQueue();
    });
  }

  /**
   * Procesa la cola de forma estrictamente secuencial
   */
  private static async processQueue() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) break;

      // Calcular tiempo transcurrido desde la última petición para respetar el rate limit
      const now = Date.now();
      const elapsed = now - this.lastExecutionTime;
      const targetDelay = this.minDelayMs + Math.floor(Math.random() * 600); // 1.2s - 1.8s

      if (elapsed < targetDelay) {
        const waitMs = targetDelay - elapsed;
        await new Promise(r => setTimeout(r, waitMs));
      }

      try {
        const result = await item.task();
        this.lastExecutionTime = Date.now();
        item.resolve(result);
      } catch (err) {
        this.lastExecutionTime = Date.now();
        item.reject(err);
      }
    }

    this.isProcessing = false;
  }

  /**
   * Retorna el tamaño actual de la cola en memoria
   */
  public static getPendingCount(): number {
    return this.queue.length;
  }
}
