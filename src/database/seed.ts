import pool from '../config/db';
import bcrypt from 'bcrypt';

const seedDatabase = async () => {
  try {
    console.log('Starting database seeding...');

    // Hash password untuk user
    const password = await bcrypt.hash('password123', 10);

    // 1. Create users
    console.log('Creating users...');
    const usersResult = await pool.query(`
      INSERT INTO users (email, password, full_name, role)
      VALUES 
        ('doctor1@example.com', $1, 'Dr. Sarah Johnson', 'doctor'),
        ('doctor2@example.com', $1, 'Dr. Michael Chen', 'doctor'),
        ('patient1@example.com', $1, 'John Doe', 'patient'),
        ('patient2@example.com', $1, 'Emma Smith', 'patient'),
        ('patient3@example.com', $1, 'David Brown', 'patient'),
        ('patient4@example.com', $1, 'Sophia Lee', 'patient')
      RETURNING id, email, full_name, role
    `, [password]);

    const users = usersResult.rows;
    console.log(`${users.length} users created successfully`);

    // Map user IDs
    const doctorUsers = users.filter(u => u.role === 'doctor');
    const patientUsers = users.filter(u => u.role === 'patient');

    // 2. Create doctors
    console.log('Creating doctor profiles...');
    const doctorsResult = await pool.query(`
      INSERT INTO doctors (user_id, specialty, license_number)
      VALUES 
        ($1, 'Sleep Medicine', 'SLP123456'),
        ($2, 'Pulmonology', 'PUL789012')
      RETURNING id, user_id
    `, [doctorUsers[0].id, doctorUsers[1].id]);

    const doctors = doctorsResult.rows;
    console.log(`${doctors.length} doctor profiles created successfully`);

    // 3. Create patients
    console.log('Creating patient profiles...');
    const patientsResult = await pool.query(`
      INSERT INTO patients (user_id, gender, age, height, weight, medical_conditions, medications, doctor_id)
      VALUES 
        ($1, 'Male', 45, 178, 86, ARRAY['Hypertension', 'Allergic Rhinitis'], ARRAY['Lisinopril 10mg'], $5),
        ($2, 'Female', 52, 165, 78, ARRAY['Type 2 Diabetes', 'GERD'], ARRAY['Metformin 500mg', 'Omeprazole 20mg'], $5),
        ($3, 'Male', 38, 182, 79, ARRAY['Asthma'], ARRAY['Albuterol'], $6),
        ($4, 'Female', 61, 160, 68, ARRAY['Hypertension', 'Osteoarthritis'], ARRAY['Amlodipine 5mg', 'Acetaminophen 500mg'], $6)
      RETURNING id, user_id, doctor_id
    `, [
      patientUsers[0].id, 
      patientUsers[1].id, 
      patientUsers[2].id, 
      patientUsers[3].id,
      doctorUsers[0].id, // Dr. Sarah Johnson
      doctorUsers[1].id  // Dr. Michael Chen
    ]);

    const patients = patientsResult.rows;
    console.log(`${patients.length} patient profiles created successfully`);

    // 4. Create devices
    console.log('Creating devices...');
    const devicesResult = await pool.query(`
      INSERT INTO devices (serial_number, patient_id, firmware_version, battery_level, status)
      VALUES 
        ('SS-2025-X1-28934', $1, '2.3.1', 85, 'active'),
        ('SS-2025-X1-28935', $2, '2.3.1', 72, 'active'),
        ('SS-2025-X1-28936', $3, '2.3.1', 93, 'active'),
        ('SS-2025-X1-28937', $4, '2.3.1', 68, 'active'),
        ('SS-2025-X1-28938', NULL, '2.3.1', 100, 'inactive')
      RETURNING id, serial_number, patient_id
    `, [patients[0].id, patients[1].id, patients[2].id, patients[3].id]);

    const devices = devicesResult.rows;
    console.log(`${devices.length} devices created successfully`);

    // 5. Create sleep data entries
    console.log('Creating sleep data entries...');
    
    // Helper for generating timestamps
    const daysAgo = (days: number): Date => {
      const date = new Date();
      date.setDate(date.getDate() - days);
      return date;
    };
    
    // Create sleep data for each patient for the past 7 days
    for (let i = 0; i < patients.length; i++) {
      const patient = patients[i];
      const device = devices.find(d => d.patient_id === patient.id);
      
      for (let day = 0; day < 7; day++) {
        const date = daysAgo(day);
        date.setHours(0, 0, 0, 0);
        
        const startTime = new Date(date);
        startTime.setHours(22, 30, 0); // 10:30 PM
        
        const endTime = new Date(date);
        endTime.setDate(endTime.getDate() + 1);
        endTime.setHours(6, 45, 0); // 6:45 AM
        
        const sleepDuration = 8.25 - (Math.random() * 0.5); // 7.75 to 8.25 hours
        const sleepQuality = Math.floor(65 + Math.random() * 30); // 65 to 95
        
        const sleepDataResult = await pool.query(`
          INSERT INTO sleep_data (patient_id, device_id, date, start_time, end_time, sleep_duration, sleep_quality)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
          RETURNING id
        `, [
          patient.id,
          device?.id || null,
          date,
          startTime,
          endTime,
          sleepDuration,
          sleepQuality
        ]);
        
        const sleepDataId = sleepDataResult.rows[0].id;
        
        // Determine AHI and events based on patient
        let apneaEvents, hypopneaEvents, ahi, severity;
        
        switch (i) {
          case 0: // John Doe - Moderate OSA
            apneaEvents = Math.floor(12 + Math.random() * 10);
            hypopneaEvents = Math.floor(8 + Math.random() * 6);
            ahi = (apneaEvents + hypopneaEvents) / sleepDuration;
            severity = 'moderate';
            break;
          case 1: // Emma Smith - Severe OSA
            apneaEvents = Math.floor(25 + Math.random() * 15);
            hypopneaEvents = Math.floor(15 + Math.random() * 10);
            ahi = (apneaEvents + hypopneaEvents) / sleepDuration;
            severity = 'severe';
            break;
          case 2: // David Brown - Mild OSA
            apneaEvents = Math.floor(4 + Math.random() * 4);
            hypopneaEvents = Math.floor(3 + Math.random() * 3);
            ahi = (apneaEvents + hypopneaEvents) / sleepDuration;
            severity = 'mild';
            break;
          default: // Sophia Lee - Moderate to Severe OSA
            apneaEvents = Math.floor(18 + Math.random() * 12);
            hypopneaEvents = Math.floor(10 + Math.random() * 8);
            ahi = (apneaEvents + hypopneaEvents) / sleepDuration;
            severity = ahi >= 30 ? 'severe' : 'moderate';
        }
        
        // Create sleep analysis
        const lowestOxygen = Math.floor(80 + Math.random() * 10);
        const avgOxygen = Math.floor(92 + Math.random() * 4);
        const timeBelow90 = Math.floor(apneaEvents * 1.5);
        
        // Set status - most recent is pending, others are approved
        let status = day === 0 ? 'pending' : 'approved';
        let doctorId = day === 0 ? null : patient.doctor_id;
        let doctorNotes = day === 0 ? null : 'Patient shows consistent sleep apnea patterns. Continue monitoring and current treatment plan.';
        let reviewedAt = day === 0 ? null : daysAgo(day - 1);
        
        await pool.query(`
          INSERT INTO sleep_analysis 
          (sleep_data_id, ahi, apnea_events, hypopnea_events, lowest_oxygen, avg_oxygen, time_below90, severity, status, doctor_id, doctor_notes, reviewed_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `, [
          sleepDataId,
          ahi,
          apneaEvents,
          hypopneaEvents,
          lowestOxygen,
          avgOxygen,
          timeBelow90,
          severity,
          status,
          doctorId,
          doctorNotes,
          reviewedAt
        ]);
        
        // Create sleep events
        for (let e = 0; e < apneaEvents; e++) {
          const eventStart = new Date(startTime);
          eventStart.setMinutes(eventStart.getMinutes() + Math.floor(Math.random() * sleepDuration * 60));
          
          const duration = Math.floor(10 + Math.random() * 20); // 10-30 seconds
          const oxygenDrop = 2 + Math.random() * 6; // 2-8% drop
          const eventSeverity = oxygenDrop > 5 ? 'moderate' : oxygenDrop > 3 ? 'mild' : 'mild';
          const confidence = 0.75 + Math.random() * 0.2; // 0.75-0.95
          
          await pool.query(`
            INSERT INTO sleep_events 
            (sleep_data_id, type, start_time, duration, oxygen_drop, severity, confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            sleepDataId,
            'apnea',
            eventStart,
            duration,
            oxygenDrop,
            eventSeverity,
            confidence
          ]);
        }
        
        for (let e = 0; e < hypopneaEvents; e++) {
          const eventStart = new Date(startTime);
          eventStart.setMinutes(eventStart.getMinutes() + Math.floor(Math.random() * sleepDuration * 60));
          
          const duration = Math.floor(8 + Math.random() * 12); // 8-20 seconds
          const oxygenDrop = 1 + Math.random() * 3; // 1-4% drop
          const eventSeverity = oxygenDrop > 3 ? 'moderate' : 'mild';
          const confidence = 0.8 + Math.random() * 0.15; // 0.8-0.95
          
          await pool.query(`
            INSERT INTO sleep_events 
            (sleep_data_id, type, start_time, duration, oxygen_drop, severity, confidence)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [
            sleepDataId,
            'hypopnea',
            eventStart,
            duration,
            oxygenDrop,
            eventSeverity,
            confidence
          ]);
        }
      }
    }
    
    console.log('Sleep data and analysis created successfully');
    
    // Create sensor data (just a sample for one sleep session)
    console.log('Creating sample sensor data for most recent sleep session...');
    const latestSleepDataResult = await pool.query(`
      SELECT id, start_time, end_time, sleep_duration
      FROM sleep_data
      ORDER BY date DESC, id DESC
      LIMIT 1
    `);
    
    if (latestSleepDataResult.rows.length > 0) {
      const sleepData = latestSleepDataResult.rows[0];
      const startTime = new Date(sleepData.start_time);
      const endTime = new Date(sleepData.end_time);
      
      // Create data points every 5 seconds for 10 minutes (120 points)
      // In a real scenario, you would have thousands of points
      for (let i = 0; i < 120; i++) {
        const timestamp = new Date(startTime);
        timestamp.setSeconds(timestamp.getSeconds() + (i * 5));
        
        // Create realistic data
        const ecg = Math.sin(i * 0.8) * 0.6 + Math.sin(i * 2.5) * 0.3 + (Math.random() - 0.5) * 0.15;
        const oxygen = 97 + Math.sin(i * 0.1) * 0.7 + (Math.random() - 0.5) * 0.4;
        const thorax = Math.sin(i * 0.3) * 0.8 + (Math.random() - 0.5) * 0.2;
        const breathing = thorax * 1.1 + (Math.random() - 0.5) * 0.15;
        const heartRate = 65 + Math.round(Math.sin(i * 0.1) * 5 + (Math.random() - 0.5) * 3);
        
        // Every 20 data points, simulate an apnea event
        const hasApneaEvent = (i >= 40 && i <= 50) || (i >= 90 && i <= 100);
        
        await pool.query(`
          INSERT INTO sensor_data 
          (sleep_data_id, timestamp, ecg, oxygen, thorax, breathing, heart_rate, has_apnea_event)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          sleepData.id,
          timestamp,
          ecg,
          hasApneaEvent ? (oxygen - 5 * Math.sin((i % 10) * 0.5)) : oxygen,
          thorax,
          hasApneaEvent ? (thorax * 0.2) : breathing,
          heartRate,
          hasApneaEvent
        ]);
      }
      
      console.log('Sample sensor data created successfully');
    }

    console.log('Database seeding completed successfully!');
    
    // Connection credentials to display
    console.log('\nDatabase Connection Information:');
    console.log('================================');
    console.log(`Host: ${process.env.DB_HOST || 'localhost'}`);
    console.log(`Port: ${process.env.DB_PORT || '5432'}`);
    console.log(`Database: ${process.env.DB_NAME || 'sleepsense_db'}`);
    console.log(`Username: ${process.env.DB_USER || 'postgres'}`);
    
    console.log('\nTest Users:');
    console.log('================================');
    users.forEach(user => {
      console.log(`${user.role.toUpperCase()}: ${user.email} (Password: password123)`);
    });
    
  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    // Close the pool connection
    await pool.end();
  }
};

// Run the seeder
seedDatabase();