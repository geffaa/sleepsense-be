import { Router } from 'express';
import { doctorController } from '../controllers/doctor.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and doctor role
router.use(authMiddleware.verifyToken, authMiddleware.isDoctor);

router.get('/profile', doctorController.getProfile);
router.put('/profile', doctorController.updateProfile);
router.get('/patients', doctorController.getPatients);
router.get('/patients/:id', doctorController.getPatientDetails);
router.get('/pending-approvals', doctorController.getPendingApprovals);
router.post('/analysis/:id/approve', doctorController.approveAnalysis);
router.post('/analysis/:id/reject', doctorController.rejectAnalysis);

export default router;