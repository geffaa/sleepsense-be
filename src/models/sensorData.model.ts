import pool from '../config/db';
import { SensorData } from '../types';

export const sensorDataModel = {
  // Method to record ECG data
  async createEcgData(
    sleepDataId: number,
    timestamp: Date,
    ecgMv: number | null
  ): Promise<any> {
    if (ecgMv === undefined || ecgMv === null) return null;
    
    const result = await pool.query(
      `INSERT INTO ecg_data 
       (sleep_data_id, record_time, ecg_mv) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [sleepDataId, timestamp, ecgMv]
    );
    
    return result.rows[0];
  },

  // Method to record pulse oximeter data
  async createPulseOxData(
    sleepDataId: number,
    timestamp: Date,
    data: {
      spo2?: number | null;
      heart_rate?: number | null;
      raw_ir?: number | null;
      raw_red?: number | null;
    }
  ): Promise<any> {
    // Only insert if at least one value is present
    if (Object.values(data).every(v => v === undefined || v === null)) return null;
    
    const result = await pool.query(
      `INSERT INTO pulse_ox_data 
       (sleep_data_id, record_time, spo2, heart_rate, raw_ir, raw_red) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        sleepDataId,
        timestamp,
        data.spo2 || null,
        data.heart_rate || null,
        data.raw_ir || null,
        data.raw_red || null
      ]
    );
    
    return result.rows[0];
  },

  // Method to record thoracic movement data
  async createThoracicData(
    sleepDataId: number,
    timestamp: Date,
    piezoelectricVoltage: number | null
  ): Promise<any> {
    if (piezoelectricVoltage === undefined || piezoelectricVoltage === null) return null;
    
    const result = await pool.query(
      `INSERT INTO thoracic_data 
       (sleep_data_id, record_time, piezoelectric_voltage) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [sleepDataId, timestamp, piezoelectricVoltage]
    );
    
    return result.rows[0];
  },

  // Method to record breathing pattern data
  async createBreathingData(
    sleepDataId: number,
    timestamp: Date,
    radarAmplitude: number | null
  ): Promise<any> {
    if (radarAmplitude === undefined || radarAmplitude === null) return null;
    
    const result = await pool.query(
      `INSERT INTO breathing_data 
       (sleep_data_id, record_time, radar_amplitude) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [sleepDataId, timestamp, radarAmplitude]
    );
    
    return result.rows[0];
  },

  // Method to record apnea events
  async createApneaEvent(
    sleepDataId: number,
    timestamp: Date,
    hasApneaEvent: boolean,
    severity?: string,
    duration?: number
  ): Promise<any> {
    if (!hasApneaEvent) return null;
    
    const result = await pool.query(
      `INSERT INTO apnea_events 
       (sleep_data_id, record_time, has_apnea_event, severity, duration) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [sleepDataId, timestamp, hasApneaEvent, severity || null, duration || null]
    );
    
    return result.rows[0];
  },
  
  // New combined method to create all sensor data at once
  async createAllSensorData(
    sleepDataId: number,
    timestamp: Date,
    data: {
      ecg_mv?: number | null;
      spo2?: number | null;
      heart_rate?: number | null;
      raw_ir?: number | null;
      raw_red?: number | null;
      piezoelectric_voltage?: number | null;
      radar_amplitude?: number | null;
      has_apnea_event?: boolean;
      apnea_severity?: string;
      apnea_duration?: number;
    }
  ): Promise<any> {
    // Create all sensor data in parallel
    const promises = [];
    
    if (data.ecg_mv !== undefined && data.ecg_mv !== null) {
      promises.push(this.createEcgData(sleepDataId, timestamp, data.ecg_mv));
    }
    
    const pulseOxData = {
      spo2: data.spo2,
      heart_rate: data.heart_rate,
      raw_ir: data.raw_ir,
      raw_red: data.raw_red
    };
    
    if (Object.values(pulseOxData).some(v => v !== undefined && v !== null)) {
      promises.push(this.createPulseOxData(sleepDataId, timestamp, pulseOxData));
    }
    
    if (data.piezoelectric_voltage !== undefined && data.piezoelectric_voltage !== null) {
      promises.push(this.createThoracicData(sleepDataId, timestamp, data.piezoelectric_voltage));
    }
    
    if (data.radar_amplitude !== undefined && data.radar_amplitude !== null) {
      promises.push(this.createBreathingData(sleepDataId, timestamp, data.radar_amplitude));
    }
    
    if (data.has_apnea_event) {
      promises.push(this.createApneaEvent(
        sleepDataId, 
        timestamp, 
        true, 
        data.apnea_severity, 
        data.apnea_duration
      ));
    }
    
    // Wait for all inserts to complete
    const results = await Promise.all(promises);
    
    // Return a combined result
    return {
      timestamp,
      data: {
        ecg_mv: data.ecg_mv,
        spo2: data.spo2,
        heart_rate: data.heart_rate,
        raw_ir: data.raw_ir, 
        raw_red: data.raw_red,
        piezoelectric_voltage: data.piezoelectric_voltage,
        radar_amplitude: data.radar_amplitude,
        has_apnea_event: data.has_apnea_event || false,
        apnea_severity: data.apnea_severity,
        apnea_duration: data.apnea_duration
      }
    };
  },
  
  // Batch creation methods for each sensor type
  async batchCreateEcgData(
    ecgRecords: Array<{
      sleep_data_id: number;
      timestamp: Date;
      ecg_mv: number;
    }>
  ): Promise<number> {
    if (ecgRecords.length === 0) return 0;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    ecgRecords.forEach(record => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        record.sleep_data_id,
        record.timestamp,
        record.ecg_mv
      );
    });
    
    const query = `
      INSERT INTO ecg_data 
      (sleep_data_id, record_time, ecg_mv) 
      VALUES ${placeholders.join(',')}
      ON CONFLICT (sleep_data_id, record_time) DO NOTHING
    `;
    
    const result = await pool.query(query, values);
    return result.rowCount ?? 0;
  },
  
  async batchCreatePulseOxData(
    pulseOxRecords: Array<{
      sleep_data_id: number;
      timestamp: Date;
      spo2?: number | null;
      heart_rate?: number | null;
      raw_ir?: number | null;
      raw_red?: number | null;
    }>
  ): Promise<number> {
    if (pulseOxRecords.length === 0) return 0;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    pulseOxRecords.forEach(record => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        record.sleep_data_id,
        record.timestamp,
        record.spo2 || null,
        record.heart_rate || null,
        record.raw_ir || null,
        record.raw_red || null
      );
    });
    
    const query = `
      INSERT INTO pulse_ox_data 
      (sleep_data_id, record_time, spo2, heart_rate, raw_ir, raw_red) 
      VALUES ${placeholders.join(',')}
      ON CONFLICT (sleep_data_id, record_time) DO NOTHING
    `;
    
    const result = await pool.query(query, values);
    return result.rowCount ?? 0;
  },
  
  async batchCreateThoracicData(
    thoracicRecords: Array<{
      sleep_data_id: number;
      timestamp: Date;
      piezoelectric_voltage: number;
    }>
  ): Promise<number> {
    if (thoracicRecords.length === 0) return 0;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    thoracicRecords.forEach(record => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        record.sleep_data_id,
        record.timestamp,
        record.piezoelectric_voltage
      );
    });
    
    const query = `
      INSERT INTO thoracic_data 
      (sleep_data_id, record_time, piezoelectric_voltage) 
      VALUES ${placeholders.join(',')}
      ON CONFLICT (sleep_data_id, record_time) DO NOTHING
    `;
    
    const result = await pool.query(query, values);
    return result.rowCount ?? 0;
  },
  
  async batchCreateBreathingData(
    breathingRecords: Array<{
      sleep_data_id: number;
      timestamp: Date;
      radar_amplitude: number;
    }>
  ): Promise<number> {
    if (breathingRecords.length === 0) return 0;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    breathingRecords.forEach(record => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        record.sleep_data_id,
        record.timestamp,
        record.radar_amplitude
      );
    });
    
    const query = `
      INSERT INTO breathing_data 
      (sleep_data_id, record_time, radar_amplitude) 
      VALUES ${placeholders.join(',')}
      ON CONFLICT (sleep_data_id, record_time) DO NOTHING
    `;
    
    const result = await pool.query(query, values);
    return result.rowCount ?? 0;
  },
  
  // Helper method for creating apnea event batch
  async createApneaBatch(
    apneaRecords: Array<{
      sleep_data_id: number;
      timestamp: Date;
      has_apnea_event: boolean;
      severity?: string;
      duration?: number;
    }>
  ): Promise<number> {
    if (apneaRecords.length === 0) return 0;
    
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    apneaRecords.forEach(record => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      values.push(
        record.sleep_data_id,
        record.timestamp,
        record.has_apnea_event,
        record.severity || null,
        record.duration || null
      );
    });
    
    const query = `
      INSERT INTO apnea_events 
      (sleep_data_id, record_time, has_apnea_event, severity, duration) 
      VALUES ${placeholders.join(',')}
      ON CONFLICT (sleep_data_id, record_time) DO NOTHING
    `;
    
    const result = await pool.query(query, values);
    return result.rowCount ?? 0;
  },
  
  // Batch creation for all sensor data (compatibility method)
  async batchCreateAllSensorData(
    sensorDataArray: Array<{
      sleep_data_id: number;
      timestamp: Date;
      ecg_mv?: number | null;
      spo2?: number | null;
      heart_rate?: number | null;
      raw_ir?: number | null;
      raw_red?: number | null;
      piezoelectric_voltage?: number | null;
      radar_amplitude?: number | null;
      has_apnea_event?: boolean;
      apnea_severity?: string;
      apnea_duration?: number;
    }>
  ): Promise<number> {
    // If array is empty, return 0
    if (sensorDataArray.length === 0) return 0;
    
    // Group records by data type
    const ecgRecords: any[] = [];
    const pulseOxRecords: any[] = [];
    const thoracicRecords: any[] = [];
    const breathingRecords: any[] = [];
    const apneaRecords: any[] = [];
    
    sensorDataArray.forEach(data => {
      if (data.ecg_mv !== undefined && data.ecg_mv !== null) {
        ecgRecords.push({
          sleep_data_id: data.sleep_data_id,
          timestamp: data.timestamp,
          ecg_mv: data.ecg_mv
        });
      }
      
      const hasPulseOx = data.spo2 !== undefined || data.heart_rate !== undefined || 
                         data.raw_ir !== undefined || data.raw_red !== undefined;
      
      if (hasPulseOx) {
        pulseOxRecords.push({
          sleep_data_id: data.sleep_data_id,
          timestamp: data.timestamp,
          spo2: data.spo2 || null,
          heart_rate: data.heart_rate || null,
          raw_ir: data.raw_ir || null,
          raw_red: data.raw_red || null
        });
      }
      
      if (data.piezoelectric_voltage !== undefined && data.piezoelectric_voltage !== null) {
        thoracicRecords.push({
          sleep_data_id: data.sleep_data_id,
          timestamp: data.timestamp,
          piezoelectric_voltage: data.piezoelectric_voltage
        });
      }
      
      if (data.radar_amplitude !== undefined && data.radar_amplitude !== null) {
        breathingRecords.push({
          sleep_data_id: data.sleep_data_id,
          timestamp: data.timestamp,
          radar_amplitude: data.radar_amplitude
        });
      }
      
      if (data.has_apnea_event) {
        apneaRecords.push({
          sleep_data_id: data.sleep_data_id,
          timestamp: data.timestamp,
          has_apnea_event: true,
          severity: data.apnea_severity || null,
          duration: data.apnea_duration || null
        });
      }
    });
    
    // Run all batch inserts in parallel
    const results = await Promise.all([
      this.batchCreateEcgData(ecgRecords),
      this.batchCreatePulseOxData(pulseOxRecords),
      this.batchCreateThoracicData(thoracicRecords),
      this.batchCreateBreathingData(breathingRecords),
      this.createApneaBatch(apneaRecords)
    ]);
    
    // Return total number of inserted records
    return results.reduce((total, count) => total + count, 0);
  },
  
  // Get sensor data using the database's combined view or function
  async getSensorDataByTimeRange(
    sleepDataId: number, 
    startTime: Date, 
    endTime: Date,
    limit = 1000
  ): Promise<SensorData[]> {
    const result = await pool.query(
      `SELECT * FROM get_combined_sensor_data($1, $2, $3, $4)`,
      [sleepDataId, startTime, endTime, limit]
    );
    
    // Transform data to match the expected SensorData interface
    return result.rows.map(row => ({
      id: 0, // The combined view doesn't have an ID
      sleep_data_id: row.sleep_data_id,
      timestamp: row.record_time,
      ecg: row.ecg_mv,
      oxygen: row.spo2,
      thorax: row.piezoelectric_voltage,
      breathing: row.radar_amplitude,
      heart_rate: row.heart_rate,
      has_apnea_event: row.has_apnea_event,
      created_at: new Date() // The combined view doesn't have created_at
    }));
  },
  
  // Get latest sensor data with combined view
  async getLatestSensorData(sleepDataId: number, limit = 500): Promise<SensorData[]> {
    const now = new Date();
    // Get the data from the last 24 hours
    const startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const result = await pool.query(
      `SELECT * FROM get_combined_sensor_data($1, $2, $3, $4) ORDER BY record_time DESC LIMIT $5`,
      [sleepDataId, startTime, now, 10000, limit]
    );
    
    // Transform data to match the expected SensorData interface
    const data = result.rows.map(row => ({
      id: 0, // The combined view doesn't have an ID
      sleep_data_id: row.sleep_data_id,
      timestamp: row.record_time,
      ecg: row.ecg_mv,
      oxygen: row.spo2,
      thorax: row.piezoelectric_voltage,
      breathing: row.radar_amplitude,
      heart_rate: row.heart_rate,
      has_apnea_event: row.has_apnea_event,
      created_at: new Date() // The combined view doesn't have created_at
    }));
    
    return data.reverse(); // Reverse to get chronological order
  },
  
  // Get pulse oximeter data by time range (for finger sensor)
  async getPulseOxDataByTimeRange(
    sleepDataId: number,
    startTime: Date,
    endTime: Date,
    limit = 1000
  ): Promise<any[]> {
    const result = await pool.query(
      `SELECT * FROM pulse_ox_data 
       WHERE sleep_data_id = $1 AND record_time BETWEEN $2 AND $3
       ORDER BY record_time
       LIMIT $4`,
      [sleepDataId, startTime, endTime, limit]
    );
    
    return result.rows;
  },
  
  // Get latest pulse oximeter data (for finger sensor)
  async getLatestPulseOxData(sleepDataId: number, limit = 500): Promise<any[]> {
    // Hapus filter waktu
    const result = await pool.query(
      `SELECT * FROM pulse_ox_data 
       WHERE sleep_data_id = $1
       ORDER BY record_time DESC
       LIMIT $2`,
      [sleepDataId, limit]
    );
    
    return result.rows.reverse();
  },
  
  // Get combined belt data (ECG, thoracic, breathing) by time range
  async getCombinedBeltDataByTimeRange(
    sleepDataId: number,
    startTime?: Date,
    endTime?: Date,
    limit = 1000
  ): Promise<any[]> {
    // Prepare base query for all timestamps within requested timeframe
    let baseQuery = `
      WITH all_timestamps AS (
        SELECT record_time 
        FROM (
            SELECT record_time FROM ecg_data WHERE sleep_data_id = $1
            UNION
            SELECT record_time FROM thoracic_data WHERE sleep_data_id = $1
            UNION
            SELECT record_time FROM breathing_data WHERE sleep_data_id = $1
        ) AS combined_times
    `;
    
    const queryParams: any[] = [sleepDataId];
    let paramIndex = 2;
    
    // Add time constraints if provided
    if (startTime && endTime) {
      baseQuery += ` WHERE record_time BETWEEN $${paramIndex} AND $${paramIndex+1} `;
      queryParams.push(startTime, endTime);
      paramIndex += 2;
    }
    
    baseQuery += ` ORDER BY record_time `;
    
    if (limit) {
      baseQuery += ` LIMIT $${paramIndex}`;
      queryParams.push(limit);
    }
    
    baseQuery += `)`;
    
    // Full query to join all sensor data on timestamps
    const fullQuery = `
      ${baseQuery}
      SELECT 
        at.record_time,
        e.ecg_mv,
        t.piezoelectric_voltage,
        b.radar_amplitude
      FROM all_timestamps at
      LEFT JOIN ecg_data e ON at.record_time = e.record_time AND e.sleep_data_id = $1
      LEFT JOIN thoracic_data t ON at.record_time = t.record_time AND t.sleep_data_id = $1
      LEFT JOIN breathing_data b ON at.record_time = b.record_time AND b.sleep_data_id = $1
      ORDER BY at.record_time
    `;
    
    const result = await pool.query(fullQuery, queryParams);
    return result.rows;
  },
  
  // Get sleep event data 
  async getSleepEventData(sleepEventId: number, margin = 30): Promise<SensorData[]> {
    // Get the sleep event details first
    const event = await pool.query('SELECT * FROM sleep_events WHERE id = $1', [sleepEventId]);
    
    if (event.rows.length === 0) {
      return [];
    }
    
    const sleepEvent = event.rows[0];
    const sleepDataId = sleepEvent.sleep_data_id;
    const startTime = new Date(sleepEvent.start_time);
    
    // Calculate time range with margin
    const marginBefore = new Date(startTime);
    marginBefore.setSeconds(marginBefore.getSeconds() - margin);
    
    // Add duration + margin seconds to start time
    const marginAfter = new Date(startTime);
    marginAfter.setSeconds(marginAfter.getSeconds() + sleepEvent.duration + margin);
    
    // Use the combined view to get data
    return this.getSensorDataByTimeRange(sleepDataId, marginBefore, marginAfter);
  }
};