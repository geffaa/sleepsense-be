import { Server as HTTPServer } from 'http';
import WebSocket from 'ws';
import mqtt from 'mqtt';
import { deviceModel } from '../models/device.model';
import { sleepDataModel } from '../models/sleepData.model';
import { sensorDataModel } from '../models/sensorData.model';
import { mqttConfig as globalMqttConfig } from '../config/mqtt-config';

// Map untuk menyimpan koneksi WebSocket untuk setiap pasien
// Key: patientId, Value: Array koneksi WebSocket
const patientConnections: Map<number, WebSocket[]> = new Map();

// Inisialisasi koneksi MQTT
let mqttClient: mqtt.MqttClient;

// Fungsi untuk menerima pesan MQTT dan meneruskan ke WebSocket
const handleMqttMessage = async (topic: string, message: Buffer) => {
  try {
    console.log(`Received MQTT message on topic: ${topic}`);
    
    // Parsing topik MQTT (format: sleepsense/device/{deviceSerialNumber}/{dataType})
    const topicParts = topic.split('/');
    if (topicParts.length < 4 || topicParts[0] !== 'sleepsense' || topicParts[1] !== 'device') {
      console.warn(`Invalid topic format: ${topic}`);
      return;
    }
    
    const deviceSerialNumber = topicParts[2];
    const dataType = topicParts[3]; // 'finger', 'belt', 'status', etc.
    
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
    if (dataType === 'finger') {
      // Proses data sensor jari (pulse oximeter)
      // Mendukung format array langsung atau format dengan properti data
      const dataToProcess = payload.data || payload;
      await processFingerSensorData(device.id, device.patient_id, dataToProcess);
    } else if (dataType === 'belt') {
      // Proses data sensor belt (ECG, thoracic, breathing)
      // Mendukung format array langsung atau format dengan properti data
      const dataToProcess = payload.data || payload;
      await processBeltSensorData(device.id, device.patient_id, dataToProcess);
    } else if (dataType === 'status') {
      // Update status device
      await deviceModel.update(device.id, {
        last_sync: new Date(),
        // battery_level diambil jika ada, jika tidak gunakan nilai yang ada
        battery_level: payload.battery_level !== undefined ? payload.battery_level : device.battery_level,
        status: payload.status || 'active'
      });
    } else if (dataType === 'data') {
      // Legacy format - process single data point
      await processSensorData(device.id, device.patient_id, payload);
    } else if (dataType === 'batch') {
      // Legacy format - process batch data
      await processBatchSensorData(device.id, device.patient_id, payload);
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

// Proses data sensor jari (pulse oximeter)
const processFingerSensorData = async (deviceId: number, patientId: number, payload: any) => {
  try {
    // Verifikasi format data - mendukung kedua format (lama dan baru)
    let dataArray: any[] = [];
    
    if (Array.isArray(payload)) {
      // Format baru - payload langsung berupa array
      dataArray = payload;
    } else if (payload.data && Array.isArray(payload.data)) {
      // Format lama - payload berisi field "data" yang merupakan array
      dataArray = payload.data;
    } else {
      throw new Error('Invalid finger sensor data format - expected array or object with data array');
    }
    
    if (dataArray.length === 0) {
      console.warn('Empty finger sensor data array received');
      return; // Tidak ada data untuk diproses
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
    
    // Prepare data untuk batch insertion
    const pulseOxBatch = dataArray.map((item: any) => ({
      sleep_data_id: sleepData.id,
      timestamp: new Date(item.timestamp),
      spo2: item.spo2,
      heart_rate: item.bpm, // Map bpm to heart_rate
      raw_ir: item.raw_ir || null,
      raw_red: item.raw_red || null
    }));
    
    // Insert data ke tabel pulse_ox_data
    await sensorDataModel.batchCreatePulseOxData(pulseOxBatch);
    
    // Update device status jika perlu - tanpa battery_level
    await deviceModel.update(deviceId, {
      last_sync: new Date(),
      status: 'active'
    });
    
  } catch (error) {
    console.error('Error processing finger sensor data:', error);
    throw error;
  }
};

// Proses data sensor belt (ECG, thoracic, breathing)
const processBeltSensorData = async (deviceId: number, patientId: number, payload: any) => {
  try {
    // Verifikasi format data - mendukung kedua format (lama dan baru)
    let dataArray: any[] = [];
    
    if (Array.isArray(payload)) {
      // Format baru - payload langsung berupa array
      dataArray = payload;
    } else if (payload.data && Array.isArray(payload.data)) {
      // Format lama - payload berisi field "data" yang merupakan array
      dataArray = payload.data;
    } else {
      throw new Error('Invalid belt sensor data format - expected array or object with data array');
    }
    
    if (dataArray.length === 0) {
      console.warn('Empty belt sensor data array received');
      return; // Tidak ada data untuk diproses
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
    
    // Prepare data untuk batch insertion (for each sensor type)
    const ecgBatch: any[] = [];
    const thoracicBatch: any[] = [];
    const breathingBatch: any[] = [];
    
    for (const item of dataArray) {
      const timestamp = new Date(item.timestamp);
      
      // Add to ECG batch if ecg data exists
      if (item.ecg !== undefined && item.ecg !== null) {
        ecgBatch.push({
          sleep_data_id: sleepData.id,
          timestamp,
          ecg_mv: item.ecg
        });
      }
      
      // Add to thoracic batch if piezoelectric_voltage data exists
      if (item.piezoelectric_voltage !== undefined && item.piezoelectric_voltage !== null) {
        thoracicBatch.push({
          sleep_data_id: sleepData.id,
          timestamp,
          piezoelectric_voltage: item.piezoelectric_voltage
        });
      }
      
      // Add to breathing batch if radar_amplitude or rcwl_amplitude data exists
      const radarAmplitude = item.radar_amplitude || item.rcwl_amplitude;
      if (radarAmplitude !== undefined && radarAmplitude !== null) {
        breathingBatch.push({
          sleep_data_id: sleepData.id,
          timestamp,
          radar_amplitude: radarAmplitude
        });
      }
    }
    
    // Insert data ke masing-masing tabel
    await sensorDataModel.batchCreateEcgData(ecgBatch);
    await sensorDataModel.batchCreateThoracicData(thoracicBatch);
    await sensorDataModel.batchCreateBreathingData(breathingBatch);
    
    // Update device status - tanpa battery_level
    await deviceModel.update(deviceId, {
      last_sync: new Date(),
      status: 'active'
    });
    
  } catch (error) {
    console.error('Error processing belt sensor data:', error);
    throw error;
  }
};

// Proses data sensor dari perangkat IoT (format lama - untuk kompatibilitas)
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
        radar_amplitude: data.radar_amplitude || data.breathing || data.rcwl_amplitude,
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

// Proses batch data sensor (format lama - untuk kompatibilitas)
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
      radar_amplitude: item.radar_amplitude || item.breathing || item.rcwl_amplitude,
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
  
   // Inisialisasi koneksi MQTT menggunakan konfigurasi dari mqtt-config.ts
   mqttClient = mqtt.connect({
    host: globalMqttConfig.host,
    port: globalMqttConfig.port,
    username: globalMqttConfig.username || undefined,
    password: globalMqttConfig.password || undefined,
    clientId: globalMqttConfig.clientId
  });
  
  mqttClient.on('connect', () => {
    console.log(`Connected to MQTT broker at ${globalMqttConfig.host}:${globalMqttConfig.port}`);
    
    // Subscribe ke topik untuk semua perangkat dan semua jenis data
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