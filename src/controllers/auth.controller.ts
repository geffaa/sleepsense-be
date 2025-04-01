import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { userModel } from '../models/user.model';
import { patientModel } from '../models/patient.model';
import { doctorModel } from '../models/doctor.model';
import { auditLogModel } from '../models/auditlog.model';
import { env } from '../config/env';
import { UserRole } from '../types';
import { SignOptions, Secret, JwtPayload } from 'jsonwebtoken';

// Maximum login attempts before account lockout
const MAX_LOGIN_ATTEMPTS = 5;

export const authController = {
  async register(req: Request, res: Response) {
    try {
      const { email, password, fullName, role } = req.body;
      
      // Validate input
      if (!email || !password || !fullName || !role) {
        return res.status(400).json({ message: 'All fields are required' });
      }
      
      if (role !== 'patient' && role !== 'doctor') {
        return res.status(400).json({ message: 'Invalid role' });
      }
      
      // Password strength validation
      if (password.length < 8) {
        return res.status(400).json({ message: 'Password must be at least 8 characters long' });
      }
      
      // Check for at least one digit and one letter
      if (!/\d/.test(password) || !/[a-zA-Z]/.test(password)) {
        return res.status(400).json({ 
          message: 'Password must contain at least one letter and one number' 
        });
      }
      
      // Check if user already exists
      const existingUser = await userModel.findByEmail(email);
      if (existingUser) {
        return res.status(409).json({ message: 'User already exists' });
      }
      
      // Create user
      const user = await userModel.create(email, password, fullName, role as UserRole);
      
      // Create associated profile
      if (role === 'patient') {
        await patientModel.create(user.id);
      } else if (role === 'doctor') {
        await doctorModel.create(user.id);
      }
      
      // Log the registration
      await auditLogModel.create({
        user_id: user.id,
        action: 'REGISTER',
        table_name: 'users',
        record_id: user.id,
        new_data: { email: user.email, role: user.role },
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || ''
      });
      
      return res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async login(req: Request, res: Response) {
    try {
      const { email, password } = req.body;
      
      // Validate input
      if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
      }
      
      // Find user by email
      const user = await userModel.findByEmail(email);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Check if account is locked
      if (await userModel.isAccountLocked(email)) {
        return res.status(401).json({ 
          message: 'Account is temporarily locked. Please try again later or reset your password.' 
        });
      }
      
      // Compare password
      const isPasswordValid = await userModel.comparePassword(password, user.password);
      if (!isPasswordValid) {
        // Increment login attempts
        await userModel.recordLoginAttempt(email);
        
        // Check if we should lock the account
        const updatedUser = await userModel.findByEmail(email);
        if (updatedUser && updatedUser.login_attempts && updatedUser.login_attempts >= MAX_LOGIN_ATTEMPTS) {
          await userModel.lockAccount(email);
          return res.status(401).json({ 
            message: 'Too many failed login attempts. Account is temporarily locked for 30 minutes.' 
          });
        }
        
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Reset login attempts on successful login
      await userModel.resetLoginAttempts(email);
      
      // Update last login timestamp
      await userModel.updateLoginTimestamp(user.id);
      
      // Generate refresh token
      const refreshToken = await userModel.generateRefreshToken(user.id);

      // Now use it in the sign options
      const signOptions: SignOptions = {
        expiresIn: env.jwt.expiresIn
      };
      
      // With this cleaner approach:
      const token = jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        env.jwt.secret as Secret,
        { expiresIn: env.jwt.expiresIn as any }
      );
      
      // Get additional profile data
      let profileId: number | null = null;
      
      if (user.role === 'patient') {
        const patient = await patientModel.findByUserId(user.id);
        profileId = patient?.id || null;
      } else if (user.role === 'doctor') {
        const doctor = await doctorModel.findByUserId(user.id);
        profileId = doctor?.id || null;
      }
      
      // Log the login
      await auditLogModel.create({
        user_id: user.id,
        action: 'LOGIN',
        table_name: 'users',
        record_id: user.id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || ''
      });
      
      // Set refresh token in HTTP-only cookie (more secure)
      res.cookie('refresh_token', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
      });
      
      return res.status(200).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          profileId
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async me(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      
      const user = await userModel.findById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Get additional profile data
      let profileId: number | null = null;
      let profileData = null;
      
      if (user.role === 'patient') {
        const patient = await patientModel.findByUserId(user.id);
        profileId = patient?.id || null;
        profileData = patient;
      } else if (user.role === 'doctor') {
        const doctor = await doctorModel.findByUserId(user.id);
        profileId = doctor?.id || null;
        profileData = doctor;
      }
      
      return res.status(200).json({
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          profileId,
          profile: profileData,
          lastLogin: user.last_login
        }
      });
    } catch (error) {
      console.error('Get user error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async changePassword(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      const { currentPassword, newPassword } = req.body;
      
      // Validate input
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ message: 'Current password and new password are required' });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long' });
      }
      
      // Check for at least one digit and one letter
      if (!/\d/.test(newPassword) || !/[a-zA-Z]/.test(newPassword)) {
        return res.status(400).json({ 
          message: 'New password must contain at least one letter and one number' 
        });
      }
      
      // Find user
      const user = await userModel.findByEmail((req as any).user.email);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Verify current password
      const isPasswordValid = await userModel.comparePassword(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Current password is incorrect' });
      }
      
      // Change password
      const success = await userModel.changePassword(userId, newPassword);
      
      if (success) {
        // Log the password change
        await auditLogModel.create({
          user_id: userId,
          action: 'PASSWORD_CHANGE',
          table_name: 'users',
          record_id: userId,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] || ''
        });
        
        return res.status(200).json({ message: 'Password changed successfully' });
      } else {
        return res.status(500).json({ message: 'Failed to update password' });
      }
    } catch (error) {
      console.error('Change password error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async requestPasswordReset(req: Request, res: Response) {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: 'Email is required' });
      }
      
      // Check if user exists
      const user = await userModel.findByEmail(email);
      if (!user) {
        // Don't reveal that the user doesn't exist for security reasons
        return res.status(200).json({ 
          message: 'If the email exists in our system, a password reset link will be sent.' 
        });
      }
      
      // Generate reset token
      const resetToken = await userModel.generatePasswordResetToken(email);
      
      if (!resetToken) {
        return res.status(500).json({ message: 'Failed to generate reset token' });
      }
      
      // In a real application, you would send an email with the reset link
      // For this demo, we'll just return the token in the response
      // DO NOT do this in a production environment
      
      // Log the password reset request
      await auditLogModel.create({
        user_id: user.id,
        action: 'PASSWORD_RESET_REQUEST',
        table_name: 'users',
        record_id: user.id,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || ''
      });
      
      // Note: In production, remove the resetToken from the response
      return res.status(200).json({ 
        message: 'If the email exists in our system, a password reset link will be sent.',
        resetToken: resetToken // Remove this in production!
      });
    } catch (error) {
      console.error('Password reset request error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async resetPassword(req: Request, res: Response) {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: 'Token and new password are required' });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: 'New password must be at least 8 characters long' });
      }
      
      // Verify token and reset password
      const success = await userModel.resetPasswordWithToken(token, newPassword);
      
      if (!success) {
        return res.status(400).json({ message: 'Invalid or expired token' });
      }
      
      // Get user ID from token (for audit log)
      const userId = await userModel.verifyPasswordResetToken(token);
      
      if (userId) {
        // Log the password reset
        await auditLogModel.create({
          user_id: userId,
          action: 'PASSWORD_RESET',
          table_name: 'users',
          record_id: userId,
          ip_address: req.ip,
          user_agent: req.headers['user-agent'] || ''
        });
      }
      
      return res.status(200).json({ message: 'Password has been reset successfully' });
    } catch (error) {
      console.error('Password reset error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async logout(req: Request, res: Response) {
    try {
      const userId = (req as any).user.userId;
      
      // Invalidate refresh token
      await userModel.invalidateRefreshToken(userId);
      
      // Clear refresh token cookie
      res.clearCookie('refresh_token');
      
      // Log the logout
      await auditLogModel.create({
        user_id: userId,
        action: 'LOGOUT',
        table_name: 'users',
        record_id: userId,
        ip_address: req.ip,
        user_agent: req.headers['user-agent'] || ''
      });
      
      return res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      console.error('Logout error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  },
  
  async refreshToken(req: Request, res: Response) {
    try {
      const refreshToken = req.cookies.refresh_token;
      
      if (!refreshToken) {
        return res.status(401).json({ message: 'Refresh token is required' });
      }
      
      // Decode the existing access token to get user ID
      // Note: We're using jwt.decode, not verify, as the token might be expired
      const oldToken = req.headers.authorization?.split(' ')[1];
      
      if (!oldToken) {
        return res.status(401).json({ message: 'Access token is required' });
      }
      
      const decoded: any = jwt.decode(oldToken);
      
      if (!decoded || !decoded.userId) {
        return res.status(401).json({ message: 'Invalid access token' });
      }
      
      // Verify the refresh token
      const isValid = await userModel.verifyRefreshToken(decoded.userId, refreshToken);
      
      if (!isValid) {
        return res.status(401).json({ message: 'Invalid or expired refresh token' });
      }

      // Now use it in the sign options
      const signOptions: SignOptions = {
        expiresIn: env.jwt.expiresIn
      };

      const newToken = jwt.sign(
        { userId: decoded.userId, email: decoded.email, role: decoded.role },
        env.jwt.secret as Secret, 
        { expiresIn: env.jwt.expiresIn as any }
      );
      
      return res.status(200).json({ token: newToken });
    } catch (error) {
      console.error('Token refresh error:', error);
      return res.status(500).json({ message: 'Internal server error' });
    }
  }
};