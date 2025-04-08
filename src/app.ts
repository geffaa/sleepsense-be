import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { env } from './config/env';
import { initializeRealTimeServices } from './server/websocket-server';

// Import routes
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';
import deviceDataRoutes from './routes/deviceData.routes';

const app = express();

// Create HTTP server
const server = createServer(app);

// Middleware
app.use(cors());
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

// Inisialisasi WebSocket server dan koneksi MQTT
initializeRealTimeServices(server);

// Start server
const port = env.port;
server.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`WebSocket server available at ws://localhost:${port}/api/ws`);
});

export default app;