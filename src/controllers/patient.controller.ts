import { Request, Response } from 'express';
import { patientModel } from '../models/patient.model';
import { sleepDataModel } from '../models/sleepData.model';
import { sleepAnalysisModel } from '../models/sleepAnalysis.model';
import { sleepEventModel } from '../models/sleepEvent.model';
import { deviceModel } from '../models/device.model';

export const patientController = {
  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      
      const patient = await patientModel.findByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      
      // Get associated devices
      const devices = await deviceModel.findByPatientId(patient.id);
      
      return res.status(200).json({
        patient,
        devices
      });
    } catch (error) {
      console.error('Get patient profile error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { gender, age, height, weight, medicalConditions, medications } = req.body;
      
      const patient = await patientModel.findByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      
      const updatedPatient = await patientModel.update(patient.id, {
        gender,
        age,
        height,
        weight,
        medical_conditions: medicalConditions,
        medications
      });
      
      return res.status(200).json({ patient: updatedPatient });
    } catch (error) {
      console.error('Update patient profile error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async getSleepHistory(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { limit = 30, offset = 0 } = req.query;
      
      const patient = await patientModel.findByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      
      const sleepHistory = await sleepDataModel.getPatientSleepHistoryWithAnalysis(
        patient.id,
        Number(limit),
        Number(offset)
      );
      
      return res.status(200).json({ sleepHistory });
    } catch (error) {
      console.error('Get sleep history error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async getSleepDetails(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const sleepDataId = Number(req.params.id);
      
      const patient = await patientModel.findByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      
      // Get sleep data
      const sleepData = await sleepDataModel.findById(sleepDataId);
      if (!sleepData || sleepData.patient_id !== patient.id) {
        return res.status(404).json({ message: 'Sleep data not found or not authorized' });
      }
      
      // Get analysis
      const analysis = await sleepAnalysisModel.findBySleepDataId(sleepDataId);
      
      // Get events
      const events = await sleepEventModel.findBySleepDataId(sleepDataId);
      
      return res.status(200).json({
        sleepData,
        analysis,
        events
      });
    } catch (error) {
      console.error('Get sleep details error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async getDeviceStatus(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const deviceId = Number(req.params.id);
      
      const patient = await patientModel.findByUserId(userId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient profile not found' });
      }
      
      // Get device
      const device = await deviceModel.findById(deviceId);
      if (!device || device.patient_id !== patient.id) {
        return res.status(404).json({ message: 'Device not found or not authorized' });
      }
      
      return res.status(200).json({ device });
    } catch (error) {
      console.error('Get device status error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
};