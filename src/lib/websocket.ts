import { CLEARNODE_WS_URL } from '../config';

/**
 * WebSocket connection manager for Yellow Network Clearnode
 * Handles connection, reconnection, and message routing
 */
class WebSocketManager {
  private static instance: WebSocketManager | null = null;
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private messageQueue: any[] = [];
  private messageHandlers: Map<string, Set<Function>> = new Map();
  private reconnectTimeout: number | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  /**
   * Connect to Yellow Network Clearnode
   */
  public connect(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('⚠️ WebSocket already connected');
      return;
    }

    try {
      console.log('🔌 Connecting to Yellow Clearnode...');
      this.ws = new WebSocket(CLEARNODE_WS_URL);

      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onerror = this.handleError.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
    } catch (error) {
      console.error('❌ WebSocket connection failed:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Handle WebSocket open event
   */
  private handleOpen(): void {
    console.log('✅ Connected to Yellow Clearnode');
    this.reconnectAttempts = 0;
    this.flushMessageQueue();
  }

  /**
   * Handle WebSocket close event
   */
  private handleClose(event: CloseEvent): void {
    console.log('🔌 Disconnected from Yellow Clearnode:', event.code, event.reason);
    this.ws = null;
    this.scheduleReconnect();
  }

  /**
   * Handle WebSocket error event
   */
  private handleError(error: Event): void {
    console.error('❌ WebSocket error:', error);
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      console.log('📩 Received message:', message);

      // Route message to registered handlers
      const messageType = this.getMessageType(message);
      const handlers = this.messageHandlers.get(messageType);

      if (handlers) {
        handlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error(`Error in message handler for ${messageType}:`, error);
          }
        });
      }

      // Also trigger 'message' event for all messages
      const allHandlers = this.messageHandlers.get('message');
      if (allHandlers) {
        allHandlers.forEach(handler => {
          try {
            handler(message);
          } catch (error) {
            console.error('Error in message handler:', error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  /**
   * Extract message type from message object
   */
  private getMessageType(message: any): string {
    // Nitro RPC format: {res: [requestId, method, data]}
    if (message.res && Array.isArray(message.res) && message.res[1]) {
      return message.res[1];
    }
    // Generic message format
    if (message.type) {
      return message.type;
    }
    return 'unknown';
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached. Giving up.');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    console.log(`⏳ Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = window.setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Send message to Clearnode
   */
  public send(message: any): void {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);

    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('📤 Sending message:', message);
      this.ws.send(messageStr);
    } else {
      console.log('⏳ WebSocket not ready, queueing message');
      this.messageQueue.push(messageStr);

      // Try to connect if not already connecting
      if (!this.ws || this.ws.readyState === WebSocket.CLOSED) {
        this.connect();
      }
    }
  }

  /**
   * Flush queued messages
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(`📤 Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(message);
      }
    }
  }

  /**
   * Register event handler
   */
  public on(event: string, handler: Function): void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, new Set());
    }
    this.messageHandlers.get(event)!.add(handler);
  }

  /**
   * Unregister event handler
   */
  public off(event: string, handler: Function): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  /**
   * Disconnect from Clearnode
   */
  public disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.reconnectAttempts = 0;
    this.messageQueue = [];
    console.log('🔌 Disconnected from Yellow Clearnode');
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection state
   */
  public getState(): string {
    if (!this.ws) return 'DISCONNECTED';

    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'CONNECTING';
      case WebSocket.OPEN:
        return 'CONNECTED';
      case WebSocket.CLOSING:
        return 'CLOSING';
      case WebSocket.CLOSED:
        return 'DISCONNECTED';
      default:
        return 'UNKNOWN';
    }
  }
}

export default WebSocketManager;
