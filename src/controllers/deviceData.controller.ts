import { Request, Response } from 'express';
import { deviceModel } from '../models/device.model';
import { sleepDataModel } from '../models/sleepData.model';
import { sensorDataModel } from '../models/sensorData.model';
import { SensorData } from '../types';

export const deviceDataController = {
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
          radar_amplitude: data.breathing || data.radar_amplitude, // Support both old and new field names
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
        radar_amplitude: item.data?.breathing || item.data?.radar_amplitude,
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