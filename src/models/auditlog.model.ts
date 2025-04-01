// src/models/auditLog.model.ts
import pool from '../config/db';

interface AuditLogData {
  user_id?: number;
  action: string;
  table_name: string;
  record_id: number;
  old_data?: any;
  new_data?: any;
  ip_address?: string;
  user_agent?: string;
}

export const auditLogModel = {
  async create(data: AuditLogData) {
    try {
      const { 
        user_id, 
        action, 
        table_name, 
        record_id, 
        old_data, 
        new_data, 
        ip_address, 
        user_agent 
      } = data;
      
      const query = `
        INSERT INTO audit_logs 
        (user_id, action, table_name, record_id, old_data, new_data, ip_address, user_agent) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
        RETURNING id
      `;
      
      const values = [
        user_id || null,
        action,
        table_name,
        record_id,
        old_data ? JSON.stringify(old_data) : null,
        new_data ? JSON.stringify(new_data) : null,
        ip_address || null,
        user_agent || null
      ];
      
      const result = await pool.query(query, values);
      return result.rows[0];
    } catch (error) {
      console.error('Error creating audit log:', error);
      // Don't throw here - audit log failures shouldn't break main functionality
      return null;
    }
  },
  
  async findByUserId(userId: number, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await pool.query(query, [userId, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error finding audit logs by user ID:', error);
      throw error;
    }
  },
  
  async findByAction(action: string, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE action = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const result = await pool.query(query, [action, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error finding audit logs by action:', error);
      throw error;
    }
  },
  
  async findByTableAndRecord(tableName: string, recordId: number) {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE table_name = $1 AND record_id = $2 
        ORDER BY created_at DESC
      `;
      
      const result = await pool.query(query, [tableName, recordId]);
      return result.rows;
    } catch (error) {
      console.error('Error finding audit logs by table and record:', error);
      throw error;
    }
  },
  
  async findByDateRange(startDate: Date, endDate: Date, limit = 100, offset = 0) {
    try {
      const query = `
        SELECT * FROM audit_logs 
        WHERE created_at BETWEEN $1 AND $2 
        ORDER BY created_at DESC 
        LIMIT $3 OFFSET $4
      `;
      
      const result = await pool.query(query, [startDate, endDate, limit, offset]);
      return result.rows;
    } catch (error) {
      console.error('Error finding audit logs by date range:', error);
      throw error;
    }
  },
  
  // Admin function to clean up old logs
  async cleanupOldLogs(olderThanMonths: number = 6) {
    try {
      const query = `
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '$1 months'
      `;
      
      const result = await pool.query(query, [olderThanMonths]);
      return result.rowCount;
    } catch (error) {
      console.error('Error cleaning up old audit logs:', error);
      throw error;
    }
  }
};