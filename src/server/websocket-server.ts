import { Server as HTTPServer } from 'http';
import WebSocket from 'ws';
import mqtt from 'mqtt';
import { deviceModel } from '../models/device.model';
import { sleepDataModel } from '../models/sleepData.model';
import { sensorDataModel } from '../models/sensorData.model';

// Map untuk menyimpan koneksi WebSocket untuk setiap pasien
// Key: patientId, Value: Array koneksi WebSocket
const patientConnections: Map<number, WebSocket[]> = new Map();

// Konfigurasi MQTT
const mqttConfig = {
  host: process.env.MQTT_HOST || 'localhost',
  port: parseInt(process.env.MQTT_PORT || '1883', 10),
  username: process.env.MQTT_USERNAME,
  password: process.env.MQTT_PASSWORD,
  clientId: `sleepsense_server_${Math.random().toString(16).substring(2, 10)}` // Client ID unik
};

// Inisialisasi koneksi MQTT
let mqttClient: mqtt.MqttClient;

// Fungsi untuk menerima pesan MQTT dan meneruskan ke WebSocket
const handleMqttMessage = async (topic: string, message: Buffer) => {
  try {
    console.log(`Received MQTT message on topic: ${topic}`);
    
    // Parsing topik MQTT (format: sleepsense/device/{deviceSerialNumber}/data)
    const topicParts = topic.split('/');
    if (topicParts.length < 4 || topicParts[0] !== 'sleepsense' || topicParts[1] !== 'device') {
      console.warn(`Invalid topic format: ${topic}`);
      return;
    }
    
    const deviceSerialNumber = topicParts[2];
    const dataType = topicParts[3]; // 'data', 'batch', 'status', etc.
    
    // Cari device dari database
    const device = await deviceModel.findBySerialNumber(deviceSerialNumber);
    if (!device) {
      console.warn(`Unknown device: ${deviceSerialNumber}`);
      return;
    }
    
    // Periksa apakah device ditetapkan ke pasien
    if (!device.patient_id) {
      console.warn(`Device ${deviceSerialNumber} not assigned to any patient`);
      return;
    }
    
    // Parse pesan JSON
    const payload = JSON.parse(message.toString());
    
    // Process data berdasarkan jenisnya
    if (dataType === 'data') {
      // Proses data sensor tunggal
      await processSensorData(device.id, device.patient_id, payload);
    } else if (dataType === 'batch') {
      // Proses batch data sensor
      await processBatchSensorData(device.id, device.patient_id, payload);
    } else if (dataType === 'status') {
      // Update status device
      await deviceModel.update(device.id, {
        last_sync: new Date(),
        battery_level: payload.batteryLevel,
        status: payload.status || 'active'
      });
    }
    
    // Kirim data ke semua koneksi WebSocket pasien
    forwardToWebSocketClients(device.patient_id, {
      type: dataType,
      deviceId: device.id,
      data: payload
    });
    
  } catch (error) {
    console.error('Error handling MQTT message:', error);
  }
};

// Proses data sensor dari perangkat IoT
const processSensorData = async (deviceId: number, patientId: number, data: any) => {
  try {
    // Cari atau buat data tidur untuk hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let sleepData = await sleepDataModel.findByPatientIdAndDate(patientId, today);
    
    if (!sleepData) {
      sleepData = await sleepDataModel.create(
        patientId,
        today,
        new Date(), // Start time is now
        deviceId
      );
    }
    
    // Simpan data sensor ke database dengan struktur baru
    await sensorDataModel.createAllSensorData(
      sleepData.id,
      new Date(data.timestamp),
      {
        ecg_mv: data.ecg_mv || data.ecg, // Support nama field lama dan baru
        spo2: data.spo2 || data.oxygen,
        heart_rate: data.heart_rate || data.bpm || data.heartRate,
        raw_ir: data.raw_ir,
        raw_red: data.raw_red,
        piezoelectric_voltage: data.piezoelectric_voltage || data.thorax,
        radar_amplitude: data.radar_amplitude || data.breathing,
        has_apnea_event: data.has_apnea_event || data.hasApneaEvent || false,
        apnea_severity: data.apnea_severity || data.severity,
        apnea_duration: data.apnea_duration || data.duration
      }
    );
    
  } catch (error) {
    console.error('Error processing sensor data:', error);
    throw error;
  }
};

// Proses batch data sensor
const processBatchSensorData = async (deviceId: number, patientId: number, batchData: any) => {
  try {
    // Periksa format data batch
    if (!Array.isArray(batchData.data)) {
      throw new Error('Invalid batch data format');
    }
    
    // Cari atau buat data tidur untuk hari ini
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let sleepData = await sleepDataModel.findByPatientIdAndDate(patientId, today);
    
    if (!sleepData) {
      sleepData = await sleepDataModel.create(
        patientId,
        today,
        new Date(), // Start time is now
        deviceId
      );
    }
    
    // Transformasi data batch ke format baru
    const sensorDataBatch = batchData.data.map((item: any) => ({
      sleep_data_id: sleepData.id,
      timestamp: new Date(item.timestamp),
      ecg_mv: item.ecg_mv || item.ecg,
      spo2: item.spo2 || item.oxygen,
      heart_rate: item.heart_rate || item.bpm || item.heartRate,
      raw_ir: item.raw_ir,
      raw_red: item.raw_red,
      piezoelectric_voltage: item.piezoelectric_voltage || item.thorax,
      radar_amplitude: item.radar_amplitude || item.breathing,
      has_apnea_event: item.has_apnea_event || item.hasApneaEvent || false,
      apnea_severity: item.apnea_severity || item.severity,
      apnea_duration: item.apnea_duration || item.duration
    }));
    
    // Simpan batch data ke database
    await sensorDataModel.batchCreateAllSensorData(sensorDataBatch);
    
  } catch (error) {
    console.error('Error processing batch sensor data:', error);
    throw error;
  }
};

// Kirim data ke semua koneksi WebSocket untuk pasien tertentu
const forwardToWebSocketClients = (patientId: number, data: any) => {
  const connections = patientConnections.get(patientId) || [];
  
  if (connections.length === 0) {
    return; // Tidak ada koneksi aktif untuk pasien ini
  }
  
  const message = JSON.stringify(data);
  
  // Kirim ke semua koneksi yang aktif
  connections.forEach((ws) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(message);
    }
  });
};

// Inisialisasi WebSocket server dan koneksi MQTT
export function initializeRealTimeServices(server: HTTPServer) {
  // Inisialisasi WebSocket Server
  const wss = new WebSocket.Server({ server });
  
  wss.on('connection', (ws, req) => {
    try {
      // Ekstrak token dari URL (contoh: /api/ws?token=xxx&patientId=123)
      const url = new URL(req.url || '', `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const patientId = parseInt(url.searchParams.get('patientId') || '0', 10);
      
      if (!token || !patientId) {
        ws.close(1008, 'Authentication or patient ID missing');
        return;
      }
      
      // TODO: Validasi token (seharusnya menggunakan autentikasi yang sama dengan API)
      // Untuk contoh ini, kita asumsikan token valid
      
      // Tambahkan koneksi ke map
      if (!patientConnections.has(patientId)) {
        patientConnections.set(patientId, []);
      }
      patientConnections.get(patientId)?.push(ws);
      
      console.log(`WebSocket client connected for patient ${patientId}`);
      
      // Kirim pesan sukses koneksi
      ws.send(JSON.stringify({
        type: 'connection',
        status: 'connected',
        message: 'Successfully connected to real-time data feed'
      }));
      
      // Handle pesan dari client (jarang digunakan dalam kasus ini)
      ws.on('message', (message) => {
        try {
          const data = JSON.parse(message.toString());
          console.log(`Received WebSocket message from patient ${patientId}:`, data);
          
          // TODO: Handle pesan dari client jika diperlukan
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
      
      // Handle penutupan koneksi
      ws.on('close', () => {
        // Hapus koneksi dari map
        const connections = patientConnections.get(patientId) || [];
        const index = connections.indexOf(ws);
        if (index !== -1) {
          connections.splice(index, 1);
        }
        
        console.log(`WebSocket client disconnected for patient ${patientId}`);
      });
      
    } catch (error) {
      console.error('Error handling WebSocket connection:', error);
      ws.close(1011, 'Internal server error');
    }
  });
  
  // Inisialisasi koneksi MQTT
  mqttClient = mqtt.connect({
    host: mqttConfig.host,
    port: mqttConfig.port,
    username: mqttConfig.username,
    password: mqttConfig.password,
    clientId: mqttConfig.clientId
  });
  
  mqttClient.on('connect', () => {
    console.log('Connected to MQTT broker');
    
    // Subscribe ke topik untuk semua perangkat
    mqttClient.subscribe('sleepsense/device/+/+', (err) => {
      if (err) {
        console.error('Error subscribing to MQTT topics:', err);
      } else {
        console.log('Subscribed to sleepsense/device/+/+ topics');
      }
    });
  });
  
  mqttClient.on('message', handleMqttMessage);
  
  mqttClient.on('error', (err) => {
    console.error('MQTT client error:', err);
  });
  
  mqttClient.on('close', () => {
    console.log('MQTT client disconnected');
  });
  
  console.log('Real-time services initialized');
}


