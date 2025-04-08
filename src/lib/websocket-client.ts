// src/lib/websocket-client.ts

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp?: string;
    deviceId?: number;
  }
  
  type MessageHandler = (message: WebSocketMessage) => void;
  type ConnectionStatusHandler = (status: 'connected' | 'disconnected' | 'connecting' | 'error') => void;
  
  export class WebSocketClient {
    private ws: WebSocket | null = null;
    private url: string;
    private patientId: string;
    private token: string;
    private reconnectAttempts: number = 0;
    private maxReconnectAttempts: number = 5;
    private reconnectTimeout: number | null = null;
    private messageHandlers: Map<string, MessageHandler[]> = new Map();
    private connectionStatusHandlers: ConnectionStatusHandler[] = [];
    private connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error' = 'disconnected';
    
    constructor(baseUrl: string, patientId: string, token: string) {
      this.url = `${baseUrl}?patientId=${patientId}&token=${token}`;
      this.patientId = patientId;
      this.token = token;
    }
    
    /**
     * Terhubung ke WebSocket server
     */
    connect(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
          console.log('WebSocket is already open or connecting');
          resolve();
          return;
        }
        
        this.updateConnectionStatus('connecting');
        
        try {
          this.ws = new WebSocket(this.url);
          
          this.ws.onopen = () => {
            console.log('WebSocket connection established');
            this.reconnectAttempts = 0;
            this.updateConnectionStatus('connected');
            resolve();
          };
          
          this.ws.onmessage = (event) => {
            try {
              const message = JSON.parse(event.data) as WebSocketMessage;
              this.handleMessage(message);
            } catch (error) {
              console.error('Error parsing WebSocket message:', error);
            }
          };
          
          this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            this.updateConnectionStatus('error');
            reject(error);
          };
          
          this.ws.onclose = () => {
            console.log('WebSocket connection closed');
            this.updateConnectionStatus('disconnected');
            
            // Attempt to reconnect
            if (this.reconnectAttempts < this.maxReconnectAttempts) {
              this.reconnectAttempts++;
              console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
              
              const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
              
              if (this.reconnectTimeout) {
                window.clearTimeout(this.reconnectTimeout);
              }
              
              this.reconnectTimeout = window.setTimeout(() => {
                this.connect().catch(err => {
                  console.error('Reconnection failed:', err);
                });
              }, delay);
            } else {
              console.error('Max reconnection attempts reached');
            }
          };
        } catch (error) {
          console.error('Error creating WebSocket:', error);
          this.updateConnectionStatus('error');
          reject(error);
        }
      });
    }
    
    /**
     * Menutup koneksi WebSocket
     */
    disconnect(): void {
      if (!this.ws) return;
      
      if (this.reconnectTimeout) {
        window.clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      this.ws.close();
      this.ws = null;
      this.updateConnectionStatus('disconnected');
    }
    
    /**
     * Mendaftarkan handler untuk jenis pesan tertentu
     */
    on(messageType: string, handler: MessageHandler): void {
      if (!this.messageHandlers.has(messageType)) {
        this.messageHandlers.set(messageType, []);
      }
      
      this.messageHandlers.get(messageType)?.push(handler);
    }
    
    /**
     * Mendaftarkan handler untuk perubahan status koneksi
     */
    onConnectionStatusChange(handler: ConnectionStatusHandler): void {
      this.connectionStatusHandlers.push(handler);
      // Trigger handler dengan status koneksi saat ini
      handler(this.connectionStatus);
    }
    
    /**
     * Mendapatkan status koneksi saat ini
     */
    getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' | 'error' {
      return this.connectionStatus;
    }
    
    /**
     * Mengirim pesan ke server (jika diperlukan)
     */
    send(message: any): void {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected');
        return;
      }
      
      try {
        this.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('Error sending WebSocket message:', error);
      }
    }
    
    /**
     * Handle pesan yang diterima dari server
     */
    private handleMessage(message: WebSocketMessage): void {
      // Handler generik untuk semua pesan
      const allHandlers = this.messageHandlers.get('*') || [];
      allHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler:', error);
        }
      });
      
      // Handler khusus untuk jenis pesan ini
      const typeHandlers = this.messageHandlers.get(message.type) || [];
      typeHandlers.forEach(handler => {
        try {
          handler(message);
        } catch (error) {
          console.error('Error in message handler for type', message.type, error);
        }
      });
    }
    
    /**
     * Memperbarui status koneksi dan memicu handler
     */
    private updateConnectionStatus(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
      this.connectionStatus = status;
      
      this.connectionStatusHandlers.forEach(handler => {
        try {
          handler(status);
        } catch (error) {
          console.error('Error in connection status handler:', error);
        }
      });
    }
  }
  
  // Contoh penggunaan:
  /*
  const websocketClient = new WebSocketClient(
    'ws://localhost:5000/api/ws',
    '123', // patientId
    'token123' // token
  );
  
  // Subscribe ke semua pesan
  websocketClient.on('*', (message) => {
    console.log('Received message:', message);
  });
  
  // Subscribe ke pesan tipe 'data'
  websocketClient.on('data', (message) => {
    console.log('Received sensor data:', message.data);
    // Update UI dengan data sensor baru
  });
  
  // Subscribe ke perubahan status koneksi
  websocketClient.onConnectionStatusChange((status) => {
    console.log('Connection status:', status);
    // Update UI dengan status koneksi
  });
  
  // Hubungkan ke server
  websocketClient.connect()
    .then(() => {
      console.log('Connected to WebSocket server');
    })
    .catch(err => {
      console.error('Failed to connect to WebSocket server:', err);
    });
  */
  