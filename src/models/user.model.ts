// src/models/user.model.ts
import pool from '../config/db';
import { User, UserRole } from '../types';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

export const userModel = {
  async create(email: string, password: string, fullName: string, role: UserRole): Promise<Omit<User, 'password'>> {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (email, password, full_name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, full_name, role, created_at, updated_at',
      [email, hashedPassword, fullName, role]
    );
    
    return result.rows[0];
  },
  
  async findByEmail(email: string): Promise<User | null> {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    return result.rows[0] || null;
  },
  
  async findById(id: number): Promise<Omit<User, 'password'> | null> {
    const result = await pool.query(
      'SELECT id, email, full_name, role, last_login, created_at, updated_at FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  },
  
  async updateProfile(id: number, fullName: string): Promise<Omit<User, 'password'> | null> {
    const result = await pool.query(
      'UPDATE users SET full_name = $1 WHERE id = $2 RETURNING id, email, full_name, role, created_at, updated_at',
      [fullName, id]
    );
    return result.rows[0] || null;
  },
  
  async changePassword(id: number, newPassword: string): Promise<boolean> {
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1 WHERE id = $2',
      [hashedPassword, id]
    );
    
    return (result.rowCount ?? 0) > 0;
  },
  
  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  },
  
  async updateLoginTimestamp(id: number): Promise<boolean> {
    const result = await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [id]
    );
    
    return (result.rowCount ?? 0) > 0;
  },
  
  async recordLoginAttempt(email: string): Promise<void> {
    await pool.query(
      'UPDATE users SET login_attempts = login_attempts + 1 WHERE email = $1',
      [email]
    );
  },
  
  async resetLoginAttempts(email: string): Promise<void> {
    await pool.query(
      'UPDATE users SET login_attempts = 0 WHERE email = $1',
      [email]
    );
  },
  
  async lockAccount(email: string, durationMinutes: number = 30): Promise<void> {
    await pool.query(
      'UPDATE users SET locked_until = NOW() + $1 * INTERVAL \'1 minute\' WHERE email = $2',
      [durationMinutes, email]
    );
  },
  
  async isAccountLocked(email: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT locked_until FROM users WHERE email = $1 AND locked_until > NOW()',
      [email]
    );
    
    return result.rows.length > 0;
  },
  
  async generatePasswordResetToken(email: string, expiresInHours: number = 24): Promise<string | null> {
    // Generate a random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiry = new Date();
    expiry.setHours(expiry.getHours() + expiresInHours);
    
    // Update the user record
    const result = await pool.query(
      'UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE email = $3 RETURNING id',
      [resetToken, expiry, email]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return resetToken;
  },
  
  async verifyPasswordResetToken(token: string): Promise<number | null> {
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token = $1 AND reset_token_expires > NOW()',
      [token]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0].id;
  },
  
  async resetPasswordWithToken(token: string, newPassword: string): Promise<boolean> {
    const userId = await this.verifyPasswordResetToken(token);
    
    if (!userId) {
      return false;
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    const result = await pool.query(
      'UPDATE users SET password = $1, reset_token = NULL, reset_token_expires = NULL WHERE id = $2',
      [hashedPassword, userId]
    );
    
    return (result.rowCount ?? 0) > 0;
  },
  
  async generateRefreshToken(userId: number, expiresInDays: number = 30): Promise<string> {
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + expiresInDays);
    
    await pool.query(
      'UPDATE users SET refresh_token = $1, refresh_token_expires = $2 WHERE id = $3',
      [refreshToken, expiry, userId]
    );
    
    return refreshToken;
  },
  
  async verifyRefreshToken(userId: number, token: string): Promise<boolean> {
    const result = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND refresh_token = $2 AND refresh_token_expires > NOW()',
      [userId, token]
    );
    
    return result.rows.length > 0;
  },
  
  async invalidateRefreshToken(userId: number): Promise<void> {
    await pool.query(
      'UPDATE users SET refresh_token = NULL, refresh_token_expires = NULL WHERE id = $1',
      [userId]
    );
  }
};