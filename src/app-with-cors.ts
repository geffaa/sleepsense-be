import express from 'express';
import cors from 'cors';
import { env } from './config/env';

// Import routes
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';
import deviceDataRoutes from './routes/deviceData.routes';

const app = express();

// Configure CORS to allow requests from frontend
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/data', deviceDataRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

app.get('/api/test', (req, res) => {
  res.status(200).json({ 
    message: 'API connection successful', 
    timestamp: new Date(),
    environment: env.nodeEnv
  });
});

// Start server
const port = env.port;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`CORS is enabled for: ${corsOptions.origin}`);
});

export default app;