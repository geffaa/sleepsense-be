import { Request, Response } from 'express';
import { doctorModel } from '../models/doctor.model';
import { patientModel } from '../models/patient.model';
import { sleepDataModel } from '../models/sleepData.model';
import { sleepAnalysisModel } from '../models/sleepAnalysis.model';
import { sleepEventModel } from '../models/sleepEvent.model';

export const doctorController = {
  async getProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      
      const doctor = await doctorModel.findByUserId(userId);
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found' });
      }
      
      return res.status(200).json({ doctor });
    } catch (error) {
      console.error('Get doctor profile error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async updateProfile(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { specialty, licenseNumber } = req.body;
      
      const doctor = await doctorModel.findByUserId(userId);
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor profile not found' });
      }
      
      const updatedDoctor = await doctorModel.update(doctor.id, {
        specialty,
        license_number: licenseNumber
      });
      
      return res.status(200).json({ doctor: updatedDoctor });
    } catch (error) {
      console.error('Update doctor profile error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async getPatients(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      
      const patients = await patientModel.getAllPatientsForDoctor(userId);
      
      return res.status(200).json({ patients });
    } catch (error) {
      console.error('Get patients error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async getPatientDetails(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const patientId = Number(req.params.id);
      
      // Verify that doctor has access to this patient
      const patients = await patientModel.getAllPatientsForDoctor(userId);
      const patientExists = patients.some(p => p.id === patientId);
      
      if (!patientExists) {
        return res.status(403).json({ message: 'You do not have access to this patient' });
      }
      
      // Get patient sleep history
      const sleepHistory = await sleepDataModel.getPatientSleepHistoryWithAnalysis(patientId, 30, 0);
      
      return res.status(200).json({
        patient: patients.find(p => p.id === patientId),
        sleepHistory
      });
    } catch (error) {
      console.error('Get patient details error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async getPendingApprovals(req: Request, res: Response) {
    try {
      const { limit = 50, offset = 0 } = req.query;
      
      const pendingAnalyses = await sleepAnalysisModel.getPendingAnalyses(
        Number(limit),
        Number(offset)
      );
      
      return res.status(200).json({ pendingApprovals: pendingAnalyses });
    } catch (error) {
      console.error('Get pending approvals error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async approveAnalysis(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const analysisId = Number(req.params.id);
      const { notes } = req.body;
      
      const updated = await sleepAnalysisModel.updateStatus(
        analysisId,
        'approved',
        userId,
        notes
      );
      
      if (!updated) {
        return res.status(404).json({ message: 'Analysis not found' });
      }
      
      return res.status(200).json({ 
        message: 'Analysis approved successfully',
        analysis: updated
      });
    } catch (error) {
      console.error('Approve analysis error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async rejectAnalysis(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const analysisId = Number(req.params.id);
      const { notes } = req.body;
      
      if (!notes) {
        return res.status(400).json({ message: 'Notes are required for rejecting an analysis' });
      }
      
      const updated = await sleepAnalysisModel.updateStatus(
        analysisId,
        'rejected',
        userId,
        notes
      );
      
      if (!updated) {
        return res.status(404).json({ message: 'Analysis not found' });
      }
      
      return res.status(200).json({ 
        message: 'Analysis rejected successfully',
        analysis: updated
      });
    } catch (error) {
      console.error('Reject analysis error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
};