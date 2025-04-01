import pool from '../config/db';
import { SleepData } from '../types';

export const sleepDataModel = {
  async create(
    patientId: number, 
    date: Date, 
    startTime: Date, 
    deviceId?: number
  ): Promise<SleepData> {
    const result = await pool.query(
      'INSERT INTO sleep_data (patient_id, device_id, date, start_time) VALUES ($1, $2, $3, $4) RETURNING *',
      [patientId, deviceId || null, date, startTime]
    );
    
    return result.rows[0];
  },
  
  async findById(id: number): Promise<SleepData | null> {
    const result = await pool.query('SELECT * FROM sleep_data WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  async findByPatientIdAndDate(patientId: number, date: Date): Promise<SleepData | null> {
    const result = await pool.query(
      'SELECT * FROM sleep_data WHERE patient_id = $1 AND date = $2',
      [patientId, date]
    );
    return result.rows[0] || null;
  },
  
  async findByPatientId(patientId: number, limit = 30, offset = 0): Promise<SleepData[]> {
    const result = await pool.query(
      'SELECT * FROM sleep_data WHERE patient_id = $1 ORDER BY date DESC LIMIT $2 OFFSET $3',
      [patientId, limit, offset]
    );
    return result.rows;
  },
  
  async update(
    id: number, 
    data: {
      end_time?: Date;
      sleep_duration?: number;
      sleep_quality?: number;
    }
  ): Promise<SleepData | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;
    
    if (data.end_time !== undefined) {
      fields.push(`end_time = $${paramIndex}`);
      values.push(data.end_time);
      paramIndex++;
    }
    
    if (data.sleep_duration !== undefined) {
      fields.push(`sleep_duration = $${paramIndex}`);
      values.push(data.sleep_duration);
      paramIndex++;
    }
    
    if (data.sleep_quality !== undefined) {
      fields.push(`sleep_quality = $${paramIndex}`);
      values.push(data.sleep_quality);
      paramIndex++;
    }
    
    if (fields.length === 0) {
      // No fields to update
      const currentData = await pool.query('SELECT * FROM sleep_data WHERE id = $1', [id]);
      return currentData.rows[0] || null;
    }
    
    fields.push(`updated_at = NOW()`);
    
    const query = `
      UPDATE sleep_data 
      SET ${fields.join(', ')} 
      WHERE id = $${paramIndex} 
      RETURNING *
    `;
    
    values.push(id);
    
    const result = await pool.query(query, values);
    return result.rows[0] || null;
  },
  
  async getPatientSleepHistoryWithAnalysis(patientId: number, limit = 30, offset = 0): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        sd.id,
        sd.date,
        sd.sleep_duration,
        sd.sleep_quality,
        sa.ahi,
        sa.apnea_events,
        sa.hypopnea_events,
        sa.lowest_oxygen,
        sa.avg_oxygen,
        sa.severity,
        sa.status as analysis_status,
        sa.doctor_notes,
        sa.reviewed_at,
        (
          SELECT COUNT(*)
          FROM sleep_events se
          WHERE se.sleep_data_id = sd.id
        ) as total_events
      FROM sleep_data sd
      LEFT JOIN sleep_analysis sa ON sd.id = sa.sleep_data_id
      WHERE sd.patient_id = $1
      ORDER BY sd.date DESC
      LIMIT $2 OFFSET $3`,
      [patientId, limit, offset]
    );
    
    return result.rows;
  }
};