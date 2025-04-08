// src/lib/realtime-monitoring-service.ts
import { WebSocketClient, WebSocketMessage } from './websocket-client';

export interface SensorData {
  timestamp: string;
  ecg_mv?: number;
  spo2?: number;
  heart_rate?: number;
  raw_ir?: number;
  raw_red?: number;
  piezoelectric_voltage?: number;
  radar_amplitude?: number;
  has_apnea_event?: boolean;
  apnea_severity?: string;
  apnea_duration?: number;
  battery_level?: number;
}

type DataHandler = (data: SensorData) => void;
type StatusHandler = (status: 'connected' | 'disconnected' | 'connecting' | 'error') => void;

export class RealTimeMonitoringService {
  private static instance: RealTimeMonitoringService;
  private wsClient: WebSocketClient | null = null;
  private dataHandlers: DataHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private patientId: string | null = null;
  private token: string | null = null;
  private isInitialized = false;
  
  // Singleton pattern
  private constructor() {}
  
  static getInstance(): RealTimeMonitoringService {
    if (!RealTimeMonitoringService.instance) {
      RealTimeMonitoringService.instance = new RealTimeMonitoringService();
    }
    return RealTimeMonitoringService.instance;
  }
  
  /**
   * Inisialisasi layanan monitoring real-time
   */
  initialize(patientId: string, token: string, baseUrl?: string): Promise<void> {
    this.patientId = patientId;
    this.token = token;
    
    // Base WebSocket URL - should point to your API server's WebSocket endpoint
    const wsUrl = baseUrl || 
      ((window.location.protocol === 'https:' ? 'wss://' : 'ws://') + 
       window.location.host + '/api/ws');
    
    this.wsClient = new WebSocketClient(wsUrl, patientId, token);
    
    // Subscribe ke semua pesan
    this.wsClient.on('*', this.handleWebSocketMessage.bind(this));
    
    // Subscribe ke perubahan status koneksi
    this.wsClient.onConnectionStatusChange(this.handleConnectionStatusChange.bind(this));
    
    // Hubungkan ke server
    this.isInitialized = true;
    return this.wsClient.connect();
  }
  
  /**
   * Mendaftarkan handler untuk data sensor baru
   */
  onSensorData(handler: DataHandler): () => void {
    this.dataHandlers.push(handler);
    
    // Return fungsi untuk membatalkan subscription
    return () => {
      const index = this.dataHandlers.indexOf(handler);
      if (index !== -1) {
        this.dataHandlers.splice(index, 1);
      }
    };
  }
  
  /**
   * Mendaftarkan handler untuk perubahan status koneksi
   */
  onConnectionStatusChange(handler: StatusHandler): () => void {
    this.statusHandlers.push(handler);
    
    // Panggil handler dengan status saat ini
    if (this.wsClient) {
      handler(this.wsClient.getConnectionStatus());
    }
    
    // Return fungsi untuk membatalkan subscription
    return () => {
      const index = this.statusHandlers.indexOf(handler);
      if (index !== -1) {
        this.statusHandlers.splice(index, 1);
      }
    };
  }
  
  /**
   * Mendapatkan status koneksi saat ini
   */
  getConnectionStatus(): 'connected' | 'disconnected' | 'connecting' | 'error' | 'not_initialized' {
    if (!this.isInitialized || !this.wsClient) {
      return 'not_initialized';
    }
    
    return this.wsClient.getConnectionStatus();
  }
  
  /**
   * Reconnect ke server
   */
  reconnect(): Promise<void> {
    if (!this.isInitialized || !this.wsClient) {
      return Promise.reject(new Error('Service not initialized'));
    }
    
    return this.wsClient.connect();
  }
  
  /**
   * Menutup koneksi WebSocket
   */
  disconnect(): void {
    if (this.wsClient) {
      this.wsClient.disconnect();
    }
  }
  
  /**
   * Handle pesan yang diterima dari WebSocket
   */
  private handleWebSocketMessage(message: WebSocketMessage): void {
    if (message.type === 'data' || message.type === 'batch') {
      // Handle data sensor dari perangkat
      const sensorData = this.extractSensorData(message);
      if (sensorData) {
        this.notifyDataHandlers(sensorData);
      }
    } else if (message.type === 'status') {
      // Handle update status perangkat (informasi baterai, dll)
      // Tidak perlu notifikasi ke handler data sensor
      console.log('Device status update:', message.data);
    } else if (message.type === 'connection') {
      // Handle pesan koneksi
      console.log('Connection message:', message.data);
    } else {
      // Handle tipe pesan lainnya
      console.log('Received unknown message type:', message.type, message.data);
    }
  }
  
  /**
   * Ekstrak data sensor dari pesan WebSocket
   */
  private extractSensorData(message: WebSocketMessage): SensorData | null {
    if (message.type === 'data') {
      // Single data point
      return {
        timestamp: message.data.timestamp || new Date().toISOString(),
        ecg_mv: message.data.ecg_mv || message.data.ecg,
        spo2: message.data.spo2 || message.data.oxygen,
        heart_rate: message.data.heart_rate || message.data.bpm || message.data.heartRate,
        raw_ir: message.data.raw_ir,
        raw_red: message.data.raw_red,
        piezoelectric_voltage: message.data.piezoelectric_voltage || message.data.thorax,
        radar_amplitude: message.data.radar_amplitude || message.data.breathing,
        has_apnea_event: message.data.has_apnea_event || message.data.hasApneaEvent,
        apnea_severity: message.data.apnea_severity || message.data.severity,
        apnea_duration: message.data.apnea_duration || message.data.duration,
        battery_level: message.data.battery_level || message.data.batteryLevel
      };
    } else if (message.type === 'batch') {
      // Batch data - kita hanya ambil data terakhir untuk contoh ini
      // Dalam implementasi nyata, Anda mungkin ingin memproses semua data batch
      const batchData = message.data.data;
      if (Array.isArray(batchData) && batchData.length > 0) {
        const lastItem = batchData[batchData.length - 1];
        return {
          timestamp: lastItem.timestamp || new Date().toISOString(),
          ecg_mv: lastItem.ecg_mv || lastItem.ecg,
          spo2: lastItem.spo2 || lastItem.oxygen,
          heart_rate: lastItem.heart_rate || lastItem.bpm || lastItem.heartRate,
          raw_ir: lastItem.raw_ir,
          raw_red: lastItem.raw_red,
          piezoelectric_voltage: lastItem.piezoelectric_voltage || lastItem.thorax,
          radar_amplitude: lastItem.radar_amplitude || lastItem.breathing,
          has_apnea_event: lastItem.has_apnea_event || lastItem.hasApneaEvent,
          apnea_severity: lastItem.apnea_severity || lastItem.severity,
          apnea_duration: lastItem.apnea_duration || lastItem.duration,
          battery_level: message.data.battery_level || message.data.batteryLevel
        };
      }
    }
    
    return null;
  }
  
  /**
   * Notifikasi ke semua handlers data
   */
  private notifyDataHandlers(data: SensorData): void {
    this.dataHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        console.error('Error in data handler:', error);
      }
    });
  }
  
  /**
   * Handle perubahan status koneksi
   */
  private handleConnectionStatusChange(status: 'connected' | 'disconnected' | 'connecting' | 'error'): void {
    this.statusHandlers.forEach(handler => {
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
// Di komponen React Anda:
import { useEffect, useState } from 'react';
import { RealTimeMonitoringService, SensorData } from '../lib/realtime-monitoring-service';
import { useAuth } from '../context/AuthContext';

const MonitoringComponent = () => {
  const { user } = useAuth();
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [latestData, setLatestData] = useState<SensorData | null>(null);
  
  useEffect(() => {
    if (!user) return;
    
    const monitoringService = RealTimeMonitoringService.getInstance();
    
    // Inisialisasi layanan
    monitoringService.initialize(user.profileId.toString(), user.token)
      .then(() => {
        console.log('Real-time monitoring initialized');
      })
      .catch(err => {
        console.error('Failed to initialize real-time monitoring:', err);
      });
    
    // Subscribe ke data sensor
    const dataUnsubscribe = monitoringService.onSensorData((data) => {
      setLatestData(data);
      // Update grafik, UI, dll.
    });
    
    // Subscribe ke perubahan status koneksi
    const statusUnsubscribe = monitoringService.onConnectionStatusChange((status) => {
      setConnectionStatus(status);
    });
    
    // Cleanup function
    return () => {
      dataUnsubscribe();
      statusUnsubscribe();
      monitoringService.disconnect();
    };
  }, [user]);
  
  // Render komponen Anda di sini
  return (
    <div>
      <div>Connection status: {connectionStatus}</div>
      {latestData && (
        <div>
          <div>ECG: {latestData.ecg_mv} mV</div>
          <div>SpO2: {latestData.spo2}%</div>
          <div>Heart Rate: {latestData.heart_rate} BPM</div>
          <div>Battery: {latestData.battery_level}%</div>
          {latestData.has_apnea_event && (
            <div className="alert">
              <strong>Apnea Event Detected!</strong>
              {latestData.apnea_duration && <div>Duration: {latestData.apnea_duration}s</div>}
              {latestData.apnea_severity && <div>Severity: {latestData.apnea_severity}</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
*/

