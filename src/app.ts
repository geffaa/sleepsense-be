import express from 'express';
import cors from 'cors';
import { env } from './config/env';

// Import routes
import authRoutes from './routes/auth.routes';
import patientRoutes from './routes/patient.routes';
import doctorRoutes from './routes/doctor.routes';
import deviceDataRoutes from './routes/deviceData.routes';
import bcrypt from 'bcrypt';
import pool from './config/db';

const app = express();

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

app.get('/debug-password', async (req, res) => {
  try {
    const samplePassword = 'password123';
    const bcryptHash = await bcrypt.hash(samplePassword, 10);
    
    // Compare the hash we just created with a plain password
    const isValid = await bcrypt.compare(samplePassword, bcryptHash);
    
    // Get a user from database to test their hash
    const testUser = await pool.query('SELECT id, email, password FROM users LIMIT 1');
    const userHash = testUser.rows[0]?.password;
    
    // Test if we can verify with the stored hash
    const isUserValid = userHash ? await bcrypt.compare(samplePassword, userHash) : false;
    
    res.json({
      generatedHash: bcryptHash,
      hashVerifies: isValid,
      dbUserEmail: testUser.rows[0]?.email,
      dbUserHash: userHash,
      dbUserVerifies: isUserValid,
      bcryptVersion: bcrypt.genSaltSync(10).substring(0, 4) // Gives the prefix like $2a$ or $2b$
    });
  } catch (error) {
    res.status(500).json({ error: String(error) });
  }
});

// Start server
const port = env.port;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

export default app;