import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export const authMiddleware = {
  verifyToken(req: Request, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'Authentication token is required' });
    }
    
    try {
      const decoded = jwt.verify(token, env.jwt.secret);
      (req as any).user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }
  },
  
  isPatient(req: Request, res: Response, next: NextFunction) {
    if ((req as any).user.role !== 'patient') {
      return res.status(403).json({ message: 'Access denied. Patient role required' });
    }
    next();
  },
  
  isDoctor(req: Request, res: Response, next: NextFunction) {
    if ((req as any).user.role !== 'doctor') {
      return res.status(403).json({ message: 'Access denied. Doctor role required' });
    }
    next();
  },
  
  verifyApiKey(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'];
    
    // For IoT devices - you would implement a more secure API key verification
    // This is simplified for demonstration purposes
    if (!apiKey || apiKey !== process.env.IOT_API_KEY) {
      return res.status(401).json({ message: 'Valid API key is required' });
    }
    
    next();
  }
};