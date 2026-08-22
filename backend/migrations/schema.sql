-- Healthcare Appointment & Follow-up Manager
-- MySQL schema

CREATE DATABASE IF NOT EXISTS healthcare_appointments;
USE healthcare_appointments;

-- ============ USERS ============
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('patient','doctor','admin') NOT NULL DEFAULT 'patient',
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============ DOCTOR PROFILES ============
CREATE TABLE IF NOT EXISTS doctor_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  specialization VARCHAR(150) NOT NULL,
  bio TEXT,
  slot_duration_minutes INT NOT NULL DEFAULT 30,
  -- working_hours JSON example:
  -- {"mon":[{"start":"09:00","end":"13:00"}],"tue":[{"start":"09:00","end":"13:00"}]}
  working_hours JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============ DOCTOR LEAVES ============
CREATE TABLE IF NOT EXISTS doctor_leaves (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  leave_date DATE NOT NULL,
  reason VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_doctor_leave_date (doctor_id, leave_date),
  FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============ SLOTS ============
-- Pre-generated slots per doctor per day. Booking always goes through a slot row,
-- which is what makes double-booking prevention and the hold mechanism possible.
CREATE TABLE IF NOT EXISTS slots (
  id INT AUTO_INCREMENT PRIMARY KEY,
  doctor_id INT NOT NULL,
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('open','held','booked','blocked') NOT NULL DEFAULT 'open',
  held_by_patient_id INT NULL,
  hold_expires_at DATETIME NULL,
  appointment_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_doctor_slot (doctor_id, slot_date, start_time),
  FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (held_by_patient_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============ APPOINTMENTS ============
CREATE TABLE IF NOT EXISTS appointments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  patient_id INT NOT NULL,
  doctor_id INT NOT NULL,
  slot_id INT NOT NULL UNIQUE,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status ENUM('booked','completed','cancelled') NOT NULL DEFAULT 'booked',

  -- Pre-visit
  symptom_text TEXT,
  pre_visit_summary JSON NULL,     -- {urgency_level, chief_complaint, suggested_questions:[]}
  pre_visit_llm_status ENUM('pending','success','failed') DEFAULT 'pending',

  -- Post-visit
  doctor_notes TEXT NULL,
  prescription JSON NULL,          -- [{medicine, dosage, frequency_per_day, duration_days}]
  post_visit_summary TEXT NULL,
  post_visit_llm_status ENUM('pending','success','failed') DEFAULT 'pending',

  -- Calendar
  patient_calendar_event_id VARCHAR(255) NULL,
  doctor_calendar_event_id VARCHAR(255) NULL,

  cancellation_reason VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (doctor_id) REFERENCES doctor_profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (slot_id) REFERENCES slots(id)
) ENGINE=InnoDB;

-- ============ MEDICATION REMINDERS ============
CREATE TABLE IF NOT EXISTS medication_reminders (
  id INT AUTO_INCREMENT PRIMARY KEY,
  appointment_id INT NOT NULL,
  patient_id INT NOT NULL,
  medicine_name VARCHAR(150) NOT NULL,
  dosage VARCHAR(100),
  times_per_day INT NOT NULL DEFAULT 1,
  reminder_times JSON NOT NULL, -- e.g. ["09:00","21:00"]
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_sent_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
  FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============ NOTIFICATIONS (email queue + retry) ============
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  appointment_id INT NULL,
  type ENUM('booking_confirmation','reminder','cancellation','leave_notice','medication_reminder','reschedule') NOT NULL,
  channel ENUM('email') NOT NULL DEFAULT 'email',
  subject VARCHAR(255),
  body TEXT,
  status ENUM('pending','sent','failed') NOT NULL DEFAULT 'pending',
  retry_count INT NOT NULL DEFAULT 0,
  max_retries INT NOT NULL DEFAULT 3,
  last_error TEXT NULL,
  send_after DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============ GOOGLE CALENDAR TOKENS ============
CREATE TABLE IF NOT EXISTS calendar_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  scope VARCHAR(255),
  token_type VARCHAR(50),
  expiry_date BIGINT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE INDEX idx_appointments_doctor_date ON appointments(doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_slots_doctor_date_status ON slots(doctor_id, slot_date, status);
CREATE INDEX idx_notifications_status ON notifications(status, send_after);
