import pool from '../config/db';
import { Patient } from '../types';

export const patientModel = {
  async create(userId: number): Promise<Patient> {
    const result = await pool.query(
      'INSERT INTO patients (user_id) VALUES ($1) RETURNING *',
      [userId]
    );
    
    return result.rows[0];
  },
  
  async findByUserId(userId: number): Promise<Patient | null> {
    const result = await pool.query('SELECT * FROM patients WHERE user_id = $1', [userId]);
    return result.rows[0] || null;
  },
  
  async update(
    patientId: number, 
    data: {
      gender?: string;
      age?: number;
      height?: number;
      weight?: number;
      medical_conditions?: string[];
      medications?: string[];
      doctor_id?: number;
    }
  ): Promise<Patient | null> {
    const currentData = await pool.query('SELECT * FROM patients WHERE id = $1', [patientId]);
    
    if (currentData.rows.length === 0) {
      return null;
    }
    
    const patient = currentData.rows[0];
    
    const updatedData = {
      gender: data.gender !== undefined ? data.gender : patient.gender,
      age: data.age !== undefined ? data.age : patient.age,
      height: data.height !== undefined ? data.height : patient.height,
      weight: data.weight !== undefined ? data.weight : patient.weight,
      medical_conditions: data.medical_conditions !== undefined 
        ? data.medical_conditions 
        : patient.medical_conditions,
      medications: data.medications !== undefined ? data.medications : patient.medications,
      doctor_id: data.doctor_id !== undefined ? data.doctor_id : patient.doctor_id,
    };
    
    const result = await pool.query(
      'UPDATE patients SET gender = $1, age = $2, height = $3, weight = $4, medical_conditions = $5, medications = $6, doctor_id = $7, updated_at = NOW() WHERE id = $8 RETURNING *',
      [
        updatedData.gender, 
        updatedData.age, 
        updatedData.height, 
        updatedData.weight, 
        updatedData.medical_conditions, 
        updatedData.medications, 
        updatedData.doctor_id, 
        patientId
      ]
    );
    
    return result.rows[0];
  },
  
  async getAllPatientsForDoctor(doctorId: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT 
        p.id, 
        u.full_name, 
        p.age, 
        p.gender,
        p.height,
        p.weight,
        p.medical_conditions,
        p.medications,
        (
          SELECT MAX(sd.date)
          FROM sleep_data sd
          WHERE sd.patient_id = p.id
        ) as last_analysis_date,
        (
          SELECT sa.ahi
          FROM sleep_analysis sa
          JOIN sleep_data sd ON sa.sleep_data_id = sd.id
          WHERE sd.patient_id = p.id
          ORDER BY sd.date DESC
          LIMIT 1
        ) as latest_ahi,
        (
          SELECT sa.severity
          FROM sleep_analysis sa
          JOIN sleep_data sd ON sa.sleep_data_id = sd.id
          WHERE sd.patient_id = p.id
          ORDER BY sd.date DESC
          LIMIT 1
        ) as severity
      FROM patients p
      JOIN users u ON p.user_id = u.id
      WHERE p.doctor_id = $1
      ORDER BY u.full_name`,
      [doctorId]
    );
    
    return result.rows;
  }
};