import { Request, Response } from 'express';
import { deviceModel } from '../models/device.model';
import { sleepDataModel } from '../models/sleepData.model';
import { sensorDataModel } from '../models/sensorData.model';
import { SensorData } from '../types';

export const deviceDataController = {
  // Controller lama tetap dipertahankan untuk kompatibilitas
  async getSensorData(req: Request, res: Response) {
    try {
      const sleepDataId = Number(req.params.sleepDataId);
      const { startTime, endTime, limit = 1000 } = req.query;
      
      // Verify sleep data exists
      const sleepData = await sleepDataModel.findById(sleepDataId);
      if (!sleepData) {
        return res.status(404).json({ message: 'Sleep data not found' });
      }
      
      let sensorData: SensorData[];
      
      if (startTime && endTime) {
        sensorData = await sensorDataModel.getSensorDataByTimeRange(
          sleepDataId,
          new Date(startTime as string),
          new Date(endTime as string),
          Number(limit)
        );
      } else {
        sensorData = await sensorDataModel.getLatestSensorData(sleepDataId, Number(limit));
      }
      
      return res.status(200).json({ sensorData });
    } catch (error) {
      console.error('Get sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  // Original controller method (compatibility)
  async receiveSensorData(req: Request, res: Response) {
    try {
      const deviceSerialNumber = req.params.serialNumber;
      const { timestamp, data } = req.body;
      
      // Verify device exists
      const device = await deviceModel.findBySerialNumber(deviceSerialNumber);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
      
      // Check if device is assigned to a patient
      if (!device.patient_id) {
        return res.status(400).json({ message: 'Device is not assigned to a patient' });
      }
      
      // Update device status
      await deviceModel.update(device.id, {
        last_sync: new Date(),
        battery_level: data.batteryLevel || device.battery_level,
        status: 'active'
      });
      
      // Find or create sleep data record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let sleepData = await sleepDataModel.findByPatientIdAndDate(device.patient_id, today);
      
      if (!sleepData) {
        sleepData = await sleepDataModel.create(
          device.patient_id,
          today,
          new Date(), // Start time is now
          device.id
        );
      }
      
      // Process and store sensor data based on what's in the payload
      // This adapts to the new database structure
      await sensorDataModel.createAllSensorData(
        sleepData.id,
        new Date(timestamp),
        {
          ecg_mv: data.ecg, // ECG in mV
          spo2: data.oxygen || data.spo2, // Support both old and new field names
          heart_rate: data.heartRate || data.bpm, // Support both old and new field names
          raw_ir: data.raw_ir,
          raw_red: data.raw_red,
          piezoelectric_voltage: data.thorax || data.piezoelectric_voltage, // Support both old and new field names
          radar_amplitude: data.breathing || data.radar_amplitude || data.rcwl_amplitude, // Support multiple field names
          has_apnea_event: data.hasApneaEvent || false,
          // Assuming we don't have severity and duration in the basic payload
        }
      );
      
      return res.status(200).json({ message: 'Data received successfully' });
    } catch (error) {
      console.error('Receive sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  // Controller untuk menerima data terpisah dari sensor jari (pulse oximeter)
  async receiveFingerSensorData(req: Request, res: Response) {
    try {
      const deviceSerialNumber = req.params.serialNumber;
      const fingerData = req.body;
      
      // Verify device exists
      const device = await deviceModel.findBySerialNumber(deviceSerialNumber);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
      
      // Check if device is assigned to a patient
      if (!device.patient_id) {
        return res.status(400).json({ message: 'Device is not assigned to a patient' });
      }
      
      // Update device status
      await deviceModel.update(device.id, {
        last_sync: new Date(),
        status: 'active'
      });
      
      // Find or create sleep data record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let sleepData = await sleepDataModel.findByPatientIdAndDate(device.patient_id, today);
      
      if (!sleepData) {
        sleepData = await sleepDataModel.create(
          device.patient_id,
          today,
          new Date(), // Start time is now
          device.id
        );
      }
      
      // Check if data is an array
      if (!Array.isArray(fingerData)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array.' });
      }
      
      // Prepare data for batch insertion
      const pulseOxBatch = fingerData.map((item: any) => ({
        sleep_data_id: sleepData.id,
        timestamp: new Date(item.timestamp),
        spo2: item.spo2,
        heart_rate: item.bpm // Map bpm to heart_rate
      }));
      
      // Insert data into pulse_ox_data table
      const insertedCount = await sensorDataModel.batchCreatePulseOxData(pulseOxBatch);
      
      return res.status(200).json({ 
        message: 'Finger sensor data received successfully',
        insertedCount
      });
    } catch (error) {
      console.error('Receive finger sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  // Controller untuk menerima data terpisah dari sensor belt (ecg, thoracic, breathing)
  async receiveBeltSensorData(req: Request, res: Response) {
    try {
      const deviceSerialNumber = req.params.serialNumber;
      const beltData = req.body;
      
      // Verify device exists
      const device = await deviceModel.findBySerialNumber(deviceSerialNumber);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
      
      // Check if device is assigned to a patient
      if (!device.patient_id) {
        return res.status(400).json({ message: 'Device is not assigned to a patient' });
      }
      
      // Update device status
      await deviceModel.update(device.id, {
        last_sync: new Date(),
        status: 'active'
      });
      
      // Find or create sleep data record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let sleepData = await sleepDataModel.findByPatientIdAndDate(device.patient_id, today);
      
      if (!sleepData) {
        sleepData = await sleepDataModel.create(
          device.patient_id,
          today,
          new Date(), // Start time is now
          device.id
        );
      }
      
      // Check if data is an array
      if (!Array.isArray(beltData)) {
        return res.status(400).json({ message: 'Invalid data format. Expected an array.' });
      }
      
      // Prepare data for batch insertion (for each sensor type)
      const ecgBatch: any[] = [];
      const thoracicBatch: any[] = [];
      const breathingBatch: any[] = [];
      
      for (const item of beltData) {
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
      
      // Insert data into respective tables
      const ecgCount = await sensorDataModel.batchCreateEcgData(ecgBatch);
      const thoracicCount = await sensorDataModel.batchCreateThoracicData(thoracicBatch);
      const breathingCount = await sensorDataModel.batchCreateBreathingData(breathingBatch);
      
      return res.status(200).json({ 
        message: 'Belt sensor data received successfully',
        insertedCount: {
          ecg: ecgCount,
          thoracic: thoracicCount,
          breathing: breathingCount
        }
      });
    } catch (error) {
      console.error('Receive belt sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  // Get data dari sensor jari
  async getFingerSensorData(req: Request, res: Response) {
    try {
      const sleepDataId = Number(req.params.sleepDataId);
      const { startTime, endTime, limit = 1000 } = req.query;
      
      // Verify sleep data exists
      const sleepData = await sleepDataModel.findById(sleepDataId);
      if (!sleepData) {
        return res.status(404).json({ message: 'Sleep data not found' });
      }
      
      let fingerData;
      
      if (startTime && endTime) {
        fingerData = await sensorDataModel.getPulseOxDataByTimeRange(
          sleepDataId,
          new Date(startTime as string),
          new Date(endTime as string),
          Number(limit)
        );
      } else {
        fingerData = await sensorDataModel.getLatestPulseOxData(sleepDataId, Number(limit));
      }
      
      // Transform data ke format yang diinginkan
      const transformedData = fingerData.map((item: any) => ({
        timestamp: item.record_time,
        spo2: item.spo2,
        bpm: item.heart_rate
      }));
      
      return res.status(200).json(transformedData);
    } catch (error) {
      console.error('Get finger sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  // Get data dari sensor belt
  async getBeltSensorData(req: Request, res: Response) {
    try {
      const sleepDataId = Number(req.params.sleepDataId);
      const { startTime, endTime, limit = 1000 } = req.query;
      
      // Verify sleep data exists
      const sleepData = await sleepDataModel.findById(sleepDataId);
      if (!sleepData) {
        return res.status(404).json({ message: 'Sleep data not found' });
      }
      
      // Get data from each sensor type and merge them based on timestamp
      let beltData = await sensorDataModel.getCombinedBeltDataByTimeRange(
        sleepDataId,
        startTime && endTime ? new Date(startTime as string) : undefined,
        startTime && endTime ? new Date(endTime as string) : undefined,
        Number(limit)
      );
      
      // Transform data ke format yang diinginkan
      const transformedData = beltData.map((item: any) => ({
        timestamp: item.record_time,
        ecg: item.ecg_mv,
        piezoelectric_voltage: item.piezoelectric_voltage,
        rcwl_amplitude: item.radar_amplitude // Gunakan radar_amplitude sebagai rcwl_amplitude
      }));
      
      return res.status(200).json(transformedData);
    } catch (error) {
      console.error('Get belt sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  // Controller untuk menerima data batch (kompatibilitas)
  async batchReceiveSensorData(req: Request, res: Response) {
    try {
      const deviceSerialNumber = req.params.serialNumber;
      const { batchData } = req.body;
      
      if (!Array.isArray(batchData) || batchData.length === 0) {
        return res.status(400).json({ message: 'Invalid batch data format' });
      }
      
      // Verify device exists
      const device = await deviceModel.findBySerialNumber(deviceSerialNumber);
      if (!device) {
        return res.status(404).json({ message: 'Device not found' });
      }
      
      // Check if device is assigned to a patient
      if (!device.patient_id) {
        return res.status(400).json({ message: 'Device is not assigned to a patient' });
      }
      
      // Update device status
      await deviceModel.update(device.id, {
        last_sync: new Date(),
        battery_level: batchData[batchData.length - 1].batteryLevel || device.battery_level,
        status: 'active'
      });
      
      // Find or create sleep data record for today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let sleepData = await sleepDataModel.findByPatientIdAndDate(device.patient_id, today);
      
      if (!sleepData) {
        sleepData = await sleepDataModel.create(
          device.patient_id,
          today,
          new Date(), // Start time is now
          device.id
        );
      }
      
      // Prepare batch sensor data for the new database structure
      const sensorDataBatch = batchData.map((item: any) => ({
        sleep_data_id: sleepData.id,
        timestamp: new Date(item.timestamp),
        ecg_mv: item.data?.ecg,
        spo2: item.data?.oxygen || item.data?.spo2,
        heart_rate: item.data?.heartRate || item.data?.bpm,
        raw_ir: item.data?.raw_ir,
        raw_red: item.data?.raw_red,
        piezoelectric_voltage: item.data?.thorax || item.data?.piezoelectric_voltage,
        radar_amplitude: item.data?.breathing || item.data?.radar_amplitude || item.data?.rcwl_amplitude,
        has_apnea_event: item.data?.hasApneaEvent || false
      }));
      
      // Store sensor data in batch using the new structure
      const insertedCount = await sensorDataModel.batchCreateAllSensorData(sensorDataBatch);
      
      return res.status(200).json({ 
        message: 'Batch data received successfully',
        insertedCount
      });
    } catch (error) {
      console.error('Batch receive sensor data error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
};