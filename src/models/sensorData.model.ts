import pool from '../config/db';
import { SensorData } from '../types';

export const sensorDataModel = {
  async create(
    sleepDataId: number,
    timestamp: Date,
    data: {
      ecg?: number | null;
      oxygen?: number | null;
      thorax?: number | null;
      breathing?: number | null;
      heart_rate?: number | null;
      has_apnea_event?: boolean;
    }
  ): Promise<SensorData> {
    // Pastikan nilai yang masuk ke database tidak undefined
    const ecg = data.ecg !== undefined ? data.ecg : null;
    const oxygen = data.oxygen !== undefined ? data.oxygen : null;
    const thorax = data.thorax !== undefined ? data.thorax : null;
    const breathing = data.breathing !== undefined ? data.breathing : null;
    const heart_rate = data.heart_rate !== undefined ? data.heart_rate : null;
    const has_apnea_event = data.has_apnea_event || false;

    const result = await pool.query(
      `INSERT INTO sensor_data 
       (sleep_data_id, timestamp, ecg, oxygen, thorax, breathing, heart_rate, has_apnea_event) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        sleepDataId,
        timestamp,
        ecg,
        oxygen,
        thorax,
        breathing,
        heart_rate,
        has_apnea_event
      ]
    );
    
    return result.rows[0];
  },
  
  async batchCreate(sensorDataArray: {
    sleep_data_id: number;
    timestamp: Date;
    ecg?: number | null;
    oxygen?: number | null;
    thorax?: number | null;
    breathing?: number | null;
    heart_rate?: number | null;
    has_apnea_event?: boolean;
  }[]): Promise<number> {
    // Jika array kosong, langsung return 0
    if (sensorDataArray.length === 0) return 0;
    
    // Buat array parameter dan placeholders untuk prepared statement
    const values: any[] = [];
    const placeholders: string[] = [];
    let paramIndex = 1;
    
    sensorDataArray.forEach((data) => {
      placeholders.push(`($${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++}, $${paramIndex++})`);
      
      values.push(
        data.sleep_data_id,
        data.timestamp,
        data.ecg !== undefined ? data.ecg : null,
        data.oxygen !== undefined ? data.oxygen : null,
        data.thorax !== undefined ? data.thorax : null,
        data.breathing !== undefined ? data.breathing : null,
        data.heart_rate !== undefined ? data.heart_rate : null,
        data.has_apnea_event === true
      );
    });
    
    const query = `
      INSERT INTO sensor_data 
      (sleep_data_id, timestamp, ecg, oxygen, thorax, breathing, heart_rate, has_apnea_event) 
      VALUES ${placeholders.join(',')}
    `;
    
    const result = await pool.query(query, values);
    // Pastikan rowCount tidak null dengan memberikan nilai default 0
    return result.rowCount ?? 0; // Gunakan nullish coalescing operator
  },
  
  // Metode lainnya tetap sama
  async getSensorDataByTimeRange(
    sleepDataId: number, 
    startTime: Date, 
    endTime: Date,
    limit = 1000
  ): Promise<SensorData[]> {
    const result = await pool.query(
      `SELECT * FROM sensor_data 
       WHERE sleep_data_id = $1 AND timestamp >= $2 AND timestamp <= $3 
       ORDER BY timestamp 
       LIMIT $4`,
      [sleepDataId, startTime, endTime, limit]
    );
    
    return result.rows;
  },
  
  async getLatestSensorData(sleepDataId: number, limit = 500): Promise<SensorData[]> {
    const result = await pool.query(
      `SELECT * FROM sensor_data 
       WHERE sleep_data_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2`,
      [sleepDataId, limit]
    );
    
    return result.rows.reverse(); // Reverse untuk mendapatkan urutan kronologis
  },
  
  async getSleepEventData(sleepEventId: number, margin = 30): Promise<SensorData[]> {
    // Dapatkan sensor data di sekitar sleep event dengan beberapa margin (dalam detik)
    const event = await pool.query('SELECT * FROM sleep_events WHERE id = $1', [sleepEventId]);
    
    if (event.rows.length === 0) {
      return [];
    }
    
    const sleepEvent = event.rows[0];
    const sleepDataId = sleepEvent.sleep_data_id;
    const startTime = new Date(sleepEvent.start_time);
    
    // Kurangi margin detik dari waktu mulai
    const marginBefore = new Date(startTime);
    marginBefore.setSeconds(marginBefore.getSeconds() - margin);
    
    // Tambahkan durasi + margin detik ke waktu mulai
    const marginAfter = new Date(startTime);
    marginAfter.setSeconds(marginAfter.getSeconds() + sleepEvent.duration + margin);
    
    const result = await pool.query(
      `SELECT * FROM sensor_data 
       WHERE sleep_data_id = $1 AND timestamp >= $2 AND timestamp <= $3 
       ORDER BY timestamp`,
      [sleepDataId, marginBefore, marginAfter]
    );
    
    return result.rows;
  }
};