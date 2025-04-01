import pool from '../config/db';
import { SleepEvent, EventType, SeverityLevel } from '../types';

export const sleepEventModel = {
  async create(
    sleepDataId: number,
    type: EventType,
    startTime: Date,
    duration: number,
    data?: {
      oxygen_drop?: number;
      severity?: SeverityLevel;
      confidence?: number;
    }
  ): Promise<SleepEvent> {
    const result = await pool.query(
      `INSERT INTO sleep_events 
       (sleep_data_id, type, start_time, duration, oxygen_drop, severity, confidence) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        sleepDataId,
        type,
        startTime,
        duration,
        data?.oxygen_drop || null,
        data?.severity || null,
        data?.confidence || null
      ]
    );
    
    return result.rows[0];
  },
  
  async findById(id: number): Promise<SleepEvent | null> {
    const result = await pool.query('SELECT * FROM sleep_events WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  async findBySleepDataId(sleepDataId: number): Promise<SleepEvent[]> {
    const result = await pool.query(
      'SELECT * FROM sleep_events WHERE sleep_data_id = $1 ORDER BY start_time',
      [sleepDataId]
    );
    return result.rows;
  },
  
  async countEventsByTypeAndSleepDataId(sleepDataId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        type, 
        COUNT(*) as count,
        AVG(duration) as avg_duration,
        AVG(oxygen_drop) as avg_oxygen_drop
      FROM sleep_events 
      WHERE sleep_data_id = $1 
      GROUP BY type`,
      [sleepDataId]
    );
    
    return result.rows;
  }
};