type MessageHandler = (data: unknown) => void;

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private url: string;
  private handlers: MessageHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnects = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private _isConnected = false;

  constructor(url: string) {
    this.url = url;
  }

  get isConnected(): boolean {
    return this._isConnected;
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fullUrl = `${protocol}//${window.location.host}${this.url}`;
    this.ws = new WebSocket(fullUrl);

    this.ws.onopen = () => {
      this._isConnected = true;
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handlers.forEach((handler) => handler(data));
      } catch {
        // ignore parse errors
      }
    };

    this.ws.onclose = () => {
      this._isConnected = false;
      this.tryReconnect();
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  private tryReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnects) return;

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 8000);

    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delay);
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  onMessage(handler: MessageHandler): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  close(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
    this.ws?.close();
    this.ws = null;
    this._isConnected = false;
  }
}
