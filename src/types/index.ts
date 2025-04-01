export type UserRole = 'patient' | 'doctor';
export type AnalysisStatus = 'pending' | 'approved' | 'rejected';
export type SeverityLevel = 'mild' | 'moderate' | 'severe';
export type EventType = 'apnea' | 'hypopnea' | 'normal';
export type NotificationType = 'system' | 'analysis' | 'appointment' | 'device';

export interface User {
  id: number;
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  login_attempts?: number;
  locked_until?: Date | null;
  last_login?: Date | null;
  reset_token?: string | null;
  reset_token_expires?: Date | null;
  refresh_token?: string | null;
  refresh_token_expires?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Patient {
  id: number;
  user_id: number;
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  medical_conditions?: string[];
  medications?: string[];
  doctor_id?: number;
  created_at: Date;
  updated_at: Date;
}

export interface Doctor {
  id: number;
  user_id: number;
  specialty?: string;
  license_number?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Device {
  id: number;
  serial_number: string;
  patient_id?: number;
  firmware_version?: string;
  last_sync?: Date;
  battery_level?: number;
  status?: string;
  created_at: Date;
  updated_at: Date;
}

export interface SleepData {
  id: number;
  patient_id: number;
  device_id?: number;
  date: Date;
  start_time: Date;
  end_time?: Date;
  sleep_duration?: number;
  sleep_quality?: number;
  created_at: Date;
  updated_at: Date;
}

export interface SleepAnalysis {
  id: number;
  sleep_data_id: number;
  ahi: number;
  apnea_events: number;
  hypopnea_events: number;
  lowest_oxygen?: number;
  avg_oxygen?: number;
  time_below90?: number;
  severity?: SeverityLevel;
  status: AnalysisStatus;
  doctor_id?: number;
  doctor_notes?: string;
  reviewed_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SleepEvent {
  id: number;
  sleep_data_id: number;
  type: EventType;
  start_time: Date;
  duration: number;
  oxygen_drop?: number;
  severity?: SeverityLevel;
  confidence?: number;
  created_at: Date;
}

export interface SensorData {
  id: number;
  sleep_data_id: number;
  timestamp: Date;
  ecg?: number;
  oxygen?: number;
  thorax?: number;
  breathing?: number;
  heart_rate?: number;
  has_apnea_event: boolean;
  created_at: Date;
}

export interface Notification {
  id: number;
  user_id: number;
  type: NotificationType;
  title: string;
  message: string;
  is_read: boolean;
  created_at: Date;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  action: string;
  table_name: string;
  record_id: number;
  old_data?: any;
  new_data?: any;
  ip_address?: string;
  user_agent?: string;
  created_at: Date;
}