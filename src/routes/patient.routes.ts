import { Router } from 'express';
import { patientController } from '../controllers/patient.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// All routes require authentication and patient role
router.use(authMiddleware.verifyToken, authMiddleware.isPatient);

router.get('/profile', patientController.getProfile);
router.put('/profile', patientController.updateProfile);
router.get('/sleep-history', patientController.getSleepHistory);
router.get('/sleep-details/:id', patientController.getSleepDetails);
router.get('/device/:id/status', patientController.getDeviceStatus);

export default router;