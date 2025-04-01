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
        battery_level: data.batteryLevel,
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
      
      // Store sensor data
      await sensorDataModel.create(
        sleepData.id,
        new Date(timestamp),
        {
          ecg: data.ecg,
          oxygen: data.oxygen,
          thorax: data.thorax,
          breathing: data.breathing,
          heart_rate: data.heartRate,
          has_apnea_event: data.hasApneaEvent
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
      
      // Prepare batch sensor data
      const sensorDataBatch = batchData.map((item: any) => ({
        sleep_data_id: sleepData.id,
        timestamp: new Date(item.timestamp),
        ecg: item.data?.ecg,
        oxygen: item.data?.oxygen,
        thorax: item.data?.thorax,
        breathing: item.data?.breathing,
        heart_rate: item.data?.heartRate,
        has_apnea_event: item.data?.hasApneaEvent || false
      }));
      
      // Store sensor data in batch
      const insertedCount = await sensorDataModel.batchCreate(sensorDataBatch);
      
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