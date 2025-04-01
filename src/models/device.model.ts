import pool from '../config/db';
import { Device } from '../types';

export const deviceModel = {
  async create(serialNumber: string, patientId?: number): Promise<Device> {
    const result = await pool.query(
      'INSERT INTO devices (serial_number, patient_id) VALUES ($1, $2) RETURNING *',
      [serialNumber, patientId || null]
    );
    
    return result.rows[0];
  },
  
  async findById(id: number): Promise<Device | null> {
    const result = await pool.query('SELECT * FROM devices WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
  
  async findBySerialNumber(serialNumber: string): Promise<Device | null> {
    const result = await pool.query('SELECT * FROM devices WHERE serial_number = $1', [serialNumber]);
    return result.rows[0] || null;
  },
  
  async findByPatientId(patientId: number): Promise<Device[]> {
    const result = await pool.query('SELECT * FROM devices WHERE patient_id = $1', [patientId]);
    return result.rows;
  },
  
  async update(
    deviceId: number, 
    data: {
      patient_id?: number;
      firmware_version?: string;
      last_sync?: Date;
      battery_level?: number;
      status?: string;
    }
  ): Promise<Device | null> {
    const currentDevice = await pool.query('SELECT * FROM devices WHERE id = $1', [deviceId]);
    
    if (currentDevice.rows.length === 0) {
      return null;
    }
    
    const device = currentDevice.rows[0];
    
    const updatedData = {
      patient_id: data.patient_id !== undefined ? data.patient_id : device.patient_id,
      firmware_version: data.firmware_version !== undefined ? data.firmware_version : device.firmware_version,
      last_sync: data.last_sync !== undefined ? data.last_sync : device.last_sync,
      battery_level: data.battery_level !== undefined ? data.battery_level : device.battery_level,
      status: data.status !== undefined ? data.status : device.status,
    };
    
    const result = await pool.query(
      `UPDATE devices 
       SET patient_id = $1, firmware_version = $2, last_sync = $3, 
           battery_level = $4, status = $5, updated_at = NOW() 
       WHERE id = $6 
       RETURNING *`,
      [
        updatedData.patient_id, 
        updatedData.firmware_version, 
        updatedData.last_sync, 
        updatedData.battery_level, 
        updatedData.status, 
        deviceId
      ]
    );
    
    return result.rows[0];
  }
};