import pool from '../config/db';
import { Doctor } from '../types';

export const doctorModel = {
  async create(userId: number, specialty?: string, licenseNumber?: string): Promise<Doctor> {
    const result = await pool.query(
      'INSERT INTO doctors (user_id, specialty, license_number) VALUES ($1, $2, $3) RETURNING *',
      [userId, specialty || null, licenseNumber || null]
    );
    
    return result.rows[0];
  },
  
  async findByUserId(userId: number): Promise<Doctor | null> {
    const result = await pool.query('SELECT * FROM doctors WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },
  
  async update(
    doctorId: number, 
    data: {
      specialty?: string;
      license_number?: string;
    }
  ): Promise<Doctor | null> {
    const currentData = await pool.query('SELECT * FROM doctors WHERE id = $1', [doctorId]);
    
    if (currentData.rows.length === 0) {
      return null;
    }
    
    const doctor = currentData.rows[0];
    
    const updatedData = {
      specialty: data.specialty !== undefined ? data.specialty : doctor.specialty,
      license_number: data.license_number !== undefined ? data.license_number : doctor.license_number,
    };
    
    const result = await pool.query(
      'UPDATE doctors SET specialty = $1, license_number = $2, updated_at = NOW() WHERE id = $3 RETURNING *',
      [updatedData.specialty, updatedData.license_number, doctorId]
    );
    
    return result.rows[0];
  },
  
  async getAllDoctors(): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        d.id, 
        u.id as user_id,
        u.full_name, 
        d.specialty, 
        d.license_number,
        (
          SELECT COUNT(*)
          FROM patients p
          WHERE p.doctor_id = u.id
        ) as patient_count
      FROM doctors d
      JOIN users u ON d.user_id = u.id
      ORDER BY u.full_name`,
    );
    
    return result.rows;
  }
};