-- Migration: Add icon column to departments table
-- Run this once against your existing Supabase database

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'Building2';

COMMENT ON COLUMN departments.icon IS 'Lucide React icon name, e.g. Building2, HeartPulse, FlaskConical';
