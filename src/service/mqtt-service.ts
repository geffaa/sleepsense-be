import mqtt from 'mqtt';

export interface MqttConfig {
  host: string;
  port: number;
  username?: string;
  password?: string;
  clientId: string;
  protocol?: 'mqtt' | 'mqtts' | 'tcp' | 'tls' | 'ws' | 'wss';
}

export class MqttService {
  private client: mqtt.MqttClient | null = null;
  private readonly config: MqttConfig;
  private isConnected: boolean = false;
  private reconnectAttempts: number = 0;
  private readonly maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  
  constructor(config: MqttConfig) {
    this.config = {
      ...config,
      clientId: config.clientId || `sleepsense_device_${Math.random().toString(16).substring(2, 10)}`
    };
  }
  
  /**
   * Menghubungkan ke MQTT broker
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.isConnected && this.client) {
        console.log('Already connected to MQTT broker');
        resolve();
        return;
      }
      
      try {
        // Format URL MQTT sesuai protokol
        const protocol = this.config.protocol || 'mqtt';
        const url = `${protocol}://${this.config.host}:${this.config.port}`;
        
        console.log(`Connecting to MQTT broker at ${url}`);
        
        this.client = mqtt.connect(url, {
          clientId: this.config.clientId,
          username: this.config.username,
          password: this.config.password,
          reconnectPeriod: 5000, // 5 detik antar percobaan reconnect
          connectTimeout: 10000 // 10 detik timeout koneksi
        });
        
        this.client.on('connect', () => {
          console.log('Connected to MQTT broker successfully');
          this.isConnected = true;
          this.reconnectAttempts = 0;
          resolve();
        });
        
        this.client.on('error', (err) => {
          console.error('MQTT connection error:', err);
          this.isConnected = false;
          reject(err);
        });
        
        this.client.on('close', () => {
          console.log('MQTT connection closed');
          this.isConnected = false;
          
          // Coba reconnect jika tidak melebihi batas percobaan
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
            
            if (this.reconnectTimeout) {
              clearTimeout(this.reconnectTimeout);
            }
            
            this.reconnectTimeout = setTimeout(() => {
              this.connect().catch(err => {
                console.error('Reconnection failed:', err);
              });
            }, 5000 * this.reconnectAttempts); // Backoff eksponensial
          } else {
            console.error('Max reconnection attempts reached');
          }
        });
      } catch (error) {
        console.error('Error initializing MQTT client:', error);
        reject(error);
      }
    });
  }
  
  /**
   * Mengirim data sensor jari (pulse oximeter) ke MQTT broker
   */
  sendFingerSensorData(
    deviceSerialNumber: string,
    data: Array<{
      timestamp: Date | string;
      spo2?: number;
      bpm?: number; // Heart rate in BPM
    }>,
    batteryLevel?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('Not connected to MQTT broker'));
        return;
      }
      
      // Topic khusus untuk data sensor jari
      const topic = `sleepsense/device/${deviceSerialNumber}/finger`;
      
      // Format data dari sensor jari
      const formattedData = data.map(item => ({
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : item.timestamp.toISOString(),
        spo2: item.spo2,
        bpm: item.bpm
      }));
      
      const payload = JSON.stringify({
        data: formattedData,
        battery_level: batteryLevel || 100,
        timestamp: new Date().toISOString()
      });
      
      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error('Error publishing finger sensor data:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Mengirim data sensor belt (ECG, piezoelectric, radar) ke MQTT broker
   */
  sendBeltSensorData(
    deviceSerialNumber: string,
    data: Array<{
      timestamp: Date | string;
      ecg?: number;
      piezoelectric_voltage?: number;
      rcwl_amplitude?: number;
    }>,
    batteryLevel?: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('Not connected to MQTT broker'));
        return;
      }
      
      // Topic khusus untuk data sensor belt
      const topic = `sleepsense/device/${deviceSerialNumber}/belt`;
      
      // Format data dari sensor belt
      const formattedData = data.map(item => ({
        timestamp: typeof item.timestamp === 'string' ? item.timestamp : item.timestamp.toISOString(),
        ecg: item.ecg,
        piezoelectric_voltage: item.piezoelectric_voltage,
        rcwl_amplitude: item.rcwl_amplitude
      }));
      
      const payload = JSON.stringify({
        data: formattedData,
        battery_level: batteryLevel || 100,
        timestamp: new Date().toISOString()
      });
      
      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error('Error publishing belt sensor data:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Mengirim update status perangkat ke MQTT broker
   */
  sendDeviceStatus(
    deviceSerialNumber: string,
    status: {
      battery_level: number;
      status: 'active' | 'inactive' | 'error';
      error_code?: string;
      message?: string;
    }
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.client) {
        reject(new Error('Not connected to MQTT broker'));
        return;
      }
      
      const topic = `sleepsense/device/${deviceSerialNumber}/status`;
      
      const payload = JSON.stringify({
        ...status,
        timestamp: new Date().toISOString()
      });
      
      this.client.publish(topic, payload, { qos: 1 }, (err) => {
        if (err) {
          console.error('Error publishing device status:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
  
  /**
   * Menutup koneksi MQTT
   */
  disconnect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        resolve();
        return;
      }
      
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
      
      this.client.end(false, {}, (err) => {
        if (err) {
          console.error('Error disconnecting from MQTT broker:', err);
          reject(err);
        } else {
          console.log('Disconnected from MQTT broker');
          this.isConnected = false;
          this.client = null;
          resolve();
        }
      });
    });
  }
}

// Contoh penggunaan:
/*
const mqttService = new MqttService({
  host: 'localhost',
  port: 1883,
  clientId: 'sleepsense_device_001'
});

// Kirim data sensor jari
mqttService.connect()
  .then(() => {
    return mqttService.sendFingerSensorData('SN12345', [
      {
        timestamp: new Date(),
        spo2: 98,
        bpm: 75
      },
      {
        timestamp: new Date(Date.now() + 1000), // 1 detik kemudian
        spo2: 97,
        bpm: 76
      }
    ], 85);
  })
  .then(() => {
    console.log('Finger sensor data sent successfully');
  })
  .catch(err => {
    console.error('Error:', err);
  });

// Kirim data sensor belt
mqttService.connect()
  .then(() => {
    return mqttService.sendBeltSensorData('SN12345', [
      {
        timestamp: new Date(),
        ecg: 1.25,
        piezoelectric_voltage: 2.5,
        rcwl_amplitude: 120
      },
      {
        timestamp: new Date(Date.now() + 1000), // 1 detik kemudian
        ecg: 1.30,
        piezoelectric_voltage: 2.6,
        rcwl_amplitude: 115
      }
    ], 85);
  })
  .then(() => {
    console.log('Belt sensor data sent successfully');
  })
  .catch(err => {
    console.error('Error:', err);
  });
*/