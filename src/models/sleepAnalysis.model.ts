import pool from '../config/db';
import { SleepAnalysis, AnalysisStatus, SeverityLevel } from '../types';

export const sleepAnalysisModel = {
  async create(
    sleepDataId: number,
    ahi: number,
    apneaEvents: number,
    hypopneaEvents: number,
    data?: {
      lowest_oxygen?: number;
      avg_oxygen?: number;
      time_below90?: number;
      severity?: SeverityLevel;
    }
  ): Promise<SleepAnalysis> {
    const result = await pool.query(
      `INSERT INTO sleep_analysis 
       (sleep_data_id, ahi, apnea_events, hypopnea_events, lowest_oxygen, avg_oxygen, time_below90, severity) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [
        sleepDataId,
        ahi,
        apneaEvents,
        hypopneaEvents,
        data?.lowest_oxygen || null,
        data?.avg_oxygen || null,
        data?.time_below90 || null,
        data?.severity || null
      ]
    );
    
    return result.rows[0];
  },
  
  async findById(id: number): Promise<SleepAnalysis | null> {
    const result = await pool.query('SELECT * FROM sleep_analysis WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  async findBySleepDataId(sleepDataId: number): Promise<SleepAnalysis | null> {
    const result = await pool.query('SELECT * FROM sleep_analysis WHERE sleep_data_id = $1', [sleepDataId]);
    return result.rows[0] || null;
  },
  
  async updateStatus(
    id: number,
    status: AnalysisStatus,
    doctorId: number,
    doctorNotes?: string
  ): Promise<SleepAnalysis | null> {
    const result = await pool.query(
      `UPDATE sleep_analysis 
       SET status = $1, doctor_id = $2, doctor_notes = $3, reviewed_at = NOW(), updated_at = NOW() 
       WHERE id = $4 
       RETURNING *`,
      [status, doctorId, doctorNotes || null, id]
    );
    
    return result.rows[0] || null;
  },
  
  async getPendingAnalyses(limit = 50, offset = 0): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        sa.id,
        sa.ahi,
        sa.apnea_events,
        sa.hypopnea_events,
        sa.lowest_oxygen,
        sa.avg_oxygen,
        sa.time_below90,
        sa.severity,
        sa.created_at,
        sd.date,
        p.id as patient_id,
        u.full_name as patient_name,
        p.age,
        p.gender
      FROM sleep_analysis sa
      JOIN sleep_data sd ON sa.sleep_data_id = sd.id
      JOIN patients p ON sd.patient_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE sa.status = 'pending'
      ORDER BY sd.date DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    
    return result.rows;
  },
  
  async getAnalysisCountByStatus(): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        status, 
        COUNT(*) as count 
      FROM sleep_analysis 
      GROUP BY status`
    );
    
    return result.rows;
  }
};