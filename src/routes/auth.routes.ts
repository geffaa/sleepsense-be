import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authMiddleware } from '../middleware/auth.middleware';

// Create router instance
const router = Router();

// Public routes
router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/request-password-reset', authController.requestPasswordReset);
router.post('/reset-password', authController.resetPassword);
router.post('/refresh-token', authController.refreshToken);

// Protected routes
router.get('/me', authMiddleware.verifyToken, authController.me);
router.post('/change-password', authMiddleware.verifyToken, authController.changePassword);
router.post('/logout', authMiddleware.verifyToken, authController.logout);

// Export router
export default router;