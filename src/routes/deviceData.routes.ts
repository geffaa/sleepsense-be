import { Router } from 'express';
import { deviceDataController } from '../controllers/deviceData.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Endpoint lama untuk kompatibilitas
router.get('/sensor-data/:sleepDataId', authMiddleware.verifyToken, deviceDataController.getSensorData);
router.post('/device/:serialNumber/data', authMiddleware.verifyApiKey, deviceDataController.receiveSensorData);
router.post('/device/:serialNumber/batch-data', authMiddleware.verifyApiKey, deviceDataController.batchReceiveSensorData);

// Endpoint baru untuk sensor jari (pulse oximeter)
router.post('/device/:serialNumber/finger-data', 
  authMiddleware.verifyApiKey, 
  deviceDataController.receiveFingerSensorData
);

// Endpoint untuk mendapatkan data sensor jari
router.get('/finger-data/:sleepDataId', 
  authMiddleware.verifyToken, 
  deviceDataController.getFingerSensorData
);

// Endpoint baru untuk sensor belt (ecg, thoracic, breathing)
router.post('/device/:serialNumber/belt-data', 
  authMiddleware.verifyApiKey, 
  deviceDataController.receiveBeltSensorData
);

// Endpoint untuk mendapatkan data sensor belt
router.get('/belt-data/:sleepDataId', 
  authMiddleware.verifyToken, 
  deviceDataController.getBeltSensorData
);

export default router;