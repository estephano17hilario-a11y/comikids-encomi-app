import { yapeReaderService } from './yapeReaderService';

export interface LiveSessionState {
  isLive: boolean;
  sessionId: number | null;
  startTime: number | null;
  sold: number;
  revenue: number;
}

const STORAGE_KEY = 'incomi_live_session_state_v1';

const defaultState: LiveSessionState = {
  isLive: false,
  sessionId: null,
  startTime: null,
  sold: 0,
  revenue: 0
};

class LiveSessionService {
  private state: LiveSessionState = defaultState;
  private listeners: Set<(state: LiveSessionState) => void> = new Set();

  constructor() {
    this.loadState();
  }

  private loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        this.state = JSON.parse(raw);
        if (this.state.isLive) {
          yapeReaderService.setLiveMode(true);
        }
      }
    } catch (e) {
      console.error('Error al cargar estado de live:', e);
    }
  }

  private saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      this.notify();
    } catch (e) {
      console.error('Error al guardar estado de live:', e);
    }
  }

  private notify() {
    this.listeners.forEach((cb) => cb({ ...this.state }));
    window.dispatchEvent(new CustomEvent('live_session_changed', { detail: { ...this.state } }));
  }

  getState(): LiveSessionState {
    return { ...this.state };
  }

  subscribe(callback: (state: LiveSessionState) => void): () => void {
    this.listeners.add(callback);
    callback({ ...this.state });
    return () => {
      this.listeners.delete(callback);
    };
  }

  startLive(): void {
    const now = Date.now();
    this.state = {
      isLive: true,
      sessionId: now,
      startTime: now,
      sold: 0,
      revenue: 0
    };
    this.saveState();
    yapeReaderService.setLiveMode(true);
  }

  updateLiveStats(soldDelta: number, revenueDelta: number): void {
    if (!this.state.isLive) return;
    this.state = {
      ...this.state,
      sold: Math.max(0, this.state.sold + soldDelta),
      revenue: Math.max(0, this.state.revenue + revenueDelta)
    };
    this.saveState();
  }

  setLiveStats(sold: number, revenue: number): void {
    if (!this.state.isLive) return;
    this.state = {
      ...this.state,
      sold: Math.max(0, sold),
      revenue: Math.max(0, revenue)
    };
    this.saveState();
  }

  endLive(): void {
    this.state = {
      isLive: false,
      sessionId: null,
      startTime: null,
      sold: 0,
      revenue: 0
    };
    this.saveState();
    yapeReaderService.setLiveMode(false);
  }
}

export const liveSessionService = new LiveSessionService();
