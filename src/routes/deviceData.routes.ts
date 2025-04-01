import { Router } from 'express';
import { deviceDataController } from '../controllers/deviceData.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Routes for authenticated users
router.get('/sensor-data/:sleepDataId', authMiddleware.verifyToken, deviceDataController.getSensorData);

// Routes for IoT devices - secured with API key
router.post('/device/:serialNumber/data', authMiddleware.verifyApiKey, deviceDataController.receiveSensorData);
router.post('/device/:serialNumber/batch-data', authMiddleware.verifyApiKey, deviceDataController.batchReceiveSensorData);

export default router;